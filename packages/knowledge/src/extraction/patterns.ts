/** Curated technology lexicon (case-insensitive match). */
export const TECHNOLOGY_LEXICON = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Rust",
  "Go",
  "Java",
  "React",
  "Vue",
  "Angular",
  "Svelte",
  "Node.js",
  "Node",
  "Deno",
  "Vite",
  "Webpack",
  "Next.js",
  "NextJS",
  "Tailwind",
  "Tailwind CSS",
  "PostgreSQL",
  "Postgres",
  "SQLite",
  "MongoDB",
  "Redis",
  "Docker",
  "Kubernetes",
  "GraphQL",
  "REST",
  "pnpm",
  "npm",
  "Yarn",
  "Vitest",
  "Jest",
  "ESLint",
  "Prettier",
  "Tauri",
  "Electron",
  "llama.cpp",
  "PyTorch",
  "TensorFlow",
] as const;

/** Common application / editor names. */
export const APPLICATION_LEXICON = [
  "VS Code",
  "Visual Studio Code",
  "Cursor",
  "Slack",
  "Discord",
  "Chrome",
  "Firefox",
  "Safari",
  "Terminal",
  "iTerm",
  "Notion",
  "Figma",
  "GitHub",
  "GitLab",
  "Linear",
  "Spotify",
  "Zoom",
  "Finder",
] as const;

export const PERSON_CUE =
  /\b(?:talked to|spoke with|met|meet|with|ping|email(?:ed)?|call(?:ed)?|message(?:d)?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;

export const PROJECT_CUE =
  /\b(?:project|repo|repository|codebase)\s+([A-Za-z][\w.-]{1,40})\b/gi;

export const WORKING_ON_CUE =
  /\b(?:working on|building|shipping)\s+([A-Z][A-Za-z0-9_-]{1,40})\b/g;

export const COMPANY_SUFFIX =
  /\b([A-Z][A-Za-z0-9&'.-]*(?:\s+[A-Z][A-Za-z0-9&'.-]*){0,2})\s+(?:Inc\.?|Corp\.?|LLC|Ltd\.?|GmbH|Co\.?)\b/g;

export const COMPANY_AT =
  /\b(?:at|for|joined|joining)\s+([A-Z][A-Za-z0-9&'.-]{1,40}(?:\s+[A-Z][A-Za-z0-9&'.-]{1,20})?)\b/g;

export const LOCATION_IN =
  /\b(?:in|near|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})(?:,\s*[A-Z]{2})?\b/g;

export const LOCATION_OFFICE = /\b(?:at the office|at home|remote)\b/gi;

export const FILE_PATH =
  /(?:(?:\/[\w.-]+)+|(?:[A-Za-z]:\\(?:[\w.-]+\\)*[\w.-]+)|(?:[\w.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|rs|go|md|json|yml|yaml|toml|css|html|sql|sh|env)))\b/g;

export const USING_TECH =
  /\b(?:using|built with|with|via)\s+([A-Za-z][\w.+#-]{1,30})\b/gi;

export const OPEN_APP =
  /\b(?:open|opened|opening|launch|launched|in|using)\s+(VS\s*Code|Visual Studio Code|Cursor|Slack|Discord|Chrome|Firefox|Safari|Terminal|iTerm|Notion|Figma|GitHub Desktop|Spotify|Zoom|Finder)\b/gi;

export const NOISE =
  /^(?:hello|hi|hey|thanks|thank you|ok|okay|yes|no|lol|haha|good (?:morning|night)|bye)[.!?]*$/i;
