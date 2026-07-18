/**
 * Shared harness for Phase 3 Memory & Personal Context integration tests.
 * SQLite :memory: + LTM/STM + knowledge + profile + workspace + context providers.
 */
import {
  ContextManager,
  createKnowledgeProvider,
  createMemoryProvider,
} from "@atlas-ai/core";
import { openAtlasDatabase, type AtlasDatabase } from "@atlas-ai/database";
import {
  createKnowledgeGraph,
  createSqliteGraphStore,
  type KnowledgeGraphManager,
} from "@atlas-ai/knowledge";
import {
  createLongTermMemory,
  createMemoryAnalyticsMonitor,
  createPersistentMemoryManager,
  createShortTermMemory,
  createStaticDekProvider,
  MemoryAccessLog,
  type LongTermMemory,
  type MemoryAnalyticsMonitor,
  type MemoryManager,
  type ShortTermMemory,
} from "@atlas-ai/memory";
import { createProfileManager, type ProfileManager } from "@atlas-ai/profile";
import {
  generateAesGcmKey,
  PermissionManager,
  type PermissionCapability,
} from "@atlas-ai/security";
import {
  createWorkspaceManager,
  type WorkspaceManager,
} from "@atlas-ai/workspace";

const DEFAULT_CAPS: PermissionCapability[] = [
  "memory.read",
  "memory.write",
  "memory.delete",
];

export interface MemoryHarnessOptions {
  grantedCapabilities?: Iterable<PermissionCapability>;
  retrieval?: {
    limit?: number;
    minScore?: number;
    recencyHalfLifeMs?: number;
  };
  knowledgeRetrieval?: {
    limit?: number;
    minScore?: number;
    maxDepth?: number;
  };
  shortTerm?: {
    maxEntries?: number;
    ttlMs?: number;
  };
}

export interface MemoryHarness {
  database: AtlasDatabase;
  permissions: PermissionManager;
  memoryAccessLog: MemoryAccessLog;
  analytics: MemoryAnalyticsMonitor;
  memoryManager: MemoryManager;
  longTermMemory: LongTermMemory;
  shortTerm: ShortTermMemory;
  knowledgeGraph: KnowledgeGraphManager;
  profile: ProfileManager;
  workspace: WorkspaceManager;
  contextManager: ContextManager;
  /** Rebuild ContextManager so memory provider picks up active projectId. */
  refreshContext: () => void;
  cleanup: () => void;
}

function buildContextManager(
  longTermMemory: LongTermMemory,
  shortTerm: ShortTermMemory,
  knowledgeGraph: KnowledgeGraphManager,
  profile: ProfileManager,
  workspace: WorkspaceManager,
  options: MemoryHarnessOptions,
): ContextManager {
  const retrieval = options.retrieval ?? {};
  const knowledgeRetrieval = options.knowledgeRetrieval ?? {};
  const activeProjectId = workspace.getActive()?.id;

  return new ContextManager({
    conversationStore: shortTerm.toConversationStore(),
    preferenceStore: profile.asPreferenceStore(),
    projectLoader: () => workspace.getActiveContext(),
    providers: [
      createMemoryProvider(
        longTermMemory.createRetriever({
          limit: retrieval.limit ?? 5,
          minScore: retrieval.minScore ?? 0.15,
          recencyHalfLifeMs: retrieval.recencyHalfLifeMs ?? 2_592_000_000,
          projectId: activeProjectId,
        }),
      ),
      createKnowledgeProvider(
        knowledgeGraph.createRetriever({
          limit: knowledgeRetrieval.limit ?? 8,
          minScore: knowledgeRetrieval.minScore ?? 0.1,
          maxDepth: knowledgeRetrieval.maxDepth ?? 2,
          recencyHalfLifeMs: 2_592_000_000,
        }),
      ),
    ],
  });
}

export function createMemoryHarness(
  options: MemoryHarnessOptions = {},
): MemoryHarness {
  const database = openAtlasDatabase({ path: ":memory:", skipSeed: true });
  const permissions = new PermissionManager({
    grantedCapabilities: options.grantedCapabilities ?? DEFAULT_CAPS,
  });
  const memoryAccessLog = new MemoryAccessLog();
  const analytics = createMemoryAnalyticsMonitor();
  const dek = createStaticDekProvider(generateAesGcmKey());

  const longTermMemory = createLongTermMemory(database.memories, {
    permissions,
    dek,
    accessLog: memoryAccessLog,
    analytics,
  });
  const memoryManager = createPersistentMemoryManager(database.memories);
  const shortTerm = createShortTermMemory({
    maxEntries: options.shortTerm?.maxEntries ?? 20,
    ttlMs: options.shortTerm?.ttlMs ?? 0,
    memoryManager,
  });
  const knowledgeGraph = createKnowledgeGraph(createSqliteGraphStore(database));
  const profile = createProfileManager(database.userPreferences, {
    observations: database.preferenceObservations,
    suggestions: database.preferenceSuggestions,
  });
  const workspace = createWorkspaceManager(
    database.projects,
    database.userPreferences,
  );

  const harness: MemoryHarness = {
    database,
    permissions,
    memoryAccessLog,
    analytics,
    memoryManager,
    longTermMemory,
    shortTerm,
    knowledgeGraph,
    profile,
    workspace,
    contextManager: buildContextManager(
      longTermMemory,
      shortTerm,
      knowledgeGraph,
      profile,
      workspace,
      options,
    ),
    refreshContext() {
      this.contextManager = buildContextManager(
        longTermMemory,
        shortTerm,
        knowledgeGraph,
        profile,
        workspace,
        options,
      );
    },
    cleanup() {
      database.close();
    },
  };

  return harness;
}
