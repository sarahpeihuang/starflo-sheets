// content.js
// StarBar Chrome Extension - Google Sheets productivity toolbar
// Features:
// - Pin frequently used functions to a floating toolbar
// - Hotkeys: 
//   • Ctrl+Alt+Z/X/S (Win/Linux) / Cmd+Option+Z/X/S (Mac) for functions 1-3 [PRIMARY]
//   • Alt+Shift+Z/X/S (⌥⇧Z/X/S on Mac) for functions 1-3 [FALLBACK]
//   • Ctrl+1 triggers the oldest (first) saved function (legacy support)

// DEBUG: Set to true to simulate Mac on Linux for testing
// In console, run: window.STARBAR_FORCE_MAC = true; location.reload();
let STARBAR_FORCE_MAC = false;

// Utility function for robust Mac detection
function isMacPlatform() {
  if (window.STARBAR_FORCE_MAC === true) {
    return true;
  }
  return navigator.platform.includes('Mac') || navigator.userAgent.includes('Mac');
}

let lastTopMenu = null;
let editingMode = false;
let titleCollapsed = false;
let currentMenuPath = [];
let lastClickedColorButton = null;
let isViewOnlySheet = false;
let menuObserver = null;
let attributeObserver = null; 

// Helper function to get hotkey text for a given index
function getHotkeyText(index) {
  const isMac = navigator.platform.includes('Mac');
  const keys = ['Z', 'X', 'S'];
  if (index < 0 || index >= keys.length) return '';
  return isMac ? `(⌘⌥${keys[index]})` : `(Ctrl+Alt+${keys[index]})`;
}

// Helper function to get full hotkey display for tooltip
function getHotkeyDisplay(index) {
  const isMac = navigator.platform.includes('Mac');
  const keys = ['Z', 'X', 'S'];
  if (index < 0 || index >= keys.length) return '';
  return isMac ? `⌘⌥${keys[index]} or ⌥⇧${keys[index]}` : `Ctrl+Alt+${keys[index]} or Alt+Shift+${keys[index]}`;
}

// Helper function to dispatch Escape key event
function dispatchEscape() {
  document.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Escape",
    code: "Escape",
    keyCode: 27,
  }));
}

// Helper function to check if a button is in active state
function isButtonActive(btn) {
  return btn.getAttribute("aria-pressed") === "true" ||
         btn.classList.contains("goog-toolbar-button-checked") ||
         btn.classList.contains("active") ||
         btn.classList.contains("goog-toolbar-button-selected");
}

// Helper function to get button label
function getButtonLabel(btn) {
  return (
    btn.getAttribute("aria-label") ||
    btn.getAttribute("data-tooltip") ||
    btn.getAttribute("title") ||
    ""
  ).toLowerCase();
}


function isExtensionContextValid() {
  try { return chrome?.runtime?.id; } catch { return false; }
}

function safeStorageGet(key, callback) {
  if (!isExtensionContextValid()) return callback({ [key]: [] });
  try { chrome.storage.local.get(key, callback); } catch { callback({ [key]: [] }); }
}

function safeStorageSet(data, callback) {
  if (!isExtensionContextValid()) return callback?.();
  try { chrome.storage.local.set(data, callback); } catch { callback?.(); }
}

function safeGetURL(path) {
  const fallback = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>`;
  if (!isExtensionContextValid()) return fallback;
  try { return chrome.runtime.getURL(path); } catch { return fallback; }
}

// Function to detect if the current sheet is view-only
function detectViewOnlySheet() {
  const url = window.location.href;
  if (url.includes('/view') || url.includes('/preview') || url.includes('usp=sharing')) return true;
  if (!document.body || document.readyState === 'loading') return false;
  
  // Check for "View only" badge
  const viewOnlySelectors = ['[title*="View only"]', '[aria-label*="View only"]', '.docs-titlebar-badges', '.docs-activity-indicator', '[data-tooltip*="view only"]'];
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
  const editFeatureSelectors = ['[aria-label*="Share"]', '[aria-label*="Insert"]', '[aria-label*="Format"]', '[aria-label*="Tools"]', '[aria-label*="Extensions"]', '[data-tooltip*="Share"]', 'div[role="menubar"]'];
  const editFeaturesFound = editFeatureSelectors.filter(sel => document.querySelector(sel)).length;
  if (editFeaturesFound < 3) return true;
  
  // Check toolbar buttons count
  const toolbar = document.querySelector('.docs-material');
  if (toolbar && toolbar.querySelectorAll('div[role="button"], button').length < 10) return true;
  
  return false;
}

// Helper function that simulates click action
function simulateClick(el) {
  el.focus?.();
  const rect = el.getBoundingClientRect();
  const opts = { bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0 };
  ["mousedown", "mouseup", "click"].forEach(type => el.dispatchEvent(new MouseEvent(type, opts)));
}

// Enhanced click function for submenu items
function simulateSubmenuClick(el) {
  el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  ["mousedown", "mouseup", "click"].forEach(type => el.dispatchEvent(new MouseEvent(type, { bubbles: true })));
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
  // Close any existing menus first to ensure clean state
  try {
    // Press Escape to close any open menus/dialogs
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true
    }));
    
    // Small delay to let menus close
    setTimeout(() => {
      executeMenuPath(path);
    }, 100);
  } catch (error) {
    executeMenuPath(path);
  }
}

function executeMenuPath(path) {
  const labels = path.split(" > ").map((l) => l.trim());
  const [first, ...rest] = labels;
  if (first === "Text color" || first === "Fill color") {
    const possibleLabels = [];
    if (first === "Fill color") {
      possibleLabels.push(
        "Fill color",
        "Fill colour",
        "Background color",
        "Background colour",
        "Cell color",
        "Cell colour"
      );
    } else {
      possibleLabels.push(
        "Text color",
        "Text colour",
        "Font color",
        "Font colour"
      );
    }

    let btn = null;
    for (const label of possibleLabels) {
      btn = Array.from(document.querySelectorAll("[aria-label]")).find(
        (el) => cleanText(el.getAttribute("aria-label")) === cleanText(label)
      );
      if (btn) break;
    }

    // If still not found, try more generic selectors for fill color
    if (!btn && first === "Fill color") {
      const fillColorSelectors = ['[data-tooltip*="fill"]', '[data-tooltip*="background"]', '[aria-label*="fill"]', '[aria-label*="background"]', ".docs-icon-fill-color", ".docs-icon-background-color"];
      btn = fillColorSelectors.map(sel => document.querySelector(sel)).find(el => el);
    }

    if (!btn) {
      alert(`Could not find "${first}" button. Check console for available options.`);
      return;
    }
    simulateClick(btn);

    const targetColor = cleanText(rest.join(" > "));
    const tryClickColor = (attempt = 1) => {
      // For fill color, also look for dropdown menus that might appear
      if (first === "Fill color") {
        const dropdowns = document.querySelectorAll(
          '[role="listbox"], [role="menu"], .goog-menu'
        );
      }

      // Look for color swatches in the color picker - cast a wider net
      const allElements = Array.from(document.querySelectorAll("*")).filter(
        (el) => {
          const className = el.className || "";
          const classStr =
            typeof className === "string"
              ? className
              : className.toString
              ? className.toString()
              : "";

          return (
            el.offsetParent !== null &&
            (el.getAttribute("aria-label") ||
              el.getAttribute("title") ||
              el.getAttribute("data-value") ||
              classStr.includes("color") ||
              classStr.includes("palette") ||
              el.style.backgroundColor ||
              (first === "Fill color" &&
                (classStr.includes("fill") ||
                  classStr.includes("background") ||
                  el
                    .getAttribute("aria-label")
                    ?.toLowerCase()
                    .includes("fill"))))
          );
        }
      );
      // Try exact match first
      let colorButtons = allElements.filter((el) => {
        const label = el.getAttribute("aria-label");
        const title = el.getAttribute("title");
        const dataValue = el.getAttribute("data-value");

        return (
          cleanText(label) === targetColor ||
          cleanText(title) === targetColor ||
          cleanText(dataValue) === targetColor
        );
      });
      // If no exact match, try partial/fuzzy matching
      if (colorButtons.length === 0) {
        const targetWords = targetColor.toLowerCase().split(/\s+/);
        colorButtons = allElements.filter((el) => {
          const label = (
            el.getAttribute("aria-label") ||
            el.getAttribute("title") ||
            ""
          ).toLowerCase();
          const hasAllWords = targetWords.every((word) => label.includes(word));
          const hasColorReference =
            label.includes("color") ||
            label.includes("cyan") ||
            label.includes("red") ||
            label.includes("blue") ||
            label.includes("green") ||
            label.includes("yellow") ||
            label.includes("orange") ||
            label.includes("purple") ||
            label.includes("pink") ||
            label.includes("brown") ||
            label.includes("gray") ||
            label.includes("grey");
          return hasAllWords && hasColorReference;
        });
      }

      // Also try looking for color swatches by common selectors and background color
      if (colorButtons.length === 0) {
        const colorSwatches = Array.from(
          document.querySelectorAll(
            '.docs-material-colorpalette-cell, .goog-palette-cell, [role="gridcell"], .color-cell, .palette-cell, [style*="background-color"]'
          )
        ).filter((el) => el.offsetParent !== null);
        colorButtons = colorSwatches.filter((el) => {
          const label = (
            el.getAttribute("aria-label") ||
            el.getAttribute("title") ||
            ""
          ).toLowerCase();
          const targetWords = targetColor.toLowerCase().split(/\s+/);
          return targetWords.some((word) => label.includes(word));
        });
      }

      if (colorButtons.length > 0) {
        const selectedButton = colorButtons[0];
        // Simple and direct color click for both fill and text
        simulateClick(selectedButton);

        // Wait and verify color application
        setTimeout(() => {
          // Check if the color picker is still open (might indicate the click didn't work)
          const colorPickers = document.querySelectorAll(
            '[role="dialog"], .goog-menu, .docs-material-colorpalette'
          );
          const openPickers = Array.from(colorPickers).filter(
            (picker) =>
              picker.offsetParent !== null &&
              getComputedStyle(picker).visibility !== "hidden"
          );
        }, 500);
      } else if (attempt < 3) {
        // Retry up to 3 times with increasing delays
        setTimeout(() => tryClickColor(attempt + 1), 300 * attempt);
      } else {
        // Debug: log available colors to help troubleshoot
        const visibleElements = allElements.slice(0, 20); // Limit to first 20 to avoid spam
        alert(
          `Could not find color "${rest.join(
            " > "
          )}" for ${first}. Check console for debug info.`
        );
      }
    };

    setTimeout(tryClickColor, 500); // Increased initial delay
    return;
  }

  // === SIMPLE: Convert generic "Color" to "Text color" ===
  if (first === "Color") {
    triggerMenuPath(`Text color > ${rest.join(" > ")}`);
    return;
  }
  navigateMenuPathImproved(labels);
}

function navigateMenuPathImproved(labelPath) {
  if (labelPath.length === 0) {
    return;
  }
  const topMenuLabel = cleanText(labelPath[0]);

  // Step 1: Find and click the top-level menu
  const topMenu = Array.from(
    document.querySelectorAll('div[role="menubar"] [role="menuitem"]')
  ).find((el) => cleanText(el.textContent) === topMenuLabel);

  if (!topMenu) {
    alert(`Could not find top menu: "${labelPath[0]}"`);
    return;
  }
  simulateClick(topMenu);

  // Step 2: Navigate through the rest of the path
  if (labelPath.length > 1) {
    setTimeout(() => {
      navigateSubmenuPath(labelPath.slice(1), 0);
    }, 250);
  } else {
    // Just opening the top menu, close after a moment
    setTimeout(dispatchEscape, 300);
  }
}

function navigateSubmenuPath(remainingPath, depth, retryCount = 0) {
  if (remainingPath.length === 0) {
    return;
  }

  const targetLabel = cleanText(remainingPath[0]);
  const isLastItem = remainingPath.length === 1;
  setTimeout(() => {
    const allMenus = Array.from(
      document.querySelectorAll('[role="menu"]')
    ).filter((menu) => menu.offsetParent !== null);
    allMenus.forEach((menu, index) => {
      const rect = menu.getBoundingClientRect();
      const items = Array.from(menu.querySelectorAll('[role="menuitem"]'))
        .filter((el) => el.offsetParent !== null)
        .slice(0, 3) // Show first 3 items
        .map((el) => cleanText(el.textContent));
    });

    if (allMenus.length === 0) {
      if (retryCount < 3) {
        setTimeout(() => {
          navigateSubmenuPath(remainingPath, depth, retryCount + 1); // Retry same step
        }, 300);
        return;
      } else {
        alert(
          `Could not find submenu for: "${remainingPath[0]}". The submenu may not have opened properly.`
        );
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
    if (depth > 0 && allMenus.length > 1) {
      const mainMenuRect =
        sortedMenus[sortedMenus.length - 1].getBoundingClientRect();
      const currentMenuRect = currentMenu.getBoundingClientRect();
    }

    const allItems = Array.from(
      currentMenu.querySelectorAll('[role="menuitem"]')
    )
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const contentEl = el.querySelector(".goog-menuitem-content");
        const rawText = contentEl ? contentEl.textContent : el.textContent;
        const cleaned = cleanText(rawText);
        const hasSubmenu = el.getAttribute("aria-haspopup") === "true";
        return { el, rawText, cleaned, hasSubmenu };
      });
    // Find the menu item - try multiple matching strategies
    let menuItem = null;
    let foundItem = null;

    // Strategy 1: Exact match (ignoring arrows)
    const targetLabelClean = targetLabel.replace(/►/g, "").trim();
    foundItem = allItems.find((item) => {
      const itemClean = item.cleaned.replace(/►/g, "").trim();
      return itemClean === targetLabelClean;
    });
    if (foundItem) menuItem = foundItem.el;

    if (!menuItem) {
      const normalizeSpaces = (text) => {
        return text
          .replace(/\s*\(\s*/g, " (")
          .replace(/\s*\)\s*/g, ") ")
          .replace(/\s+/g, " ")
          .trim();
      };

      const targetNormalized = normalizeSpaces(targetLabelClean);
      foundItem = allItems.find((item) => {
        const itemClean = item.cleaned.replace(/►/g, "").trim();
        const itemNormalized = normalizeSpaces(itemClean);
        return itemNormalized === targetNormalized;
      });
      if (foundItem) menuItem = foundItem.el;
    }

    if (!menuItem) {
      foundItem = allItems.find((item) => {
        const itemClean = item.cleaned.replace(/►/g, "").trim();
        return (
          itemClean === targetLabelClean ||
          (item.hasSubmenu && targetLabelClean.startsWith(itemClean))
        );
      });
      if (foundItem) menuItem = foundItem.el;
    }

    if (!menuItem) {
      const removePunctuation = (text) =>
        text.replace(/[^\w]/g, "").toLowerCase();
      const targetFuzzy = removePunctuation(targetLabelClean);

      foundItem = allItems.find((item) => {
        const itemClean = item.cleaned.replace(/►/g, "").trim();
        const itemFuzzy = removePunctuation(itemClean);
        return itemFuzzy === targetFuzzy;
      });
      if (foundItem) menuItem = foundItem.el;
    }

    // Strategy 5: Partial matching both ways
    if (!menuItem) {
      foundItem = allItems.find((item) => {
        const itemClean = item.cleaned.replace(/►/g, "").trim();
        return (
          itemClean.includes(targetLabelClean) ||
          targetLabelClean.includes(itemClean)
        );
      });
      if (foundItem) menuItem = foundItem.el;
    }

    if (!menuItem) {
      const targetWords = targetLabelClean
        .split(/\s+/)
        .filter((w) => w.length > 2);
      foundItem = allItems.find((item) => {
        const itemClean = item.cleaned.replace(/►/g, "").trim();
        const itemWords = itemClean.split(/\s+/).filter((w) => w.length > 2);
        return (
          targetWords.length > 0 &&
          targetWords.every((word) =>
            itemWords.some((iw) => iw.includes(word) || word.includes(iw))
          )
        );
      });
      if (foundItem) menuItem = foundItem.el;
    }

    // Strategy 7: Special cases for common Google Sheets items
    if (!menuItem) {
      const specialCases = {
        "share with others": ["share", "others", "people", "collaborate"],
        email: ["email", "send", "mail"],
        "publish to web": ["publish", "web", "public"],
        download: ["download", "export"],
        "make a copy": ["copy", "duplicate"],
        import: ["import", "upload"],
      };

      const targetKey = Object.keys(specialCases).find(
        (key) =>
          targetLabelClean.includes(key) || key.includes(targetLabelClean)
      );

      if (targetKey) {
        const keywords = specialCases[targetKey];
        foundItem = allItems.find((item) => {
          const itemClean = item.cleaned.replace(/►/g, "").trim();
          return keywords.some((keyword) => itemClean.includes(keyword));
        });
        if (foundItem) {
          menuItem = foundItem.el;
        }
      }
    }

    if (!menuItem) {
      const availableItems = allItems.map(
        (item) => `"${item.cleaned}" (raw: "${item.rawText}")`
      );
      alert(
        `Could not find menu item: "${
          remainingPath[0]
        }"\n\nSearching for: "${targetLabel}"\n\nAvailable items in this submenu:\n${availableItems.join(
          "\n"
        )}\n\nTip: Try starring the item again from the actual submenu.`
      );

      // Close all menus
      setTimeout(dispatchEscape, 100);
      return;
    }

    const itemHasSubmenu = foundItem?.hasSubmenu || false;
    // Click the menu item - use enhanced click for submenu items that need to open submenus
    if (itemHasSubmenu && !isLastItem) {
      simulateSubmenuClick(menuItem);
    } else {
      simulateClick(menuItem);
    }

    if (!isLastItem && itemHasSubmenu) {
      setTimeout(() => {
        navigateSubmenuPath(remainingPath.slice(1), depth + 1);
      }, 600); // Reduced timeout - was too long for simple menu items
    } else if (isLastItem) {
      // This was the final item in path
      const actionText = cleanText(remainingPath[0]);
      const shouldKeepDialogOpen = [
        "pdf (.pdf)",
        "excel (.xlsx)",
        "csv",
        "tsv",
        "ods",
        "zip",
        "share with others",
        "email",
        "publish to web",
        "make a copy",
        "import",
        "version history",
        "details",
        "rename",
      ].some((action) => actionText.includes(action));

      if (shouldKeepDialogOpen) {
        // Check multiple times for dialog appearance with increasing delays
        const checkForDialog = (attempt = 1, maxAttempts = 5) => {
          setTimeout(() => {
            // More comprehensive dialog selectors for Google Sheets
            const dialogSelectors = [
              '[role="dialog"]',
              ".modal",
              '[aria-modal="true"]',
              ".docs-dialog",
              ".docs-material-dialog",
              ".goog-modal-dialog",
              ".docs-share-dialog",
              ".docs-download-dialog",
              "[data-dialog]",
              ".picker-dialog",
              ".jfk-bubble",
              ".docs-bubble",

              ".gb_g",
              ".picker",
              ".docs-offscreen-focus-trap-start",
              ".docs-offscreen-focus-trap-end",
            ];

            const hasDialog = dialogSelectors.some((selector) => {
              const elements = document.querySelectorAll(selector);
              return Array.from(elements).some((el) => {
                const style = window.getComputedStyle(el);
                return (
                  el.offsetParent !== null &&
                  style.visibility !== "hidden" &&
                  style.display !== "none" &&
                  style.opacity !== "0"
                );
              });
            });

            const hasOverlay = document.querySelector(
              '.docs-material-dialog-backdrop, .goog-modalpopup-bg, .modal-backdrop, [class*="overlay"], [class*="backdrop"]'
            );
            if (hasDialog || hasOverlay) return;

            if (attempt < maxAttempts) {
              checkForDialog(attempt + 1, maxAttempts);
            } else {
              dispatchEscape();
            }
          }, attempt * 500);
        };

        checkForDialog();
      } else {
        setTimeout(dispatchEscape, 200);
      }
    } else {
      setTimeout(dispatchEscape, 400);
    }
  }, 150 + depth * 100);
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

      const iconSrc = func.includes("Fill color") ? safeGetURL("fill.svg") : 
                      func.includes("Text color") ? safeGetURL("A.svg") : null;
      
      const hotkeyText = getHotkeyText(index);
      const textWrapper = document.createElement("span");
      textWrapper.innerHTML = btnText + (hotkeyText ? `<span style="font-size: 10px; opacity: 0.7; margin-left: 4px;">${hotkeyText}</span>` : '');
      textWrapper.style.cssText = "flex-grow: 1; text-align: center; display: flex; align-items: center; justify-content: center;";

      btn.style.cssText = "display: flex; align-items: center; justify-content: " + (iconSrc ? "flex-start" : "center") + ";";
      
      if (iconSrc) {
        const iconImg = document.createElement("img");
        Object.assign(iconImg, { src: iconSrc, alt: "" });
        iconImg.style.cssText = "width: 16px; height: 16px; margin-right: 6px; flex-shrink: 0;";
        btn.appendChild(iconImg);
      }
      btn.appendChild(textWrapper);

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

      // Add tooltip for hotkey information
      const hotkeyDisplay = getHotkeyDisplay(index);
      btn.title = hotkeyDisplay 
        ? `Click or press ${hotkeyDisplay} to activate: ${btnText}`
        : `Click to activate: ${btnText}`;

      // Add hover effects
      if (!editingMode && !isViewOnlySheet) {
        btn.onclick = () => triggerMenuPath(func);
        btn.addEventListener("mouseenter", () => {
          btn.style.backgroundColor = "#D9D9D9";
        });
        btn.addEventListener("mouseleave", () => {
          btn.style.backgroundColor = "#ffffff";
        });
      } else if (isViewOnlySheet) {
        // For view-only sheets, disable interactions
        btn.style.cursor = "default";
        btn.style.opacity = "0.6";
        btn.onclick = () => {
          // Optional: Show a subtle notification
          // alert("This function is not available in view-only mode");
        };
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
            document.querySelectorAll(".pin-star").forEach((star) => {
              const item = star.closest('[role="menuitem"]');
              const path = getFullMenuPath(item);
              star.textContent = buttons.some(b => b.includes(path)) ? "⭐" : "☆";
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
    const shouldHide = buttons.length === 0 || titleCollapsed;

    if (editButton) editButton.style.display = shouldHide ? "none" : "inline-block";
    if (editContainer) editContainer.style.display = shouldHide ? "none" : "inline-block";

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
    const allVisibleMenus = Array.from(
      document.querySelectorAll('[role="menu"]')
    ).filter((menu) => {
      const style = window.getComputedStyle(menu);
      return (
        menu.offsetParent !== null &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    });

    // If we have multiple menus open and a tracked path, use it
    if (allVisibleMenus.length > 1) {
return [...currentMenuPath, label].join(" > ");
    }
  }

  const isColorItem =
    label &&
    (label.toLowerCase().includes("color") ||
      label.match(
        /\b(red|green|blue|yellow|orange|purple|pink|cyan|magenta|black|white|gray|grey)\b/i
      ) ||
      label.match(
        /\b(light|dark)\s+(red|green|blue|yellow|orange|purple|pink|cyan|magenta|gray|grey)\b/i
      ) ||
      label.match(
        /\b(red|green|blue|yellow|orange|purple|pink|cyan|magenta|gray|grey)\s+\d+\b/i
      ));

  if (isColorItem) {
    let isFromFillColor = lastClickedColorButton === "fill";
    let isFromTextColor = lastClickedColorButton === "text";

    // Method 2: Check BOTH fill and text color buttons for active states
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

    if (!isFromFillColor && !isFromTextColor) {
      const fillColorIndicators = [".docs-icon-fill-color", '[data-command-name*="fill"]', '[data-command-name*="background"]'];
      const textColorIndicators = [".docs-icon-text-color", '[data-command-name*="text"]', '[aria-label*="Text color"]'];

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

    // FINAL DECISION: Fill > Text > lastClicked > default Text
    if (isFromFillColor) return `Fill color > ${label}`;
    if (isFromTextColor) return `Text color > ${label}`;
    if (lastClickedColorButton === "fill") return `Fill color > ${label}`;
    return `Text color > ${label}`;
  }

  // Fallback: try to determine path from DOM structure for single-level menus
  let path = [label];

  // Add the top-level menu
  const topMenu = document.querySelector(
    'div[role="menubar"] [aria-expanded="true"]'
  );
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
  // Skip if this is a sheet tab context menu (e.g., contains "Rename", "Duplicate", etc.)
  const firstItemText =
    menu.querySelector('[role="menuitem"]')?.innerText?.toLowerCase() || "";
  const tabFunctions = ["delete", "create new spreadsheet"];
  if (tabFunctions.includes(firstItemText)) {
    return; // Don't inject stars here
  }

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
  // Add click listeners to ALL buttons, not just color ones
  const allButtons = document.querySelectorAll(
    'button, div[role="button"], span[role="button"], *[onclick], *[aria-label], *[data-tooltip]'
  );
  let trackedCount = 0;

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
        trackedCount++;
        button.addEventListener("click", (e) => {
          if (
            label.includes("fill") ||
            label.includes("background") ||
            label.includes("cell color")
          ) {
            lastClickedColorButton = "fill";
          } else if (label.includes("text") || label.includes("font")) {
            lastClickedColorButton = "text";
          }

          setTimeout(() => {
            if (lastClickedColorButton) {
              lastClickedColorButton = null;
            }
          }, 30000);
        });
      }
    }
  });
}

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

function observeMenus() {
  // Clean up existing observers
  cleanupObservers();
  
  menuObserver = new MutationObserver((mutations) => {
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

  attributeObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === "attributes" &&
        (mutation.attributeName === "class" ||
          mutation.attributeName === "aria-selected")
      ) {
        const target = mutation.target;
        if (
          target.getAttribute?.("role") === "menuitem" &&
          target.getAttribute?.("aria-haspopup") === "true"
        ) {
          // A submenu item state changed, update our path tracking
          setTimeout(updateCurrentMenuPath, 50);
        }
      }
    }
  });

  menuObserver.observe(document.body, { childList: true, subtree: true });
  attributeObserver.observe(document.body, {
    attributes: true,
    subtree: true,
    attributeFilter: ["class", "aria-selected"],
  });

  trackColorButtonClicks();

  setInterval(trackColorButtonClicks, 2000);
}

// Track the current menu path as user navigates
function updateCurrentMenuPath() {
  currentMenuPath = [];

  // Get the top-level menu
  const topMenu = document.querySelector(
    'div[role="menubar"] [aria-expanded="true"]'
  );
  if (topMenu) {
    const topLabel = cleanText(topMenu.innerText || topMenu.textContent);
    if (topLabel) {
      currentMenuPath.push(topLabel);
    }
  }

  // Get all visible menus in order
  const allVisibleMenus = Array.from(document.querySelectorAll('[role="menu"]'))
    .filter((menu) => {
      const style = window.getComputedStyle(menu);
      return (
        menu.offsetParent !== null &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
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
    const submenuItems = Array.from(
      menu.querySelectorAll('[role="menuitem"][aria-haspopup="true"]')
    ).filter((el) => el.offsetParent !== null);

    // Look for highlighted or selected items
    let activeItem = submenuItems.find(
      (el) =>
        el.classList.contains("goog-menuitem-highlight") ||
        el.classList.contains("goog-menuitem-selected") ||
        el.getAttribute("aria-selected") === "true"
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
  // Check if toolbar already exists and remove it to prevent duplicates
  const existingBar = document.getElementById("quickbar");
  if (existingBar) {
    existingBar.remove();
  }
  
  // Also check for any orphaned starbars without proper ID (safety net)
  const orphanedBars = document.querySelectorAll('[alt="StarBar"]');
  orphanedBars.forEach((orphan, index) => {
    const parentBar = orphan.closest('div');
    if (parentBar && parentBar.id !== 'quickbar') {
      parentBar.remove();
    }
  });
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
editButton.id = "starbar-edit-button";            // <— stable anchor for the tour
editButton.setAttribute("aria-label", "Edit");    // improves query reliability
editButton.title = "Edit";

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
      editingMode = false;
      editButton.innerText = "✏️";
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
  
  // Auto-minimize starbar for view-only sheets
  if (isViewOnlySheet) {
    titleCollapsed = true;
    
    Array.from(bar.children).forEach((child) => {
      if (child !== titleBar) {
        child.style.display = "none";
      }
    });

    Array.from(titleBar.children).forEach((child) => {
      if (child !== title) {
        child.style.display = "none";
      }
    });

    bar.style.background = "transparent";
    bar.style.border = "none";
    bar.style.padding = "0px";
  }
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

// Setup hotkey functionality for starBar functions
function setupHotkeys() {
  // Mac detection - declare once at function scope
  const isMac = isMacPlatform();
  // Use capture phase to intercept events before Google Sheets can handle them
  document.addEventListener("keydown", (e) => {
    // More comprehensive check for input/editable elements in Google Sheets
    const activeElement = document.activeElement;
    const isInInputField = activeElement && (
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
    
    if (isInInputField) {
      return;
    }
    
    let isHotkeyPressed = false;
    let functionIndex = -1;
    let hotkeyDisplay = "";
    
    // Check for Ctrl+1 (original hotkey)
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

// Mac hotkey test function - can be called from browser console
window.starBarMacTest = function() {
  const isMac = isMacPlatform();
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
  safeStorageGet("pinnedFunctions", (data) => {
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
    triggerMenuPath(functionPath);
  });
};

// Alternative hotkey system using document.addEventListener with different options
function setupAlternativeHotkeys() {
  // Add event listener to window as well as document
  const handleKeyEvent = (e) => {
    // Only process if we have a letter key, not just modifier keys
    const keyCode = e.code.toLowerCase();
    const keyChar = e.key.toLowerCase();
    const isLetterKey = keyCode.startsWith('key') || ['z', 'x', 's', 'ω', '≈', 'ß'].includes(keyChar);
    
    if (!isLetterKey) return;
    
    if (e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) {
      // Check for primary hotkeys - Ctrl+Alt on Win/Linux, Cmd+Option on Mac
      const isMac = isMacPlatform();
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
function executeHotkeyAction(functionIndex, hotkeyDisplay) {
  // Get the pinned functions
  safeStorageGet("pinnedFunctions", (data) => {
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
      triggerMenuPath(functionPath);
    }, 50);
  });
}

// Show visual feedback when a hotkey is pressed
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

// Initialize when DOM is ready
let isInitialized = false;
function init() {
 const currentUrl = window.location.href;
  const isHomePage = currentUrl.match(/^https:\/\/docs\.google\.com\/spreadsheets\/(u\/\d+\/)?$/) ||
                     currentUrl.match(/^https:\/\/docs\.google\.com\/spreadsheets\/(u\/\d+\/)?\?.*$/) ||
                     currentUrl.match(/^https:\/\/docs\.google\.com\/spreadsheets\/(u\/\d+\/)?#.*$/) ||
                     !currentUrl.includes('/d/'); // Any sheets URL without '/d/' is likely the home page
  
  if (isHomePage) {
    return;}

  // Detect if this is a view-only sheet with retry mechanism
  const detectWithRetry = (attempt = 1, maxAttempts = 5) => {
    isViewOnlySheet = detectViewOnlySheet();
    // If we haven't detected view-only yet and there are more attempts, try again
    if (!isViewOnlySheet && attempt < maxAttempts) {
      setTimeout(() => detectWithRetry(attempt + 1, maxAttempts), 1000 * attempt);
    } else {
      // Update the toolbar if it was already created and we now detect view-only
      if (isViewOnlySheet && attempt > 1) {
        const bar = document.getElementById("quickbar");
        if (bar) {
          const titleBar = bar.querySelector("div:first-child");
          const title = titleBar?.querySelector("img");
          
          if (titleBar && title) {
            titleCollapsed = true;
            
            Array.from(bar.children).forEach((child) => {
              if (child !== titleBar) {
                child.style.display = "none";
              }
            });

            Array.from(titleBar.children).forEach((child) => {
              if (child !== title) {
                child.style.display = "none";
              }
            });

            bar.style.background = "transparent";
            bar.style.border = "none";
            bar.style.padding = "0px";
            
            // Update button interactions
            updateQuickbar();
          }
        }
      }
    }
  };
  
  detectWithRetry();
  
  createToolbar();
  observeMenus();

  // Check if user has seen onboarding and start tour if needed
  chrome.storage.local.get(['hasSeenOnboarding'], (result) => {
    if (!result.hasSeenOnboarding) {
      // Wait for:
      // 1. Toolbar to be fully created
      // 2. Google Sheets interface to be ready
      // 3. intro.js library to be loaded
      setTimeout(() => {
        // Check if intro.js is loaded
        if (typeof introJs === 'undefined') {
          return;
        }
        
        // Check if onboarding function exists
        if (typeof window.startOnboardingTour !== 'function') {
          return;
        }
        
        // Check if quickbar exists
        const quickbar = document.getElementById('quickbar');
        if (!quickbar) {
          return;
        }
        
        // All checks passed - start the tour!
        window.startOnboardingTour();
        
      }, 2000); // Wait 2 seconds for everything to be ready
    }
  });


  // Reset menu path when menus are closed (like pressing Escape)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      currentMenuPath = [];
    }
  });
  
  // Add hotkey functionality for starBar functions
  setupHotkeys();
  
  // Also setup alternative hotkey system as backup
  setupAlternativeHotkeys();
  
  // Reset menu path when clicking outside menus
  document.addEventListener("click", (e) => {
    const clickedMenu = e.target.closest('[role="menu"], [role="menubar"]');
    if (!clickedMenu) {
      currentMenuPath = [];
    }
  });
}

// Initialize based on document ready state
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else if (document.readyState === "interactive" || document.readyState === "complete") {
  // Document is already loaded
  setTimeout(init, 100);
} else {
  // Fallback for older browsers
  window.addEventListener("load", init);
}

// Re-initialize when page navigation occurs
let lastUrl = location.href;
let navigationTimeout = null;

new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    const existingToolbar = document.getElementById('quickbar');
    if (existingToolbar) {
      existingToolbar.remove();
    }
    // Reset view-only status for new page
    isViewOnlySheet = false;
    setTimeout(init, 1000);
  }
}).observe(document, { subtree: true, childList: true });

// Also re-track color buttons when significant DOM changes occur
let colorTrackingObserver = new MutationObserver((mutations) => {
  let shouldRetrack = false;

  mutations.forEach((mutation) => {
    if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          // Element node
          const text = (node.textContent || "").toLowerCase();
          const label = (
            node.getAttribute &&
            (node.getAttribute("aria-label") ||
              node.getAttribute("data-tooltip") ||
              "")
          ).toLowerCase();

          if (
            text.includes("color") ||
            label.includes("color") ||
            text.includes("fill") ||
            label.includes("fill") ||
            text.includes("text") ||
            label.includes("text")
          ) {
            shouldRetrack = true;
          }
        }
      });
    }
  });

  if (shouldRetrack) {
    setTimeout(trackColorButtonClicks, 500);
  }
});

// Start observing after initial load
window.addEventListener("load", () => {
  setTimeout(() => {
    colorTrackingObserver.observe(document.body, {
      childList: true,
      subtree: true,
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
  // ENHANCED DETECTION FOR RIGHT-CLICK CONTEXT
  let prefix = "Text color"; // Default fallback
  let isFromFillColor = false;
  let isFromTextColor = false;

  // Method 1: Check BOTH fill and text color buttons to see which is active
  const allColorButtons = document.querySelectorAll("*[aria-label], *[data-tooltip], *[title]");
  
  const fillColorButtons = Array.from(allColorButtons).filter((btn) => {
    const btnLabel = getButtonLabel(btn);
    return btnLabel.includes("fill") || btnLabel.includes("background") || btnLabel.includes("cell color");
  });

  const textColorButtons = Array.from(allColorButtons).filter((btn) => {
    const btnLabel = getButtonLabel(btn);
    return (btnLabel.includes("text") && btnLabel.includes("color")) || btnLabel.includes("font color");
  });
  // Check fill color buttons
  for (const btn of fillColorButtons) {
    if (isButtonActive(btn)) {
      isFromFillColor = true;
      break;
    }
  }

  // Check text color buttons
  for (const btn of textColorButtons) {
    if (isButtonActive(btn)) {
      isFromTextColor = true;
      break;
    }
  }

  if (lastClickedColorButton === "fill" && !isFromTextColor) {
    isFromFillColor = true;
  } else if (lastClickedColorButton === "text" && !isFromFillColor) {
    isFromTextColor = true;
  }

  if (!isFromFillColor && !isFromTextColor) {
    const fillColorIndicators = [
      ".docs-icon-fill-color",
      '[data-command-name*="fill"]',
      '[data-command-name*="background"]',
    ];

    const textColorIndicators = [
      ".docs-icon-text-color",
      '[data-command-name*="text"]',
      '[aria-label*="Text color"]',
    ];

    // Check fill indicators
    for (const selector of fillColorIndicators) {
      const element = document.querySelector(selector);
      if (
        element &&
        (element.classList.contains("goog-toolbar-button-checked") ||
          element.getAttribute("aria-pressed") === "true")
      ) {
        isFromFillColor = true;
        break;
      }
    }

    // Check text indicators (only if fill not found)
    if (!isFromFillColor) {
      for (const selector of textColorIndicators) {
        const element = document.querySelector(selector);
        if (
          element &&
          (element.classList.contains("goog-toolbar-button-checked") ||
            element.getAttribute("aria-pressed") === "true")
        ) {
          isFromTextColor = true;
          break;
        }
      }
    }
  }

  if (isFromTextColor && !isFromFillColor) {
    prefix = "Text color";
  } else if (isFromFillColor && !isFromTextColor) {
    prefix = "Fill color";
  } else if (isFromTextColor && isFromFillColor) {
    // Both detected - use recent tracking as tiebreaker
    if (lastClickedColorButton === "text") {
      prefix = "Text color";
    } else if (lastClickedColorButton === "fill") {
      prefix = "Fill color";
    } else {
      // Default to text color when unsure
      prefix = "Text color";
    }
  } else {
    prefix = "Text color";
  }

  const path = `${prefix} > ${label}`;
  safeStorageGet(["pinnedFunctions"], (data) => {
    const pins = data.pinnedFunctions || [];
    if (!pins.includes(path)) {
      pins.push(path);
      safeStorageSet({ pinnedFunctions: pins }, updateQuickbar);
    }
  });
});
