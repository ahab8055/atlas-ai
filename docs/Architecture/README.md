# Architecture documentation

Numbered technical design docs for Atlas AI. Read with the matching [PRD](../PRD/) and [product](../product/) plans when implementing features.

## Index

| #   | Document                                                          | Topic                  |
| --- | ----------------------------------------------------------------- | ---------------------- |
| 01  | [System Architecture](./01-System-Architecture.md)                | Overall system shape   |
| 02  | [Component Architecture](./02-Component-Architecture.md)          | Internal components    |
| 03  | [Agent System](./03-Agent-System-Architecture.md)                 | Agents                 |
| 04  | [Memory](./04-Memory-Architecture.md)                             | Memory system          |
| 05  | [Tool System](./05-Tool-System-Architecture.md)                   | Tools                  |
| 06  | [Security](./06-Security-Architecture.md)                         | Permissions & security |
| 07  | [Data](./07-Data-Architecture.md)                                 | Data architecture      |
| 08  | [Voice](./08-Voice-System-Architecture.md)                        | Voice I/O              |
| 09  | [Local AI](./09-Local-AI-Architecture.md)                         | Local inference        |
| 10  | [Event System](./10-Event-System-Architecture.md)                 | Events                 |
| 11  | [Desktop Application](./11-Desktop-Application-Architecture.md)   | Desktop shell          |
| 12  | [Plugin System](./12-Plugin-System-Architecture.md)               | Plugins                |
| 13  | [Workflow Automation](./13-Workflow-Automation-Architecture.md)   | Workflows              |
| 14  | [Deployment](./14-Deployment-Architecture.md)                     | Deploy                 |
| 15  | [Monitoring](./15-Monitoring-Architecture.md)                     | Observability          |
| 16  | [Implementation Roadmap](./16-Implementation-Roadmap.md)          | Roadmap                |
| 17  | [Technology Stack](./17-Technology-Stack.md)                      | Stack detail           |
| 18  | [MVP Feature Specification](./18-MVP-Feature-Specification.md)    | MVP features           |
| 19  | [Development Plan](./19-Development-Plan.md)                      | Engineering plan       |
| 20  | [Database Schema](./20-Database-Schema.md)                        | Schema                 |
| 21  | [API Specification](./21-API-Specification.md)                    | APIs                   |
| 22  | [AI Orchestration](./22-AI-Orchestration-Architecture.md)         | Orchestration          |
| 23  | [Knowledge Graph](./23-Knowledge-Graph-Architecture.md)           | Knowledge graph        |
| 24  | [Search and Retrieval](./24-Search-and-Retrieval-Architecture.md) | Search / RAG           |
| 25  | [Model Management](./25-Model-Management-System.md)               | Model lifecycle        |

## Conventions

- Keep numbering **zero-padded** (`01`, `02`, …).
- New architecture docs get the **next number**; do not renumber existing files.
- Cross-link related PRD / product / ADR documents in a “Related documents” section when useful.
- Significant choices that change architecture belong in [`../adr/`](../adr/).

## Related

- [Documentation hub](../README.md)
- [Technology Stack (product overview)](../product/Technology-Stack-Architecture.md)
- [MVP Plan](../product/MVP-Plan.md)
