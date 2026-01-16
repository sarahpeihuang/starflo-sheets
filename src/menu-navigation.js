// src/menu-navigation.js
// Menu navigation logic for StarBar Chrome Extension

// Helper accessors - these access globals after they're defined
function _cleanText(text) { return window.StarBarUtils.cleanText(text); }
function _dispatchEscape() { return window.StarBarDOM.dispatchEscape(); }
function _simulateClick(el) { return window.StarBarDOM.simulateClick(el); }
function _simulateSubmenuClick(el) { return window.StarBarDOM.simulateSubmenuClick(el); }

/**
 * Trigger a menu path action
 * @param {string} path - Menu path like "Format > Text > Bold"
 */
function triggerMenuPath(path) {
  // Close any existing menus first to ensure clean state
  try {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true
    }));
    
    setTimeout(() => {
      executeMenuPath(path);
    }, 100);
  } catch (error) {
    executeMenuPath(path);
  }
}

/**
 * Execute the menu path navigation
 * @param {string} path - Menu path
 */
function executeMenuPath(path) {
  const labels = path.split(" > ").map((l) => l.trim());
  const [first, ...rest] = labels;
  
  // Handle color paths specially
  if (first === "Text color" || first === "Fill color") {
    handleColorPath(first, rest);
    return;
  }

  // Convert generic "Color" to "Text color"
  if (first === "Color") {
    triggerMenuPath(`Text color > ${rest.join(" > ")}`);
    return;
  }
  
  navigateMenuPathImproved(labels);
}

/**
 * Handle color-specific menu paths
 * @param {string} colorType - "Text color" or "Fill color"
 * @param {string[]} rest - Remaining path parts
 */
function handleColorPath(colorType, rest) {
  const possibleLabels = [];
  
  if (colorType === "Fill color") {
    possibleLabels.push(
      "Fill color", "Fill colour", "Background color", 
      "Background colour", "Cell color", "Cell colour"
    );
  } else {
    possibleLabels.push(
      "Text color", "Text colour", "Font color", "Font colour"
    );
  }

  let btn = null;
  for (const label of possibleLabels) {
    btn = Array.from(document.querySelectorAll("[aria-label]")).find(
      (el) => _cleanText(el.getAttribute("aria-label")) === _cleanText(label)
    );
    if (btn) break;
  }

  // Try more generic selectors for fill color
  if (!btn && colorType === "Fill color") {
    const fillColorSelectors = [
      '[data-tooltip*="fill"]', 
      '[data-tooltip*="background"]', 
      '[aria-label*="fill"]', 
      '[aria-label*="background"]', 
      ".docs-icon-fill-color", 
      ".docs-icon-background-color"
    ];
    btn = fillColorSelectors.map(sel => document.querySelector(sel)).find(el => el);
  }

  if (!btn) {
    alert(`Could not find "${colorType}" button. Check console for available options.`);
    return;
  }
  
  _simulateClick(btn);

  const targetColor = _cleanText(rest.join(" > "));
  tryClickColor(targetColor, colorType, 1);
}

/**
 * Try to click a color in the color picker
 * @param {string} targetColor - Target color label
 * @param {string} colorType - "Text color" or "Fill color"
 * @param {number} attempt - Current attempt number
 */
function tryClickColor(targetColor, colorType, attempt = 1) {
  // Look for color swatches in the color picker
  const allElements = Array.from(document.querySelectorAll("*")).filter((el) => {
    const className = el.className || "";
    const classStr = typeof className === "string" ? className : className.toString?.() || "";

    return (
      el.offsetParent !== null &&
      (el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        el.getAttribute("data-value") ||
        classStr.includes("color") ||
        classStr.includes("palette") ||
        el.style.backgroundColor ||
        (colorType === "Fill color" &&
          (classStr.includes("fill") ||
            classStr.includes("background") ||
            el.getAttribute("aria-label")?.toLowerCase().includes("fill"))))
    );
  });

  // Try exact match first
  let colorButtons = allElements.filter((el) => {
    const label = el.getAttribute("aria-label");
    const title = el.getAttribute("title");
    const dataValue = el.getAttribute("data-value");

    return (
      _cleanText(label) === targetColor ||
      _cleanText(title) === targetColor ||
      _cleanText(dataValue) === targetColor
    );
  });

  // Try partial/fuzzy matching
  if (colorButtons.length === 0) {
    const targetWords = targetColor.toLowerCase().split(/\s+/);
    colorButtons = allElements.filter((el) => {
      const label = (el.getAttribute("aria-label") || el.getAttribute("title") || "").toLowerCase();
      const hasAllWords = targetWords.every((word) => label.includes(word));
      const hasColorReference = /color|cyan|red|blue|green|yellow|orange|purple|pink|brown|gray|grey/i.test(label);
      return hasAllWords && hasColorReference;
    });
  }

  // Try color swatches by common selectors
  if (colorButtons.length === 0) {
    const colorSwatches = Array.from(
      document.querySelectorAll(
        '.docs-material-colorpalette-cell, .goog-palette-cell, [role="gridcell"], .color-cell, .palette-cell, [style*="background-color"]'
      )
    ).filter((el) => el.offsetParent !== null);
    
    colorButtons = colorSwatches.filter((el) => {
      const label = (el.getAttribute("aria-label") || el.getAttribute("title") || "").toLowerCase();
      const targetWords = targetColor.toLowerCase().split(/\s+/);
      return targetWords.some((word) => label.includes(word));
    });
  }

  if (colorButtons.length > 0) {
    _simulateClick(colorButtons[0]);
  } else if (attempt < 3) {
    setTimeout(() => tryClickColor(targetColor, colorType, attempt + 1), 300 * attempt);
  } else {
    alert(`Could not find color "${targetColor}" for ${colorType}. Check console for debug info.`);
  }
}

/**
 * Navigate through menu path with improved matching
 * @param {string[]} labelPath - Array of menu labels
 */
function navigateMenuPathImproved(labelPath) {
  if (labelPath.length === 0) return;
  
  const topMenuLabel = _cleanText(labelPath[0]);

  // Find and click the top-level menu
  const topMenu = Array.from(
    document.querySelectorAll('div[role="menubar"] [role="menuitem"]')
  ).find((el) => _cleanText(el.textContent) === topMenuLabel);

  if (!topMenu) {
    alert(`Could not find top menu: "${labelPath[0]}"`);
    return;
  }
  
  _simulateClick(topMenu);

  if (labelPath.length > 1) {
    setTimeout(() => {
      navigateSubmenuPath(labelPath.slice(1), 0);
    }, 250);
  } else {
    setTimeout(_dispatchEscape, 300);
  }
}

/**
 * Navigate through submenu path
 * @param {string[]} remainingPath - Remaining menu labels
 * @param {number} depth - Current depth in menu hierarchy
 * @param {number} retryCount - Retry count for current step
 */
function navigateSubmenuPath(remainingPath, depth, retryCount = 0) {
  if (remainingPath.length === 0) return;

  const targetLabel = _cleanText(remainingPath[0]);
  const isLastItem = remainingPath.length === 1;
  
  setTimeout(() => {
    const allMenus = Array.from(document.querySelectorAll('[role="menu"]'))
      .filter((menu) => menu.offsetParent !== null);

    if (allMenus.length === 0) {
      if (retryCount < 3) {
        setTimeout(() => navigateSubmenuPath(remainingPath, depth, retryCount + 1), 300);
        return;
      } else {
        alert(`Could not find submenu for: "${remainingPath[0]}". The submenu may not have opened properly.`);
        return;
      }
    }

    // Sort menus by position (rightmost/highest z-index first)
    const sortedMenus = allMenus.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      if (Math.abs(aRect.left - bRect.left) > 10) {
        return bRect.left - aRect.left;
      }
      const aZIndex = parseInt(window.getComputedStyle(a).zIndex) || 0;
      const bZIndex = parseInt(window.getComputedStyle(b).zIndex) || 0;
      return bZIndex - aZIndex;
    });

    const currentMenu = sortedMenus[0];
    const allItems = Array.from(currentMenu.querySelectorAll('[role="menuitem"]'))
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const contentEl = el.querySelector(".goog-menuitem-content");
        const rawText = contentEl ? contentEl.textContent : el.textContent;
        const cleaned = _cleanText(rawText);
        const hasSubmenu = el.getAttribute("aria-haspopup") === "true";
        return { el, rawText, cleaned, hasSubmenu };
      });

    // Find menu item using multiple strategies
    const menuItem = findMenuItemByLabel(targetLabel, allItems);

    if (!menuItem) {
      const availableItems = allItems.map((item) => `"${item.cleaned}"`);
      alert(`Could not find menu item: "${remainingPath[0]}"\n\nAvailable items:\n${availableItems.join("\n")}`);
      setTimeout(_dispatchEscape, 100);
      return;
    }

    const foundItem = allItems.find(item => item.el === menuItem);
    const itemHasSubmenu = foundItem?.hasSubmenu || false;

    // Click the menu item
    if (itemHasSubmenu && !isLastItem) {
      _simulateSubmenuClick(menuItem);
    } else {
      _simulateClick(menuItem);
    }

    if (!isLastItem && itemHasSubmenu) {
      setTimeout(() => navigateSubmenuPath(remainingPath.slice(1), depth + 1), 600);
    } else if (isLastItem) {
      handleLastMenuItem(remainingPath[0]);
    } else {
      setTimeout(_dispatchEscape, 400);
    }
  }, 150 + depth * 100);
}

/**
 * Find a menu item by label using multiple matching strategies
 * @param {string} targetLabel - Target label to find
 * @param {Object[]} allItems - Array of menu item objects
 * @returns {HTMLElement|null} Found menu item or null
 */
function findMenuItemByLabel(targetLabel, allItems) {
  const targetLabelClean = targetLabel.replace(/►/g, "").trim();
  
  // Strategy 1: Exact match
  let foundItem = allItems.find((item) => {
    const itemClean = item.cleaned.replace(/►/g, "").trim();
    return itemClean === targetLabelClean;
  });
  if (foundItem) return foundItem.el;

  // Strategy 2: Normalized spaces
  const normalizeSpaces = (text) => text.replace(/\s*\(\s*/g, " (").replace(/\s*\)\s*/g, ") ").replace(/\s+/g, " ").trim();
  const targetNormalized = normalizeSpaces(targetLabelClean);
  foundItem = allItems.find((item) => {
    const itemNormalized = normalizeSpaces(item.cleaned.replace(/►/g, "").trim());
    return itemNormalized === targetNormalized;
  });
  if (foundItem) return foundItem.el;

  // Strategy 3: Submenu prefix match
  foundItem = allItems.find((item) => {
    const itemClean = item.cleaned.replace(/►/g, "").trim();
    return itemClean === targetLabelClean || (item.hasSubmenu && targetLabelClean.startsWith(itemClean));
  });
  if (foundItem) return foundItem.el;

  // Strategy 4: Fuzzy match (remove punctuation)
  const removePunctuation = (text) => text.replace(/[^\w]/g, "").toLowerCase();
  const targetFuzzy = removePunctuation(targetLabelClean);
  foundItem = allItems.find((item) => {
    const itemFuzzy = removePunctuation(item.cleaned.replace(/►/g, "").trim());
    return itemFuzzy === targetFuzzy;
  });
  if (foundItem) return foundItem.el;

  // Strategy 5: Partial matching
  foundItem = allItems.find((item) => {
    const itemClean = item.cleaned.replace(/►/g, "").trim();
    return itemClean.includes(targetLabelClean) || targetLabelClean.includes(itemClean);
  });
  if (foundItem) return foundItem.el;

  // Strategy 6: Word matching
  const targetWords = targetLabelClean.split(/\s+/).filter((w) => w.length > 2);
  foundItem = allItems.find((item) => {
    const itemWords = item.cleaned.replace(/►/g, "").trim().split(/\s+/).filter((w) => w.length > 2);
    return targetWords.length > 0 && targetWords.every((word) =>
      itemWords.some((iw) => iw.includes(word) || word.includes(iw))
    );
  });
  if (foundItem) return foundItem.el;

  return null;
}

/**
 * Handle actions after clicking the last menu item
 * @param {string} itemLabel - Label of the clicked item
 */
function handleLastMenuItem(itemLabel) {
  const actionText = _cleanText(itemLabel);
  const shouldKeepDialogOpen = [
    "pdf (.pdf)", "excel (.xlsx)", "csv", "tsv", "ods", "zip",
    "share with others", "email", "publish to web", "make a copy",
    "import", "version history", "details", "rename"
  ].some((action) => actionText.includes(action));

  if (shouldKeepDialogOpen) {
    checkForDialog(1, 5);
  } else {
    setTimeout(_dispatchEscape, 200);
  }
}

/**
 * Check for dialog appearance after menu action
 * @param {number} attempt - Current attempt
 * @param {number} maxAttempts - Maximum attempts
 */
function checkForDialog(attempt, maxAttempts) {
  setTimeout(() => {
    const dialogSelectors = [
      '[role="dialog"]', '.modal', '[aria-modal="true"]',
      '.docs-dialog', '.docs-material-dialog', '.goog-modal-dialog',
      '.docs-share-dialog', '.docs-download-dialog', '[data-dialog]',
      '.picker-dialog', '.jfk-bubble', '.docs-bubble', '.gb_g', '.picker'
    ];

    const hasDialog = dialogSelectors.some((selector) => {
      const elements = document.querySelectorAll(selector);
      return Array.from(elements).some((el) => {
        const style = window.getComputedStyle(el);
        return el.offsetParent !== null && 
               style.visibility !== "hidden" && 
               style.display !== "none" && 
               style.opacity !== "0";
      });
    });

    const hasOverlay = document.querySelector(
      '.docs-material-dialog-backdrop, .goog-modalpopup-bg, .modal-backdrop'
    );
    
    if (hasDialog || hasOverlay) return;
    
    if (attempt < maxAttempts) {
      checkForDialog(attempt + 1, maxAttempts);
    } else {
      _dispatchEscape();
    }
  }, attempt * 500);
}

// Export functions
window.StarBarMenu = {
  triggerMenuPath,
  executeMenuPath,
  navigateMenuPathImproved,
  navigateSubmenuPath
};
