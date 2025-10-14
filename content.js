// content.js
let lastTopMenu = null;
let editingMode = false;
let titleCollapsed = false;
let currentMenuPath = []; 


function isExtensionContextValid() {
  try {
    return chrome && chrome.runtime && chrome.runtime.id;
  } catch (error) {
    return false;
  }
}


function safeStorageGet(key, callback) {
  if (!isExtensionContextValid()) {
    console.warn('Extension context invalidated - using fallback');
    callback({ [key]: [] });
    return;
  }
  
  try {
    chrome.storage.local.get(key, callback);
  } catch (error) {
    console.warn('Storage get failed:', error);
    callback({ [key]: [] });
  }
}

function safeStorageSet(data, callback) {
  if (!isExtensionContextValid()) {
    console.warn('Extension context invalidated - cannot save data');
    if (callback) callback();
    return;
  }
  
  try {
    chrome.storage.local.set(data, callback);
  } catch (error) {
    console.warn('Storage set failed:', error);
    if (callback) callback();
  }
}


function safeGetURL(path) {
  if (!isExtensionContextValid()) {
    console.warn('Extension context invalidated - using fallback URL');
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>`;
  }
  
  try {
    return chrome.runtime.getURL(path);
  } catch (error) {
    console.warn('getURL failed:', error);
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>`;
  }
}

// Helper function that simulates click action
function simulateClick(el) {
 
  if (el.focus) {
    el.focus();
  }
  
  
  const rect = el.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  const mouseEvents = [
    new MouseEvent("mousedown", { 
      bubbles: true, 
      cancelable: true,
      clientX: centerX,
      clientY: centerY,
      button: 0
    }),
    new MouseEvent("mouseup", { 
      bubbles: true, 
      cancelable: true,
      clientX: centerX,
      clientY: centerY,
      button: 0
    }),
    new MouseEvent("click", { 
      bubbles: true, 
      cancelable: true,
      clientX: centerX,
      clientY: centerY,
      button: 0
    })
  ];
  
  mouseEvents.forEach(event => el.dispatchEvent(event));
}

// Enhanced click function for submenu items
function simulateSubmenuClick(el) {
  // For submenu items, we might need hover events to trigger the submenu
  el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  
  // Click immediately after hover events
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}


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

// Callback function that triggers when tooltip button is clicked
function triggerMenuPath(path) {
  const labels = path.split(" > ").map((l) => l.trim());
  const [first, ...rest] = labels;

  // === Special case: Text color / Fill color ===
  if (first === "Text color" || first === "Fill color") {
    const btn = Array.from(document.querySelectorAll("[aria-label]")).find(
      (el) => cleanText(el.getAttribute("aria-label")) === cleanText(first)
    );

    if (!btn) {
      alert(`Could not find "${first}" button.`);
      return;
    }

    // Step 1: Click the toolbar button
    simulateClick(btn);

    // Step 2: Wait for the color grid to appear and click the swatch
    const targetColor = cleanText(rest.join(" > "));
    const tryClickColor = () => {
      const colorButtons = Array.from(
        document.querySelectorAll("[aria-label]")
      ).filter(
        (el) =>
          el.offsetParent !== null &&
          cleanText(el.getAttribute("aria-label")) === targetColor
      );

      if (colorButtons.length > 0) {
        simulateClick(colorButtons[0]);
      } else {
        alert(`Could not find color "${rest.join(" > ")}"`);
      }
    };

    setTimeout(tryClickColor, 300);
    return;
  }

  
  console.log("Navigating menu path:", labels);
  navigateMenuPathImproved(labels);
}


function navigateMenuPathImproved(labelPath) {
  if (labelPath.length === 0) {
    console.warn("Empty label path provided");
    return;
  }

  console.log("Full navigation path:", labelPath);
  console.log("Path length:", labelPath.length);

  const topMenuLabel = cleanText(labelPath[0]);
  
  // Step 1: Find and click the top-level menu
  const topMenu = Array.from(
    document.querySelectorAll('div[role="menubar"] [role="menuitem"]')
  ).find(el => cleanText(el.textContent) === topMenuLabel);
  
  if (!topMenu) {
    alert(`Could not find top menu: "${labelPath[0]}"`);
    return;
  }
  
  console.log(`Found top menu: "${topMenuLabel}", will navigate ${labelPath.length - 1} more levels`);
  simulateClick(topMenu);
  
  // Step 2: Navigate through the rest of the path
  if (labelPath.length > 1) {
    setTimeout(() => {
      console.log("Starting submenu navigation with:", labelPath.slice(1));
      navigateSubmenuPath(labelPath.slice(1), 0);
    }, 250);
  } else {
    // Just opening the top menu, close after a moment
    setTimeout(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          keyCode: 27,
        })
      );
    }, 300);
  }
}


function navigateSubmenuPath(remainingPath, depth, retryCount = 0) {
  if (remainingPath.length === 0) {
    console.log("Navigation complete - no more items in path");
    return;
  }
  
  const targetLabel = cleanText(remainingPath[0]);
  const isLastItem = remainingPath.length === 1;
  
  console.log(`[Depth ${depth}] Looking for "${targetLabel}" (original: "${remainingPath[0]}"), isLast: ${isLastItem}, remaining after this: ${remainingPath.length - 1}, retry: ${retryCount}`);
  
  setTimeout(() => {
  
    const allMenus = Array.from(document.querySelectorAll('[role="menu"]')).filter(
      menu => menu.offsetParent !== null
    );
    
    console.log(`Found ${allMenus.length} visible menu(s)`);
    
  
    allMenus.forEach((menu, index) => {
      const rect = menu.getBoundingClientRect();
      const items = Array.from(menu.querySelectorAll('[role="menuitem"]'))
        .filter(el => el.offsetParent !== null)
        .slice(0, 3) // Show first 3 items
        .map(el => cleanText(el.textContent));
      console.log(`Menu ${index}: pos(${Math.round(rect.left)}, ${Math.round(rect.top)}), items: [${items.join(', ')}...]`);
    });
    
  
    if (allMenus.length === 0) {
      if (retryCount < 3) {
        console.warn(`No visible menus found at depth ${depth}, retrying in 300ms... (attempt ${retryCount + 1}/3)`);
        setTimeout(() => {
          navigateSubmenuPath(remainingPath, depth, retryCount + 1); // Retry same step
        }, 300);
        return;
      } else {
        console.error("No visible menus found after multiple retries");
        alert(`Could not find submenu for: "${remainingPath[0]}". The submenu may not have opened properly.`);
        return;
      }
    }
    

    const sortedMenus = allMenus.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      
    
      if (Math.abs(aRect.left - bRect.left) > 10) {
        return bRect.left - aRect.left; // rightmost first
      }
      
     
      const aZIndex = parseInt(window.getComputedStyle(a).zIndex) || 0;
      const bZIndex = parseInt(window.getComputedStyle(b).zIndex) || 0;
      return bZIndex - aZIndex;
    });
    
    
    const currentMenu = sortedMenus[0];
    
    console.log(`Looking in menu at position (${currentMenu.getBoundingClientRect().left}, ${currentMenu.getBoundingClientRect().top})`);
    
    
    if (depth > 0 && allMenus.length > 1) {
      const mainMenuRect = sortedMenus[sortedMenus.length - 1].getBoundingClientRect();
      const currentMenuRect = currentMenu.getBoundingClientRect();
      
      // Submenu should be to the right of main menu
      if (currentMenuRect.left <= mainMenuRect.left) {
        console.warn("Warning: Expected submenu but menu position doesn't look right");
      }
    }
    
    
    const allItems = Array.from(currentMenu.querySelectorAll('[role="menuitem"]'))
      .filter(el => el.offsetParent !== null)
      .map(el => {
        const contentEl = el.querySelector(".goog-menuitem-content");
        const rawText = contentEl ? contentEl.textContent : el.textContent;
        const cleaned = cleanText(rawText);
        const hasSubmenu = el.getAttribute("aria-haspopup") === "true";
        return { el, rawText, cleaned, hasSubmenu };
      });
    
    console.log("Available menu items:", allItems.map(item => `"${item.cleaned}" (raw: "${item.rawText}") ${item.hasSubmenu ? '[HAS SUBMENU]' : ''}`));
    
    // Find the menu item - try multiple matching strategies
    let menuItem = null;
    let foundItem = null;
    
    // Strategy 1: Exact match (ignoring arrows)
    const targetLabelClean = targetLabel.replace(/►/g, '').trim();
    foundItem = allItems.find(item => {
      const itemClean = item.cleaned.replace(/►/g, '').trim();
      return itemClean === targetLabelClean;
    });
    if (foundItem) menuItem = foundItem.el;
    
    
    if (!menuItem) {
      const normalizeSpaces = (text) => {
        return text
          .replace(/\s*\(\s*/g, ' (')  
          .replace(/\s*\)\s*/g, ') ')  
          .replace(/\s+/g, ' ')       
          .trim();
      };
      
      const targetNormalized = normalizeSpaces(targetLabelClean);
      foundItem = allItems.find(item => {
        const itemClean = item.cleaned.replace(/►/g, '').trim();
        const itemNormalized = normalizeSpaces(itemClean);
        return itemNormalized === targetNormalized;
      });
      if (foundItem) menuItem = foundItem.el;
    }
    
   
    if (!menuItem) {
      foundItem = allItems.find(item => {
        const itemClean = item.cleaned.replace(/►/g, '').trim();
        return itemClean === targetLabelClean || 
               (item.hasSubmenu && targetLabelClean.startsWith(itemClean));
      });
      if (foundItem) menuItem = foundItem.el;
    }
    
    
    if (!menuItem) {
      const removePunctuation = (text) => text.replace(/[^\w]/g, '').toLowerCase();
      const targetFuzzy = removePunctuation(targetLabelClean);
      
      foundItem = allItems.find(item => {
        const itemClean = item.cleaned.replace(/►/g, '').trim();
        const itemFuzzy = removePunctuation(itemClean);
        return itemFuzzy === targetFuzzy;
      });
      if (foundItem) menuItem = foundItem.el;
    }
    
    // Strategy 5: Partial matching both ways
    if (!menuItem) {
      foundItem = allItems.find(item => {
        const itemClean = item.cleaned.replace(/►/g, '').trim();
        return itemClean.includes(targetLabelClean) || targetLabelClean.includes(itemClean);
      });
      if (foundItem) menuItem = foundItem.el;
    }
    
    
    if (!menuItem) {
      const targetWords = targetLabelClean.split(/\s+/).filter(w => w.length > 2);
      foundItem = allItems.find(item => {
        const itemClean = item.cleaned.replace(/►/g, '').trim();
        const itemWords = itemClean.split(/\s+/).filter(w => w.length > 2);
        return targetWords.length > 0 && 
               targetWords.every(word => itemWords.some(iw => iw.includes(word) || word.includes(iw)));
      });
      if (foundItem) menuItem = foundItem.el;
    }
    
    // Strategy 7: Special cases for common Google Sheets items
    if (!menuItem) {
      const specialCases = {
        'share with others': ['share', 'others', 'people', 'collaborate'],
        'email': ['email', 'send', 'mail'],
        'publish to web': ['publish', 'web', 'public'],
        'download': ['download', 'export'],
        'make a copy': ['copy', 'duplicate'],
        'import': ['import', 'upload']
      };
      
      const targetKey = Object.keys(specialCases).find(key => 
        targetLabelClean.includes(key) || key.includes(targetLabelClean)
      );
      
      if (targetKey) {
        const keywords = specialCases[targetKey];
        foundItem = allItems.find(item => {
          const itemClean = item.cleaned.replace(/►/g, '').trim();
          return keywords.some(keyword => itemClean.includes(keyword));
        });
        if (foundItem) {
          console.log(`Special case match: "${targetLabelClean}" matched "${foundItem.cleaned}" using keywords: ${keywords.join(', ')}`);
          menuItem = foundItem.el;
        }
      }
    }
    
    if (!menuItem) {
      const availableItems = allItems.map(item => `"${item.cleaned}" (raw: "${item.rawText}")`);
      
      console.error(`Could not find "${remainingPath[0]}" at depth ${depth}`, {
        searchedFor: targetLabel,
        originalText: remainingPath[0],
        availableItems: availableItems
      });
      
      alert(`Could not find menu item: "${remainingPath[0]}"\n\nSearching for: "${targetLabel}"\n\nAvailable items in this submenu:\n${availableItems.join("\n")}\n\nTip: Try starring the item again from the actual submenu.`);
      
      // Close all menus
      setTimeout(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            keyCode: 27,
          })
        );
      }, 100);
      return;
    }
    
    const itemHasSubmenu = foundItem?.hasSubmenu || false;
    console.log(`Found menu item: "${cleanText(menuItem.textContent)}", hasSubmenu: ${itemHasSubmenu}, isLastInPath: ${isLastItem}`);
    
    // Click the menu item - use enhanced click for submenu items that need to open submenus
    if (itemHasSubmenu && !isLastItem) {
      console.log("Using enhanced submenu click (with hover) to open submenu");
      simulateSubmenuClick(menuItem);
    } else {
      console.log("Using standard click for final action or non-submenu item");
      simulateClick(menuItem);
      
      // For final items that aren't dialog actions, add a small delay to ensure click registers
      if (isLastItem && !itemHasSubmenu) {
        console.log("Final simple menu item clicked - ensuring click has time to register");
      }
    }
    
   
    if (!isLastItem && itemHasSubmenu) {
      console.log(`Item has submenu and more path remains, continuing to depth ${depth + 1}`);
      setTimeout(() => {
        navigateSubmenuPath(remainingPath.slice(1), depth + 1);
      }, 600); // Reduced timeout - was too long for simple menu items
    } else if (isLastItem) {
      // This was the final item in path
      console.log("Clicked final item in path");
      
      
      const actionText = cleanText(remainingPath[0]);
      const shouldKeepDialogOpen = [
        'pdf (.pdf)', 'excel (.xlsx)', 'csv', 'tsv', 'ods', 'zip', 
        'share with others', 'email', 'publish to web', 'make a copy',
        'import', 'version history', 'details', 'rename'
      ].some(action => actionText.includes(action));
      
      if (shouldKeepDialogOpen) {
        console.log("Action opens dialog/popup - not closing menus immediately");
        
        // Check multiple times for dialog appearance with increasing delays
        const checkForDialog = (attempt = 1, maxAttempts = 5) => {
          setTimeout(() => {
            // More comprehensive dialog selectors for Google Sheets
            const dialogSelectors = [
              '[role="dialog"]',
              '.modal',
              '[aria-modal="true"]',
              '.docs-dialog',
              '.docs-material-dialog',
              '.goog-modal-dialog',
              '.docs-share-dialog',
              '.docs-download-dialog',
              '[data-dialog]',
              '.picker-dialog',
              '.jfk-bubble',
              '.docs-bubble',
             
              '.gb_g', 
              '.picker',
              '.docs-offscreen-focus-trap-start', 
              '.docs-offscreen-focus-trap-end'
            ];
            
            const hasDialog = dialogSelectors.some(selector => {
              const elements = document.querySelectorAll(selector);
              return Array.from(elements).some(el => {
                const style = window.getComputedStyle(el);
                return el.offsetParent !== null && 
                       style.visibility !== 'hidden' && 
                       style.display !== 'none' &&
                       style.opacity !== '0';
              });
            });
            
           
            const hasOverlay = document.querySelector('.docs-material-dialog-backdrop, .goog-modalpopup-bg, .modal-backdrop, [class*="overlay"], [class*="backdrop"]');
            
            console.log(`Dialog check attempt ${attempt}: hasDialog=${hasDialog}, hasOverlay=${!!hasOverlay}`);
            
            if (hasDialog || hasOverlay) {
              console.log("Dialog/overlay detected, leaving menus open");
              return; // Don't close menus
            }
            
            if (attempt < maxAttempts) {
              // Try again with longer delay
              checkForDialog(attempt + 1, maxAttempts);
            } else {
              console.log("No dialog detected after multiple attempts, closing menus");
              document.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "Escape",
                  code: "Escape",
                  keyCode: 27,
                })
              );
            }
          }, attempt * 500); // Increasing delays: 500ms, 1s, 1.5s, 2s, 2.5s
        };
        
        checkForDialog();
      } else {
        // Regular menu items - close after giving action time to complete
        console.log("Regular menu item - closing menus after short delay");
        setTimeout(() => {
          document.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Escape",
              code: "Escape",
              keyCode: 27,
            })
          );
        }, 200); 
      }
    } else {
     
      console.warn("Path expects more items but current item has no submenu");
      setTimeout(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            keyCode: 27,
          })
        );
      }, 400);
    }
  }, 150 + (depth * 100)); 
}

// Helper function that implements toggle functionality for editing and deleting
function togglePin(path) {
  safeStorageGet("pinnedFunctions", (data) => {
    let pins = data.pinnedFunctions || [];
    const index = pins.indexOf(path);
    if (index === -1) pins.push(path);
    else pins.splice(index, 1);
    safeStorageSet({ pinnedFunctions: pins }, updateQuickbar);
  });
}

// Callback function that manages state
function updateQuickbar() {
  safeStorageGet("pinnedFunctions", (data) => {
    const buttons = data.pinnedFunctions || [];
    const container = document.getElementById("quickbar-buttons");
    container.innerHTML = "";
    buttons.forEach((func, index) => {
      const funcList = String(func).trim().split(">");
      const wrapper = document.createElement("div");
      wrapper.className = "quickbar-button";
      wrapper.setAttribute("draggable", editingMode);
      wrapper.dataset.index = index;
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";

      const btn = document.createElement("button");
      const btnText =
        funcList[funcList.length - 1].trim().slice(0, 1).toUpperCase() +
        funcList[funcList.length - 1].trim().slice(1);

      let iconSrc = null;

      if (func.includes("Fill color")) {
        iconSrc = safeGetURL("fill.svg");
      } else if (func.includes("Text color")) {
        iconSrc = safeGetURL("A.svg");
      }

      if (iconSrc) {
        const iconImg = document.createElement("img");
        iconImg.src = iconSrc;
        iconImg.alt = "";
        iconImg.style.width = "16px";
        iconImg.style.height = "16px";
        iconImg.style.marginRight = "6px";
        iconImg.style.verticalAlign = "middle";

        // Wrap text so icon and label align nicely
        const textWrapper = document.createElement("span");
        textWrapper.innerText = btnText;

        btn.innerText = "";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "flex-start";

        iconImg.style.width = "16px";
        iconImg.style.height = "16px";
        iconImg.style.marginRight = "6px";
        iconImg.style.flexShrink = "0";

        textWrapper.style.flexGrow = "1";
        textWrapper.style.textAlign = "center";

        btn.appendChild(iconImg);
        btn.appendChild(textWrapper);
      } else {
        btn.innerText = btnText; // fallback for non-color buttons
      }
      Object.assign(btn.style, {
        background: "#ffffff",
        color: "#454444",
        border: "0px solid #e0e0e0",
        borderRadius: "40px",
        padding: "6px 1px",
        cursor: editingMode ? "default" : "pointer",
        flexGrow: 1,
        width: "100%",
        textAlign: "center",
        transition: "background-color 0.2s ease",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      });

      // Add hover effects
      if (!editingMode) {
        btn.onclick = () => triggerMenuPath(func);
        btn.addEventListener("mouseenter", () => {
          btn.style.backgroundColor = "#D9D9D9";
        });
        btn.addEventListener("mouseleave", () => {
          btn.style.backgroundColor = "#ffffff";
        });
      }

      if (editingMode) {
        const drag = document.createElement("span");
        drag.textContent = "⋮⋮";
        drag.style.cssText = "cursor: grab; padding: 0 6px; font-size: 16px;";

        const del = document.createElement("button");
        del.innerText = "✕";
        del.style.cssText =
          "margin-left: 6px; background: #fff; color: black; border: 1px solid #ccc; cursor: pointer;";
        del.onclick = () => {
          buttons.splice(index, 1);
          safeStorageSet({ pinnedFunctions: buttons }, () => {
            updateQuickbar();
            // Update stars in open menus
            const stars = document.querySelectorAll(".pin-star");
            stars.forEach((star) => {
              const item = star.closest('[role="menuitem"]');
              const path = getFullMenuPath(item);
              let flag = false;
              for (let i = 0; i < buttons.length; i++) {
                if (buttons[i].includes(path)) {
                  star.textContent = "⭐";
                  flag = true;
                  break;
                }
              }
              if (!flag) {
                star.textContent = "☆";
              }
            });
          });
        };

        wrapper.appendChild(drag);
        wrapper.appendChild(btn);
        wrapper.appendChild(del);
      } else {
        wrapper.appendChild(btn);
      }

      container.appendChild(wrapper);
    });

    // Hide/show editContainer and editButton based on whether there are items
    const bar = document.getElementById("quickbar");
    const editButton = bar?.editButton;
    const editContainer = bar?.editContainer;

    if (editButton) {
      editButton.style.display =
        buttons.length === 0 || titleCollapsed ? "none" : "inline-block";
    }
    if (editContainer) {
      editContainer.style.display =
        buttons.length === 0 || titleCollapsed ? "none" : "inline-block";
    }

    if (editingMode) enableDragDrop(container, buttons);
  });
}

// Functionality for dragging tooltip children
function enableDragDrop(container, data) {
  let draggingEl;
  container.addEventListener("dragstart", (e) => {
    draggingEl = e.target;
    e.dataTransfer.effectAllowed = "move";
  });

  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    const afterElement = [...container.children].find((child) => {
      const box = child.getBoundingClientRect();
      return e.clientY < box.top + box.height / 2;
    });
    if (afterElement) container.insertBefore(draggingEl, afterElement);
    else container.appendChild(draggingEl);
  });

  container.addEventListener("drop", () => {
    const newOrder = [...container.children].map((el) => {
      const idx = el.dataset.index;
      return data[idx]; // preserve the full path from the original data array
    });
    safeStorageSet({ pinnedFunctions: newOrder }, updateQuickbar);
  });
}

// Helper function that gets the full menu path of a div component
function getFullMenuPath(item) {
  let label = "";
  
  const contentEl = item.querySelector(".goog-menuitem-content");
  if (contentEl) {
    label = cleanText(contentEl.innerText || contentEl.textContent);
  }
  
  if (!label) {
    label = cleanText(item.innerText || item.textContent);
  }
  
  if (!label) {
    label = cleanText(item.getAttribute("aria-label"));
  }
  
  
  if (currentMenuPath.length > 0) {
    // Verify that we're still in the same menu context
    const allVisibleMenus = Array.from(document.querySelectorAll('[role="menu"]'))
      .filter(menu => {
        const style = window.getComputedStyle(menu);
        return menu.offsetParent !== null && 
               style.visibility !== 'hidden' && 
               style.display !== 'none';
      });
    
    // If we have multiple menus open and a tracked path, use it
    if (allVisibleMenus.length > 1) {
      return [...currentMenuPath, label].join(" > ");
    }
  }
  
  // Fallback: try to determine path from DOM structure for single-level menus
  let path = [label];
  
  // Add the top-level menu
  const topMenu = document.querySelector('div[role="menubar"] [aria-expanded="true"]');
  if (topMenu) {
    const topLabel = cleanText(topMenu.innerText || topMenu.textContent);
    if (topLabel && path[0] !== topLabel) {
      path.unshift(topLabel);
    }
  }

  return path.join(" > ");
}

// Injects stars into menus
function injectStarsIntoMenu(menu) {
  const items = menu.querySelectorAll('[role="menuitem"]');

  safeStorageGet("pinnedFunctions", (data) => {
    const pinned = data.pinnedFunctions || [];

    items.forEach((item) => {
      if (item.querySelector(".pin-star")) return;
      if (item.offsetParent === null) return;

      const label = cleanText(
        item.querySelector(".goog-menuitem-content")?.innerText ||
          item.innerText
      );
      if (!label || item.getAttribute("aria-haspopup") === "true") return;

      const path = getFullMenuPath(item);
      if (!path) return;

      const star = document.createElement("span");
      star.className = "pin-star";
      star.textContent = pinned.includes(path) ? "⭐" : "☆";
      star.style.cssText =
        "float:right; margin-left:0px; cursor:pointer; font-size: 24px;";

      // Updated to prevent all interaction
      star.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        e.preventDefault();
      });
      star.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        togglePin(path);
        star.textContent = star.textContent === "⭐" ? "☆" : "⭐";
      });

      const target = item.querySelector(".goog-menuitem-content") || item;
      target.appendChild(star);
      target.id = path;
    });
  });
}

// Setup function on load
function observeMenus() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const added of mutation.addedNodes) {
        if (!(added instanceof HTMLElement)) continue;
        if (added.getAttribute?.("role") === "menu") {
          injectStarsIntoMenu(added);
          
          // Track menu opening and update current path
          updateCurrentMenuPath();
        }
      }
    }
  });

  
  const attributeObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && 
          (mutation.attributeName === 'class' || mutation.attributeName === 'aria-selected')) {
        const target = mutation.target;
        if (target.getAttribute?.('role') === 'menuitem' && 
            target.getAttribute?.('aria-haspopup') === 'true') {
          // A submenu item state changed, update our path tracking
          setTimeout(updateCurrentMenuPath, 50);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  attributeObserver.observe(document.body, { 
    attributes: true, 
    subtree: true, 
    attributeFilter: ['class', 'aria-selected'] 
  });
}

// Track the current menu path as user navigates
function updateCurrentMenuPath() {
  currentMenuPath = [];
  
  // Get the top-level menu
  const topMenu = document.querySelector('div[role="menubar"] [aria-expanded="true"]');
  if (topMenu) {
    const topLabel = cleanText(topMenu.innerText || topMenu.textContent);
    if (topLabel) {
      currentMenuPath.push(topLabel);
    }
  }
  
  // Get all visible menus in order
  const allVisibleMenus = Array.from(document.querySelectorAll('[role="menu"]'))
    .filter(menu => {
      const style = window.getComputedStyle(menu);
      return menu.offsetParent !== null && 
             style.visibility !== 'hidden' && 
             style.display !== 'none';
    })
    .sort((a, b) => {
      // Sort by left position (parent menus are typically to the left)
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return aRect.left - bRect.left;
    });
  
  // For each menu (except the last), find the highlighted submenu item
  for (let i = 0; i < allVisibleMenus.length - 1; i++) {
    const menu = allVisibleMenus[i];
    const submenuItems = Array.from(menu.querySelectorAll('[role="menuitem"][aria-haspopup="true"]'))
      .filter(el => el.offsetParent !== null);
    
    // Look for highlighted or selected items
    let activeItem = submenuItems.find(el => 
      el.classList.contains('goog-menuitem-highlight') ||
      el.classList.contains('goog-menuitem-selected') ||
      el.getAttribute('aria-selected') === 'true'
    );
    
    // If no highlighted item, try to find the one that logically opened the next menu
    if (!activeItem && submenuItems.length > 0) {
      const nextMenuRect = allVisibleMenus[i + 1]?.getBoundingClientRect();
      if (nextMenuRect) {
        // Find the submenu item closest to where the next menu appears
        let closestItem = submenuItems[0];
        let minDistance = Infinity;
        
        for (const submenuItem of submenuItems) {
          const itemRect = submenuItem.getBoundingClientRect();
          const distance = Math.abs(itemRect.top - nextMenuRect.top);
          if (distance < minDistance) {
            minDistance = distance;
            closestItem = submenuItem;
          }
        }
        activeItem = closestItem;
      }
    }
    
    if (activeItem) {
      const label = cleanText(
        activeItem.querySelector(".goog-menuitem-content")?.innerText ||
        activeItem.innerText ||
        activeItem.textContent
      );
      if (label) {
        currentMenuPath.push(label);
      }
    }
  }
}

function createToolbar() {
  const bar = document.createElement("div");
  bar.id = "quickbar";
  bar.style.position = "fixed";
  bar.style.top = "100px";
  bar.style.right = "20px";
  bar.style.background = "#fff";
  bar.style.border = "1px solid #ccc";
  bar.style.padding = "10px";
  bar.style.zIndex = 9999;
  bar.style.cursor = "default";

  // === Title bar ===
  const titleBar = document.createElement("div");
  titleBar.style.display = "flex";
  titleBar.style.justifyContent = "space-between";
  titleBar.style.gap = "25px";
  titleBar.style.alignItems = "center";

  const title = document.createElement("img");
  title.draggable = false;
  title.alt = "StarBar";
  title.style.width = "45px";
  title.style.height = "auto";
  title.style.display = "block";
  title.style.cursor = "pointer";

  const defaultSrc = safeGetURL("star-default.svg");
  const hoverSrc = safeGetURL("star-hover.svg");

  title.src = defaultSrc;
  title.draggable = false;

  title.addEventListener("mouseenter", () => {
    title.src = hoverSrc;
  });
  title.addEventListener("mouseleave", () => {
    title.src = defaultSrc;
  });

  titleBar.appendChild(title);

  // === Draggable handle bar ===
  const dragHandleWrapper = document.createElement("div");
  dragHandleWrapper.style.display = "flex";
  dragHandleWrapper.style.justifyContent = "center";

  const dragHandle = document.createElement("img");
  dragHandle.src = safeGetURL("gripper.svg");
  dragHandle.alt = "Gripper";
  dragHandle.style.width = "25px";
  dragHandle.style.cursor = "move";
  dragHandle.draggable = false;

  dragHandleWrapper.appendChild(dragHandle);

  titleBar.appendChild(dragHandleWrapper);

  // === Edit button ===
  const editButton = document.createElement("button");
  editButton.innerText = "✏️";
  editButton.style.border = "none";
  editButton.style.background = "transparent";
  editButton.style.cursor = "pointer";
  editButton.style.fontSize = "18px";
  editButton.style.marginLeft = "1px";
  editButton.style.display = "none";

  editButton.onclick = () => {
    editingMode = !editingMode;
    editButton.innerText = editingMode ? "✔️" : "✏️";
    updateQuickbar();
  };

  bar.editButton = editButton;
  titleBar.appendChild(editButton);

  // === Content container ===
  const container = document.createElement("div");
  container.id = "quickbar-buttons";

  const content = document.createElement("div");
  content.appendChild(container);

  // === Append everything ===
  bar.appendChild(titleBar);
  bar.appendChild(content);
  document.body.appendChild(bar);

  // === Make only the star and gripper draggable ===
  makeDraggable(title, bar);
  makeDraggable(dragHandle, bar);

  // === Collapse/expand functionality ===
  let dragStartX = 0,
    dragStartY = 0;
  let isDragging = false;

  title.addEventListener("mousedown", (e) => {
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    isDragging = false;
  });

  title.addEventListener("mouseup", (e) => {
    const dx = Math.abs(e.clientX - dragStartX);
    const dy = Math.abs(e.clientY - dragStartY);
    if (dx < 5 && dy < 5) {
      titleCollapsed = !titleCollapsed;
      updateQuickbar();

      Array.from(bar.children).forEach((child) => {
        if (child !== titleBar) {
          child.style.display = titleCollapsed ? "none" : "";
        }
      });

      Array.from(titleBar.children).forEach((child) => {
        if (child !== title) {
          child.style.display = titleCollapsed ? "none" : "";
        }
      });

      bar.style.background = titleCollapsed ? "transparent" : "#fff";
      bar.style.border = titleCollapsed ? "none" : "1px solid #ccc";
      bar.style.padding = titleCollapsed ? "0px" : "10px";
    }
  });

  updateQuickbar();
}

// Function that allows certain components to be draggable
function makeDraggable(handle, target) {
  let isDragging = false;
  let offsetX, offsetY;

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    isDragging = true;
    offsetX = e.clientX - target.getBoundingClientRect().left;
    offsetY = e.clientY - target.getBoundingClientRect().top;
    target.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      target.style.left = e.clientX - offsetX + "px";
      target.style.top = e.clientY - offsetY + "px";
      target.style.right = "auto";
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    target.style.userSelect = "auto";
  });
}

window.addEventListener("load", () => {
  createToolbar();
  observeMenus();
  
  // Reset menu path when menus are closed (like pressing Escape)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      currentMenuPath = [];
    }
  });
  
  // Reset menu path when clicking outside menus
  document.addEventListener("click", (e) => {
    const clickedMenu = e.target.closest('[role="menu"], [role="menubar"]');
    if (!clickedMenu) {
      currentMenuPath = [];
    }
  });
});

window.addEventListener("contextmenu", (e) => {
  const target = e.target.closest("[aria-label], [title]");
  if (!target) return;

  const colorMenu = target.closest(
    ".docs-material-colorpalette, .docs-material-colorswatch, .goog-menu"
  );
  if (!colorMenu) return;

  e.preventDefault();
  e.stopPropagation();

  const label =
    target.getAttribute("aria-label") || target.getAttribute("title");
  if (!label) return;

  let prefix = "Color";
  const parent = document.querySelector(
    '[aria-label*="Fill color"], [aria-label*="Text color"]'
  );
  if (parent?.getAttribute("aria-label")?.includes("Fill"))
    prefix = "Fill color";
  if (parent?.getAttribute("aria-label")?.includes("Text"))
    prefix = "Text color";

  const path = `${prefix} > ${label}`;

  safeStorageGet(["pinnedFunctions"], (data) => {
    const pins = data.pinnedFunctions || [];
    if (!pins.includes(path)) {
      pins.push(path);
      safeStorageSet({ pinnedFunctions: pins }, updateQuickbar);
    }
  });
});