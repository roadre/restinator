(() => {
  const DEFAULT_CONTENT = `@baseUrl = https://jsonplaceholder.typicode.com
@postId = 1

### Get post
GET {{baseUrl}}/posts/{{postId}}
Accept: application/json

### Create post
POST {{baseUrl}}/posts
Content-Type: application/json

{
  "title": "restinator",
  "body": "hello from a .rest file",
  "userId": 1
}

### HTML example
GET https://example.com
Accept: text/html
`;

  const acePath = '../node_modules/ace-builds/src-noconflict';
  ace.config.set('basePath', acePath);
  ace.config.set('modePath', acePath);
  ace.config.set('themePath', acePath);
  ace.config.set('workerPath', acePath);

  const editor = ace.edit('editor');
  editor.session.setUseWorker(false);
  editor.setTheme('ace/theme/twilight');
  editor.session.setMode('ace/mode/rest');
  editor.setShowPrintMargin(false);
  editor.setOptions({
    fontSize: '13px',
    tabSize: 2,
    useSoftTabs: true,
    wrap: false,
    scrollPastEnd: 0.4,
    useWorker: false
  });
  editor.setValue(DEFAULT_CONTENT, -1);

  const resultEditor = ace.edit('result-editor');
  resultEditor.session.setUseWorker(false);
  resultEditor.setTheme('ace/theme/twilight');
  resultEditor.session.setMode('ace/mode/json');
  resultEditor.setReadOnly(true);
  resultEditor.setShowPrintMargin(false);
  resultEditor.setHighlightActiveLine(false);
  resultEditor.setOptions({
    fontSize: '13px',
    wrap: true,
    showGutter: false,
    useWorker: false
  });
  resultEditor.setValue('Submit a request with F9 (or Edit → Submit).', -1);

  const state = {
    filePath: null,
    dirty: false,
    tab: 'json',
    last: null,
    sending: false,
    displayUrl: ''
  };

  const els = {
    splitter: document.getElementById('splitter'),
    editorPane: document.getElementById('editor-pane'),
    cursorInfo: document.getElementById('cursor-info'),
    fileInfo: document.getElementById('file-info'),
    status: document.getElementById('result-status'),
    request: document.getElementById('result-request'),
    copyUrl: document.getElementById('copy-url'),
    timing: document.getElementById('result-timing'),
    size: document.getElementById('result-size'),
    tabs: document.querySelectorAll('.tab'),
    resultEditor: document.getElementById('result-editor'),
    htmlView: document.getElementById('html-view')
  };

  function fileName() {
    if (!state.filePath) return 'Untitled.rest';
    return state.filePath.split(/[\\/]/).pop();
  }

  function updateTitle() {
    const name = fileName();
    els.fileInfo.textContent = state.dirty ? `${name} •` : name;
    window.restinator.setTitle(`${state.dirty ? '• ' : ''}${name} — Restinator`);
  }

  function updateCursor() {
    const pos = editor.getCursorPosition();
    els.cursorInfo.textContent = `Ln ${pos.row + 1}, Col ${pos.column + 1}`;
  }

  editor.commands.addCommand({
    name: 'submitRequest',
    bindKey: { win: 'F9', mac: 'F9' },
    exec: () => {
      submitCurrent();
    }
  });

  editor.session.on('change', () => {
    if (!state.dirty) {
      state.dirty = true;
      updateTitle();
    }
  });
  editor.selection.on('changeCursor', updateCursor);
  updateCursor();
  updateTitle();

  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.className = `status ${kind}`;
  }

  function setRequestLine(text, url) {
    els.request.textContent = text || '';
    state.displayUrl = url || '';
    if (els.copyUrl) {
      els.copyUrl.hidden = !state.displayUrl;
      els.copyUrl.textContent = 'Copy';
    }
  }

  function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function statusKind(code) {
    if (code >= 200 && code < 300) return 'ok';
    if (code >= 300 && code < 400) return 'redirect';
    if (code >= 400 && code < 500) return 'client';
    return 'server';
  }

  function prettyJson(body) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return null;
    }
  }

  function formatHeaders(headers) {
    return Object.entries(headers || {})
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }

  function formatSentRequest(req, res) {
    const headerLines = res && res.sentHeaders
      ? Object.entries(res.sentHeaders)
          .map(([name, value]) => `${name}: ${value}`)
          .join('\n')
      : (req.headers || []).map((h) => `${h.name}: ${h.value}`).join('\n');
    const requestBlock = [
      `${req.method} ${req.url}`,
      headerLines,
      req.body ? `\n${req.body}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    if (!res || res.error) {
      return requestBlock;
    }

    return [
      'REQUEST',
      requestBlock,
      '',
      'RESPONSE HEADERS',
      `HTTP ${res.status} ${res.statusText}`,
      res.url && res.url !== req.url ? `url: ${res.url}` : null,
      formatHeaders(res.headers)
    ]
      .filter((line) => line != null)
      .join('\n');
  }

  function showTab(tab) {
    state.tab = tab;
    els.tabs.forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === tab);
    });

    const html = tab === 'html';
    els.htmlView.classList.toggle('visible', html);
    els.resultEditor.classList.toggle('hidden', html);
    renderResult();
    requestAnimationFrame(() => {
      resultEditor.resize();
      editor.resize();
    });
  }

  function setResultMode(mode) {
    resultEditor.session.setUseWorker(false);
    resultEditor.session.setMode(mode);
    resultEditor.session.setUseWorker(false);
  }

  function htmlPreview(body, url) {
    const html = body || '';
    if (!url) return html;
    const base = `<base href="${escapeHtml(url)}">`;
    if (/<head[\s>]/i.test(html)) {
      return html.replace(/<head([^>]*)>/i, `<head$1>${base}`);
    }
    return `${base}${html}`;
  }

  function renderResult() {
    const last = state.last;
    if (!last) {
      if (state.tab === 'html') {
        els.htmlView.removeAttribute('srcdoc');
      } else {
        setResultMode('ace/mode/text');
        resultEditor.setValue('Submit a request with F9 (or Edit → Submit).', -1);
      }
      return;
    }

    if (last.error) {
      if (state.tab === 'html') {
        els.htmlView.srcdoc = `<pre style="white-space:pre-wrap;font-family:monospace;padding:16px;color:#b91c1c">${escapeHtml(last.error)}</pre>`;
        return;
      }
      setResultMode('ace/mode/text');
      const requestText =
        last.request
          ? `${formatSentRequest(last.request, last.response)}\n\nERROR\n${last.error}`
          : last.error;
      resultEditor.setValue(state.tab === 'request' ? requestText : last.error, -1);
      return;
    }

    if (state.tab === 'json') {
      const pretty = prettyJson(last.response.body);
      setResultMode('ace/mode/json');
      resultEditor.setValue(
        pretty || `Not JSON.\n\n${last.response.body || '(empty body)'}`,
        -1
      );
      return;
    }

    if (state.tab === 'request') {
      setResultMode('ace/mode/text');
      resultEditor.setValue(formatSentRequest(last.request, last.response), -1);
      return;
    }

    if (state.tab === 'raw') {
      setResultMode('ace/mode/text');
      resultEditor.setValue(last.response.body || '', -1);
      return;
    }

    els.htmlView.srcdoc = htmlPreview(last.response.body, last.response.url);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function headersObject(headers) {
    const out = {};
    headers.forEach((header) => {
      out[header.name] = header.value;
    });
    return out;
  }

  async function submitCurrent() {
    if (state.sending) return;
    const text = editor.getValue();
    const doc = RestParser.parseRestDocument(text);
    const cursor = editor.getCursorPosition().row;
    const request = RestParser.findRequestAtCursor(doc, cursor);

    if (!request) {
      setStatus('No request', 'error');
      setRequestLine('Place the cursor on a request and submit again.');
      els.timing.textContent = '';
      els.size.textContent = '';
      state.last = { error: 'No HTTP request found at the cursor.' };
      renderResult();
      return;
    }

    state.sending = true;
    setStatus('Sending…', 'pending');
    setRequestLine(`${request.method} ${request.url}`, request.url);
    els.timing.textContent = '';
    els.size.textContent = '';

    const vars = request.variables || {};
    const response = await window.restinator.sendRequest({
      method: request.method,
      url: request.url,
      headers: headersObject(request.headers),
      body: request.body,
      insecureSSL: /^(true|1|yes|on)$/i.test(String(vars.insecureSSL || vars.insecure || ''))
    });

    state.sending = false;
    state.last = { request, response, error: response.error || null };

    if (response.error) {
      const firstLine = String(response.error).split('\n')[0];
      setStatus(firstLine, 'error');
      els.timing.textContent = `${response.time} ms`;
      els.size.textContent = '';
    } else {
      setStatus(`${response.status} ${response.statusText}`, statusKind(response.status));
      setRequestLine(
        `${request.method} ${response.url || request.url}`,
        response.url || request.url
      );
      els.timing.textContent = `${response.time} ms`;
      els.size.textContent = formatBytes(response.size);
    }

    renderResult();
  }

  async function maybeSaveIfDirty(action) {
    if (!state.dirty) return 'discard';
    return window.restinator.confirmUnsaved(action);
  }

  async function save(saveAs) {
    const content = editor.getValue();
    if (!saveAs && state.filePath) {
      await window.restinator.saveFile(state.filePath, content);
      state.dirty = false;
      updateTitle();
      return true;
    }
    const result = await window.restinator.saveFileAs(content, state.filePath || fileName());
    if (!result) return false;
    state.filePath = result.filePath;
    state.dirty = false;
    updateTitle();
    return true;
  }

  function applyOpened(opened) {
    editor.setValue(opened.content, -1);
    state.filePath = opened.filePath;
    state.dirty = false;
    updateTitle();
  }

  async function confirmReplace() {
    const choice = await maybeSaveIfDirty('open');
    if (choice === 'cancel') return false;
    if (choice === 'save') {
      const saved = await save(false);
      if (!saved) return false;
    }
    return true;
  }

  async function openFile() {
    if (!(await confirmReplace())) return;
    const opened = await window.restinator.openFile();
    if (!opened) return;
    applyOpened(opened);
  }

  async function openRecent(filePath) {
    if (state.filePath && pathEquals(state.filePath, filePath) && !state.dirty) return;
    if (!(await confirmReplace())) return;
    const opened = await window.restinator.openPath(filePath);
    if (!opened) return;
    applyOpened(opened);
  }

  function pathEquals(left, right) {
    return String(left) === String(right);
  }

  async function handleClose() {
    const choice = await maybeSaveIfDirty('close');
    if (choice === 'cancel') return;
    if (choice === 'save') {
      const saved = await save(false);
      if (!saved) return;
    }
    await window.restinator.allowClose();
  }

  els.tabs.forEach((button) => {
    button.addEventListener('click', () => showTab(button.dataset.tab));
  });

  let dragging = false;
  els.splitter.addEventListener('mousedown', (event) => {
    dragging = true;
    els.splitter.classList.add('dragging');
    event.preventDefault();
  });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    const min = 240;
    const max = window.innerWidth - 240 - 6;
    const width = Math.min(max, Math.max(min, event.clientX));
    els.editorPane.style.flexBasis = `${width}px`;
    editor.resize();
    resultEditor.resize();
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    els.splitter.classList.remove('dragging');
  });
  window.addEventListener('resize', () => {
    editor.resize();
    resultEditor.resize();
  });

  window.restinator.onMenuOpen(() => {
    openFile();
  });
  window.restinator.onMenuOpenRecent((filePath) => {
    openRecent(filePath);
  });
  window.restinator.onMenuSave(() => {
    save(false);
  });
  window.restinator.onMenuSaveAs(() => {
    save(true);
  });
  window.restinator.onMenuSubmit(() => {
    submitCurrent();
  });
  window.restinator.onMenuWrap((wrap) => {
    editor.setOption('wrap', wrap);
  });
  window.restinator.onMenuTab((tab) => {
    showTab(tab);
  });

  let copyReset;
  els.copyUrl.addEventListener('click', async () => {
    if (!state.displayUrl) return;
    await window.restinator.copyText(state.displayUrl);
    els.copyUrl.textContent = 'Copied';
    clearTimeout(copyReset);
    copyReset = setTimeout(() => {
      els.copyUrl.textContent = 'Copy';
    }, 1200);
  });
  window.restinator.onCloseRequested(() => {
    handleClose();
  });
})();
