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
  let attempts = 0;

  function open(index) {
    const label = labels[index];
    const el = findVisibleElementByText(label);

    if (el) {
      simulateClick(el);
      if (index < labels.length - 1) {
        setTimeout(() => open(index + 1), 400);
      } else {
        setTimeout(() => {
          const finalLabel = cleanText(labels[index]);
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
          } else {
            alert(
              `"${labels[index]}" matched but couldn't be clicked with PointerEvent.`
            );
          }
        }, 400);
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
      const funcList = String(func).trim().split(">");
      const wrapper = document.createElement("div");
      wrapper.className = "quickbar-button";
      wrapper.setAttribute("draggable", editingMode);
      wrapper.dataset.index = index;
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";

      const btn = document.createElement("button");
      btn.innerText = funcList[funcList.length - 1];
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
  bar.style.cursor = "move";

  const titleBar = document.createElement("div");
  titleBar.style.display = "flex";
  titleBar.style.justifyContent = "space-between";
  titleBar.style.alignItems = "center";

  const title = document.createElement("b");
  title.innerText = "⭐ Quickbar ";

  const collapseBtn = document.createElement("button");
  collapseBtn.innerText = "−";
  collapseBtn.style.marginLeft = "8px";
  collapseBtn.style.cursor = "pointer";

  titleBar.appendChild(title);
  titleBar.appendChild(collapseBtn);

  const editContainer = document.createElement("div");
  editContainer.style.display = "inline-block"; // default to visible

  const toggleEdit = document.createElement("input");
  toggleEdit.type = "checkbox";
  toggleEdit.style.verticalAlign = "middle";
  toggleEdit.onchange = () => {
    editingMode = toggleEdit.checked;
    editLabel.innerText = editingMode ? "Confirm" : "Edit";
    updateQuickbar();
  };

  const editLabel = document.createElement("label");
  editLabel.innerText = "Edit";
  editLabel.style.marginLeft = "4px";

  editContainer.appendChild(toggleEdit);
  editContainer.appendChild(editLabel);

  const container = document.createElement("div");
  container.id = "quickbar-buttons";

  const content = document.createElement("div");
  content.appendChild(editContainer);
  content.appendChild(container);

  bar.appendChild(titleBar);
  bar.appendChild(content);
  document.body.appendChild(bar);

  // Make the toolbar draggable
  makeDraggable(bar);

  // Collapse/expand functionality
  let collapsed = false;
  collapseBtn.onclick = () => {
    collapsed = !collapsed;
    content.style.display = collapsed ? "none" : "block";
    collapseBtn.innerText = collapsed ? "+" : "−";
  };

  // Save the editContainer reference for use in updateQuickbar
  bar.editContainer = editContainer;

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
