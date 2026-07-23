export {
  createFileIndexingService,
  type FileIndexingService,
  type FileIndexingServiceOptions,
  type FileIndexSearchOptions,
  type IndexBuildOptions,
  type IndexBuildResult,
  type SemanticIndexSink,
} from "./file-indexer.js";

export {
  __resetFileIndexSearchStoreForTests,
  getFileIndexSearchStore,
  searchIndexedFiles,
  setFileIndexSearchStore,
  type FileIndexSearchStore,
} from "./query-facade.js";
