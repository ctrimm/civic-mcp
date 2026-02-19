/**
 * Content script entry point — injected into every page at document_idle.
 * Delegates to the plugin loader to activate matching adapters.
 */

import { initPluginLoader } from '../core/plugin-loader.js';

initPluginLoader().catch((err) => {
  console.error('[Civic-MCP] Plugin loader failed:', err);
});
