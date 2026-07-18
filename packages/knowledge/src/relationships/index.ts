export type {
  CoMentionOptions,
  LinkEntitiesInput,
  LinkEndpoint,
  LinkResult,
  LinkSource,
  ReinforceOptions,
} from "./types.js";

export { DEFAULT_REINFORCE_STEP } from "./types.js";
export { computeReinforce } from "./reinforce.js";
export { linkEntities } from "./link.js";
export { linkCoMentions } from "./co-mention.js";
