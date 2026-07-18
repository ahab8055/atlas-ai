# Atlas AI

## Technical Architecture Documentation

**Document:** Architecture/20-Database-Schema.md

**Project Name:** Atlas AI (Codename)

**Version:** 0.1 (Draft)

**Status:** Draft

**Author:** Ahab Latif

**Last Updated:** July 15, 2026

---

# Database Schema Architecture

## Purpose

This document defines the database architecture and schema design for Atlas AI.

The database manages:

- User profile.
- Conversations.
- Memory.
- Tasks.
- Workflows.
- Plugins.
- Permissions.
- System events.
- Logs.

---

# Database Philosophy

Atlas follows a local-first database approach.

```
User Device

↓

Local Database

↓

Atlas Runtime

↓

AI Intelligence

```

The user's information remains under their control.

---

# Database Technology

## Primary Database

Recommended:

```
SQLite

```

---

## Why SQLite?

Advantages:

- Local.
- Reliable.
- Lightweight.
- Zero configuration.
- Portable.
- Fast.

---

# Additional Storage

For semantic memory:

```
SQLite

+

Vector Extension

```

---

# Database Architecture Overview

```
                 Atlas Database

                       |

 ------------------------------------------------

 |          |           |          |             |

Users   Memory   Conversations  Tasks   System Data

                       |

                Vector Storage

```

---

# Database Naming Convention

Tables:

```
snake_case

plural names

```

Examples:

```
users

memories

tasks

plugins

```

---

# Core Tables

---

# 1. users

## Purpose

Stores local user information.

---

## Schema

```
users

id
uuid
name
email
avatar
created_at
updated_at

```

---

## Example

```
id:
1

name:
Ahab

created_at:
2026-07-15

```

---

# 2. user_preferences

## Purpose

Stores personalization settings.

---

## Schema

```
user_preferences

id

user_id

key

value

category

created_at

updated_at

```

---

## Examples

```
theme:
dark

preferred_language:
English

coding_language:
TypeScript

```

---

# 3. conversations

## Purpose

Stores chat sessions.

---

## Schema

```
conversations

id

user_id

title

model_used

created_at

updated_at

```

---

# 4. messages

## Purpose

Stores conversation messages.

---

## Schema

```
messages

id

conversation_id

role

content

tokens

created_at

```

---

# Roles

Possible:

```
user

assistant

system

tool

```

---

# Example

```
role:
assistant

content:
"I opened VS Code."

```

---

# 5. Memories

## Purpose

Stores long-term knowledge.

---

# Schema

```
memories

id

user_id

type

content

importance

embedding

source

created_at

updated_at

```

---

# Memory Types

```
preference

fact

project

habit

instruction

context

```

---

# Example

```
type:

preference


content:

User prefers TypeScript.

```

---

# 5b. Knowledge Graph Entities

## Purpose

Stores knowledge graph nodes (Architecture/23).

---

# Schema

```
entities

id

user_id

type

name

properties

created_at

updated_at

UNIQUE (user_id, type, name)

```

Known types: `project`, `person`, `technology`, `file`, `concept`, `location`,
`preference` (custom strings allowed).

---

# 5c. Knowledge Graph Relationships

## Purpose

Stores directed edges between entities.

---

# Schema

```
relationships

id

user_id

from_entity_id

to_entity_id

type

weight

properties

created_at

updated_at

UNIQUE (user_id, from_entity_id, to_entity_id, type)

FOREIGN KEY from_entity_id / to_entity_id → entities(id) ON DELETE CASCADE

```

Known types: `part_of`, `depends_on`, `uses`, `related_to`, `located_at`,
`prefers` (custom strings allowed).

---

# 6. Memory Tags

## Purpose

Categorizes memories.

---

Schema:

```
memory_tags

id

memory_id

tag

```

---

Example:

```
coding

workflow

personal

```

---

# 7. Tasks

## Purpose

Stores Atlas tasks.

---

Schema:

```
tasks

id

user_id

title

description

status

priority

created_at

completed_at

```

---

# Task Status

```
pending

running

completed

failed

cancelled

```

---

# 8. Task Executions

## Purpose

Tracks task execution history.

---

Schema:

```
task_executions

id

task_id

step

status

result

error

started_at

completed_at

```

---

# 9. Workflows

## Purpose

Stores automation workflows.

---

Schema:

```
workflows

id

user_id

name

description

trigger_type

configuration

status

created_at

updated_at

```

---

# Workflow Status

```
draft

active

paused

disabled

```

---

# 10. Workflow Steps

## Purpose

Stores workflow actions.

---

Schema:

```
workflow_steps

id

workflow_id

order_number

action_type

configuration

created_at

```

---

# Example

```
Step 1:

Open VS Code


Step 2:

Start Backend

```

---

# 11. Workflow Executions

## Purpose

Tracks workflow runs.

---

Schema:

```
workflow_executions

id

workflow_id

status

started_at

completed_at

result

```

---

# 12. Plugins

## Purpose

Stores installed plugins.

---

Schema:

```
plugins

id

name

version

author

status

permissions

configuration

installed_at

updated_at

```

---

# Plugin Status

```
installed

enabled

disabled

failed

```

---

# 13. Plugin Permissions

## Purpose

Stores plugin access rules.

---

Schema:

```
plugin_permissions

id

plugin_id

permission

approved

created_at

```

---

# Examples

```
filesystem.read

network.access

terminal.execute

```

---

# 14. Tools

## Purpose

Stores available Atlas tools.

---

Schema:

```
tools

id

name

description

type

enabled

configuration

```

---

# Example

```
name:

file_search


type:

system

```

---

# 15. Permissions

## Purpose

Stores user-approved capabilities.

---

Schema:

```
permissions

id

user_id

resource

action

status

created_at

```

---

# Examples

```
resource:

documents


action:

read

```

---

# 16. Events

## Purpose

Stores important system events.

---

Schema:

```
events

id

event_type

source

payload

created_at

```

---

# Event Examples

```
TaskCompleted

PermissionGranted

PluginInstalled

```

---

# 17. Logs

## Purpose

Stores system logs.

---

Schema:

```
logs

id

level

service

message

metadata

created_at

```

---

# Log Levels

```
debug

info

warning

error

critical

```

---

# 18. Models

## Purpose

Stores installed AI models.

---

Schema:

```
models

id

name

provider

version

size

location

status

created_at

```

---

# Example

```
name:

Llama 7B

status:

active

```

---

# 19. Active Sessions

## Purpose

Tracks running Atlas sessions.

---

Schema:

```
sessions

id

device_id

started_at

last_activity

status

```

---

# 20. System Configuration

## Purpose

Stores runtime settings.

---

Schema:

```
system_config

id

key

value

updated_at

```

---

# Database Relationships

```
User

 |

 |---- Conversations

 |

 |---- Memories

 |

 |---- Tasks

 |

 |---- Workflows

 |

 |---- Permissions


Workflow

 |

 |---- Workflow Steps

 |

 |---- Executions


Plugin

 |

 |---- Permissions

```

---

# Vector Memory Architecture

## Purpose

Enable semantic retrieval.

---

Flow:

```
Memory Created

↓

Generate Embedding

↓

Store Vector

↓

Similarity Search

↓

Retrieve Context

```

---

# Memory Retrieval Example

User:

> "What coding setup do I use?"

Atlas searches:

```
memory_vectors

↓

Find relevant memories

↓

Inject context

↓

Generate response

```

---

# Database Indexing

Important indexes:

---

## Messages

Index:

```
conversation_id

created_at

```

---

## Memories

Index:

```
user_id

type

importance

```

---

## Tasks

Index:

```
status

created_at

```

---

## Events

Index:

```
event_type

created_at

```

---

# Database Migration Strategy

Use versioned migrations.

Example:

```
migration_001

migration_002

migration_003

```

---

# Backup Strategy

Backup:

- Database.
- Vector storage.
- Configuration.

---

# Export Format

Future:

```
Atlas Backup File

.atlasbackup

```

Contains:

- Memories.
- Settings.
- Workflows.
- Plugins.

---

# Database Security

Requirements:

- Encryption at rest.
- Secure keys.
- Access control.

---

# Performance Requirements

Database operations:

Target:

```
<100ms

```

---

Memory search:

Target:

```
<500ms

```

---

# MVP Database Scope

Initial tables:

```
users

preferences

conversations

messages

memories

tasks

permissions

logs

models

```

---

# Future Database Expansion

Add:

- Multi-device sync.
- Enterprise users.
- Shared workspaces.
- Advanced analytics.

Knowledge graph tables (`entities`, `relationships`) ship at schema version 6 —
see [Architecture/23](./23-Knowledge-Graph-Architecture.md) and
[Knowledge-Graph.md](../guides/Knowledge-Graph.md).

---

# Related Documents

Previous:

- `Architecture/19-Development-Plan.md`

Next:

- `Architecture/21-API-Specification.md`
- `Architecture/22-Agent-System-Architecture.md`
- `Architecture/23-Security-Architecture.md`

---

# Conclusion

The Atlas database architecture provides the foundation for personalization, memory, automation, and system intelligence.

By keeping data local and structured, Atlas can become a truly personal AI assistant that understands the user's environment while preserving privacy and control.
