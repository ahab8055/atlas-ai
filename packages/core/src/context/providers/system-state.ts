import type { ContextContribution, ContextProvider } from "../types.js";

export function createSystemStateProvider(): ContextProvider {
  return {
    id: "system",
    load({ request }) {
      return {
        source: "system",
        systemState: {
          runtime: "atlas-core",
          source: request.source,
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.versions.node,
          collectedAt: new Date().toISOString(),
        },
      } satisfies ContextContribution;
    },
  };
}
