/**
 * Phase 4 Platform Abstraction — integration tests.
 *
 * Forces darwin / linux / win32 via mock runners so all providers pass on a
 * single CI host. Does not re-assert per-provider CLI arg shapes (unit tests).
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  PLATFORM_IDS,
  PermissionManager,
  PlatformError,
  assertOperatingSystemCompliance,
  assertPlatformCatalog,
  assertPlatformServiceKeyMatrix,
  createEventCollector,
  createPlatformHarness,
  fromUnknown,
  isPlatformError,
  platformIdToOs,
  type PlatformHarness,
} from "./platform-helpers.js";

const active: PlatformHarness[] = [];

function harness(
  ...args: Parameters<typeof createPlatformHarness>
): PlatformHarness {
  const h = createPlatformHarness(...args);
  active.push(h);
  return h;
}

afterEach(() => {
  while (active.length > 0) {
    active.pop()?.cleanup();
  }
});

describe("Phase 4 integration — PLATFORM_EVENTS catalog", () => {
  it("exports the four platform event types from core and platform", () => {
    assertPlatformCatalog();
  });
});

describe.each(PLATFORM_IDS)(
  "Phase 4 integration — platform %s",
  (platformId) => {
    it("loads the forced provider (not host OS)", async () => {
      const h = harness({ platformId, enforceOsPermissions: false });
      const info = h.manager.getServices().info;
      const os = h.registry.getOs();

      expect(h.manager.platformId).toBe(platformId);
      expect(info.id).toBe(platformId);
      expect(info.os).toBe(platformIdToOs(platformId));
      expect(os.system.getPlatform().id).toBe(platformId);
      expect(os.system.getPlatform().os).toBe(platformIdToOs(platformId));

      await os.applications.open(
        platformId === "linux" ? "firefox" : "TextEdit",
      );
      expect(h.runnerCalls.length).toBeGreaterThan(0);
      expect(h.runnerCalls.some((c) => c.command.length > 0)).toBe(true);
    });

    it("registers the full PlatformServiceKey matrix", () => {
      const h = harness({ platformId, enforceOsPermissions: false });
      assertPlatformServiceKeyMatrix(h.registry);
    });

    it("satisfies OperatingSystem interface compliance", () => {
      const h = harness({ platformId, enforceOsPermissions: false });
      assertOperatingSystemCompliance(h.registry.getOs());
    });

    it("smoke: terminal, clipboard, notifications, listRunning via mocks", async () => {
      const h = harness({ platformId, enforceOsPermissions: false });
      const os = h.registry.getOs();

      const term = await os.terminal.execute("echo", ["ok"]);
      expect(term.exitCode === 0 || term.exitCode === null).toBe(true);

      await os.clipboard.writeText("hello");
      expect(await os.clipboard.readText()).toBeTruthy();

      await os.notifications.show({ title: "Atlas", body: "smoke" });

      const running = await os.applications.listRunning();
      expect(Array.isArray(running)).toBe(true);
      expect(running.length).toBeGreaterThan(0);
    });

    it("maps empty open and missing file to PlatformError", async () => {
      const h = harness({ platformId, enforceOsPermissions: false });
      const os = h.registry.getOs();

      try {
        await os.applications.open("");
        expect.fail("expected invalid_input");
      } catch (error) {
        expect(isPlatformError(error)).toBe(true);
        expect((error as PlatformError).code).toBe("invalid_input");
        const atlas = fromUnknown(error);
        expect(atlas.context?.platformCode).toBe("invalid_input");
      }

      const missing =
        platformId === "win32"
          ? "C:\\atlas-missing-platform-int-test.txt"
          : "/tmp/atlas-missing-platform-int-test.txt";
      try {
        os.files.readText(missing);
        expect.fail("expected resource_not_found");
      } catch (error) {
        expect(isPlatformError(error)).toBe(true);
        const pe = error as PlatformError;
        expect(["resource_not_found", "io_error"]).toContain(pe.code);
        expect(pe.detail).toBeDefined();
        const atlas = fromUnknown(error);
        expect(atlas.context?.platformCode).toBe(pe.code);
        expect(atlas.context?.detail).toBeDefined();
      }
    });

    it("publishes PlatformDetected then PlatformServicesStarted", () => {
      const collector = createEventCollector();
      harness({
        platformId,
        enforceOsPermissions: false,
        onPlatformEvent: collector.publisher,
      });

      expect(collector.types()).toEqual([
        "PlatformDetected",
        "PlatformServicesStarted",
      ]);
      expect(collector.events[0]?.payload).toMatchObject({
        platformId,
        os: platformIdToOs(platformId),
      });
      expect(collector.events[1]?.payload).toEqual({
        platformId,
        via: "bootstrap",
      });
    });

    it("emits PermissionDenied without PlatformProviderFailed on broker deny", async () => {
      const collector = createEventCollector();
      const h = harness({
        platformId,
        enforceOsPermissions: true,
        permissionManager: new PermissionManager(),
        onPlatformEvent: collector.publisher,
      });

      await expect(
        h.registry.getOs().applications.open("firefox"),
      ).rejects.toMatchObject({ code: "permission_denied" });
      expect(collector.types()).toContain("PermissionDenied");
      expect(
        collector.events.some((e) => e.type === "PlatformProviderFailed"),
      ).toBe(false);
    });

    it("bridges PlatformProviderFailed to EventBus with detail", async () => {
      const collector = createEventCollector();
      const h = harness({
        platformId,
        enforceOsPermissions: true,
        permissionManager: new PermissionManager({
          grantedCapabilities: ["application.control"],
        }),
        onPlatformEvent: collector.busPublisher,
        runnerHandler: async () => {
          throw new PlatformError("io_error", "spawn failed", {
            detail: { errno: "EIO", syscall: "spawn" },
          });
        },
      });

      await expect(
        h.registry.getOs().applications.open("firefox"),
      ).rejects.toMatchObject({ code: "io_error" });

      const history = collector.bus.getHistory();
      expect(history.map((e) => e.type)).toEqual(
        expect.arrayContaining([
          "PlatformDetected",
          "PlatformServicesStarted",
          "PlatformProviderFailed",
        ]),
      );
      expect(history[0]?.source).toBe("atlas.platform");
      expect(
        history.some(
          (e) =>
            e.type === "PlatformProviderFailed" &&
            (e.payload as { detail?: unknown }).detail !== undefined,
        ),
      ).toBe(true);
    });
  },
);

describe("Phase 4 integration — critical path", () => {
  it("detect → bootstrap → compliance → open → broker deny → event", async () => {
    const collector = createEventCollector();
    const permissions = new PermissionManager();
    const h = harness({
      platformId: "linux",
      enforceOsPermissions: true,
      permissionManager: permissions,
      onPlatformEvent: collector.publisher,
    });

    expect(h.manager.platformId).toBe("linux");
    assertOperatingSystemCompliance(h.registry.getOs());
    assertPlatformServiceKeyMatrix(h.registry);

    await expect(
      h.registry.getOs().applications.open("firefox"),
    ).rejects.toMatchObject({ code: "permission_denied" });

    expect(collector.types()).toEqual([
      "PlatformDetected",
      "PlatformServicesStarted",
      "PermissionDenied",
    ]);

    permissions.grant("application.control");
    await h.registry.getOs().applications.open("firefox");
    expect(h.runnerCalls.some((c) => c.command === "gtk-launch")).toBe(true);
  });
});
