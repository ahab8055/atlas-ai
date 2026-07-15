# Atlas AI Documentation

Single entry point for product, architecture, development, and decision records.

## Structure

```
docs/
├── README.md                 ← you are here
├── product/                  # MVP & high-level product/tech planning
├── PRD/                      # Product requirements (numbered)
├── Architecture/             # Technical architecture (numbered 01–25)
├── guides/                   # Day-to-day development guides
└── adr/                      # Architecture Decision Records
```

| Folder                             | Purpose                                                   | Naming                |
| ---------------------------------- | --------------------------------------------------------- | --------------------- |
| [`product/`](./product/)           | Planning overviews that sit above PRD/Architecture detail | `Title-Case.md`       |
| [`PRD/`](./PRD/)                   | Requirements, personas, roadmap                           | `NN-Title.md`         |
| [`Architecture/`](./Architecture/) | System design, APIs, schema, runtime                      | `NN-Title.md`         |
| [`guides/`](./guides/)             | How developers work in this repo                          | `Title-Case.md`       |
| [`adr/`](./adr/)                   | Significant decision history                              | `NNNN-kebab-title.md` |

## Start here

| Role                    | Start with                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------- |
| New contributor         | [guides/Development-Setup.md](./guides/Development-Setup.md)                           |
| Product / MVP scope     | [product/MVP-Plan.md](./product/MVP-Plan.md), [PRD/10-MVP.md](./PRD/10-MVP.md)         |
| Architecture deep-dive  | [Architecture/README.md](./Architecture/README.md)                                     |
| Stack choices           | [product/Technology-Stack-Architecture.md](./product/Technology-Stack-Architecture.md) |
| Recording a decision    | [adr/README.md](./adr/README.md)                                                       |
| Configuration / secrets | [guides/Configuration.md](./guides/Configuration.md)                                   |
| Logging / debugging     | [guides/Logging.md](./guides/Logging.md)                                               |
| Testing                 | [guides/Testing.md](./guides/Testing.md)                                               |
| CI / CD                 | [guides/CI-CD.md](./guides/CI-CD.md)                                                   |
| Desktop shell           | [guides/Desktop-Shell.md](./guides/Desktop-Shell.md)                                   |
| Security baseline       | [guides/Security.md](./guides/Security.md)                                             |
| Request pipeline        | [guides/Request-Pipeline.md](./guides/Request-Pipeline.md)                             |
| Intent detection        | [guides/Intent-Detection.md](./guides/Intent-Detection.md)                             |

## Adding future documents

1. Choose the **correct folder** from the table above (do not leave new long-lived docs loose under `docs/`).
2. Follow that folder’s naming convention and numbering (next free `NN` / `NNNN`).
3. Add a row to that folder’s `README.md` index.
4. Link from this hub if the doc is a common entry point.
5. For structural or technology decisions, add an **ADR** under `adr/`.

## Docs-driven development

Implementation must follow these docs (see `.cursor/rules/docs-driven-implementation.mdc`). Prefer local-first, security-first, modular choices inside MVP scope.
