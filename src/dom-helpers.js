// src/dom-helpers.js
// DOM manipulation helpers for StarBar Chrome Extension

/**
 * Dispatch Escape key event to close menus/dialogs
 */
function dispatchEscape() {
  document.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Escape",
    code: "Escape",
    keyCode: 27,
  }));
}

/**
 * Simulate a realistic click on an element
 * @param {HTMLElement} el - Element to click
 */
function simulateClick(el) {
  el.focus?.();
  const rect = el.getBoundingClientRect();
  const opts = { 
    bubbles: true, 
    cancelable: true, 
    clientX: rect.left + rect.width / 2, 
    clientY: rect.top + rect.height / 2, 
    button: 0 
  };
  ["mousedown", "mouseup", "click"].forEach(type => 
    el.dispatchEvent(new MouseEvent(type, opts))
  );
}

/**
 * Enhanced click for submenu items that need hover states
 * @param {HTMLElement} el - Element to click
 */
function simulateSubmenuClick(el) {
  el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  ["mousedown", "mouseup", "click"].forEach(type => 
    el.dispatchEvent(new MouseEvent(type, { bubbles: true }))
  );
}

/**
 * Detect if the current sheet is view-only
 * @returns {boolean} True if sheet is view-only
 */
function detectViewOnlySheet() {
  const url = window.location.href;
  if (url.includes('/view') || url.includes('/preview') || url.includes('usp=sharing')) {
    return true;
  }
  
  if (!document.body || document.readyState === 'loading') {
    return false;
  }
  
  // Check for "View only" badge
  const viewOnlySelectors = [
    '[title*="View only"]', 
    '[aria-label*="View only"]', 
    '.docs-titlebar-badges', 
    '.docs-activity-indicator', 
    '[data-tooltip*="view only"]'
  ];
  
  const hasViewOnlyBadge = viewOnlySelectors.some(sel => 
    Array.from(document.querySelectorAll(sel)).some(el => {
      const combined = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`.toLowerCase();
      return combined.includes('view only') || combined.includes('viewing only');
    })
  );
  
  if (hasViewOnlyBadge) return true;
  
  // Check page title
  if (document.title?.includes('- View only')) return true;
  
  // Check for absence of editing features
  const editFeatureSelectors = [
    '[aria-label*="Share"]', 
    '[aria-label*="Insert"]', 
    '[aria-label*="Format"]', 
    '[aria-label*="Tools"]', 
    '[aria-label*="Extensions"]', 
    '[data-tooltip*="Share"]', 
    'div[role="menubar"]'
  ];
  
  const editFeaturesFound = editFeatureSelectors.filter(sel => 
    document.querySelector(sel)
  ).length;
  
  if (editFeaturesFound < 3) return true;
  
  // Check toolbar buttons count
  const toolbar = document.querySelector('.docs-material');
  if (toolbar && toolbar.querySelectorAll('div[role="button"], button').length < 10) {
    return true;
  }
  
  return false;
}

/**
 * Determine color type (fill or text) from context
 * @param {string} label - Color label
 * @param {string|null} lastClickedColorButton - Last clicked color button type
 * @returns {string} "Fill color" or "Text color"
 */
function determineColorType(label, lastClickedColorButton) {
  const { getButtonLabel, isButtonActive } = window.StarBarUtils;
  
  let isFromFillColor = lastClickedColorButton === "fill";
  let isFromTextColor = lastClickedColorButton === "text";

  if (!isFromFillColor && !isFromTextColor) {
    const allColorButtons = document.querySelectorAll("*[aria-label], *[data-tooltip], *[title]");
    
    const fillButtons = Array.from(allColorButtons).filter((btn) => {
      const btnLabel = getButtonLabel(btn);
      return btnLabel.includes("fill") || btnLabel.includes("background") || btnLabel.includes("cell color");
    });

    const textButtons = Array.from(allColorButtons).filter((btn) => {
      const btnLabel = getButtonLabel(btn);
      return (btnLabel.includes("text") && btnLabel.includes("color")) || btnLabel.includes("font color");
    });
    
    // Check fill buttons
    for (const btn of fillButtons) {
      if (isButtonActive(btn)) {
        isFromFillColor = true;
        break;
      }
    }

    // Check text buttons (only if fill not active)
    if (!isFromFillColor) {
      for (const btn of textButtons) {
        if (isButtonActive(btn)) {
          isFromTextColor = true;
          break;
        }
      }
    }
  }

  // Check indicator elements as fallback
  if (!isFromFillColor && !isFromTextColor) {
    const fillColorIndicators = [
      ".docs-icon-fill-color", 
      '[data-command-name*="fill"]', 
      '[data-command-name*="background"]'
    ];
    const textColorIndicators = [
      ".docs-icon-text-color", 
      '[data-command-name*="text"]', 
      '[aria-label*="Text color"]'
    ];

    isFromFillColor = fillColorIndicators.some(sel => {
      const el = document.querySelector(sel);
      return el && isButtonActive(el);
    });

    if (!isFromFillColor) {
      isFromTextColor = textColorIndicators.some(sel => {
        const el = document.querySelector(sel);
        return el && isButtonActive(el);
      });
    }
  }

  // Final decision: Fill > Text > lastClicked > default Text
  if (isFromFillColor) return "Fill color";
  if (isFromTextColor) return "Text color";
  if (lastClickedColorButton === "fill") return "Fill color";
  return "Text color";
}

// Export functions
window.StarBarDOM = {
  dispatchEscape,
  simulateClick,
  simulateSubmenuClick,
  detectViewOnlySheet,
  determineColorType
};
