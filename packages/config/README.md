# `@atlas-ai/config`

Centralized configuration loading for Atlas AI.

## Usage

```ts
import { loadConfig } from "@atlas-ai/config";

const config = loadConfig({ repoRoot: process.cwd() });
console.log(config.env, config.paths.databasePath);
// Secrets: config.secrets.openaiApiKey (from env only)
```

## Commands

```bash
pnpm --filter @atlas-ai/config build
pnpm --filter @atlas-ai/config test:load
```

See [docs/guides/Configuration.md](../../docs/guides/Configuration.md).
