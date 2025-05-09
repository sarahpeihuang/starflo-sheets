// content.js
let lastTopMenu = null;

function simulateClick(el) {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function findVisibleElementByText(text, index) {
  const elements = Array.from(document.querySelectorAll('[role="menuitem"]'));

  return elements.find(el => {
    if (el.offsetParent === null) return false;

    const rawText = el.innerText.trim().toLowerCase();
    const noHotkey = rawText.replace(/\s+[^\s]+\s*$/, '').trim();

    return index === 0
      ? rawText === text.toLowerCase() || noHotkey === text.toLowerCase()
      : (el.querySelector('.goog-menuitem-content')?.textContent.trim().toLowerCase() === text.toLowerCase());
  });
}

function triggerMenuPath(path) {
  const labels = path.split(' > ').map(l => l.trim());
  let attempts = 0;

  function open(index) {
    const label = labels[index];
    const el = findVisibleElementByText(label, index);

    if (el) {
      if (index === 0) lastTopMenu = label;

      simulateClick(el);
      if (index < labels.length - 1) {
        setTimeout(() => open(index + 1), 400);
      } else {
        setTimeout(() => {
          const finalLabel = labels[index].toLowerCase();
          const allItems = Array.from(document.querySelectorAll('[role="menuitem"]'));

          const match = allItems.find(el => {
            const inner = el.querySelector('.goog-menuitem-content');
            const raw = inner?.textContent.trim().toLowerCase() || el.innerText.trim().toLowerCase();
            const noHotkey = raw.replace(/\s+[^\s]+\s*$/, '').trim();
            return el.offsetParent !== null && (raw === finalLabel || noHotkey === finalLabel);
          });

          if (match) {
            const rect = match.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;

            ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(type => {
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
            alert(`"${labels[index]}" matched but couldn't be clicked with PointerEvent.`);
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
    if (index === -1) {
      pins.push(path);
    } else {
      pins.splice(index, 1);
    }
    chrome.storage.local.set({ pinnedFunctions: pins }, () => {
      updateQuickbar();
    });
  });
}

function updateQuickbar() {
  chrome.storage.local.get("pinnedFunctions", (data) => {
    const buttons = data.pinnedFunctions || [];
    const container = document.getElementById("quickbar-buttons");
    container.innerHTML = '';

    buttons.forEach((func, i) => {
      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.margin = "5px 0";

      const handle = document.createElement("span");
      handle.textContent = "⋮⋮";
      handle.draggable = true;
      handle.dataset.index = i;
      handle.style.cssText = `
        cursor: grab;
        padding: 0 6px;
        user-select: none;
      `;

      handle.ondragstart = (e) => {
        e.dataTransfer.setData("text/plain", handle.dataset.index);
        wrapper.style.opacity = '0.5';
      };

      handle.ondragend = () => {
        wrapper.style.opacity = '1';
      };

      wrapper.ondragover = (e) => {
        e.preventDefault();
        wrapper.style.background = "#f0f0f0";
      };

      wrapper.ondragleave = () => {
        wrapper.style.background = "";
      };

      wrapper.ondrop = (e) => {
        e.preventDefault();
        const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
        const to = parseInt(handle.dataset.index, 10);
        if (from === to) return;

        const reordered = [...buttons];
        const [moved] = reordered.splice(from, 1);
        reordered.splice(to, 0, moved);

        chrome.storage.local.set({ pinnedFunctions: reordered }, updateQuickbar);
      };

      const btn = document.createElement("button");
      btn.textContent = func;
      btn.style.cssText = `
        flex-grow: 1;
        padding: 6px 8px;
        border: 1px solid #888;
        background: white;
        font-family: Arial, sans-serif;
        cursor: pointer;
      `;
      btn.onclick = () => triggerMenuPath(func);

      wrapper.appendChild(handle);
      wrapper.appendChild(btn);
      container.appendChild(wrapper);
    });
  });
}



function injectStarsIntoMenu(menu) {
  const items = menu.querySelectorAll('[role="menuitem"]');

  chrome.storage.local.get("pinnedFunctions", (data) => {
    const pinned = data.pinnedFunctions || [];

    items.forEach(item => {
      if (item.querySelector('.pin-star')) return;
      if (item.offsetParent === null) return;

      const rawLabel = item.querySelector('.goog-menuitem-content')?.innerText?.trim() || item.innerText.trim();
      const label = rawLabel.replace(/\s+[^\s]+\s*$/, '').trim();
      if (!label || item.getAttribute("aria-haspopup") === "true") return;

      const path = getMenuPath(item, label, menu);
      if (!path) return;

      const star = document.createElement('span');
      star.className = 'pin-star';
      star.textContent = pinned.includes(path) ? '⭐' : '☆';
      star.style.cssText = 'float:right; margin-left:8px; cursor:pointer;';
      star.onclick = (e) => {
        e.stopPropagation();
        togglePin(path);
        star.textContent = star.textContent === '⭐' ? '☆' : '⭐';
      };

      const target = item.querySelector('.goog-menuitem-content') || item;
      target.appendChild(star);
    });
  });
}

function observeMenus() {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const added of mutation.addedNodes) {
        if (!(added instanceof HTMLElement)) continue;
        if (added.getAttribute?.('role') === 'menu') {
          injectStarsIntoMenu(added);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function getMenuPath(item, label, menu) {
  const menuId = menu?.id;
  let topLabel = null;

  if (menuId) {
    const opener = document.querySelector(`[aria-controls="${menuId}"]`);
    if (opener) {
      topLabel = opener.innerText?.trim();
    }
  }

  if (!topLabel) {
    const active = document.querySelector('div[role="menubar"] [aria-expanded="true"]');
    topLabel = active?.innerText?.trim();
  }

  if (!topLabel) {
    topLabel = lastTopMenu || 'Unknown';
  }

  return `${topLabel} > ${label}`;
}

function createToolbar() {
  const bar = document.createElement('div');
  bar.id = 'quickbar';
  bar.style.position = 'fixed';
  bar.style.top = '100px';
  bar.style.right = '20px';
  bar.style.background = '#fff';
  bar.style.border = '1px solid #ccc';
  bar.style.padding = '10px';
  bar.style.zIndex = 9999;
  bar.innerHTML = `
    <b>⭐ Quickbar</b>
    <div id="quickbar-buttons"></div>
  `;
  document.body.appendChild(bar);

  updateQuickbar();
}

window.addEventListener('load', () => {
  createToolbar();
  observeMenus();
});
