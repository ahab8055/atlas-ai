import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const config = loadConfig({ repoRoot });

const redacted = {
  ...config,
  secrets: {
    openaiApiKey: config.secrets.openaiApiKey ? "[set]" : undefined,
    anthropicApiKey: config.secrets.anthropicApiKey ? "[set]" : undefined,
  },
};

console.log(JSON.stringify(redacted, null, 2));
