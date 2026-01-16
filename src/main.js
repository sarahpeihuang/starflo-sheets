// src/main.js
// Main entry point for StarBar Chrome Extension

/**
 * Main initialization function
 */
function init() {
  const currentUrl = window.location.href;
  
  // Check if this is the Sheets home page (not a specific sheet)
  const isHomePage = currentUrl.match(/^https:\/\/docs\.google\.com\/spreadsheets\/(u\/\d+\/)?$/) ||
                     currentUrl.match(/^https:\/\/docs\.google\.com\/spreadsheets\/(u\/\d+\/)?\?.*$/) ||
                     currentUrl.match(/^https:\/\/docs\.google\.com\/spreadsheets\/(u\/\d+\/)?#.*$/) ||
                     !currentUrl.includes('/d/');
  
  if (isHomePage) return;

  const { StarBarDOM, StarBarQuickbar, StarBarObservers, StarBarHotkeys } = window;
  
  // Detect view-only status with retry mechanism
  const detectWithRetry = (attempt = 1, maxAttempts = 5) => {
    StarBarQuickbar.isViewOnlySheet = StarBarDOM.detectViewOnlySheet();
    
    if (!StarBarQuickbar.isViewOnlySheet && attempt < maxAttempts) {
      setTimeout(() => detectWithRetry(attempt + 1, maxAttempts), 1000 * attempt);
    } else if (StarBarQuickbar.isViewOnlySheet && attempt > 1) {
      // Update toolbar if already created
      updateToolbarForViewOnly();
    }
  };
  
  detectWithRetry();
  
  // Create UI and setup observers
  StarBarQuickbar.createToolbar();
  StarBarObservers.observeMenus();

  // Check for onboarding
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['hasSeenOnboarding'], (result) => {
      if (!result.hasSeenOnboarding) {
        setTimeout(() => {
          if (typeof introJs !== 'undefined' && 
              typeof window.startOnboardingTour === 'function' && 
              document.getElementById('quickbar')) {
            window.startOnboardingTour();
          }
        }, 2000);
      }
    });
  }

  // Reset menu path on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      StarBarQuickbar.currentMenuPath = [];
    }
  });
  
  // Setup hotkeys
  StarBarHotkeys.setupHotkeys();
  StarBarHotkeys.setupAlternativeHotkeys();
  
  // Reset menu path on outside click
  document.addEventListener("click", (e) => {
    const clickedMenu = e.target.closest('[role="menu"], [role="menubar"]');
    if (!clickedMenu) {
      StarBarQuickbar.currentMenuPath = [];
    }
  });
}

/**
 * Update toolbar appearance for view-only sheets
 */
function updateToolbarForViewOnly() {
  const { StarBarQuickbar } = window;
  const bar = document.getElementById("quickbar");
  
  if (!bar) return;
  
  const titleBar = bar.querySelector("div:first-child");
  const title = titleBar?.querySelector("img");
  
  if (!titleBar || !title) return;
  
  StarBarQuickbar.titleCollapsed = true;
  
  Array.from(bar.children).forEach((child) => {
    if (child !== titleBar) child.style.display = "none";
  });

  Array.from(titleBar.children).forEach((child) => {
    if (child !== title) child.style.display = "none";
  });

  bar.style.background = "transparent";
  bar.style.border = "none";
  bar.style.padding = "0px";
  
  StarBarQuickbar.updateQuickbar();
}

// Wait for DOM and initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(init, 1000);
  });
} else {
  setTimeout(init, 1000);
}

// Export for potential external access
window.StarBarMain = {
  init,
  updateToolbarForViewOnly
};
