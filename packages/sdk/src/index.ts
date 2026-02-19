// Types
export type { TrustLevel, PermissionId, ToolSummary, AdapterPermissions, AdapterManifest, AdapterStatistics, AdapterSignature } from './types/manifest.js';
export type { SandboxContext, PageAPI, StorageAPI, NotifyAPI, UtilsAPI, NavigateOptions, WaitForOptions, FillOptions, SelectOptions, ClickOptions, WaitForHumanOptions } from './types/sandbox.js';
export type { AdapterModule, AdapterTool, AdapterTool as Tool, ToolInputSchema, ToolResult, ToolSuccess, ToolError, JSONSchemaProperty, JSONSchemaType } from './types/adapter.js';
export type { DeclarativeTool, DeclarativeAdapterConfig, NavigationDef, InputDef, OutputDef, SubmitDef, InputType, OutputType, SelectOption } from './types/declarative.js';
export type { RegistryEntry, RegistryIndex, VerifiedPublisher, VerifiedRegistry, CategoryMeta, PluginCategory } from './types/registry.js';

// Utils
export { validateManifest } from './utils/validate-manifest.js';
export type { ValidationResult, ValidationError } from './utils/validate-manifest.js';
export {
  pluginStorageKey,
  namespacedToolName,
  isUrlAllowed,
  jsonByteSize,
  sanitizeFieldValue,
  formatDuration,
  MAX_STORAGE_BYTES,
} from './utils/selector-helpers.js';
