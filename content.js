// content.js
let lastTopMenu = null;
let editingMode = false;
let titleCollapsed = false;
let currentMenuPath = [];
let lastClickedColorButton = null; 


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


function triggerMenuPath(path) {
  console.log("=== TRIGGER MENU PATH ===");
  console.log("Full path:", path);
  
  const labels = path.split(" > ").map((l) => l.trim());
  const [first, ...rest] = labels;
  
  console.log("First:", first);
  console.log("Rest:", rest);

 
  if (first === "Text color" || first === "Fill color") {
    console.log("MATCHED COLOR CASE:", first);
    
    const possibleLabels = [];
    if (first === "Fill color") {
      possibleLabels.push("Fill color", "Fill colour", "Background color", "Background colour", "Cell color", "Cell colour");
    } else {
      possibleLabels.push("Text color", "Text colour", "Font color", "Font colour");
    }
    
    let btn = null;
    for (const label of possibleLabels) {
      btn = Array.from(document.querySelectorAll("[aria-label]")).find(
        (el) => cleanText(el.getAttribute("aria-label")) === cleanText(label)
      );
      if (btn) {
        console.log(`Found ${first} button with label: "${btn.getAttribute("aria-label")}"`);
        break;
      }
    }

    // If still not found, try more generic selectors
    if (!btn && first === "Fill color") {
      const fillColorSelectors = [
        '[data-tooltip*="fill"]',
        '[data-tooltip*="background"]',
        '[aria-label*="fill"]',
        '[aria-label*="background"]',
        '.docs-icon-fill-color',
        '.docs-icon-background-color'
      ];
      
      for (const selector of fillColorSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          btn = elements[0];
          console.log(`Found fill color button using selector: ${selector}`);
          break;
        }
      }
    }

    if (!btn) {
      
      const allButtons = Array.from(document.querySelectorAll("[aria-label]"))
        .filter(el => {
          const label = el.getAttribute("aria-label").toLowerCase();
          return label.includes("color") || label.includes("colour") || label.includes("fill") || label.includes("background");
        })
        .map(el => el.getAttribute("aria-label"));
      
      console.log(`Could not find "${first}" button. Available color-related buttons:`, allButtons);
      alert(`Could not find "${first}" button. Check console for available options.`);
      return;
    }

   
    console.log(`Clicking ${first} button...`);
    
    
    simulateClick(btn);

    
    const targetColor = cleanText(rest.join(" > "));
    console.log(`Looking for color: "${targetColor}"`);
    
    const tryClickColor = (attempt = 1) => {
      console.log(`Color search attempt ${attempt} for ${first}`);
      
      // For fill color, also look for dropdown menus that might appear
      if (first === "Fill color") {
        const dropdowns = document.querySelectorAll('[role="listbox"], [role="menu"], .goog-menu');
        console.log(`Fill color dropdowns found: ${dropdowns.length}`);
        
        dropdowns.forEach((dropdown, index) => {
          if (dropdown.offsetParent !== null) {
            console.log(`Dropdown ${index} visible with ${dropdown.children.length} children`);
          }
        });
      }
      
      // Look for color swatches in the color picker - cast a wider net
      const allElements = Array.from(document.querySelectorAll("*")).filter(el => {
        const className = el.className || "";
        const classStr = typeof className === 'string' ? className : (className.toString ? className.toString() : "");
        
        return el.offsetParent !== null && (
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          el.getAttribute("data-value") ||
          classStr.includes("color") ||
          classStr.includes("palette") ||
          el.style.backgroundColor ||
          (first === "Fill color" && (
            classStr.includes("fill") ||
            classStr.includes("background") ||
            el.getAttribute("aria-label")?.toLowerCase().includes("fill")
          ))
        );
      });
      
      console.log(`Found ${allElements.length} potential color elements`);
      
      // Try exact match first
      let colorButtons = allElements.filter(el => {
        const label = el.getAttribute("aria-label");
        const title = el.getAttribute("title");
        const dataValue = el.getAttribute("data-value");
        
        return cleanText(label) === targetColor ||
               cleanText(title) === targetColor ||
               cleanText(dataValue) === targetColor;
      });

      console.log(`Exact matches found: ${colorButtons.length}`);

      // If no exact match, try partial/fuzzy matching
      if (colorButtons.length === 0) {
        const targetWords = targetColor.toLowerCase().split(/\s+/);
        console.log(`Searching for words: ${targetWords.join(', ')}`);
        
        colorButtons = allElements.filter(el => {
          const label = (el.getAttribute("aria-label") || el.getAttribute("title") || "").toLowerCase();
          const hasAllWords = targetWords.every(word => label.includes(word));
          const hasColorReference = label.includes("color") || label.includes("cyan") || label.includes("red") || 
                                   label.includes("blue") || label.includes("green") || label.includes("yellow") ||
                                   label.includes("orange") || label.includes("purple") || label.includes("pink") ||
                                   label.includes("brown") || label.includes("gray") || label.includes("grey");
          return hasAllWords && hasColorReference;
        });
        
        console.log(`Fuzzy matches found: ${colorButtons.length}`);
      }

      // Also try looking for color swatches by common selectors and background color
      if (colorButtons.length === 0) {
        const colorSwatches = Array.from(document.querySelectorAll(
          '.docs-material-colorpalette-cell, .goog-palette-cell, [role="gridcell"], .color-cell, .palette-cell, [style*="background-color"]'
        )).filter(el => el.offsetParent !== null);
        
        console.log(`Found ${colorSwatches.length} color swatches`);
        
        colorButtons = colorSwatches.filter(el => {
          const label = (el.getAttribute("aria-label") || el.getAttribute("title") || "").toLowerCase();
          const targetWords = targetColor.toLowerCase().split(/\s+/);
          return targetWords.some(word => label.includes(word));
        });
        
        console.log(`Swatch matches found: ${colorButtons.length}`);
      }

      if (colorButtons.length > 0) {
        const selectedButton = colorButtons[0];
        console.log(`Found color match: "${selectedButton.getAttribute("aria-label") || selectedButton.getAttribute("title")}" (${selectedButton.className})`);
        
        // Check if cells are selected
        const selectedCells = document.querySelectorAll('.docs-sheet-active-cell, .docs-sheet-selected-cell, [aria-selected="true"]');
        console.log(`Selected cells found: ${selectedCells.length}`);
        
        if (selectedCells.length === 0) {
          console.warn('No cells appear to be selected. Color may not apply.');
        }
        
        console.log(`About to click color: ${selectedButton.tagName} with classes: ${selectedButton.className}`);
        
        // Simple and direct color click for both fill and text
        console.log(`Clicking color swatch for ${first}`);
        simulateClick(selectedButton);
        
        // Wait and verify color application
        setTimeout(() => {
          console.log(`${first} color application completed`);
          
          // Check if the color picker is still open (might indicate the click didn't work)
          const colorPickers = document.querySelectorAll('[role="dialog"], .goog-menu, .docs-material-colorpalette');
          const openPickers = Array.from(colorPickers).filter(picker => 
            picker.offsetParent !== null && 
            getComputedStyle(picker).visibility !== 'hidden'
          );
          
          if (openPickers.length > 0) {
            console.warn('Color picker still appears to be open - color may not have been applied');
          } else {
            console.log('Color picker closed - color should be applied');
          }
        }, 500);
      } else if (attempt < 3) {
        // Retry up to 3 times with increasing delays
        console.log(`No color found, retrying in ${300 * attempt}ms...`);
        setTimeout(() => tryClickColor(attempt + 1), 300 * attempt);
      } else {
        // Debug: log available colors to help troubleshoot
        console.log("=== DEBUG INFO ===");
        console.log("Target color:", targetColor);
        console.log("Button type:", first);
        
        const visibleElements = allElements.slice(0, 20); // Limit to first 20 to avoid spam
        console.log("Sample visible elements with color info:", visibleElements.map(el => ({
          tag: el.tagName,
          label: el.getAttribute("aria-label"),
          title: el.getAttribute("title"), 
          dataValue: el.getAttribute("data-value"),
          className: el.className,
          backgroundColor: el.style.backgroundColor
        })));
        
        alert(`Could not find color "${rest.join(" > ")}" for ${first}. Check console for debug info.`);
      }
    };

    setTimeout(tryClickColor, 500); // Increased initial delay
    return;
  }

  // === SIMPLE: Convert generic "Color" to "Text color" ===
  if (first === "Color") {
    console.log("Converting generic Color path to Text color:", path);
    triggerMenuPath(`Text color > ${rest.join(" > ")}`);
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
        console.log("QUICKBAR: Fill color detected:", func);
      } else if (func.includes("Text color")) {
        iconSrc = safeGetURL("A.svg");
        console.log("QUICKBAR: Text color detected:", func);
      } else {
        console.log("QUICKBAR: Unknown color type:", func);
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
  
  
  const isColorItem = label && (
    label.toLowerCase().includes('color') ||
    label.match(/\b(red|green|blue|yellow|orange|purple|pink|cyan|magenta|black|white|gray|grey)\b/i) ||
    label.match(/\b(light|dark)\s+(red|green|blue|yellow|orange|purple|pink|cyan|magenta|gray|grey)\b/i) ||
    label.match(/\b(red|green|blue|yellow|orange|purple|pink|cyan|magenta|gray|grey)\s+\d+\b/i)
  );
  
  if (isColorItem) {
    console.log("Detected color item:", label);
    console.log("Last clicked color button:", lastClickedColorButton);
    
    
    console.log("=== COLOR DETECTION DEBUG ===");
    console.log("lastClickedColorButton:", lastClickedColorButton);
    
    
    let isFromFillColor = false;
    let isFromTextColor = false;
    
    
    if (lastClickedColorButton === 'fill') {
      isFromFillColor = true;
      console.log("Method 1: Detected FILL from tracked click");
    } else if (lastClickedColorButton === 'text') {
      isFromTextColor = true;
      console.log("Method 1: Detected TEXT from tracked click");
    }
    
    // Method 2: Check BOTH fill and text color buttons for active states
    if (!isFromFillColor && !isFromTextColor) {
      const fillButtons = Array.from(document.querySelectorAll('*[aria-label], *[data-tooltip], *[title]')).filter(btn => {
        const btnLabel = (btn.getAttribute('aria-label') || btn.getAttribute('data-tooltip') || btn.getAttribute('title') || '').toLowerCase();
        return btnLabel.includes('fill') || btnLabel.includes('background') || btnLabel.includes('cell color');
      });
      
      const textButtons = Array.from(document.querySelectorAll('*[aria-label], *[data-tooltip], *[title]')).filter(btn => {
        const btnLabel = (btn.getAttribute('aria-label') || btn.getAttribute('data-tooltip') || btn.getAttribute('title') || '').toLowerCase();
        return (btnLabel.includes('text') && btnLabel.includes('color')) || btnLabel.includes('font color');
      });
      
      console.log("Checking", fillButtons.length, "fill buttons and", textButtons.length, "text buttons");
      
      // Check fill buttons
      for (const btn of fillButtons) {
        const btnLabel = (btn.getAttribute('aria-label') || btn.getAttribute('data-tooltip') || btn.getAttribute('title') || '').toLowerCase();
        const isPressed = btn.getAttribute('aria-pressed') === 'true';
        const isChecked = btn.classList.contains('goog-toolbar-button-checked');
        const isActive = btn.classList.contains('active');
        const hasSelectedClass = btn.classList.contains('goog-toolbar-button-selected');
        
        console.log("Fill button:", btnLabel, "pressed:", isPressed, "checked:", isChecked, "active:", isActive, "selected:", hasSelectedClass);
        
        if (isPressed || isChecked || isActive || hasSelectedClass) {
          isFromFillColor = true;
          console.log("Method 2: Detected active fill button:", btnLabel);
          break;
        }
      }
      
      // Check text buttons (only if fill not active)
      if (!isFromFillColor) {
        for (const btn of textButtons) {
          const btnLabel = (btn.getAttribute('aria-label') || btn.getAttribute('data-tooltip') || btn.getAttribute('title') || '').toLowerCase();
          const isPressed = btn.getAttribute('aria-pressed') === 'true';
          const isChecked = btn.classList.contains('goog-toolbar-button-checked');
          const isActive = btn.classList.contains('active');
          const hasSelectedClass = btn.classList.contains('goog-toolbar-button-selected');
          
          console.log("Text button:", btnLabel, "pressed:", isPressed, "checked:", isChecked, "active:", isActive, "selected:", hasSelectedClass);
          
          if (isPressed || isChecked || isActive || hasSelectedClass) {
            isFromTextColor = true;
            console.log("Method 2: Detected active text button:", btnLabel);
            break;
          }
        }
      }
    }
    
    
    if (!isFromFillColor && !isFromTextColor) {
      console.log("No clear button state, checking DOM selectors...");
      
      const fillColorIndicators = [
        '.docs-icon-fill-color',
        '[data-command-name*="fill"]',
        '[data-command-name*="background"]'
      ];
      
      const textColorIndicators = [
        '.docs-icon-text-color', 
        '[data-command-name*="text"]',
        '[aria-label*="Text color"]'
      ];
      
      
      for (const selector of fillColorIndicators) {
        const element = document.querySelector(selector);
        if (element && (element.classList.contains('goog-toolbar-button-checked') || element.getAttribute('aria-pressed') === 'true')) {
          isFromFillColor = true;
          console.log("Method 3: Detected fill color via selector:", selector);
          break;
        }
      }
      
      
      if (!isFromFillColor) {
        for (const selector of textColorIndicators) {
          const element = document.querySelector(selector);
          if (element && (element.classList.contains('goog-toolbar-button-checked') || element.getAttribute('aria-pressed') === 'true')) {
            isFromTextColor = true;
            console.log("Method 3: Detected text color via selector:", selector);
            break;
          }
        }
      }
    }
    
    // FINAL DECISION with proper priority
    if (isFromTextColor && !isFromFillColor) {
      console.log("=== SAVING AS TEXT COLOR ===");
      return `Text color > ${label}`;
    } else if (isFromFillColor && !isFromTextColor) {
      console.log("=== SAVING AS FILL COLOR ===");
      return `Fill color > ${label}`;
    } else if (isFromTextColor && isFromFillColor) {
      // Both detected - use tracking as tiebreaker
      if (lastClickedColorButton === 'text') {
        console.log("=== BOTH DETECTED - USING TEXT FROM TRACKING ===");
        return `Text color > ${label}`;
      } else if (lastClickedColorButton === 'fill') {
        console.log("=== BOTH DETECTED - USING FILL FROM TRACKING ===");
        return `Fill color > ${label}`;
      } else {
        console.log("=== BOTH DETECTED - DEFAULTING TO TEXT ===");
        return `Text color > ${label}`;
      }
    } else {
      // Neither clearly detected - default to text
      console.log("=== NO CLEAR DETECTION - DEFAULTING TO TEXT ===");
      return `Text color > ${label}`;
    }
    
    // Fallback: try to detect from DOM state
    const activeFillColorBtn = document.querySelector('[aria-label*="Fill"][aria-label*="color"], [aria-label*="Fill"][aria-label*="colour"], [aria-label*="Background"][aria-label*="color"]');
    const activeTextColorBtn = document.querySelector('[aria-label*="Text"][aria-label*="color"], [aria-label*="Text"][aria-label*="colour"]');
    
    // Check which one appears to be in an active state
    if (activeFillColorBtn && (activeFillColorBtn.getAttribute('aria-pressed') === 'true' || activeFillColorBtn.classList.contains('goog-toolbar-button-checked'))) {
      console.log("Pinning as Fill color based on DOM state:", label);
      return `Fill color > ${label}`;
    } else if (activeTextColorBtn && (activeTextColorBtn.getAttribute('aria-pressed') === 'true' || activeTextColorBtn.classList.contains('goog-toolbar-button-checked'))) {
      console.log("Pinning as Text color based on DOM state:", label);
      return `Text color > ${label}`;
    }
    
    // Final fallback: default to text color
    console.log("No reliable color type detection, defaulting to text color");
    return `Text color > ${label}`;
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
// Track color button clicks
function trackColorButtonClicks() {
  console.log("=== TRACKING COLOR BUTTONS ===");
  
  // Add click listeners to ALL buttons, not just color ones
  const allButtons = document.querySelectorAll('button, div[role="button"], span[role="button"], *[onclick], *[aria-label], *[data-tooltip]');
  console.log("Found", allButtons.length, "potential buttons to track");
  
  let trackedCount = 0;
  
  allButtons.forEach(button => {
    if (!button.hasAttribute('data-color-tracked')) {
      const label = (button.getAttribute('aria-label') || button.getAttribute('data-tooltip') || button.getAttribute('title') || button.textContent || '').toLowerCase();
      
      
      if (label.includes('fill') || label.includes('background') || label.includes('cell color') || 
          label.includes('text color') || label.includes('font color') || label.includes('colour')) {
        
        button.setAttribute('data-color-tracked', 'true');
        trackedCount++;
        
        console.log("Tracking button:", label.substring(0, 50));
        
        button.addEventListener('click', (e) => {
          console.log("=== BUTTON CLICKED ===");
          console.log("Button label:", label);
          
          if (label.includes('fill') || label.includes('background') || label.includes('cell color')) {
            lastClickedColorButton = 'fill';
            console.log('>>> TRACKED FILL COLOR BUTTON CLICK <<<');
          } else if (label.includes('text') || label.includes('font')) {
            lastClickedColorButton = 'text';
            console.log('>>> TRACKED TEXT COLOR BUTTON CLICK <<<');
          }
          
          
          setTimeout(() => {
            if (lastClickedColorButton) {
              console.log("Clearing color button tracking after 30 seconds");
              lastClickedColorButton = null;
            }
          }, 30000);
        });
      }
    }
  });
  
  console.log("Tracked", trackedCount, "color-related buttons");
}

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

  
  trackColorButtonClicks();
  
  
  setInterval(trackColorButtonClicks, 2000);
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

// Initialize when DOM is ready
function init() {
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
}

window.addEventListener("load", init);

// Re-initialize when page navigation occurs
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(init, 1000);
  }
}).observe(document, {subtree: true, childList: true});

// Also re-track color buttons when significant DOM changes occur
let colorTrackingObserver = new MutationObserver((mutations) => {
  let shouldRetrack = false;
  
  mutations.forEach(mutation => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) { // Element node
          const text = (node.textContent || '').toLowerCase();
          const label = (node.getAttribute && (node.getAttribute('aria-label') || node.getAttribute('data-tooltip') || '')).toLowerCase();
          
          if (text.includes('color') || label.includes('color') || 
              text.includes('fill') || label.includes('fill') ||
              text.includes('text') || label.includes('text')) {
            shouldRetrack = true;
          }
        }
      });
    }
  });
  
  if (shouldRetrack) {
    console.log("DOM changed, re-tracking color buttons...");
    setTimeout(trackColorButtonClicks, 500);
  }
});

// Start observing after initial load
window.addEventListener("load", () => {
  setTimeout(() => {
    colorTrackingObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }, 2000);
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

  console.log("=== RIGHT-CLICK CONTEXT MENU ===");
  console.log("Color label:", label);

  // ENHANCED DETECTION FOR RIGHT-CLICK CONTEXT
  let prefix = "Text color"; // Default fallback
  let isFromFillColor = false;
  let isFromTextColor = false;
  
  // Method 1: Check BOTH fill and text color buttons to see which is active
  const fillColorButtons = Array.from(document.querySelectorAll('*[aria-label], *[data-tooltip], *[title]')).filter(btn => {
    const btnLabel = (btn.getAttribute('aria-label') || btn.getAttribute('data-tooltip') || btn.getAttribute('title') || '').toLowerCase();
    return btnLabel.includes('fill') || btnLabel.includes('background') || btnLabel.includes('cell color');
  });
  
  const textColorButtons = Array.from(document.querySelectorAll('*[aria-label], *[data-tooltip], *[title]')).filter(btn => {
    const btnLabel = (btn.getAttribute('aria-label') || btn.getAttribute('data-tooltip') || btn.getAttribute('title') || '').toLowerCase();
    return (btnLabel.includes('text') && btnLabel.includes('color')) || btnLabel.includes('font color');
  });
  
  console.log("Found", fillColorButtons.length, "fill color buttons and", textColorButtons.length, "text color buttons");
  
  // Check fill color buttons
  for (const btn of fillColorButtons) {
    const isPressed = btn.getAttribute('aria-pressed') === 'true';
    const isChecked = btn.classList.contains('goog-toolbar-button-checked');
    const isActive = btn.classList.contains('active');
    const hasSelectedClass = btn.classList.contains('goog-toolbar-button-selected');
    
    console.log("Fill button check:", btn.getAttribute('aria-label'), "pressed:", isPressed, "checked:", isChecked, "active:", isActive);
    
    if (isPressed || isChecked || isActive || hasSelectedClass) {
      isFromFillColor = true;
      console.log("Context menu: Detected active fill button:", btn.getAttribute('aria-label'));
      break;
    }
  }
  
  // Check text color buttons  
  for (const btn of textColorButtons) {
    const isPressed = btn.getAttribute('aria-pressed') === 'true';
    const isChecked = btn.classList.contains('goog-toolbar-button-checked');
    const isActive = btn.classList.contains('active');
    const hasSelectedClass = btn.classList.contains('goog-toolbar-button-selected');
    
    console.log("Text button check:", btn.getAttribute('aria-label'), "pressed:", isPressed, "checked:", isChecked, "active:", isActive);
    
    if (isPressed || isChecked || isActive || hasSelectedClass) {
      isFromTextColor = true;
      console.log("Context menu: Detected active text button:", btn.getAttribute('aria-label'));
      break;
    }
  }
  
  
  if (lastClickedColorButton === 'fill' && !isFromTextColor) {
    isFromFillColor = true;
    console.log("Context menu: Using recent button tracking for fill");
  } else if (lastClickedColorButton === 'text' && !isFromFillColor) {
    isFromTextColor = true;
    console.log("Context menu: Using recent button tracking for text");
  }
  
  
  if (!isFromFillColor && !isFromTextColor) {
    console.log("No clear button state detected, checking DOM context...");
    
    
    const fillColorIndicators = [
      '.docs-icon-fill-color',
      '[data-command-name*="fill"]',
      '[data-command-name*="background"]'
    ];
    
    const textColorIndicators = [
      '.docs-icon-text-color',
      '[data-command-name*="text"]',
      '[aria-label*="Text color"]'
    ];
    
    // Check fill indicators
    for (const selector of fillColorIndicators) {
      const element = document.querySelector(selector);
      if (element && (element.classList.contains('goog-toolbar-button-checked') || element.getAttribute('aria-pressed') === 'true')) {
        isFromFillColor = true;
        console.log("Context menu: Detected fill color via selector:", selector);
        break;
      }
    }
    
    // Check text indicators (only if fill not found)
    if (!isFromFillColor) {
      for (const selector of textColorIndicators) {
        const element = document.querySelector(selector);
        if (element && (element.classList.contains('goog-toolbar-button-checked') || element.getAttribute('aria-pressed') === 'true')) {
          isFromTextColor = true;
          console.log("Context menu: Detected text color via selector:", selector);
          break;
        }
      }
    }
  }
  
  
  if (isFromTextColor && !isFromFillColor) {
    prefix = "Text color";
    console.log("=== CONTEXT MENU: DETERMINED TEXT COLOR ===");
  } else if (isFromFillColor && !isFromTextColor) {
    prefix = "Fill color";
    console.log("=== CONTEXT MENU: DETERMINED FILL COLOR ===");
  } else if (isFromTextColor && isFromFillColor) {
    // Both detected - use recent tracking as tiebreaker
    if (lastClickedColorButton === 'text') {
      prefix = "Text color";
      console.log("=== CONTEXT MENU: BOTH DETECTED - USING TEXT FROM TRACKING ===");
    } else if (lastClickedColorButton === 'fill') {
      prefix = "Fill color";
      console.log("=== CONTEXT MENU: BOTH DETECTED - USING FILL FROM TRACKING ===");
    } else {
      // Default to text color when unsure
      prefix = "Text color";
      console.log("=== CONTEXT MENU: BOTH DETECTED - DEFAULTING TO TEXT ===");
    }
  } else {
    
    prefix = "Text color";
    console.log("=== CONTEXT MENU: NO CLEAR DETECTION - DEFAULTING TO TEXT ===");
  }

  const path = `${prefix} > ${label}`;
  console.log("Context menu final path:", path);

  safeStorageGet(["pinnedFunctions"], (data) => {
    const pins = data.pinnedFunctions || [];
    if (!pins.includes(path)) {
      pins.push(path);
      safeStorageSet({ pinnedFunctions: pins }, updateQuickbar);
    }
  });
});