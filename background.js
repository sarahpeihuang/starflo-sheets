// adds a right-click context menu to “pin” functions

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "pinFunction",
      title: "⭐ Pin to Toolbar",
      contexts: ["all"]
    });
  });
  
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "pinFunction") {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          alert("Pinned! (This is a placeholder - add logic to store menu item)");
        }
      });
    }
  });
  