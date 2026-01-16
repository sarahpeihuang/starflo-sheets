// src/quickbar.js
// Quickbar/Toolbar UI and management for StarBar Chrome Extension

// Helper accessors - these access globals after they're defined
function _safeStorageGet(key, cb) { return window.StarBarUtils.safeStorageGet(key, cb); }
function _safeStorageSet(data, cb) { return window.StarBarUtils.safeStorageSet(data, cb); }
function _safeGetURL(path) { return window.StarBarUtils.safeGetURL(path); }
function _cleanText(text) { return window.StarBarUtils.cleanText(text); }
function _getHotkeyText(idx) { return window.StarBarUtils.getHotkeyText(idx); }
function _getHotkeyDisplay(idx) { return window.StarBarUtils.getHotkeyDisplay(idx); }
function _triggerMenuPath(path) { return window.StarBarMenu.triggerMenuPath(path); }

// State variables
let editingMode = false;
let titleCollapsed = false;
let currentMenuPath = [];
let lastClickedColorButton = null;
let isViewOnlySheet = false;

/**
 * Toggle pin state for a menu path
 * @param {string} path - Menu path to toggle
 */
function togglePin(path) {
  _safeStorageGet("pinnedFunctions", (data) => {
    let pins = data.pinnedFunctions || [];
    const index = pins.indexOf(path);
    if (index === -1) {
      pins.push(path);
    } else {
      pins.splice(index, 1);
    }
    _safeStorageSet({ pinnedFunctions: pins }, updateQuickbar);
  });
}

/**
 * Update the quickbar UI with current pinned functions
 */
function updateQuickbar() {
  _safeStorageGet("pinnedFunctions", (data) => {
    const buttons = data.pinnedFunctions || [];
    const container = document.getElementById("quickbar-buttons");
    if (!container) return;
    
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
      const btnText = funcList[funcList.length - 1].trim().slice(0, 1).toUpperCase() +
                      funcList[funcList.length - 1].trim().slice(1);

      const iconSrc = func.includes("Fill color") ? _safeGetURL("fill.svg") : 
                      func.includes("Text color") ? _safeGetURL("A.svg") : null;
      
      const hotkeyText = _getHotkeyText(index);
      const textWrapper = document.createElement("span");
      textWrapper.innerHTML = btnText + (hotkeyText ? `<span style="font-size: 10px; opacity: 0.7; margin-left: 4px;">${hotkeyText}</span>` : '');
      textWrapper.style.cssText = "flex-grow: 1; text-align: center; display: flex; align-items: center; justify-content: center;";

      btn.style.cssText = `display: flex; align-items: center; justify-content: ${iconSrc ? "flex-start" : "center"};`;
      
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
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      });

      // Add tooltip
      const hotkeyDisplay = _getHotkeyDisplay(index);
      btn.title = hotkeyDisplay 
        ? `Click or press ${hotkeyDisplay} to activate: ${btnText}`
        : `Click to activate: ${btnText}`;

      // Add interactions
      if (!editingMode && !isViewOnlySheet) {
        btn.onclick = () => _triggerMenuPath(func);
        btn.addEventListener("mouseenter", () => btn.style.backgroundColor = "#D9D9D9");
        btn.addEventListener("mouseleave", () => btn.style.backgroundColor = "#ffffff");
      } else if (isViewOnlySheet) {
        btn.style.cursor = "default";
        btn.style.opacity = "0.6";
      }

      if (editingMode) {
        const drag = document.createElement("span");
        drag.textContent = "⋮⋮";
        drag.style.cssText = "cursor: grab; padding: 0 6px; font-size: 16px;";

        const del = document.createElement("button");
        del.innerText = "✕";
        del.style.cssText = "margin-left: 6px; background: #fff; color: black; border: 1px solid #ccc; cursor: pointer;";
        del.onclick = () => {
          buttons.splice(index, 1);
          _safeStorageSet({ pinnedFunctions: buttons }, () => {
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

    // Update edit button visibility
    const bar = document.getElementById("quickbar");
    const editButton = bar?.editButton;
    const editContainer = bar?.editContainer;
    const shouldHide = buttons.length === 0 || titleCollapsed;

    if (editButton) editButton.style.display = shouldHide ? "none" : "inline-block";
    if (editContainer) editContainer.style.display = shouldHide ? "none" : "inline-block";

    if (editingMode) {
      enableDragDrop(container, buttons);
    }
  });
}

/**
 * Enable drag and drop reordering for quickbar buttons
 * @param {HTMLElement} container - Container element
 * @param {string[]} data - Array of pinned functions
 */
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
    if (afterElement) {
      container.insertBefore(draggingEl, afterElement);
    } else {
      container.appendChild(draggingEl);
    }
  });

  container.addEventListener("drop", () => {
    const newOrder = [...container.children].map((el) => {
      const idx = el.dataset.index;
      return data[idx];
    });
    _safeStorageSet({ pinnedFunctions: newOrder }, updateQuickbar);
  });
}

/**
 * Get the full menu path of a menu item element
 * @param {HTMLElement} item - Menu item element
 * @returns {string} Full menu path
 */
function getFullMenuPath(item) {
  let label = "";

  const contentEl = item.querySelector(".goog-menuitem-content");
  if (contentEl) {
    label = _cleanText(contentEl.innerText || contentEl.textContent);
  }

  if (!label) {
    label = _cleanText(item.innerText || item.textContent);
  }

  if (!label) {
    label = _cleanText(item.getAttribute("aria-label"));
  }

  // Check if we're in a nested menu context
  if (currentMenuPath.length > 0) {
    const allVisibleMenus = Array.from(document.querySelectorAll('[role="menu"]'))
      .filter((menu) => {
        const style = window.getComputedStyle(menu);
        return menu.offsetParent !== null && 
               style.visibility !== "hidden" && 
               style.display !== "none";
      });

    if (allVisibleMenus.length > 1) {
      return [...currentMenuPath, label].join(" > ");
    }
  }

  // Check if this is a color item
  const isColorItem = label && (
    label.toLowerCase().includes("color") ||
    label.match(/\b(red|green|blue|yellow|orange|purple|pink|cyan|magenta|black|white|gray|grey)\b/i) ||
    label.match(/\b(light|dark)\s+(red|green|blue|yellow|orange|purple|pink|cyan|magenta|gray|grey)\b/i)
  );

  if (isColorItem) {
    const colorType = window.StarBarDOM.determineColorType(label, lastClickedColorButton);
    return `${colorType} > ${label}`;
  }

  // Fallback: try to determine path from DOM structure
  let path = [label];
  const topMenu = document.querySelector('div[role="menubar"] [aria-expanded="true"]');
  if (topMenu) {
    const topLabel = _cleanText(topMenu.innerText || topMenu.textContent);
    if (topLabel && path[0] !== topLabel) {
      path.unshift(topLabel);
    }
  }

  return path.join(" > ");
}

/**
 * Inject star icons into menu items for pinning
 * @param {HTMLElement} menu - Menu element
 */
function injectStarsIntoMenu(menu) {
  // Skip sheet tab context menus
  const firstItemText = menu.querySelector('[role="menuitem"]')?.innerText?.toLowerCase() || "";
  const tabFunctions = ["delete", "create new spreadsheet"];
  if (tabFunctions.includes(firstItemText)) return;

  const items = menu.querySelectorAll('[role="menuitem"]');

  _safeStorageGet("pinnedFunctions", (data) => {
    const pinned = data.pinnedFunctions || [];

    items.forEach((item) => {
      if (item.querySelector(".pin-star")) return;
      if (item.offsetParent === null) return;

      const label = _cleanText(
        item.querySelector(".goog-menuitem-content")?.innerText || item.innerText
      );
      if (!label || item.getAttribute("aria-haspopup") === "true") return;

      const path = getFullMenuPath(item);
      if (!path) return;

      const star = document.createElement("span");
      star.className = "pin-star";
      star.textContent = pinned.includes(path) ? "⭐" : "☆";
      star.style.cssText = "float:right; margin-left:0px; cursor:pointer; font-size: 24px;";

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

/**
 * Update the current menu path tracking
 */
function updateCurrentMenuPath() {
  currentMenuPath = [];

  const topMenu = document.querySelector('div[role="menubar"] [aria-expanded="true"]');
  if (topMenu) {
    const topLabel = _cleanText(topMenu.innerText || topMenu.textContent);
    if (topLabel) currentMenuPath.push(topLabel);
  }

  const allVisibleMenus = Array.from(document.querySelectorAll('[role="menu"]'))
    .filter((menu) => {
      const style = window.getComputedStyle(menu);
      return menu.offsetParent !== null && 
             style.visibility !== "hidden" && 
             style.display !== "none";
    })
    .sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return aRect.left - bRect.left;
    });

  // Find highlighted submenu items
  for (let i = 0; i < allVisibleMenus.length - 1; i++) {
    const menu = allVisibleMenus[i];
    const submenuItems = Array.from(
      menu.querySelectorAll('[role="menuitem"][aria-haspopup="true"]')
    ).filter((el) => el.offsetParent !== null);

    let activeItem = submenuItems.find((el) =>
      el.classList.contains("goog-menuitem-highlight") ||
      el.classList.contains("goog-menuitem-selected") ||
      el.getAttribute("aria-selected") === "true"
    );

    // Find item closest to next menu if no highlight
    if (!activeItem && submenuItems.length > 0) {
      const nextMenuRect = allVisibleMenus[i + 1]?.getBoundingClientRect();
      if (nextMenuRect) {
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
      const label = _cleanText(
        activeItem.querySelector(".goog-menuitem-content")?.innerText ||
        activeItem.innerText
      );
      if (label) currentMenuPath.push(label);
    }
  }
}

/**
 * Create the main toolbar UI
 */
function createToolbar() {
  // Remove existing toolbar
  const existingBar = document.getElementById("quickbar");
  if (existingBar) existingBar.remove();
  
  // Remove orphaned starbars
  document.querySelectorAll('[alt="StarBar"]').forEach((orphan) => {
    const parentBar = orphan.closest('div');
    if (parentBar && parentBar.id !== 'quickbar') parentBar.remove();
  });

  const bar = document.createElement("div");
  bar.id = "quickbar";
  Object.assign(bar.style, {
    position: "fixed",
    top: "100px",
    right: "20px",
    background: "#fff",
    border: "1px solid #ccc",
    padding: "10px",
    zIndex: 9999,
    cursor: "default"
  });

  // Title bar
  const titleBar = document.createElement("div");
  titleBar.style.cssText = "display: flex; justify-content: space-between; gap: 25px; align-items: center;";

  // Logo
  const title = document.createElement("img");
  title.draggable = false;
  title.alt = "StarBar";
  title.style.cssText = "width: 45px; height: auto; display: block; cursor: pointer;";
  
  const defaultSrc = _safeGetURL("star-default.svg");
  const hoverSrc = _safeGetURL("star-hover.svg");
  title.src = defaultSrc;
  
  title.addEventListener("mouseenter", () => title.src = hoverSrc);
  title.addEventListener("mouseleave", () => title.src = defaultSrc);
  titleBar.appendChild(title);

  // Drag handle
  const dragHandleWrapper = document.createElement("div");
  dragHandleWrapper.style.cssText = "display: flex; justify-content: center;";
  
  const dragHandle = document.createElement("img");
  dragHandle.src = _safeGetURL("gripper.svg");
  dragHandle.alt = "Gripper";
  dragHandle.style.cssText = "width: 25px; cursor: move;";
  dragHandle.draggable = false;
  
  dragHandleWrapper.appendChild(dragHandle);
  titleBar.appendChild(dragHandleWrapper);

  // Edit button
  const editButton = document.createElement("button");
  editButton.id = "starbar-edit-button";
  editButton.setAttribute("aria-label", "Edit");
  editButton.title = "Edit";
  editButton.innerText = "✏️";
  editButton.style.cssText = "border: none; background: transparent; cursor: pointer; font-size: 18px; margin-left: 1px; display: none;";
  
  editButton.onclick = () => {
    editingMode = !editingMode;
    editButton.innerText = editingMode ? "✔️" : "✏️";
    updateQuickbar();
  };
  
  bar.editButton = editButton;
  titleBar.appendChild(editButton);

  // Content container
  const container = document.createElement("div");
  container.id = "quickbar-buttons";
  
  const content = document.createElement("div");
  content.appendChild(container);

  bar.appendChild(titleBar);
  bar.appendChild(content);
  document.body.appendChild(bar);

  // Make draggable
  makeDraggable(title, bar);
  makeDraggable(dragHandle, bar);

  // Collapse/expand on logo click
  let dragStartX = 0, dragStartY = 0;
  
  title.addEventListener("mousedown", (e) => {
    dragStartX = e.clientX;
    dragStartY = e.clientY;
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
        if (child !== titleBar) child.style.display = titleCollapsed ? "none" : "";
      });

      Array.from(titleBar.children).forEach((child) => {
        if (child !== title) child.style.display = titleCollapsed ? "none" : "";
      });

      bar.style.background = titleCollapsed ? "transparent" : "#fff";
      bar.style.border = titleCollapsed ? "none" : "1px solid #ccc";
      bar.style.padding = titleCollapsed ? "0px" : "10px";
    }
  });

  updateQuickbar();
  
  // Auto-minimize for view-only sheets
  if (isViewOnlySheet) {
    titleCollapsed = true;
    Array.from(bar.children).forEach((child) => {
      if (child !== titleBar) child.style.display = "none";
    });
    Array.from(titleBar.children).forEach((child) => {
      if (child !== title) child.style.display = "none";
    });
    bar.style.background = "transparent";
    bar.style.border = "none";
    bar.style.padding = "0px";
  }
}

/**
 * Make an element draggable
 * @param {HTMLElement} handle - Drag handle element
 * @param {HTMLElement} target - Target element to move
 */
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

// Export functions and state
window.StarBarQuickbar = {
  togglePin,
  updateQuickbar,
  getFullMenuPath,
  injectStarsIntoMenu,
  updateCurrentMenuPath,
  createToolbar,
  // State accessors
  get editingMode() { return editingMode; },
  set editingMode(val) { editingMode = val; },
  get titleCollapsed() { return titleCollapsed; },
  set titleCollapsed(val) { titleCollapsed = val; },
  get currentMenuPath() { return currentMenuPath; },
  set currentMenuPath(val) { currentMenuPath = val; },
  get lastClickedColorButton() { return lastClickedColorButton; },
  set lastClickedColorButton(val) { lastClickedColorButton = val; },
  get isViewOnlySheet() { return isViewOnlySheet; },
  set isViewOnlySheet(val) { isViewOnlySheet = val; }
};
