// content.js
function simulateClick(el) {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function findVisibleElementByText(text, index) {
  const elements = Array.from(document.querySelectorAll('[role="menuitem"]'));

  return elements.find(el => {
    if (el.offsetParent === null) return false;

    // Top-level menu (e.g., Format, Insert)
    if (index === 0) {
      return el.textContent.trim().toLowerCase() === text.toLowerCase();
    }

    // Submenus (e.g., Theme, Chart)
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
      simulateClick(el);
      if (index < labels.length - 1) {
        setTimeout(() => open(index + 1), 400);
      } else {
        // final item: trigger Enter key
        setTimeout(() => {
          const finalLabel = labels[index].toLowerCase();
          const allItems = Array.from(document.querySelectorAll('[role="menuitem"]'));
        
          const match = allItems.find(el => {
            const inner = el.querySelector('.goog-menuitem-content');
            return (
              el.offsetParent !== null &&
              inner?.textContent.trim().toLowerCase() === finalLabel
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

window.addEventListener('load', createToolbar);
