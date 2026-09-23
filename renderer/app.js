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

  const REST_TEMPLATES = {
    get: `### GET
GET https://httpbin.org/get
Accept: application/json
`,
    userAgent: `### User-Agent
GET https://httpbin.org/user-agent
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36
Accept: application/json
`,
    postJson: `### POST with JSON
POST https://httpbin.org/post
Content-Type: application/json
Accept: application/json

{
  "title": "restinator",
  "ok": true
}
`,
    postAuth: `### POST with auth
@token = your-token-here
POST https://httpbin.org/post
Authorization: Bearer {{token}}
Content-Type: application/json
Accept: application/json

{
  "name": "restinator"
}
`,
    postForm: `### POST with form fields
POST https://httpbin.org/post
Content-Type: application/x-www-form-urlencoded

name=restinator&role=admin
`
  };

  function insertTemplate(id) {
    const snippet = REST_TEMPLATES[id];
    if (!snippet) return;
    const block = snippet.replace(/\s+$/, '');
    const current = editor.getValue().replace(/\s+$/, '');
    const next = current ? `${current}\n\n${block}\n` : `${block}\n`;
    editor.setValue(next, -1);
    const lines = next.split('\n');
    let methodRow = 0;
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i.test(lines[i].trim())) {
        methodRow = i;
        break;
      }
    }
    editor.gotoLine(methodRow + 1, 0, true);
    editor.focus();
    setStatus('Inserted template', 'ok');
  }

  const acePath = '../node_modules/ace-builds/src-noconflict';
  ace.config.set('basePath', acePath);
  ace.config.set('modePath', acePath);
  ace.config.set('themePath', acePath);
  ace.config.set('workerPath', acePath);

  const editor = ace.edit('editor');
  editor.session.setUseWorker(false);
  editor.setTheme('ace/theme/github_dark');
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
  resultEditor.setTheme('ace/theme/github_dark');
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

  function applyTheme(name) {
    if (!name) return;
    const id = String(name).startsWith('ace/theme/') ? name : `ace/theme/${name}`;
    editor.setTheme(id);
    resultEditor.setTheme(id);
  }

  window.restinator.getTheme().then(applyTheme);

  const AceRange = ace.require('ace/range').Range;
  let resultSearchMarkerIds = [];
  let resultSearchRanges = [];

  const state = {
    filePath: null,
    dirty: false,
    tab: 'json',
    last: null,
    sending: false,
    pendingRequest: null,
    displayUrl: '',
    hideSecrets: true,
    resultSearchQuery: '',
    resultSearchIndex: 0
  };

  const els = {
    splitter: document.getElementById('splitter'),
    editorPane: document.getElementById('editor-pane'),
    cursorInfo: document.getElementById('cursor-info'),
    fileInfo: document.getElementById('file-info'),
    status: document.getElementById('status-message'),
    httpStatus: document.getElementById('result-status'),
    request: document.getElementById('result-request'),
    copyUrl: document.getElementById('copy-url'),
    timing: document.getElementById('result-timing'),
    size: document.getElementById('result-size'),
    tabs: document.querySelectorAll('.tab'),
    resultSearch: document.getElementById('result-search'),
    resultSearchPrev: document.getElementById('result-search-prev'),
    resultSearchNext: document.getElementById('result-search-next'),
    resultSearchCount: document.getElementById('result-search-count'),
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
    bindKey: { win: 'F9|Ctrl-Enter', mac: 'F9|Ctrl-Enter' },
    exec: () => {
      submitCurrent();
    }
  });
  resultEditor.commands.addCommand({
    name: 'submitRequest',
    bindKey: { win: 'F9|Ctrl-Enter', mac: 'F9|Ctrl-Enter' },
    exec: () => {
      submitCurrent();
    }
  });

  let lastStatementNav = 0;

  function gotoStatement(direction) {
    const now = Date.now();
    if (now - lastStatementNav < 80) return;
    lastStatementNav = now;

    const rows = requestGutterRows.length
      ? requestGutterRows
      : (RestParser.parseRestDocument(editor.getValue()).requests || [])
          .map((req) => req.methodLine)
          .filter((row) => Number.isInteger(row));
    if (!rows.length) return;

    const current = editor.getCursorPosition().row;
    let target = null;
    if (direction < 0) {
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (rows[i] < current) {
          target = rows[i];
          break;
        }
      }
    } else {
      for (let i = 0; i < rows.length; i += 1) {
        if (rows[i] > current) {
          target = rows[i];
          break;
        }
      }
    }
    if (target == null) return;
    editor.gotoLine(target + 1, 0, true);
    editor.focus();
  }

  [editor, resultEditor].forEach((pane) => {
    pane.commands.removeCommand('scrollup');
    pane.commands.removeCommand('scrolldown');
    pane.commands.addCommand({
      name: 'statementUp',
      bindKey: { win: 'Ctrl-Up', mac: 'Ctrl-Up' },
      exec: () => gotoStatement(-1),
      readOnly: true
    });
    pane.commands.addCommand({
      name: 'statementDown',
      bindKey: { win: 'Ctrl-Down', mac: 'Ctrl-Down' },
      exec: () => gotoStatement(1),
      readOnly: true
    });
  });

  let requestGutterRows = [];

  function refreshRequestGutter() {
    const doc = RestParser.parseRestDocument(editor.getValue());
    const rows = (doc.requests || [])
      .map((req) => req.methodLine)
      .filter((row) => Number.isInteger(row));
    const same =
      rows.length === requestGutterRows.length &&
      rows.every((row, i) => row === requestGutterRows[i]);
    if (same) return;
    requestGutterRows = rows;
    editor.session.clearBreakpoints();
    rows.forEach((row) => {
      editor.session.setBreakpoint(row, 'ace_run ');
    });
  }

  function runChevronRow(e) {
    const region = editor.renderer.$gutterLayer.getRegion(e);
    if (region !== 'markers') return false;
    const row = e.getDocumentPosition().row;
    return requestGutterRows.includes(row) ? row : false;
  }

  editor.on('guttermousedown', (e) => {
    if (e.getButton() !== 0) return;
    const row = runChevronRow(e);
    if (row === false) return;
    e.stop();
    editor.gotoLine(row + 1, 0, true);
    submitCurrent();
  });
  editor.on('guttermousemove', (e) => {
    const over = runChevronRow(e) !== false;
    editor.renderer.$gutter.style.cursor = over ? 'pointer' : '';
    editor.renderer.$gutter.title = over ? 'Run request' : '';
  });
  editor.renderer.$gutter.addEventListener('mouseleave', () => {
    editor.renderer.$gutter.style.cursor = '';
    editor.renderer.$gutter.title = '';
  });

  editor.session.on('change', () => {
    refreshRequestGutter();
    if (!state.dirty) {
      state.dirty = true;
      updateTitle();
    }
  });
  editor.selection.on('changeCursor', updateCursor);
  updateCursor();
  updateTitle();
  refreshRequestGutter();

  function setStatus(text, kind) {
    if (!els.status) return;
    els.status.textContent = text;
    els.status.className = `status ${kind}`;
  }

  function setHttpStatus(text, kind) {
    if (!els.httpStatus) return;
    els.httpStatus.textContent = text;
    els.httpStatus.className = `status ${kind}`;
  }

  function httpStatusLabel(status, statusText) {
    const code = status == null ? '' : String(status);
    const reason = String(statusText || '').trim();
    if (!code) return reason;
    if (!reason || reason === code) return code;
    return `${code} ${reason}`;
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
      `HTTP ${httpStatusLabel(res.status, res.statusText)}`,
      res.url && res.url !== req.url ? `url: ${res.url}` : null,
      formatHeaders(res.headers)
    ]
      .filter((line) => line != null)
      .join('\n');
  }

  function isResultSearchSupported() {
    return state.tab !== 'html';
  }

  function clearResultSearchMarkers() {
    const session = resultEditor.getSession();
    resultSearchMarkerIds.forEach((id) => session.removeMarker(id));
    resultSearchMarkerIds = [];
  }

  function findResultSearchMatches(query) {
    const needle = String(query || '');
    if (!needle) return [];
    const doc = resultEditor.getSession().getDocument();
    const needleLower = needle.toLowerCase();
    const ranges = [];
    for (let row = 0; row < doc.getLength(); row += 1) {
      const line = doc.getLine(row);
      const lineLower = line.toLowerCase();
      let col = 0;
      while (col < line.length) {
        const idx = lineLower.indexOf(needleLower, col);
        if (idx === -1) break;
        ranges.push(new AceRange(row, idx, row, idx + needle.length));
        col = idx + needle.length;
      }
    }
    return ranges;
  }

  function updateResultSearchCount(count, hasQuery, activeIndex = 0) {
    const el = els.resultSearchCount;
    if (!hasQuery) {
      el.textContent = '';
      el.classList.remove('no-match');
      return;
    }
    if (count === 0) {
      el.textContent = 'Keine Treffer';
      el.classList.add('no-match');
      return;
    }
    if (count === 1) {
      el.textContent = '1 Treffer';
    } else {
      el.textContent = `${activeIndex + 1} / ${count}`;
    }
    el.classList.remove('no-match');
  }

  function updateResultSearchNav(count, enabled) {
    const canNavigate = enabled && count > 1;
    els.resultSearchPrev.disabled = !canNavigate;
    els.resultSearchNext.disabled = !canNavigate;
  }

  function paintResultSearchMarkers(ranges, activeIndex) {
    clearResultSearchMarkers();
    const session = resultEditor.getSession();
    ranges.forEach((range, index) => {
      const className = index === activeIndex ? 'ace_result_search_current' : 'ace_result_search';
      resultSearchMarkerIds.push(session.addMarker(range, className, 'text', false));
    });
  }

  function scrollToResultSearchMatch(range) {
    resultEditor.scrollToLine(range.start.row, true, true, () => {});
    resultEditor.gotoLine(range.start.row + 1, range.start.column, true);
  }

  function normalizeResultSearchIndex(index, count) {
    if (count <= 0) return 0;
    return ((index % count) + count) % count;
  }

  function setActiveResultSearchIndex(index, ranges, hasQuery) {
    resultSearchRanges = ranges;
    if (!ranges.length) {
      state.resultSearchIndex = 0;
      clearResultSearchMarkers();
      updateResultSearchCount(0, hasQuery);
      updateResultSearchNav(0, hasQuery && isResultSearchSupported());
      return;
    }

    state.resultSearchIndex = normalizeResultSearchIndex(index, ranges.length);
    paintResultSearchMarkers(ranges, state.resultSearchIndex);
    scrollToResultSearchMatch(ranges[state.resultSearchIndex]);
    updateResultSearchCount(ranges.length, hasQuery, state.resultSearchIndex);
    updateResultSearchNav(ranges.length, hasQuery && isResultSearchSupported());
  }

  function resolveResultSearchIndex(ranges, preserveIndex) {
    if (!ranges.length) return 0;
    if (!preserveIndex) return 0;
    if (state.resultSearchIndex >= ranges.length) return 0;
    return state.resultSearchIndex;
  }

  function updateResultSearchUi() {
    const supported = isResultSearchSupported();
    els.resultSearch.disabled = !supported;
    els.resultSearch.placeholder = supported
      ? 'Im Ergebnis suchen…'
      : 'Nur JSON, Request, Raw';
    if (!supported) {
      resultSearchRanges = [];
      clearResultSearchMarkers();
      state.resultSearchIndex = 0;
      updateResultSearchCount(0, false);
      updateResultSearchNav(0, false);
    }
  }

  function applyResultSearch(options = {}) {
    const preserveIndex = options.preserveIndex === true;
    updateResultSearchUi();

    const query = state.resultSearchQuery.trim();
    const hasQuery = !!query;
    if (!hasQuery || !isResultSearchSupported() || els.resultEditor.classList.contains('hidden')) {
      resultSearchRanges = [];
      clearResultSearchMarkers();
      state.resultSearchIndex = 0;
      updateResultSearchCount(0, false);
      updateResultSearchNav(0, false);
      return;
    }

    const ranges = findResultSearchMatches(query);
    const index = resolveResultSearchIndex(ranges, preserveIndex);
    setActiveResultSearchIndex(index, ranges, true);
  }

  function stepResultSearch(direction) {
    if (!resultSearchRanges.length) return;
    setActiveResultSearchIndex(state.resultSearchIndex + direction, resultSearchRanges, true);
  }

  function scheduleResultSearch() {
    requestAnimationFrame(() => applyResultSearch({ preserveIndex: true }));
  }

  function showTab(tab) {
    state.tab = tab;
    els.tabs.forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === tab);
    });

    const html = tab === 'html';
    els.htmlView.classList.toggle('visible', html);
    els.resultEditor.classList.toggle('hidden', html);
    updateResultSearchUi();
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

  function formatOutgoingRequest(req) {
    if (!req) return '';
    const headerLines = (req.headers || [])
      .map((header) => `${header.name}: ${header.value}`)
      .join('\n');
    return [`${req.method} ${req.url}`, headerLines, req.body ? `\n${req.body}` : '']
      .filter(Boolean)
      .join('\n');
  }

  function showRunning(req) {
    els.htmlView.classList.remove('visible');
    els.htmlView.removeAttribute('srcdoc');
    els.resultEditor.classList.remove('hidden');
    setResultMode('ace/mode/text');
    const outgoing = formatOutgoingRequest(req || state.pendingRequest);
    resultEditor.setValue(outgoing ? `Running ...\n\n${outgoing}` : 'Running ...', -1);
  }

  function renderResult() {
    if (state.sending) {
      showRunning(state.pendingRequest);
      scheduleResultSearch();
      return;
    }
    const last = state.last;
    if (!last) {
      if (state.tab === 'html') {
        els.htmlView.removeAttribute('srcdoc');
      } else {
        setResultMode('ace/mode/text');
        resultEditor.setValue('Submit a request with F9 (or Edit → Submit).', -1);
      }
      scheduleResultSearch();
      return;
    }

    if (last.error) {
      if (state.tab === 'html') {
        els.htmlView.srcdoc = `<pre style="white-space:pre-wrap;font-family:monospace;padding:16px;color:#b91c1c">${escapeHtml(last.error)}</pre>`;
        scheduleResultSearch();
        return;
      }
      setResultMode('ace/mode/text');
      const requestText =
        last.request
          ? `${formatSentRequest(last.request, last.response)}\n\nERROR\n${last.error}`
          : last.error;
      resultEditor.setValue(state.tab === 'request' ? requestText : last.error, -1);
      scheduleResultSearch();
      return;
    }

    if (state.tab === 'json') {
      const pretty = prettyJson(last.response.body);
      setResultMode('ace/mode/json');
      resultEditor.setValue(
        pretty || `Not JSON.\n\n${last.response.body || '(empty body)'}`,
        -1
      );
      scheduleResultSearch();
      return;
    }

    if (state.tab === 'request') {
      setResultMode('ace/mode/text');
      resultEditor.setValue(formatSentRequest(last.request, last.response), -1);
      scheduleResultSearch();
      return;
    }

    if (state.tab === 'raw') {
      setResultMode('ace/mode/text');
      resultEditor.setValue(last.response.body || '', -1);
      scheduleResultSearch();
      return;
    }

    els.htmlView.srcdoc = htmlPreview(last.response.body, last.response.url);
    scheduleResultSearch();
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

  function shellQuote(value) {
    return `'${String(value).replace(/'/g, `'\\''`)}'`;
  }

  function isTruthyVar(value) {
    return /^(true|1|yes|on)$/i.test(String(value || '').trim());
  }

  function isSecretName(name) {
    const n = String(name || '').trim();
    return /^(x-)?(api[-_]?key|auth(orization)?|access[-_]?token|refresh[-_]?token|id[-_]?token|token|secret|password|passwd|pass|bearer|credential|client[-_]?secret|private[-_]?key|jwt|session|cookie|set-cookie)$/i.test(n)
      || /(password|passwd|secret|token|api[-_]?key)$/i.test(n);
  }

  function maskPlain(value) {
    const text = String(value);
    if (!text) return text;
    return `${text.slice(0, 2)}....`;
  }

  function maskSecret(value) {
    const text = String(value);
    const scheme = text.match(/^(Bearer|Basic|Token)\s+(\S+)(.*)$/i);
    if (scheme) {
      return `${scheme[1]} ${maskPlain(scheme[2])}${scheme[3]}`;
    }
    return maskPlain(text);
  }

  function redactHeaderValue(name, value) {
    if (!state.hideSecrets) return value;
    return isSecretName(name) ? maskSecret(value) : value;
  }

  function redactHeadersObject(headers) {
    const out = {};
    Object.entries(headers || {}).forEach(([name, value]) => {
      out[name] = redactHeaderValue(name, value);
    });
    return out;
  }

  function redactJsonValue(value, parentSecret) {
    if (parentSecret && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
      return maskSecret(String(value));
    }
    if (Array.isArray(value)) {
      return value.map((item) => redactJsonValue(item, parentSecret));
    }
    if (value && typeof value === 'object') {
      const out = {};
      Object.keys(value).forEach((key) => {
        out[key] = redactJsonValue(value[key], isSecretName(key));
      });
      return out;
    }
    return value;
  }

  function redactJsonText(text) {
    if (!state.hideSecrets || text == null || text === '') return text;
    try {
      return JSON.stringify(redactJsonValue(JSON.parse(text), false), null, 2);
    } catch {
      return text;
    }
  }

  function redactUrl(url) {
    if (!state.hideSecrets || !url) return url;
    try {
      const parsed = new URL(url);
      parsed.searchParams.forEach((value, key) => {
        if (isSecretName(key)) parsed.searchParams.set(key, maskPlain(value));
      });
      return parsed.toString();
    } catch {
      return url;
    }
  }

  function exportHeaders(req, res) {
    const headers = (res && res.sentHeaders) || headersObject(req.headers || []);
    return redactHeadersObject(headers);
  }

  function exportBody(text) {
    if (text == null || text === '') return '';
    const pretty = prettyJson(text);
    if (pretty != null) return redactJsonText(pretty);
    return text;
  }

  function exportResponseBody(res) {
    if (!res) return '';
    if (res.error) return res.error;
    return exportBody(res.body || '');
  }

  function formatExportRequest(req, res) {
    const headers = exportHeaders(req, res);
    const headerLines = Object.entries(headers)
      .map(([name, value]) => `${name}: ${value}`)
      .join('\n');
    const body = exportBody(req.body || '');
    const url = redactUrl((res && res.url) || req.url);
    return [`${req.method} ${url}`, headerLines, body ? `\n${body}` : '']
      .filter(Boolean)
      .join('\n');
  }

  function toCurl(req, res) {
    const method = (req.method || 'GET').toUpperCase();
    const body = exportBody(req.body || '');
    const url = redactUrl((res && res.url) || req.url);
    const lines = [method !== 'GET' || body ? `curl -X ${method}` : 'curl'];
    const skip = new Set(['content-length', 'transfer-encoding', 'connection']);

    Object.entries(exportHeaders(req, res)).forEach(([name, value]) => {
      if (skip.has(name.toLowerCase())) return;
      lines.push(`-H ${shellQuote(`${name}: ${value}`)}`);
    });

    const vars = req.variables || {};
    if (isTruthyVar(vars.insecureSSL || vars.insecure)) {
      lines.push('-k');
    }

    if (body) {
      lines.push(`--data-binary ${shellQuote(body)}`);
    }

    lines.push(shellQuote(url));
    return lines.join(' \\\n  ');
  }

  function exportTitle(title) {
    return `---------------------------------------------\n${title}\n---------------------------------------------`;
  }

  function formatExportExchange(req, res) {
    const parts = [exportTitle('REQUEST'), formatExportRequest(req, res)];
    if (!res || res.error) {
      if (res && res.error) {
        parts.push('', exportTitle('RESPONSE'), res.error);
      }
      return parts.join('\n');
    }
    parts.push(
      '',
      exportTitle('RESPONSE'),
      httpStatusLabel(res.status, res.statusText),
      '',
      exportResponseBody(res)
    );
    return parts.join('\n');
  }

  function actualRequest() {
    if (state.last && state.last.request) {
      return { request: state.last.request, response: state.last.response || null };
    }
    const doc = RestParser.parseRestDocument(editor.getValue());
    const request = RestParser.findRequestAtCursor(doc, editor.getCursorPosition().row);
    if (!request) return null;
    return { request, response: null };
  }

  async function copyExport(text, okStatus) {
    await window.restinator.copyText(text);
    setStatus(okStatus, 'ok');
  }

  async function copyAsCurl() {
    const current = actualRequest();
    if (!current) {
      setStatus('No request', 'error');
      setRequestLine('Place the cursor on a request, or submit one first.');
      return;
    }
    await copyExport(toCurl(current.request, current.response), 'Copied curl');
  }

  async function copyRequestAndResponse() {
    if (!state.last || !state.last.request) {
      setStatus('No response', 'error');
      setRequestLine('Submit a request first.');
      return;
    }
    await copyExport(
      formatExportExchange(state.last.request, state.last.response),
      'Copied request and response'
    );
  }

  async function copyResponse() {
    if (!state.last || !state.last.response) {
      setStatus('No response', 'error');
      setRequestLine('Submit a request first.');
      return;
    }
    await copyExport(exportResponseBody(state.last.response), 'Copied response');
  }

  async function submitCurrent() {
    if (state.sending) return;
    state.sending = true;
    try {
      const text = editor.getValue();
      const doc = RestParser.parseRestDocument(text);
      const cursor = editor.getCursorPosition().row;
      const request = RestParser.findRequestAtCursor(doc, cursor);

      if (!request) {
        setHttpStatus('No request', 'error');
        setRequestLine('Place the cursor on a request and submit again.');
        els.timing.textContent = '';
        els.size.textContent = '';
        state.last = { error: 'No HTTP request found at the cursor.' };
        renderResult();
        return;
      }

      state.pendingRequest = request;
      setHttpStatus('Running ...', 'pending');
      setStatus('Running ...', 'pending');
      setRequestLine(`${request.method} ${request.url}`, request.url);
      els.timing.textContent = '';
      els.size.textContent = '';
      showRunning(request);

      const vars = request.variables || {};
      const response = await window.restinator.sendRequest({
        method: request.method,
        url: request.url,
        headers: headersObject(request.headers),
        body: request.body,
        insecureSSL: isTruthyVar(vars.insecureSSL || vars.insecure)
      });

      state.last = { request, response, error: response.error || null };
      state.sending = false;

      if (response.error) {
        const firstLine = String(response.error).split('\n')[0];
        setHttpStatus(firstLine, 'error');
        setStatus(firstLine, 'error');
        els.timing.textContent = `${response.time} ms`;
        els.size.textContent = '';
      } else {
        const label = httpStatusLabel(response.status, response.statusText);
        setHttpStatus(label, statusKind(response.status));
        setStatus(label, statusKind(response.status));
        setRequestLine(
          `${request.method} ${response.url || request.url}`,
          response.url || request.url
        );
        els.timing.textContent = `${response.time} ms`;
        els.size.textContent = formatBytes(response.size);
      }

      renderResult();
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      setHttpStatus('Submit failed', 'error');
      setStatus(message, 'error');
    } finally {
      state.sending = false;
    }
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

  els.tabs.forEach((button) => {
    button.addEventListener('click', () => showTab(button.dataset.tab));
  });

  els.resultSearch.addEventListener('input', () => {
    state.resultSearchQuery = els.resultSearch.value;
    applyResultSearch({ preserveIndex: false });
  });
  els.resultSearchPrev.addEventListener('click', () => stepResultSearch(-1));
  els.resultSearchNext.addEventListener('click', () => stepResultSearch(1));
  updateResultSearchUi();
  updateResultSearchNav(0, false);

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
  window.restinator.onMenuCopyCurl(() => {
    copyAsCurl();
  });
  window.restinator.onMenuCopyExchange(() => {
    copyRequestAndResponse();
  });
  window.restinator.onMenuCopyResponse(() => {
    copyResponse();
  });
  window.restinator.onMenuHideSecrets((hide) => {
    state.hideSecrets = hide;
  });
  window.restinator.onMenuWrap((wrap) => {
    editor.setOption('wrap', wrap);
  });
  window.restinator.onMenuTheme((theme) => {
    applyTheme(theme);
  });
  window.restinator.onMenuTab((tab) => {
    showTab(tab);
  });
  window.restinator.onMenuStatement((direction) => {
    gotoStatement(direction === 'up' ? -1 : 1);
  });
  window.restinator.onMenuTemplate((id) => {
    insertTemplate(id);
  });

  function activeEditor() {
    return resultEditor.isFocused() ? resultEditor : editor;
  }

  function execEdit(command) {
    const pane = activeEditor();
    pane.focus();
    if (command === 'undo') return pane.undo();
    if (command === 'redo') return pane.redo();
    if (command === 'selectAll') return pane.selectAll();
    document.execCommand(command);
  }

  const menuBarEl = document.getElementById('menu-bar');
  const menuBar = window.RestMenuBar({
    el: menuBarEl,
    actions: {
      open: () => openFile(),
      save: () => save(false),
      saveAs: () => save(true),
      openRecent: (filePath) => openRecent(filePath),
      exit: () => window.close(),
      submit: () => submitCurrent(),
      undo: () => execEdit('undo'),
      redo: () => execEdit('redo'),
      cut: () => execEdit('cut'),
      copy: () => execEdit('copy'),
      paste: () => execEdit('paste'),
      selectAll: () => execEdit('selectAll'),
      statementUp: () => gotoStatement(-1),
      statementDown: () => gotoStatement(1),
      wrap: (wrap) => {
        editor.setOption('wrap', wrap);
        window.restinator.setWrap(wrap);
      },
      theme: (theme) => {
        applyTheme(theme);
        window.restinator.setTheme(theme);
      },
      hideSecrets: (hide) => {
        state.hideSecrets = hide;
        window.restinator.setHideSecrets(hide);
      },
      copyCurl: () => copyAsCurl(),
      copyExchange: () => copyRequestAndResponse(),
      copyResponse: () => copyResponse(),
      tab: (tab) => showTab(tab),
      template: (id) => insertTemplate(id)
    }
  });

  function applyChrome(chrome) {
    if (!chrome) return;
    if (chrome.inWindow) {
      menuBarEl.hidden = false;
      requestAnimationFrame(() => {
        editor.resize();
        resultEditor.resize();
      });
    }
    if (chrome.theme) applyTheme(chrome.theme);
    if (typeof chrome.wrapText === 'boolean') editor.setOption('wrap', chrome.wrapText);
    if (typeof chrome.hideSecrets === 'boolean') state.hideSecrets = chrome.hideSecrets;
    menuBar.setChrome(chrome);
  }

  window.restinator.getChrome().then(applyChrome);
  window.restinator.onMenuChrome(applyChrome);

  let copyReset;
  els.copyUrl.addEventListener('click', async () => {
    if (!state.displayUrl) return;
    await window.restinator.copyText(state.displayUrl);
    els.copyUrl.textContent = 'Copied';
    setStatus('Copied URL', 'ok');
    clearTimeout(copyReset);
    copyReset = setTimeout(() => {
      els.copyUrl.textContent = 'Copy';
    }, 1200);
  });
})();
