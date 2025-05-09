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

    if (index === 0) {
      return el.textContent.trim().toLowerCase() === text.toLowerCase();
    }

    const inner = el.querySelector('.goog-menuitem-content');
    return inner?.textContent.trim().toLowerCase() === text.toLowerCase();
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
            return (
              el.offsetParent !== null &&
              (inner?.textContent.trim().toLowerCase() === finalLabel || el.innerText.trim().toLowerCase() === finalLabel)
            );
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
    buttons.forEach((func) => {
      const btn = document.createElement("button");
      btn.innerText = func;
      btn.style.display = "block";
      btn.style.margin = "5px 0";
      btn.onclick = () => triggerMenuPath(func);
      container.appendChild(btn);
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

      const label = item.querySelector('.goog-menuitem-content')?.innerText?.trim() || item.innerText.trim();
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

  // Fallback: try to find closest open top-level menu
  if (!topLabel) {
    const active = document.querySelector('div[role="menubar"] [aria-expanded="true"]');
    topLabel = active?.innerText?.trim();
  }

  // Final fallback
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
    <button id="triggerTheme" style="display:block; margin:8px 0; background:#4285f4; color:#fff; border:none; border-radius:4px; padding:6px 12px; cursor:pointer;">Format > Theme</button>
    <input type="text" id="functionSearch" placeholder="Search functions..." style="display:block; margin-top:5px; width:160px;">
    <div id="quickbar-buttons"></div>
  `;
  document.body.appendChild(bar);

  document.getElementById('triggerTheme').onclick = function () {
    triggerMenuPath("Format > Theme");
  };

  const input = document.getElementById('functionSearch');
  input.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const allButtons = document.querySelectorAll('#quickbar-buttons button');
    allButtons.forEach(btn => {
      btn.style.display = btn.innerText.toLowerCase().includes(query) ? 'block' : 'none';
    });
  });

  updateQuickbar();
}

window.addEventListener('load', () => {
  createToolbar();
  observeMenus();
});
