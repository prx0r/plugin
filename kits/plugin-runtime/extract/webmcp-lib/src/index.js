export { discoverFunctions } from "./discovery.js";
export {
  extractJSDoc,
  extractParameters,
  extractParamNames,
} from "./parser.js";
export { generateSchema, normalizeInferredSchema } from "./schema-generator.js";
export { inferWithAI } from "./ai-fallback.js";
export { exposeToWebMCP, unregisterTools } from "./webmcp-binder.js";
