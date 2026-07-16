# Atlas AI — Hardware Profiles

Named device capability profiles that drive model recommendations (Architecture/25).

Related: [Hardware-Detection.md](./Hardware-Detection.md), [Model-Registry.md](./Model-Registry.md), [Architecture/25](../Architecture/25-Model-Management-System.md), [ADR-0027](../adr/0027-hardware-profile-management.md), [`@atlas-ai/ai`](../../packages/ai/).

---

## Profiles

| Id            | Architecture/25 name | Typical host                       | Model guidance  |
| ------------- | -------------------- | ---------------------------------- | --------------- |
| `low`         | Low Resource         | ≈8GB RAM, CPU-only                 | Small quantized |
| `balanced`    | Standard             | ≈16–32GB RAM, GPU when available   | Medium          |
| `performance` | High Performance     | ≈64GB+ and/or strong dedicated GPU | Large           |

Resource categories considered: **cpu**, **memory**, **gpu**, **acceleration**.

---

## CLI

```bash
pnpm atlas ai profiles     # catalog of profiles
pnpm atlas ai hardware     # classify this machine + top recommendations
pnpm atlas ai recommend    # ranked models for the active profile
```

---

## Programmatic

```ts
import {
  detectHardware,
  listResourceProfiles,
  recommendModelsForProfile,
} from "@atlas-ai/ai";

const hardware = detectHardware();
console.log(hardware.profileId, hardware.profile.label);

const recs = recommendModelsForProfile(registry.list(), {
  hardware,
  limit: 5,
});
```

---

## Out of scope

Model Router (task-type routing), auto-download of recommended weights, rewriting `config.ai.hardware`.
