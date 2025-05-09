// injects a floating toolbar into Google Sheets
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
    bar.innerHTML = '<b>⭐ Quickbar</b><br>(Add buttons here)';
    document.body.appendChild(bar);
  }
  
  window.addEventListener('load', createToolbar);