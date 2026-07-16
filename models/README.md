# Local AI models

Place **GGUF** weights under this controlled tree for llama.cpp (`llama-server`). Large binaries are gitignored.

## Directory structure (Architecture/25)

```
models/
├── general/       # chat / reasoning
├── coding/        # code assistants
├── embeddings/    # embedding models
├── speech/        # speech / audio
└── *.gguf         # legacy flat files still supported
```

Run `pnpm atlas ai storage` to ensure folders exist and see usage.

## Expectation

1. Install / build [llama.cpp](https://github.com/ggerganov/llama.cpp) `llama-server`.
2. Drop a `.gguf` into a category (e.g. `models/general/qwen2.5-1.5b.gguf`) or the root.
3. Register / validate:

```bash
pnpm atlas ai register
pnpm atlas ai validate
pnpm atlas ai storage
```

4. Run CPU inference:

```bash
# Manual server (default config: manageServer=false)
llama-server -m ./models/general/qwen2.5-1.5b.gguf --port 8080 -ngl 0

# Or let Atlas spawn the server
# config: ai.llamaCpp.manageServer = true
```

5. Point Atlas at llama.cpp:

```json
"ai": {
  "provider": "llamacpp",
  "endpoint": "http://127.0.0.1:8080",
  "defaultModelId": "general/qwen2.5-1.5b",
  "hardware": { "acceleration": "cpu", "gpuLayers": 0 }
}
```

6. Probe / generate:

```bash
pnpm atlas ai status
pnpm atlas ai load
pnpm atlas ai ask "Hello"
```

Default development provider remains `mock` so CI works without weights.

See [docs/guides/Model-Storage.md](../docs/guides/Model-Storage.md) and [docs/guides/LlamaCpp-Integration.md](../docs/guides/LlamaCpp-Integration.md).
