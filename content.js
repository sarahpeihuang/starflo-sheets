// content.js
let lastTopMenu = null;
let editingMode = false;

function simulateClick(el) {
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

function findVisibleElementByText(text) {
  const elements = Array.from(document.querySelectorAll('[role="menuitem"]'));
  const target = cleanText(text);

  return elements.find((el) => {
    if (el.offsetParent === null) return false;
    const raw =
      el.querySelector(".goog-menuitem-content")?.textContent || el.textContent;
    return cleanText(raw) === target;
  });
}

function triggerMenuPath(path) {
  const el = document.getElementById(path);
  if (!el) {
    alert(`Could not find menu item: "${path}"`);
    return;
  }

  simulateClick(el);
}

function togglePin(path) {
  chrome.storage.local.get("pinnedFunctions", (data) => {
    let pins = data.pinnedFunctions || [];
    const index = pins.indexOf(path);
    if (index === -1) pins.push(path);
    else pins.splice(index, 1);
    chrome.storage.local.set({ pinnedFunctions: pins }, updateQuickbar);
  });
}

function updateQuickbar() {
  chrome.storage.local.get("pinnedFunctions", (data) => {
    const buttons = data.pinnedFunctions || [];
    const container = document.getElementById("quickbar-buttons");
    container.innerHTML = "";
    buttons.forEach((func, index) => {
      //const funcList = String(func).trim().split(">");
      const wrapper = document.createElement("div");
      wrapper.className = "quickbar-button";
      wrapper.setAttribute("draggable", editingMode);
      wrapper.dataset.index = index;
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";

      const btn = document.createElement("button");
      btn.innerText = func;
      Object.assign(btn.style, {
        background: "#4285f4",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        padding: "6px 12px",
        cursor: editingMode ? "default" : "pointer",
        flexGrow: 1,
      });
      if (!editingMode) btn.onclick = () => triggerMenuPath(func);

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
              console.log(path);
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
      editButton.style.display = buttons.length === 0 ? "none" : "inline-block";
    }
    if (editContainer) {
      editContainer.style.display =
        buttons.length === 0 ? "none" : "inline-block";
    }

    if (editingMode) enableDragDrop(container, buttons);
  });
}

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
    const newOrder = [...container.children].map(
      (el) => el.querySelector("button").innerText
    );
    chrome.storage.local.set({ pinnedFunctions: newOrder }, updateQuickbar);
  });
}

function getFullMenuPath(item) {
  let label = cleanText(
    item.querySelector(".goog-menuitem-content")?.textContent ||
      item.textContent
  );
  let path = [label];
  let current = item.closest('[role="menu"]');

  while (current) {
    const opener = document.querySelector(`[aria-controls="${current.id}"]`);
    if (!opener) break;
    const openerLabel = cleanText(opener.textContent);
    path.unshift(openerLabel);
    current = opener.closest('[role="menu"]');
  }

  const topMenu = document.querySelector(
    'div[role="menubar"] [aria-expanded="true"]'
  );
  if (topMenu) {
    const topLabel = cleanText(topMenu.textContent);
    if (path[0] !== topLabel) {
      path.unshift(topLabel);
    }
  }

  return path.join(" > ");
}

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

      console.log(path);

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

  // === Draggable handle bar ===
  const dragHandle = document.createElement("div");

  dragHandle.style.margin = "0 auto 4px auto";
  dragHandle.style.height = "2px";
  dragHandle.style.width = "50%";
  dragHandle.style.background = "#bbb";
  dragHandle.style.borderRadius = "4px";
  dragHandle.style.cursor = "move";
  dragHandle.style.marginBottom = "4px";
  dragHandle.title = "Drag to move";
  bar.appendChild(dragHandle);

  // === Title bar ===
  const titleBar = document.createElement("div");
  titleBar.style.display = "flex";
  titleBar.style.justifyContent = "space-between";
  titleBar.style.alignItems = "center";

  const title = document.createElement("img");
  title.src = chrome.runtime.getURL("starbar.jpeg");
  title.alt = "StarBar";
  title.style.width = "120px";
  title.style.height = "auto";
  title.style.display = "block";

  titleBar.appendChild(title);

  // === Edit button ===
  const editButton = document.createElement("button");
  editButton.innerText = "✏️";
  editButton.style.border = "none";
  editButton.style.background = "transparent";
  editButton.style.cursor = "pointer";
  editButton.style.fontSize = "16px";
  editButton.style.marginLeft = "8px";
  editButton.style.display = "none";

  editButton.onclick = () => {
    editingMode = !editingMode;
    editButton.innerText = editingMode ? "✔️" : "✏️";
    updateQuickbar();
  };

  bar.editButton = editButton;
  titleBar.appendChild(editButton);

  // === Collapse button ===
  const collapseBtn = document.createElement("button");
  collapseBtn.innerText = "−";
  collapseBtn.style.marginLeft = "8px";
  collapseBtn.style.cursor = "pointer";

  titleBar.appendChild(collapseBtn);

  // === Content container ===
  const container = document.createElement("div");
  container.id = "quickbar-buttons";

  const content = document.createElement("div");
  content.appendChild(container);

  // === Append everything ===
  bar.appendChild(titleBar);
  bar.appendChild(content);
  document.body.appendChild(bar);

  // === Make only the handle draggable ===
  makeDraggable(bar, dragHandle);

  // === Collapse/expand functionality ===
  let collapsed = false;
  collapseBtn.onclick = () => {
    collapsed = !collapsed;
    content.style.display = collapsed ? "none" : "block";
    collapseBtn.innerText = collapsed ? "+" : "−";
  };

  updateQuickbar();
}

function makeDraggable(el) {
  let isDragging = false;
  let offsetX, offsetY;

  el.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - el.getBoundingClientRect().left;
    offsetY = e.clientY - el.getBoundingClientRect().top;
    el.style.userSelect = "none"; // Prevent text selection
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      el.style.left = e.clientX - offsetX + "px";
      el.style.top = e.clientY - offsetY + "px";
      el.style.right = "auto"; // Reset right when dragging
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    el.style.userSelect = "auto";
  });
}

window.addEventListener("load", () => {
  createToolbar();
  observeMenus();
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
    prefix = "Fill color";
  if (parent?.getAttribute("aria-label")?.includes("Text"))
    prefix = "Text color";

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
