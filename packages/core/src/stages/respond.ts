/**
 * Respond stage — delegates to the Response Generation module.
 */
export {
  generateResponse,
  getDefaultResponseGenerator,
  ResponseGenerator,
  setDefaultResponseGenerator,
} from "../response/index.js";
export type {
  GenerateResponseInput,
  PipelineResponse,
  ResponseGeneratorOptions,
  ResponseModality,
} from "../response/types.js";
