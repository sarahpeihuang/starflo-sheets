// src/observers.js
// Mutation observers for StarBar Chrome Extension

// Helper accessors - these access globals after they're defined
function _safeStorageGet(key, cb) { return window.StarBarUtils.safeStorageGet(key, cb); }
function _safeStorageSet(data, cb) { return window.StarBarUtils.safeStorageSet(data, cb); }
function _getButtonLabel(button) { return window.StarBarUtils.getButtonLabel(button); }
function _injectStarsIntoMenu(menu) { return window.StarBarQuickbar.injectStarsIntoMenu(menu); }
function _updateCurrentMenuPath() { return window.StarBarQuickbar.updateCurrentMenuPath(); }
function _updateQuickbar() { return window.StarBarQuickbar.updateQuickbar(); }

let menuObserver = null;
let attributeObserver = null;

/**
 * Cleanup existing observers
 */
function cleanupObservers() {
  if (menuObserver) {
    menuObserver.disconnect();
    menuObserver = null;
  }
  if (attributeObserver) {
    attributeObserver.disconnect();
    attributeObserver = null;
  }
}

/**
 * Track color button clicks to determine context
 */
function trackColorButtonClicks() {
  const allButtons = document.querySelectorAll(
    'button, div[role="button"], span[role="button"], *[onclick], *[aria-label], *[data-tooltip]'
  );

  allButtons.forEach((button) => {
    if (!button.hasAttribute("data-color-tracked")) {
      const label = (
        button.getAttribute("aria-label") ||
        button.getAttribute("data-tooltip") ||
        button.getAttribute("title") ||
        button.textContent ||
        ""
      ).toLowerCase();

      if (
        label.includes("fill") ||
        label.includes("background") ||
        label.includes("cell color") ||
        label.includes("text color") ||
        label.includes("font color") ||
        label.includes("colour")
      ) {
        button.setAttribute("data-color-tracked", "true");
        
        button.addEventListener("click", () => {
          const { StarBarQuickbar } = window;
          
          if (label.includes("fill") || label.includes("background") || label.includes("cell color")) {
            StarBarQuickbar.lastClickedColorButton = "fill";
          } else if (label.includes("text") || label.includes("font")) {
            StarBarQuickbar.lastClickedColorButton = "text";
          }

          // Reset after 30 seconds
          setTimeout(() => {
            if (StarBarQuickbar.lastClickedColorButton) {
              StarBarQuickbar.lastClickedColorButton = null;
            }
          }, 30000);
        });
      }
    }
  });
}

/**
 * Setup menu observation
 */
function observeMenus() {
  cleanupObservers();
  
  // Watch for new menus being added
  menuObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const added of mutation.addedNodes) {
        if (!(added instanceof HTMLElement)) continue;
        if (added.getAttribute?.("role") === "menu") {
          _injectStarsIntoMenu(added);
          _updateCurrentMenuPath();
        }
      }
    }
  });

  // Watch for attribute changes on menu items
  attributeObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === "attributes" &&
        (mutation.attributeName === "class" || mutation.attributeName === "aria-selected")
      ) {
        const target = mutation.target;
        if (
          target.getAttribute?.("role") === "menuitem" &&
          target.getAttribute?.("aria-haspopup") === "true"
        ) {
          _updateCurrentMenuPath();
        }
      }
    }
  });

  // Start observing
  menuObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  attributeObserver.observe(document.body, {
    attributes: true,
    subtree: true,
    attributeFilter: ["class", "aria-selected"]
  });

  // Track color buttons
  trackColorButtonClicks();
  
  // Re-track periodically as new buttons may appear
  setInterval(trackColorButtonClicks, 5000);
}

/**
 * Setup storage change listener for cross-tab sync
 */
function setupStorageListener() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.pinnedFunctions) {
        _updateQuickbar();
      }
    });
  }
}

/**
 * Observe toolbar buttons for color context
 */
function observeToolbarButtons() {
  const toolbarObserver = new MutationObserver(() => {
    trackColorButtonClicks();
  });

  const toolbar = document.querySelector('.docs-toolbar-wrapper') ||
                   document.querySelector('[role="toolbar"]') ||
                   document.querySelector('.waffle-toolbar');

  if (toolbar) {
    toolbarObserver.observe(toolbar, {
      childList: true,
      subtree: true
    });
  }
}

// Export functions
window.StarBarObservers = {
  cleanupObservers,
  trackColorButtonClicks,
  observeMenus,
  setupStorageListener,
  observeToolbarButtons
};
