# `@atlas-ai/database`

Local SQLite persistence for Atlas AI runtime data.

```ts
import { openAtlasDatabase } from "@atlas-ai/database";

const db = openAtlasDatabase(); // creates `.data/atlas.sqlite` + schema + seeds
db.systemConfig.set("logging.level", "debug");
db.userPreferences.get("preferred_editor");
db.close();
```

See [docs/guides/Database.md](../../docs/guides/Database.md).
