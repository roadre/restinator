(() => {
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function RestMenuBar(options) {
    const root = options.el;
    const actions = options.actions || {};
    let chrome = {
      recents: [],
      themes: [],
      theme: 'github_dark',
      wrapText: false,
      hideSecrets: true
    };
    let openKey = null;

    function run(name, arg) {
      const fn = actions[name];
      close();
      if (typeof fn === 'function') fn(arg);
    }

    function close() {
      openKey = null;
      root.querySelectorAll('.menu-root.open').forEach((btn) => btn.classList.remove('open'));
      root.querySelectorAll('.menu-popup').forEach((popup) => popup.remove());
    }

    function closeSiblingSubs(item) {
      const parent = item.parentElement;
      if (!parent) return;
      Array.from(parent.children).forEach((child) => {
        if (child !== item && child.classList && child.classList.contains('open')) {
          child.classList.remove('open');
        }
      });
    }

    function itemButton(spec) {
      if (spec.type === 'separator') return el('div', 'menu-sep');

      const btn = el('div', 'menu-item' + (spec.submenu ? ' has-sub' : ''));
      btn.setAttribute('role', 'menuitem');
      if (spec.disabled) btn.classList.add('disabled');

      if (spec.checked != null) {
        btn.appendChild(el('span', 'menu-check', spec.checked ? '✓' : ''));
      } else {
        btn.appendChild(el('span', 'menu-check'));
      }

      btn.appendChild(el('span', 'menu-label', spec.label));
      if (spec.accel) btn.appendChild(el('span', 'menu-accel', spec.accel));
      if (spec.submenu) btn.appendChild(el('span', 'menu-caret', '▸'));

      btn.addEventListener('mouseenter', () => {
        closeSiblingSubs(btn);
        if (spec.submenu) btn.classList.add('open');
      });

      if (spec.submenu) {
        const sub = el('div', 'menu-popup menu-sub');
        spec.submenu.forEach((child) => sub.appendChild(itemButton(child)));
        btn.appendChild(sub);
      } else if (!spec.disabled) {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          run(spec.action, spec.arg);
        });
      }

      return btn;
    }

    function popupFor(key) {
      const items = menus()[key] || [];
      const popup = el('div', 'menu-popup');
      items.forEach((spec) => popup.appendChild(itemButton(spec)));
      return popup;
    }

    function open(key, slot) {
      close();
      openKey = key;
      const button = slot.querySelector('.menu-root');
      button.classList.add('open');
      slot.appendChild(popupFor(key));
    }

    function menus() {
      const recents = chrome.recents || [];
      const themes = chrome.themes || [];
      return {
        file: [
          { label: 'New', accel: 'Ctrl+N', action: 'new' },
          { label: 'Open', accel: 'Ctrl+O', action: 'open' },
          { label: 'Save', accel: 'Ctrl+S', action: 'save' },
          { label: 'Save As', accel: 'Ctrl+Shift+S', action: 'saveAs' },
          {
            label: 'Recent',
            submenu: recents.length
              ? recents.map((item) => ({
                  label: item.label,
                  action: 'openRecent',
                  arg: item.filePath
                }))
              : [{ label: 'No Recent Files', disabled: true }]
          },
          { type: 'separator' },
          { label: 'Exit', accel: 'Alt+F4', action: 'exit' }
        ],
        edit: [
          { label: 'Submit', accel: 'F9', action: 'submit' },
          { type: 'separator' },
          { label: 'Undo', accel: 'Ctrl+Z', action: 'undo' },
          { label: 'Redo', accel: 'Ctrl+Y', action: 'redo' },
          { type: 'separator' },
          { label: 'Cut', accel: 'Ctrl+X', action: 'cut' },
          { label: 'Copy', accel: 'Ctrl+C', action: 'copy' },
          { label: 'Paste', accel: 'Ctrl+V', action: 'paste' },
          { label: 'Select All', accel: 'Ctrl+A', action: 'selectAll' }
        ],
        navigate: [
          { label: 'Statement Up', accel: 'Ctrl+Up', action: 'statementUp' },
          { label: 'Statement Down', accel: 'Ctrl+Down', action: 'statementDown' }
        ],
        templates: [
          { label: 'Demo', action: 'template', arg: 'demo' },
          { type: 'separator' },
          { label: 'GET', action: 'template', arg: 'get' },
          { label: 'GET with User-Agent', action: 'template', arg: 'userAgent' },
          { type: 'separator' },
          { label: 'POST with JSON', action: 'template', arg: 'postJson' },
          { label: 'POST with auth', action: 'template', arg: 'postAuth' },
          { label: 'POST with form fields', action: 'template', arg: 'postForm' }
        ],
        view: [
          {
            label: 'Wrap Text',
            checked: !!chrome.wrapText,
            action: 'wrap',
            arg: !chrome.wrapText
          },
          {
            label: 'Theme',
            submenu: themes.map((item) => {
              if (item.type === 'separator') return { type: 'separator' };
              return {
                label: item.label,
                checked: chrome.theme === item.id,
                action: 'theme',
                arg: item.id
              };
            })
          }
        ],
        export: [
          {
            label: 'Hide Secrets',
            checked: !!chrome.hideSecrets,
            action: 'hideSecrets',
            arg: !chrome.hideSecrets
          },
          { type: 'separator' },
          { label: 'Copy Request as curl', accel: 'Ctrl+Shift+C', action: 'copyCurl' },
          { label: 'Copy Request and Response', action: 'copyExchange' },
          { label: 'Copy Response', action: 'copyResponse' }
        ],
        response: [
          { label: 'Json', accel: 'Ctrl+1', action: 'tab', arg: 'json' },
          { label: 'Request', accel: 'Ctrl+2', action: 'tab', arg: 'request' },
          { label: 'Raw', accel: 'Ctrl+3', action: 'tab', arg: 'raw' },
          { label: 'Html', accel: 'Ctrl+4', action: 'tab', arg: 'html' }
        ]
      };
    }

    const roots = [
      ['file', 'File'],
      ['edit', 'Edit'],
      ['navigate', 'Navigate'],
      ['templates', 'Templates'],
      ['view', 'View'],
      ['export', 'Export'],
      ['response', 'Response']
    ];

    roots.forEach(([key, label]) => {
      const slot = el('div', 'menu-slot');
      const button = el('button', 'menu-root', label);
      button.type = 'button';
      button.dataset.menu = key;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (openKey === key) close();
        else open(key, slot);
      });
      button.addEventListener('mouseenter', () => {
        if (openKey && openKey !== key) open(key, slot);
      });
      slot.appendChild(button);
      root.appendChild(slot);
    });

    document.addEventListener('mousedown', (event) => {
      if (!root.contains(event.target)) close();
    });
    window.addEventListener('blur', close);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });

    return {
      setChrome(next) {
        chrome = Object.assign({}, chrome, next || {});
        if (openKey) {
          const slot = root.querySelector(`.menu-root[data-menu="${openKey}"]`)?.parentElement;
          if (slot) open(openKey, slot);
        }
      },
      close
    };
  }

  window.RestMenuBar = RestMenuBar;
})();
