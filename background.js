chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "pinFunction",
    title: "⭐ Pin 'Bold' to Toolbar",
    contexts: ["all"]
  });
});

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