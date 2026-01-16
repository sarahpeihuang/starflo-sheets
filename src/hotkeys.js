// src/hotkeys.js
// Hotkey functionality for StarBar Chrome Extension
// Hotkeys:
//   • Ctrl+Alt+Z/X/S (Win/Linux) / Cmd+Option+Z/X/S (Mac) for functions 1-3 [PRIMARY]
//   • Alt+Shift+Z/X/S (⌥⇧Z/X/S on Mac) for functions 1-3 [FALLBACK]
//   • Ctrl+1 triggers the oldest (first) saved function (legacy support)

// Helper accessors - these access globals after they're defined
function _isMacPlatform() { return window.StarBarUtils.isMacPlatform(); }
function _safeStorageGet(key, cb) { return window.StarBarUtils.safeStorageGet(key, cb); }
function _triggerMenuPath(path) { return window.StarBarMenu.triggerMenuPath(path); }

/**
 * Show visual feedback when a hotkey is pressed
 * @param {string} message - Message to display
 */
function showHotkeyFeedback(message) {
  // Remove any existing feedback
  const existingFeedback = document.getElementById('starbar-hotkey-feedback');
  if (existingFeedback) {
    existingFeedback.remove();
  }
  
  // Create feedback element
  const feedback = document.createElement('div');
  feedback.id = 'starbar-hotkey-feedback';
  feedback.textContent = message;
  feedback.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 10001;
    pointer-events: none;
    opacity: 1;
    transition: opacity 0.3s ease;
  `;
  
  document.body.appendChild(feedback);
  
  // Fade out and remove after 2 seconds
  setTimeout(() => {
    feedback.style.opacity = '0';
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 300);
  }, 2000);
}

/**
 * Execute hotkey action for a function index
 * @param {number} functionIndex - Index of function to execute (0-2)
 * @param {string} hotkeyDisplay - Display string for the hotkey
 */
function executeHotkeyAction(functionIndex, hotkeyDisplay) {
  // Get the pinned functions
  _safeStorageGet("pinnedFunctions", (data) => {
    const buttons = data.pinnedFunctions || [];
    if (buttons.length === 0) {
      showHotkeyFeedback(`${hotkeyDisplay}: No functions saved`);
      return;
    }
    
    if (functionIndex >= buttons.length) {
      showHotkeyFeedback(`${hotkeyDisplay}: Function ${functionIndex + 1} not available`);
      return;
    }
    
    const functionPath = buttons[functionIndex];
    // Show a brief visual feedback
    showHotkeyFeedback(`${hotkeyDisplay}: ${functionPath.split(" > ").pop()}`);
    
    // Trigger the function with a slight delay to ensure UI is ready
    setTimeout(() => {
      _triggerMenuPath(functionPath);
    }, 50);
  });
}

/**
 * Check if user is typing in an input field
 * @returns {boolean} True if in input field
 */
function isInInputField() {
  const activeElement = document.activeElement;
  return activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.contentEditable === 'true' ||
    activeElement.isContentEditable ||
    // Google Sheets specific elements
    activeElement.classList?.contains('cell-input') ||
    activeElement.classList?.contains('waffle-name-box-input') ||
    activeElement.id === 'waffle-name-box' ||
    // Check if we're in formula bar
    activeElement.closest('.docs-formula-bar') ||
    // Check if we're in any Google Sheets input context
    activeElement.closest('[contenteditable="true"]') ||
    activeElement.closest('[role="textbox"]')
  );
}

/**
 * Setup primary hotkey listeners
 * Hotkeys: Ctrl+Alt+Z/X/S (Win/Linux) / Cmd+Option+Z/X/S (Mac)
 * Fallback: Alt+Shift+Z/X/S
 * Legacy: Ctrl+1
 */
function setupHotkeys() {
  // Mac detection - declare once at function scope
  const isMac = _isMacPlatform();
  
  // Use capture phase to intercept events before Google Sheets can handle them
  document.addEventListener("keydown", (e) => {
    // Check for input/editable elements in Google Sheets
    if (isInInputField()) {
      return;
    }
    
    // Don't trigger if view-only
    if (window.StarBarQuickbar?.isViewOnlySheet) return;
    
    let isHotkeyPressed = false;
    let functionIndex = -1;
    let hotkeyDisplay = "";
    
    // Check for Ctrl+1 (original hotkey - legacy support)
    if (e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && e.key === '1') {
      isHotkeyPressed = true;
      functionIndex = 0;
      hotkeyDisplay = "Ctrl+1";
    }
    
    // Try Ctrl+Alt+Z/X/S as primary hotkeys on Windows/Linux, Cmd+Option+Z/X/S on Mac
    const isPrimaryHotkey = isMac ? 
      (e.metaKey && e.altKey && !e.shiftKey && !e.ctrlKey) : 
      (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey);
    
    if (isPrimaryHotkey) {
      // On Mac, Cmd+Option can produce special characters, so check e.code instead of e.key
      const keyCode = e.code.toLowerCase();
      const keyChar = e.key.toLowerCase();
      
      // Only process if we have a valid letter key (not just modifier keys)
      if (keyCode.startsWith('key') || ['z', 'x', 's', 'ω', '≈', 'ß'].includes(keyChar)) {
        // Check both e.key and e.code for compatibility
        if (keyCode === 'keyz' || keyChar === 'z' || keyChar === 'ω') {
          isHotkeyPressed = true;
          functionIndex = 0;
          hotkeyDisplay = isMac ? "⌘⌥Z" : "Ctrl+Alt+Z";
        } else if (keyCode === 'keyx' || keyChar === 'x' || keyChar === '≈') {
          isHotkeyPressed = true;
          functionIndex = 1;
          hotkeyDisplay = isMac ? "⌘⌥X" : "Ctrl+Alt+X";
        } else if (keyCode === 'keys' || keyChar === 's' || keyChar === 'ß') {
          isHotkeyPressed = true;
          functionIndex = 2;
          hotkeyDisplay = isMac ? "⌘⌥S" : "Ctrl+Alt+S";
        }
      }
    }
    
    // Fallback: Try Alt+Shift+Z/X/S (original requested hotkeys)
    const isAltShift = (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey);
    
    if (isAltShift && !isHotkeyPressed) {
      const keyCode = e.code.toLowerCase();
      const keyChar = e.key.toLowerCase();
      
      if (keyCode === 'keyz' || keyChar === 'z') {
        isHotkeyPressed = true;
        functionIndex = 0;
        hotkeyDisplay = isMac ? "⌥⇧Z" : "Alt+Shift+Z";
      } else if (keyCode === 'keyx' || keyChar === 'x') {
        isHotkeyPressed = true;
        functionIndex = 1;
        hotkeyDisplay = isMac ? "⌥⇧X" : "Alt+Shift+X";
      } else if (keyCode === 'keys' || keyChar === 's') {
        isHotkeyPressed = true;
        functionIndex = 2;
        hotkeyDisplay = isMac ? "⌥⇧S" : "Alt+Shift+S";
      }
    }
    
    // If a hotkey was pressed, handle it immediately
    if (isHotkeyPressed) {
      // More aggressive prevention for Mac to override system shortcuts
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      // Additional Mac-specific prevention
      if (isMac) {
        // Try to prevent any default Mac behavior
        if (e.cancelable) {
          e.preventDefault();
        }
      }
      // Execute immediately without waiting for storage
      executeHotkeyAction(functionIndex, hotkeyDisplay);
      
      return false; // Additional prevention
    }
  }, true); // Use capture phase to intercept before Google Sheets handles the event
  
  // Show a brief notification that hotkeys are ready
  setTimeout(() => {
    const hotkeyText = isMac ? "⌘⌥Z/X/S" : "Ctrl+Alt+Z/X/S";
    showHotkeyFeedback(`StarBar hotkeys ready! Press ${hotkeyText}`);
  }, 1000);
}

/**
 * Alternative hotkey system using document.addEventListener with different options
 * Adds listeners to window and body as well for better interception
 */
function setupAlternativeHotkeys() {
  // Add event listener to window as well as document
  const handleKeyEvent = (e) => {
    // Don't trigger if typing or view-only
    if (isInInputField()) return;
    if (window.StarBarQuickbar?.isViewOnlySheet) return;
    
    // Only process if we have a letter key, not just modifier keys
    const keyCode = e.code.toLowerCase();
    const keyChar = e.key.toLowerCase();
    const isLetterKey = keyCode.startsWith('key') || ['z', 'x', 's', 'ω', '≈', 'ß'].includes(keyChar);
    
    if (!isLetterKey) return;
    
    if (e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) {
      // Check for primary hotkeys - Ctrl+Alt on Win/Linux, Cmd+Option on Mac
      const isMac = _isMacPlatform();
      const isPrimaryHotkey = isMac ? 
        (e.metaKey && e.altKey && !e.shiftKey && !e.ctrlKey) : 
        (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey);
      
      if (isPrimaryHotkey) {
        let functionIndex = -1;
        
        // Check both e.key and e.code for Mac compatibility
        if (keyCode === 'keyz' || keyChar === 'z' || keyChar === 'ω') {
          functionIndex = 0;
        } else if (keyCode === 'keyx' || keyChar === 'x' || keyChar === '≈') {
          functionIndex = 1;
        } else if (keyCode === 'keys' || keyChar === 's' || keyChar === 'ß') {
          functionIndex = 2;
        }
        
        if (functionIndex >= 0) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          const hotkeyDisplay = isMac ? 
            `⌘⌥${['Z', 'X', 'S'][functionIndex]}` : 
            `Ctrl+Alt+${['Z', 'X', 'S'][functionIndex]}`;
          executeHotkeyAction(functionIndex, hotkeyDisplay);
          return false;
        }
      }
    }
  };
  
  // Add to both window and document with different phases
  window.addEventListener('keydown', handleKeyEvent, true);
  document.body.addEventListener('keydown', handleKeyEvent, true);
}

// Mac hotkey test function - can be called from browser console
window.starBarMacTest = function() {
  const isMac = _isMacPlatform();
  if (!isMac) {
    showHotkeyFeedback("Test: Not on Mac platform");
    return;
  }
  showHotkeyFeedback("Mac Test: Ready! Try ⌘⌥Z/X/S");
  
  return {
    isMac: isMac,
    platform: navigator.platform,
    userAgent: navigator.userAgent
  };
};

// Test function for debugging - can be called from browser console
window.starBarTest = function(functionIndex = 0) {
  _safeStorageGet("pinnedFunctions", (data) => {
    const buttons = data.pinnedFunctions || [];
    if (buttons.length === 0) {
      showHotkeyFeedback("Test: No functions saved");
      return;
    }
    
    if (functionIndex >= buttons.length) {
      showHotkeyFeedback(`Test: Function ${functionIndex + 1} not available`);
      return;
    }
    
    const functionPath = buttons[functionIndex];
    showHotkeyFeedback(`Test: ${functionPath.split(" > ").pop()}`);
    _triggerMenuPath(functionPath);
  });
};

// Export functions
window.StarBarHotkeys = {
  showHotkeyFeedback,
  executeHotkeyAction,
  isInInputField,
  setupHotkeys,
  setupAlternativeHotkeys
};
