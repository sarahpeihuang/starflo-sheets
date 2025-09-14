// Runs when the extension is installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  // Create the right-click context menu item
  chrome.contextMenus.create({
    id: "pinFunction",
    title: "⭐ Pin 'Bold' to Toolbar",
    contexts: ["all"]
  });

  // Check if the reason for this event is a fresh installation
  if (details.reason === 'install') {
    // If it is, set up the initial values in storage
    chrome.storage.local.set({ 
      hasSeenOnboarding: false, // This tells the content script to run the tour
      pinnedFunctions: []       // Initialize with an empty array of pinned items
    });
  }
});

// Runs when the user clicks the context menu item
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "pinFunction") {
    chrome.storage.local.get("pinnedFunctions", (data) => {
      const existing = data.pinnedFunctions || [];
      if (!existing.includes("Bold")) {
        existing.push("Bold");
        chrome.storage.local.set({ pinnedFunctions: existing }, () => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => alert("'Bold' pinned to toolbar!")
          });
        });
      }
    });
  }
});