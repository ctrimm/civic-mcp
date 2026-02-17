// Civic-MCP Core - Plugin Loader Reference Implementation
// This demonstrates how the plugin marketplace would actually work

class CivicMCPPluginSystem {
  constructor() {
    this.plugins = new Map();
    this.registry = null;
    this.sandbox = new PluginSandbox();
  }

  /**
   * Initialize the plugin system
   * Loads enabled plugins from storage
   */
  async init() {
    console.log('[CivicMCPHub] Initializing plugin system...');
    
    // Load registry from GitHub
    this.registry = await this.fetchRegistry();
    
    // Load user's installed plugins
    const installed = await this.getInstalledPlugins();
    
    // Load each enabled plugin
    for (const pluginId of installed) {
      if (await this.isPluginEnabled(pluginId)) {
        await this.loadPlugin(pluginId);
      }
    }
    
    console.log(`[CivicMCPHub] Loaded ${this.plugins.size} plugins`);
  }

  /**
   * Fetch plugin registry from GitHub
   */
  async fetchRegistry() {
    const response = await fetch(
      'https://raw.githubusercontent.com/CivicMCP/plugin-registry/main/registry.json'
    );
    return await response.json();
  }

  /**
   * Load a specific plugin
   */
  async loadPlugin(pluginId) {
    try {
      console.log(`[CivicMCPHub] Loading plugin: ${pluginId}`);
      
      // Get plugin manifest
      const manifest = await this.fetchPluginManifest(pluginId);
      
      // Check if plugin should run on this domain
      if (!this.shouldRunOnDomain(manifest.domains)) {
        return;
      }
      
      // Check permissions
      const hasPermissions = await this.checkPermissions(manifest.permissions);
      if (!hasPermissions) {
        console.warn(`[CivicMCPHub] Plugin ${pluginId} missing permissions`);
        return;
      }
      
      // Determine plugin type
      if (manifest.declarative) {
        await this.loadDeclarativePlugin(pluginId, manifest);
      } else {
        await this.loadJavaScriptPlugin(pluginId, manifest);
      }
      
      this.plugins.set(pluginId, {
        manifest,
        loaded: true,
        toolCount: manifest.tools.length
      });
      
      console.log(`[CivicMCPHub] ✓ Plugin ${pluginId} loaded (${manifest.tools.length} tools)`);
      
    } catch (error) {
      console.error(`[CivicMCPHub] Failed to load plugin ${pluginId}:`, error);
      
      // Report error to user
      this.notifyError(pluginId, error.message);
    }
  }

  /**
   * Load declarative (JSON-only) plugin
   * These are safer and don't require JavaScript execution
   */
  async loadDeclarativePlugin(pluginId, manifest) {
    for (const toolDef of manifest.tools) {
      const tool = this.buildDeclarativeTool(pluginId, toolDef);
      await this.registerTool(pluginId, tool);
    }
  }

  /**
   * Build a WebMCP tool from declarative definition
   */
  buildDeclarativeTool(pluginId, toolDef) {
    return {
      name: `${pluginId}.${toolDef.name}`,
      description: toolDef.description,
      inputSchema: this.buildInputSchema(toolDef.inputs),
      
      execute: async (params) => {
        try {
          // Navigate if needed
          if (toolDef.navigation) {
            await this.navigate(toolDef.navigation.url);
            if (toolDef.navigation.waitForSelector) {
              await this.waitForSelector(toolDef.navigation.waitForSelector);
            }
          }
          
          // Fill inputs
          for (const [key, value] of Object.entries(params)) {
            const inputDef = toolDef.inputs[key];
            if (inputDef) {
              await this.fillField(inputDef.selector, value, inputDef.type);
            }
          }
          
          // Submit if defined
          if (toolDef.submit) {
            await this.click(toolDef.submit.selector);
            
            // Wait for results
            if (toolDef.submit.waitForSelector) {
              await this.waitForSelector(toolDef.submit.waitForSelector);
            }
          }
          
          // Extract outputs
          const result = {};
          for (const [key, outputDef] of Object.entries(toolDef.output)) {
            result[key] = await this.extractValue(outputDef.selector, outputDef.type);
          }
          
          return {
            success: true,
            ...result
          };
          
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  /**
   * Load JavaScript plugin (requires sandboxing)
   */
  async loadJavaScriptPlugin(pluginId, manifest) {
    // Fetch plugin code
    const code = await this.fetchPluginCode(pluginId, manifest.version);
    
    // Verify signature for verified plugins
    if (manifest.verified) {
      const isValid = await this.verifySignature(code, manifest.signature);
      if (!isValid) {
        throw new Error('Plugin signature verification failed');
      }
    }
    
    // Create sandbox context
    const context = this.sandbox.createContext(pluginId, manifest);
    
    // Execute plugin code in sandbox
    const plugin = await this.sandbox.execute(code, context);
    
    // Initialize plugin
    if (plugin.init) {
      await plugin.init(context);
    }
    
    // Register tools
    for (const toolDef of plugin.tools) {
      const wrappedTool = this.wrapPluginTool(pluginId, toolDef, context);
      await this.registerTool(pluginId, wrappedTool);
    }
  }

  /**
   * Wrap plugin tool with security context
   */
  wrapPluginTool(pluginId, toolDef, context) {
    return {
      name: `${pluginId}.${toolDef.name}`,
      description: toolDef.description,
      inputSchema: toolDef.inputSchema,
      
      execute: async (params) => {
        // Validate inputs against schema
        const isValid = this.validateInputs(params, toolDef.inputSchema);
        if (!isValid) {
          return {
            success: false,
            error: 'Invalid input parameters'
          };
        }
        
        // Execute with sandboxed context
        try {
          const result = await toolDef.execute(params, context);
          
          // Log execution (opt-in telemetry)
          if (await this.isTelemetryEnabled()) {
            this.logToolExecution(pluginId, toolDef.name, true);
          }
          
          return result;
          
        } catch (error) {
          console.error(`[CivicMCPHub] Tool execution failed:`, error);
          
          // Log error
          this.logToolExecution(pluginId, toolDef.name, false, error);
          
          return {
            success: false,
            error: error.message
          };
        }
      }
    };
  }

  /**
   * Register tool with WebMCP
   */
  async registerTool(pluginId, tool) {
    if (!navigator.modelContext) {
      console.warn('[CivicMCPHub] WebMCP not available');
      return;
    }
    
    try {
      await navigator.modelContext.registerTool(tool);
      console.log(`[CivicMCPHub] Registered tool: ${tool.name}`);
    } catch (error) {
      console.error(`[CivicMCPHub] Failed to register tool ${tool.name}:`, error);
    }
  }

  /**
   * Check if plugin should run on current domain
   */
  shouldRunOnDomain(domains) {
    const currentDomain = window.location.hostname;
    return domains.some(domain => {
      // Support wildcards: *.example.com
      if (domain.startsWith('*.')) {
        const baseDomain = domain.slice(2);
        return currentDomain.endsWith(baseDomain);
      }
      return currentDomain === domain;
    });
  }

  /**
   * Get installed plugins from storage
   */
  async getInstalledPlugins() {
    const result = await chrome.storage.local.get('installedPlugins');
    return result.installedPlugins || [];
  }

  /**
   * Check if plugin is enabled
   */
  async isPluginEnabled(pluginId) {
    const result = await chrome.storage.local.get(`plugin_${pluginId}_enabled`);
    return result[`plugin_${pluginId}_enabled`] !== false; // enabled by default
  }

  // Helper methods for declarative plugins

  async navigate(url) {
    if (window.location.href !== url) {
      window.location.href = url;
      // Wait for navigation
      await new Promise(resolve => {
        window.addEventListener('load', resolve, { once: true });
      });
    }
  }

  async waitForSelector(selector, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timeout waiting for selector: ${selector}`);
  }

  async fillField(selector, value, type = 'text') {
    const element = await this.waitForSelector(selector);
    
    switch (type) {
      case 'number':
        element.value = parseFloat(value);
        break;
      case 'checkbox':
        element.checked = Boolean(value);
        break;
      case 'select':
        element.value = value;
        break;
      default:
        element.value = String(value);
    }
    
    // Trigger events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  async click(selector) {
    const element = await this.waitForSelector(selector);
    element.click();
  }

  async extractValue(selector, type = 'text') {
    const element = await this.waitForSelector(selector);
    
    switch (type) {
      case 'boolean':
        return element.textContent.toLowerCase().includes('yes') ||
               element.textContent.toLowerCase().includes('eligible');
      case 'number':
        const match = element.textContent.match(/[\d,]+\.?\d*/);
        return match ? parseFloat(match[0].replace(/,/g, '')) : null;
      default:
        return element.textContent.trim();
    }
  }
}

/**
 * Plugin Sandbox
 * Provides isolated execution environment for plugin code
 */
class PluginSandbox {
  createContext(pluginId, manifest) {
    return {
      pluginId,
      manifest,
      
      // Safe page interaction API
      page: {
        navigate: async (url) => {
          // Whitelist check
          if (!this.isUrlAllowed(url, manifest.domains)) {
            throw new Error('Navigation to this URL is not permitted');
          }
          window.location.href = url;
        },
        
        fillField: async (selector, value) => {
          const element = document.querySelector(selector);
          if (!element) throw new Error(`Element not found: ${selector}`);
          
          element.value = value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        },
        
        click: async (selector) => {
          const element = document.querySelector(selector);
          if (!element) throw new Error(`Element not found: ${selector}`);
          element.click();
        },
        
        getText: async (selector) => {
          const element = document.querySelector(selector);
          if (!element) throw new Error(`Element not found: ${selector}`);
          return element.textContent.trim();
        },
        
        waitForSelector: async (selector, timeout = 5000) => {
          const startTime = Date.now();
          while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element) return true;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          throw new Error(`Timeout waiting for: ${selector}`);
        }
      },
      
      // Scoped storage API
      storage: {
        get: async (key) => {
          const storageKey = `plugin_${pluginId}_${key}`;
          const result = await chrome.storage.local.get(storageKey);
          return result[storageKey];
        },
        
        set: async (key, value) => {
          const storageKey = `plugin_${pluginId}_${key}`;
          
          // Size limit: 100KB per key
          const serialized = JSON.stringify(value);
          if (serialized.length > 100000) {
            throw new Error('Storage value too large (max 100KB)');
          }
          
          await chrome.storage.local.set({ [storageKey]: value });
        },
        
        delete: async (key) => {
          const storageKey = `plugin_${pluginId}_${key}`;
          await chrome.storage.local.remove(storageKey);
        }
      },
      
      // User notifications
      notify: {
        info: (message) => {
          this.showNotification(pluginId, 'info', message);
        },
        warn: (message) => {
          this.showNotification(pluginId, 'warning', message);
        },
        error: (message) => {
          this.showNotification(pluginId, 'error', message);
        }
      },
      
      // Utility functions
      utils: {
        sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        
        parseDate: (dateStr) => new Date(dateStr),
        
        formatCurrency: (amount) => {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
          }).format(amount);
        }
      }
    };
  }

  isUrlAllowed(url, allowedDomains) {
    try {
      const urlObj = new URL(url);
      return allowedDomains.some(domain => {
        if (domain.startsWith('*.')) {
          return urlObj.hostname.endsWith(domain.slice(2));
        }
        return urlObj.hostname === domain;
      });
    } catch {
      return false;
    }
  }

  showNotification(pluginId, type, message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      background: ${type === 'error' ? '#fee2e2' : type === 'warning' ? '#fef3c7' : '#dbeafe'};
      color: ${type === 'error' ? '#991b1b' : type === 'warning' ? '#92400e' : '#1e40af'};
      z-index: 10000;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      font-family: system-ui;
      font-size: 14px;
    `;
    notification.textContent = `[${pluginId}] ${message}`;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 5000);
  }

  async execute(code, context) {
    // This is simplified - real implementation would use isolated contexts
    // Consider using iframe sandboxing or worker threads for production
    
    try {
      // Create function from code
      const fn = new Function('context', `
        'use strict';
        ${code}
        return (typeof exports !== 'undefined') ? exports : {};
      `);
      
      // Execute and return plugin object
      return fn(context);
      
    } catch (error) {
      console.error('[Sandbox] Plugin execution failed:', error);
      throw new Error(`Plugin execution failed: ${error.message}`);
    }
  }
}

// Initialize plugin system when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCivicMCPHub);
} else {
  initCivicMCPHub();
}

async function initCivicMCPHub() {
  const pluginSystem = new CivicMCPPluginSystem();
  await pluginSystem.init();
  
  // Make available globally for debugging
  window.CivicMCPHub = pluginSystem;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CivicMCPPluginSystem, PluginSandbox };
}
