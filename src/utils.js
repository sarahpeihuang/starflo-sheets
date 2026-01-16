// src/utils.js
// Utility functions for StarBar Chrome Extension

// DEBUG: Set to true to simulate Mac on Linux for testing
// In console, run: window.STARBAR_FORCE_MAC = true; location.reload();
let STARBAR_FORCE_MAC = false;

/**
 * Robust Mac platform detection
 * @returns {boolean} True if running on Mac
 */
function isMacPlatform() {
  if (window.STARBAR_FORCE_MAC === true) {
    return true;
  }
  return navigator.platform.includes('Mac') || navigator.userAgent.includes('Mac');
}

/**
 * Check if extension context is still valid
 * @returns {boolean} True if extension context is valid
 */
function isExtensionContextValid() {
  try { 
    return chrome?.runtime?.id; 
  } catch { 
    return false; 
  }
}

/**
 * Safe wrapper for chrome.storage.local.get
 * @param {string} key - Storage key to retrieve
 * @param {Function} callback - Callback function
 */
function safeStorageGet(key, callback) {
  if (!isExtensionContextValid()) return callback({ [key]: [] });
  try { 
    chrome.storage.local.get(key, callback); 
  } catch { 
    callback({ [key]: [] }); 
  }
}

/**
 * Safe wrapper for chrome.storage.local.set
 * @param {Object} data - Data to store
 * @param {Function} callback - Optional callback function
 */
function safeStorageSet(data, callback) {
  if (!isExtensionContextValid()) return callback?.();
  try { 
    chrome.storage.local.set(data, callback); 
  } catch { 
    callback?.(); 
  }
}

/**
 * Safe wrapper for chrome.runtime.getURL
 * @param {string} path - Path to resource
 * @returns {string} Full URL or fallback SVG
 */
function safeGetURL(path) {
  const fallback = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>`;
  if (!isExtensionContextValid()) return fallback;
  try { 
    return chrome.runtime.getURL(path); 
  } catch { 
    return fallback; 
  }
}

/**
 * Clean and normalize text for comparison
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  return (
    text
      ?.replace(/\s+/g, " ")
      .replace(/\u200B/g, "")
      .replace(/[⭐☆]/g, "")
      .replace(/\s*(ctrl|⌘|command|alt|option|shift|⇧)\s*\+.*$/i, "")
      .trim()
      .toLowerCase() || ""
  );
}

/**
 * Get hotkey text for display on buttons
 * @param {number} index - Function index (0-2)
 * @returns {string} Hotkey text like "(⌘⌥Z)" or "(Ctrl+Alt+Z)"
 */
function getHotkeyText(index) {
  const isMac = navigator.platform.includes('Mac');
  const keys = ['Z', 'X', 'S'];
  if (index < 0 || index >= keys.length) return '';
  return isMac ? `(⌘⌥${keys[index]})` : `(Ctrl+Alt+${keys[index]})`;
}

/**
 * Get full hotkey display for tooltips
 * @param {number} index - Function index (0-2)
 * @returns {string} Full hotkey display with alternatives
 */
function getHotkeyDisplay(index) {
  const isMac = navigator.platform.includes('Mac');
  const keys = ['Z', 'X', 'S'];
  if (index < 0 || index >= keys.length) return '';
  return isMac 
    ? `⌘⌥${keys[index]} or ⌥⇧${keys[index]}` 
    : `Ctrl+Alt+${keys[index]} or Alt+Shift+${keys[index]}`;
}

/**
 * Get button label from various attributes
 * @param {HTMLElement} btn - Button element
 * @returns {string} Lowercase label
 */
function getButtonLabel(btn) {
  return (
    btn.getAttribute("aria-label") ||
    btn.getAttribute("data-tooltip") ||
    btn.getAttribute("title") ||
    ""
  ).toLowerCase();
}

/**
 * Check if a button is in active/pressed state
 * @param {HTMLElement} btn - Button element
 * @returns {boolean} True if button is active
 */
function isButtonActive(btn) {
  return btn.getAttribute("aria-pressed") === "true" ||
         btn.classList.contains("goog-toolbar-button-checked") ||
         btn.classList.contains("active") ||
         btn.classList.contains("goog-toolbar-button-selected");
}

// Export functions for use in other modules
window.StarBarUtils = {
  STARBAR_FORCE_MAC,
  isMacPlatform,
  isExtensionContextValid,
  safeStorageGet,
  safeStorageSet,
  safeGetURL,
  cleanText,
  getHotkeyText,
  getHotkeyDisplay,
  getButtonLabel,
  isButtonActive
};
