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
  const labels = path.split(" > ").map((l) => l.trim());
  const [first, ...rest] = labels;
  let attempts = 0;

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
      } else if (attempts < 10) {
        attempts++;
        setTimeout(tryClickColor, 300);
      } else {
        alert(`Could not find color "${rest.join(" > ")}"`);
      }
    };

    setTimeout(tryClickColor, 300);
    return;
  }

  // === Regular menu path logic ===
  function open(index) {
    const label = labels[index];
    let el = findVisibleElementByText(label);

    if (!el && index === 0) {
      const toolbarBtn = Array.from(
        document.querySelectorAll("[aria-label]")
      ).find((btn) => cleanText(btn.getAttribute("aria-label")) === label);
      if (toolbarBtn) el = toolbarBtn;
    }

    if (el) {
      simulateClick(el);
      if (index < labels.length - 1) {
        setTimeout(() => open(index + 1), 400);
      } else {
        // Final click logic — retry until menu is interactable
        const finalLabel = cleanText(labels[index]);
        let clickAttempts = 0;

        function tryClickFinal() {
          const allItems = Array.from(
            document.querySelectorAll('[role="menuitem"]')
          );
          const match = allItems.find((el) => {
            const text =
              el.querySelector(".goog-menuitem-content")?.textContent ||
              el.textContent;
            return el.offsetParent !== null && cleanText(text) === finalLabel;
          });

          if (match) {
            const rect = match.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;

            ["pointerdown", "mousedown", "mouseup", "click"].forEach((type) => {
              const event = new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                view: window,
              });
              match.dispatchEvent(event);
            });
          } else if (clickAttempts < 10) {
            clickAttempts++;
            requestAnimationFrame(tryClickFinal);
          } else {
            alert(
              `"${finalLabel}" matched but couldn't be clicked after waiting.`
            );
          }
        }

        requestAnimationFrame(tryClickFinal);
      }
    } else if (attempts < 10) {
      attempts++;
      setTimeout(() => open(index), 400);
    } else {
      alert(`Could not find "${label}" menu item.`);
    }
  }

  open(0);
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
          chrome.storage.local.set(
            { pinnedFunctions: buttons },
            updateQuickbar
          );
        };

        wrapper.appendChild(drag);
        wrapper.appendChild(btn);
        wrapper.appendChild(del);
      } else {
        wrapper.appendChild(btn);
      }

      container.appendChild(wrapper);
    });

    // Hide/show editContainer based on whether there are items
    const editContainer = document.getElementById("quickbar").editContainer;
    if (buttons.length === 0) {
      editContainer.style.display = "none";
    } else {
      editContainer.style.display = "inline-block";
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
  dragHandle.style.height = "4px"; // Thinner
  dragHandle.style.background = "#bbb";
  dragHandle.style.borderRadius = "4px";
  dragHandle.style.cursor = "move";
  dragHandle.style.marginBottom = "8px";
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
  title.style.width = "150px";
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
