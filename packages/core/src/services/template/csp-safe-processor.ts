/**
 * CSP-safe template processor for browser extensions
 * 
 * This processor provides basic variable substitution without using eval() or Function constructor,
 * making it compatible with strict Content Security Policy (CSP) in browser extensions.
 */

import type { TemplateContext } from './processor';

// Chrome extension API type declaration
declare global {
  const chrome: {
    runtime: {
      getManifest: () => any;
    };
  };
}

/**
 * Simple variable substitution that's CSP-safe
 * Supports basic {{variable}} syntax without complex Handlebars features
 */
export class CSPSafeTemplateProcessor {
  /**
   * Process template content with variable substitution
   * @param content Template content with {{variable}} placeholders
   * @param context Variables to substitute
   * @returns Processed content with variables replaced
   */
  static processContent(content: string, context: TemplateContext): string {
    let result = content;
    
    // Replace all {{variable}} patterns with context values
    result = result.replace(/\{\{([^}]+)\}\}/g, (_, variableName) => {
      const trimmedName = variableName.trim();
      const value = context[trimmedName];
      
      // Return the value if it exists, otherwise return empty string
      return value !== undefined ? String(value) : '';
    });
    
    return result;
  }

  /**
   * Check if we're running in a browser extension environment
   * This is used to determine whether to use CSP-safe processing
   */
  static isExtensionEnvironment(): boolean {
    try {
      // First check if we're in a browser environment
      if (typeof window === 'undefined') {
        return false; // Node.js environment
      }

      // Exclude Electron environments (they can use full Handlebars)
      // Check multiple indicators to safely detect Electron
      if (typeof window !== 'undefined') {
        try {
          // Check for Electron-specific properties
          if (typeof (window as any).require !== 'undefined' ||
              typeof (window as any).electronAPI !== 'undefined' ||
              typeof (window as any).electron !== 'undefined') {
            return false; // Electron environment
          }

          // Check user agent for Electron (fallback)
          if (typeof navigator !== 'undefined' &&
              navigator.userAgent &&
              navigator.userAgent.includes('Electron')) {
            return false; // Electron environment
          }
        } catch (e) {
          // If any Electron detection fails, continue to Chrome extension check
          // This ensures we don't break functionality on other platforms
        }
      }

      // Check for Chrome extension APIs (only after excluding Electron)
      if (typeof chrome !== 'undefined' &&
          typeof chrome.runtime !== 'undefined' &&
          typeof chrome.runtime.getManifest === 'function') {

        // Additional verification: try to call the manifest function
        // This helps distinguish real extensions from mock objects
        try {
          const manifest = chrome.runtime.getManifest();
          return !!(manifest && typeof manifest.manifest_version !== 'undefined');
        } catch (manifestError) {
          // If getManifest fails, it's likely not a real extension
          return false;
        }
      }

      return false;
    } catch (error) {
      // If any error occurs during detection, default to false
      // This ensures other platforms continue to work normally
      return false;
    }
  }

  /**
   * Validate template content for CSP-safe processing
   * This ensures the template only uses supported features
   */
  static validateTemplate(content: string): void {
    // Check for unsupported Handlebars features that won't work with simple replacement
    const unsupportedPatterns = [
      /\{\{#if\s/,           // {{#if condition}}
      /\{\{#each\s/,         // {{#each items}}
      /\{\{#unless\s/,       // {{#unless condition}}
      /\{\{#with\s/,         // {{#with object}}
      /\{\{>\s/,             // {{> partial}}
      /\{\{&\s/,             // {{& unescaped}}
      /\{\{\{/,              // {{{unescaped}}}
    ];

    for (const pattern of unsupportedPatterns) {
      if (pattern.test(content)) {
        console.warn(
          `Template contains unsupported Handlebars features for CSP-safe processing. ` +
          `Complex features like conditionals, loops, and partials are not supported in browser extensions. ` +
          `Only basic variable substitution ({{variable}}) is available.`
        );
        break;
      }
    }
  }
}
