# Atlas AI — Offline Mode

Run Atlas without internet: local models, local tools, and an explicit offline policy (Architecture/09, NFR-OFFLINE).

Related: [Local-AI-Runtime.md](./Local-AI-Runtime.md), [Configuration.md](./Configuration.md), [Model-Installation.md](./Model-Installation.md), [ADR-0037](../adr/0037-offline-mode.md), [`@atlas-ai/ai`](../../packages/ai/), [`@atlas-ai/config`](../../packages/config/).

---

## Purpose

- Keep **local inference** working with no cloud dependency (`mock` / `llamacpp` on loopback).
- **Block** internet-dependent AI ops when `features.offlineMode` is on (default).
- Make offline policy **visible** via CLI status.
- Document what still needs the network.

---

## Config

| Setting / env                                         | Default | Meaning                                   |
| ----------------------------------------------------- | ------- | ----------------------------------------- |
| `features.offlineMode` / `ATLAS_FEATURE_OFFLINE_MODE` | `true`  | Block URL model install + cloud inference |
| `features.cloudProviders`                             | `false` | Cloud LLMs remain optional and off        |
| `ai.provider`                                         | `mock`  | Works fully offline                       |

Disable offline policy only when you need URL downloads:

```bash
ATLAS_FEATURE_OFFLINE_MODE=false pnpm atlas ai install https://example.com/model.gguf general
```

Loopback (`http://127.0.0.1:8080`) for llama-server is **always** allowed.

---

## CLI

```bash
pnpm atlas ai status    # includes Offline mode block
pnpm atlas ai offline   # offline policy + limitations only
pnpm atlas ai ask "hello"   # mock / local — no internet required
```

Skip the soft DNS probe (status display only):

```bash
ATLAS_OFFLINE_PROBE=0 pnpm atlas ai offline
```

---

## What works offline

- Mock inference (CI / default)
- Local GGUF via llama.cpp on loopback
- Local file model install / register / storage
- Hardware detect, router, runtime, metrics (in-process)
- Mock embeddings / speech foundation ports

---

## Limitations (when offlineMode is on)

- No http(s) model downloads
- No cloud LLM providers
- No external web search / web APIs
- No model marketplace
- Real STT/TTS engines not shipped yet (mocks only)
- No outbound telemetry

---

## API

```ts
import {
  assessOfflineCapability,
  assertNetworkOperationAllowed,
  formatOfflineModeStatus,
} from "@atlas-ai/ai";

const status = assessOfflineCapability({
  offlineMode: true,
  cloudProvidersEnabled: false,
  localInferenceReady: true,
  providerId: "mock",
});
console.log(formatOfflineModeStatus(status));

assertNetworkOperationAllowed(
  "model_install_url",
  { offlineMode: true },
  {
    url: "https://cdn.example.com/m.gguf", // throws offline_blocked
  },
);
```
