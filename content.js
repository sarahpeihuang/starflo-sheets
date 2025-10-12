// content.js
let lastTopMenu = null;
let editingMode = false;
let titleCollapsed = false;

// Helper function that simulates click action
function simulateClick(el) {
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

// Helper function that parses through stars
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

    tryClickColor();
    return;
  }

 
  function navigateMenuPath(labelPath, currentIndex = 0) {
    if (currentIndex >= labelPath.length) {
      
      console.log("Navigation complete - final item should have been clicked");
     
      setTimeout(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            keyCode: 27,
          })
        );
      }, 200);
      return;
    }

    const currentLabel = cleanText(labelPath[currentIndex]);
    const isLastItem = currentIndex === labelPath.length - 1;
    console.log(`Looking for menu item: "${currentLabel}" at index ${currentIndex}, isLast: ${isLastItem}`);
    
   
    setTimeout(() => {
      // Find the menu item for the current level - only look at visible items
      let menuItem = Array.from(
        document.querySelectorAll('[role="menuitem"]')
      ).filter(el => el.offsetParent !== null) // Only visible items
       .find((el) => cleanText(el.textContent) === currentLabel);

      // If exact match fails, try partial matching
      if (!menuItem) {
        menuItem = Array.from(
          document.querySelectorAll('[role="menuitem"]')
        ).filter(el => el.offsetParent !== null)
         .find((el) => {
          const elText = cleanText(el.textContent);
          const elInnerText = cleanText(el.innerText);
          // Try both directions: does the label contain the element text, or vice versa
          return elText.includes(currentLabel) || currentLabel.includes(elText) ||
                 elInnerText.includes(currentLabel) || currentLabel.includes(elInnerText);
        });
      }

      if (!menuItem) {
        console.warn(`Could not find menu item: "${labelPath[currentIndex]}"`, {
          searchedFor: currentLabel,
          currentIndex: currentIndex,
          fullPath: labelPath,
          availableItems: Array.from(document.querySelectorAll('[role="menuitem"]'))
            .filter(el => el.offsetParent !== null) // Only visible items
            .map(el => ({
              text: cleanText(el.textContent),
              innerText: cleanText(el.innerText),
              content: cleanText(el.querySelector('.goog-menuitem-content')?.textContent || '')
            }))
        });
        alert(`Could not find menu item: "${labelPath[currentIndex]}"\n\nTry starring the item again to ensure the path is correct.`);
        return;
      }

      console.log(`Found menu item: "${cleanText(menuItem.textContent)}" for "${currentLabel}"`);

      // Click the menu item
      simulateClick(menuItem);
      
      if (isLastItem) {
        
        console.log("Clicked final item, navigation complete");
        setTimeout(() => {
          document.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Escape",
              code: "Escape",
              keyCode: 27,
            })
          );
        }, 500);
      } else {
       
        setTimeout(() => {
          navigateMenuPath(labelPath, currentIndex + 1);
        }, 250);
      }
    }, 100);
  }

  
  function openSpecificMenuPath(labelPath) {
    console.log("Trying alternative approach for path:", labelPath);
    
   
    const topMenuLabel = cleanText(labelPath[0]);
    const topMenu = Array.from(
      document.querySelectorAll('div[role="menubar"] [role="menuitem"]')
    ).find(el => cleanText(el.textContent) === topMenuLabel);
    
    if (!topMenu) {
      alert(`Could not find top menu: ${labelPath[0]}`);
      return;
    }
    
    simulateClick(topMenu);
    
    
    setTimeout(() => {
      navigateFromOpen(labelPath.slice(1), 0);
    }, 200);
  }
  
  function navigateFromOpen(remainingPath, depth) {
    if (remainingPath.length === 0) {
      return;
    }
    
    const targetLabel = cleanText(remainingPath[0]);
    const isLast = remainingPath.length === 1;
    
    setTimeout(() => {
      const allMenus = document.querySelectorAll('[role="menu"]');
      const currentMenu = allMenus[allMenus.length - 1]; // Get the most recently opened menu
      
      if (!currentMenu) {
        console.error("No menu found at depth", depth);
        return;
      }
      
      const menuItem = Array.from(currentMenu.querySelectorAll('[role="menuitem"]'))
        .find(el => {
          const elText = cleanText(el.textContent);
          const elInner = cleanText(el.innerText);
          return elText === targetLabel || elInner === targetLabel || 
                 elText.includes(targetLabel) || targetLabel.includes(elText);
        });
      
      if (!menuItem) {
        console.error(`Could not find "${targetLabel}" in current menu`);
        return;
      }
      
      simulateClick(menuItem);
      
      if (!isLast) {
        // Continue to next level
        navigateFromOpen(remainingPath.slice(1), depth + 1);
      } else {
        // Final item clicked, close menus
        setTimeout(() => {
          document.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Escape", code: "Escape", keyCode: 27
            })
          );
        }, 300);
      }
    }, 150 + (depth * 50)); // Increase delay for deeper levels
  }

  var btn = document.getElementById(path);

  // If button exists in DOM, click it directly
  if (btn) {
    setTimeout(() => {
      simulateClick(btn);
    }, 100);
    setTimeout(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          keyCode: 27,
        })
      );
    }, 2000);
  } else {
    // Button not in DOM yet, try the specific path navigation first
    console.log("Attempting navigation for path:", labels);
    navigateMenuPath(labels);
    
    // If that fails, fallback to alternative approach after a delay
    setTimeout(() => {
      const stillExists = document.getElementById(path);
      if (!stillExists) {
        console.log("First approach failed, trying alternative...");
        openSpecificMenuPath(labels);
      }
    }, 2000);
  }
}

// Helper function that implements toggle functionality for editing and deleting
function togglePin(path) {
  chrome.storage.local.get("pinnedFunctions", (data) => {
    let pins = data.pinnedFunctions || [];
    const index = pins.indexOf(path);
    if (index === -1) pins.push(path);
    else pins.splice(index, 1);
    chrome.storage.local.set({ pinnedFunctions: pins }, updateQuickbar);
  });
}

// Callback function that manages state
function updateQuickbar() {
  chrome.storage.local.get("pinnedFunctions", (data) => {
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
        iconSrc = chrome.runtime.getURL("fill.svg");
      } else if (func.includes("Text color")) {
        iconSrc = chrome.runtime.getURL("A.svg");
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
          chrome.storage.local.set({ pinnedFunctions: buttons }, () => {
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
    chrome.storage.local.set({ pinnedFunctions: newOrder }, updateQuickbar);
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
  
  let path = [label];
  let current = item.closest('[role="menu"]');

  while (current) {
    const opener = document.querySelector(`[aria-controls="${current.id}"]`);
    if (!opener) break;
    
    
    let openerLabel = "";
    const openerContent = opener.querySelector(".goog-menuitem-content");
    if (openerContent) {
      openerLabel = cleanText(openerContent.innerText || openerContent.textContent);
    } else {
      openerLabel = cleanText(opener.innerText || opener.textContent);
    }
    
    path.unshift(openerLabel);
    current = opener.closest('[role="menu"]');
  }

  const topMenu = document.querySelector(
    'div[role="menubar"] [aria-expanded="true"]'
  );
  if (topMenu) {
    const topLabel = cleanText(topMenu.innerText || topMenu.textContent);
    if (path[0] !== topLabel) {
      path.unshift(topLabel);
    }
  }

  return path.join(" > ");
}

// Injects stars into menus
function injectStarsIntoMenu(menu) {
  const items = menu.querySelectorAll('[role="menuitem"]');

  chrome.storage.local.get("pinnedFunctions", (data) => {
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
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
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
  bar.style.cursor = "default"; // Only handle is draggable

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

  const defaultSrc = chrome.runtime.getURL("star-default.svg");
  const hoverSrc = chrome.runtime.getURL("star-hover.svg");

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
  dragHandle.src = chrome.runtime.getURL("gripper.svg");
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
  makeDraggable(title, bar); // star icon
  makeDraggable(dragHandle, bar); // gripper icon

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
      // Treat as click (toggle collapse)
      titleCollapsed = !titleCollapsed;
      updateQuickbar();

      // Hide or show all children except the titleBar
      Array.from(bar.children).forEach((child) => {
        if (child !== titleBar) {
          child.style.display = titleCollapsed ? "none" : "";
        }
      });

      // Hide or show everything inside titleBar except the image
      Array.from(titleBar.children).forEach((child) => {
        if (child !== title) {
          child.style.display = titleCollapsed ? "none" : "";
        }
      });

      // Hide background and border
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
      target.style.right = "auto"; // Reset right when dragging
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    target.style.userSelect = "auto";
  });
}

function preloadAllMenus() {
  const topMenus = document.querySelectorAll(
    'div[role="menubar"] [role="menuitem"]'
  );

  let index = 0;

  function openMenu(menuBtn, callback) {
    simulateClick(menuBtn); // open it
    setTimeout(() => {
      const submenus = document.querySelectorAll('[role="menu"]');

      // preload each submenu by clicking its items that have children
      const submenuItems = Array.from(
        submenus[submenus.length - 1]?.querySelectorAll(
          '[role="menuitem"][aria-haspopup="true"]'
        ) || []
      );

      let subIndex = 0;
      function openSubmenu() {
        if (subIndex >= submenuItems.length) {
          simulateClick(menuBtn); // close parent
          callback();
          return;
        }
        const item = submenuItems[subIndex];
        simulateClick(item); // open inner submenu
        setTimeout(() => {
          simulateClick(item); // close it
          subIndex++;
          openSubmenu();
        }, 200);
      }

      openSubmenu();
    }, 200);
  }

  function nextTopMenu() {
    if (index >= topMenus.length) return;
    const btn = topMenus[index];
    openMenu(btn, () => {
      index++;
      setTimeout(nextTopMenu, 200);
    });
  }

  nextTopMenu();
}

window.addEventListener("load", () => {
  createToolbar();
  observeMenus();
  // preloadAllMenus();
});

window.addEventListener("contextmenu", (e) => {
  const target = e.target.closest("[aria-label], [title]");
  if (!target) return;

  // Only apply to color swatches inside a known container
  const colorMenu = target.closest(
    ".docs-material-colorpalette, .docs-material-colorswatch, .goog-menu"
  );
  if (!colorMenu) return;

  // Prevent browser default right-click menu
  e.preventDefault();
  e.stopPropagation();

  // Get color name from aria-label or title
  const label =
    target.getAttribute("aria-label") || target.getAttribute("title");
  if (!label) return;

  // Determine whether it's fill or text color
  let prefix = "Color"; // fallback
  const parent = document.querySelector(
    '[aria-label*="Fill color"], [aria-label*="Text color"]'
  );
  if (parent?.getAttribute("aria-label")?.includes("Fill"))
    prefix = "Text color";
  if (parent?.getAttribute("aria-label")?.includes("Text"))
    prefix = "Fill color";

  const path = `${prefix} > ${label}`;

  // Store it and update
  chrome.storage.local.get(["pinnedFunctions"], (data) => {
    const pins = data.pinnedFunctions || [];
    if (!pins.includes(path)) {
      pins.push(path);
      chrome.storage.local.set({ pinnedFunctions: pins }, updateQuickbar);
    }
  });
});
