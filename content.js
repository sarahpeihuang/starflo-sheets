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

  const title = document.createElement("img");
  title.src =
    "data:image/jpeg;base64,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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/xAAC/9oADAMBAAIAAwAAACHzzzzzzzzzzym/bzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzx73rzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzy332/wC888888888888888888888888888888888888888888888888888888888e999d88888888888888888888888888888888888888888888888888888888p9999v08888888888888888888888888888888888888888888888888888888W999997888888888888888888888888888888888888888888888888888888/wDfffffff8Azzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz3rO533r/wD0999M09y+88888888888www08888888888888888888888888+ct899999te001w99k999/u+/wDPPPPPPPNOMNNCPPPPPPPPPPPPPPPPPPPPPPPE/ffffffb+fPfbKPcfusfffcq/PPPPOPPNNPPLLFPPPOPPPPPPPPPPPPPPPPPPPnffffffb7/AH328z3Xz7r3bjijjzxxBjzzzTzyijzygjiTzzzATBzzzzzzzzzzzz5z33333zQ/PL332i933/ldzjzTzRTzyyjDDzSzyjRzzyjyyxTzzzzzzzzzzzzzz7T333335v7wrX23r332fzijzzzzzzzjzDDxTzzzzjzDzzjzzzzzzzzzzzzzzzzz7733333301932Sv32PjTzCjyzjzzzzjzzyizzTjTxijzijzzzzzzzzzzzzzzzzz7r22/3331Xf1c72xQTzzTjzjTzzxzzzzzzzhwTzxzTxzTzzzzzzzzzzzzzzzzzzr3m7PX+W7/AN3ey98U8880880888c888wcc880808c800888888888888888888999Z50yzc99ew8044ks088c0888c8844888cw0kU0800888888888888888888k9999999999999s8888888888888888888888888888888888888888888888889999999999999988888888888888888888888888888888888888888888888d9999992999999o88888888888888888888888888888888888888888888884299996Jea19999v2888888888888888888888888888888888888888888888t9994re888se9999c888888888888888888888888888888888888888888888/wDd2DvPPPPPPHOvfX/PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPLn/vPPPPPPPPPPLB/vPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP/8QAMRAAAQQBAgQEBgMAAwEBAAAAAwECBAUABhEQEhMgFiEwMRQVQEFQYCIjMiQ0NTNw/9oACAEBAAEHAvp3O5UzmXGvVMRd/wB5I7deInfb93I7ZOxF2xPNP3cjt17Qu+37qR2ydyeWNXdP3UjuZe8TvPb9zI7ZPRau6J+5kdzL6Infb9xI7ZPTau6fuL3cy+mJ2y/uBF2T1WLun7e926+qJ2y/txF2Tb1mO3T9te7dfXE7Zf2rqNzrJjiqv0LSqmdZM6rcRzV/X99s6jM6qZ1lzquznd6CqiJvJvoAPIupZLsdeWbs+b2WMvbNmA1M7IlhEmp6SLtiPVMQrsQ2dZudRn1Eo3w0Y5vF0nPF0nPF0nPF0nPF0nPF0nE1cfB6vZka/rJSon5FVRM6jUTOsmKbOq7OZfVsLSPAbkyylzl72ucxyOqLvrq2P2mMOOJ5fn9ZjLuuI9jO/mXOq7OsudbEIi/RahL0qmR6VZdSq5yNiyQzAsN+Oe7lTN1+htrRsAfK97yvc/IdHMlbODp2APEq65uOq652H07BJk6rkwPPPbKed8bERezUBOStemU4+pZRU9Rjt0+h1aXaLFFlXDSfODH8JQc8JQc8JQc8JQcdpGLkrS00KK5zXMcrc05PWLNQP44vv9DIOyMAhpMgkoxDZT0zRNZI7XsYRjmWkL4CU4eadNyTlH2anJ/CIPNNj5ppH+oL6HVpd5cYWaUHzTyv7tSVjTx3S8a5WuRwSdUQifjSpiLv9BqWRyiADKOKkmc30NTj/pjEyl/9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";
  title.alt = "StarBar";
  title.style.width = "150px";
  title.style.height = "auto";
  title.style.display = "block";

  titleBar.appendChild(title);

  // Edit button
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

  // Collapse button
  const collapseBtn = document.createElement("button");
  collapseBtn.innerText = "−";
  collapseBtn.style.marginLeft = "8px";
  collapseBtn.style.cursor = "pointer";

  titleBar.appendChild(collapseBtn);

  const container = document.createElement("div");
  container.id = "quickbar-buttons";

  const content = document.createElement("div");
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
