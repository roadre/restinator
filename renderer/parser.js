(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RestParser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const METHOD_RE =
    /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\s+(\S+)(?:\s+HTTP\/[\d.]+)?$/i;
  const VAR_DEF_RE = /^@([A-Za-z_][\w]*)\s*=\s*(.*)$/;
  const COMMENT_RE = /^\s*(#|\/\/)/;
  const QUERY_RE = /^[?&]\S/;

  function stripInlineComment(value) {
    const trimmed = value.trim();
    const comment = trimmed.search(/\s+\/\//);
    if (comment >= 0) return trimmed.slice(0, comment).trim();
    return trimmed;
  }

  function substitute(text, vars) {
    if (text == null) return text;
    let result = String(text);
    for (let i = 0; i < 12; i += 1) {
      const next = result.replace(/\{\{\s*([A-Za-z_][\w]*)\s*\}\}/g, (match, name) => {
        return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match;
      });
      if (next === result) break;
      result = next;
    }
    return result;
  }

  function resolveVars(vars) {
    const resolved = { ...vars };
    Object.keys(resolved).forEach((key) => {
      resolved[key] = substitute(resolved[key], resolved);
    });
    return resolved;
  }

  function parseBlock(block, globalVars) {
    const localVars = {};
    const lines = block.lines;
    let i = 0;

    function isSkippable(text) {
      const t = text.trim();
      return t === '' || COMMENT_RE.test(t);
    }

    while (i < lines.length) {
      const t = lines[i].text.trim();
      if (isSkippable(lines[i].text)) {
        i += 1;
        continue;
      }
      const defined = t.match(VAR_DEF_RE);
      if (defined) {
        localVars[defined[1]] = stripInlineComment(defined[2]);
        globalVars[defined[1]] = localVars[defined[1]];
        i += 1;
        continue;
      }
      break;
    }

    if (i >= lines.length) return null;

    const requestLine = lines[i].text.trim();
    const requestMatch = requestLine.match(METHOD_RE);
    if (!requestMatch) return null;

    const method = requestMatch[1].toUpperCase();
    const methodLine = lines[i].n;
    let url = requestMatch[2];
    i += 1;

    const headers = [];
    while (i < lines.length && lines[i].text.trim() !== '') {
      const raw = lines[i].text;
      const t = raw.trim();
      if (COMMENT_RE.test(t)) {
        i += 1;
        continue;
      }
      if (QUERY_RE.test(t)) {
        const fragment = t.startsWith('?') || url.includes('?') ? t : `?${t.replace(/^&/, '')}`;
        url += fragment;
        i += 1;
        continue;
      }
      const colon = t.indexOf(':');
      if (colon > 0) {
        headers.push({
          name: t.slice(0, colon).trim(),
          value: t.slice(colon + 1).trim()
        });
      }
      i += 1;
    }

    while (i < lines.length && lines[i].text.trim() === '') i += 1;
    const bodyLines = lines.slice(i).map((line) => line.text);
    while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === '') {
      bodyLines.pop();
    }
    const body = bodyLines.join('\n');

    const vars = resolveVars({ ...globalVars, ...localVars });

    return {
      name: block.name || `${method} ${url}`,
      startLine: block.start,
      methodLine,
      endLine: block.end,
      method,
      url: substitute(url, vars),
      headers: headers.map((header) => ({
        name: header.name,
        value: substitute(header.value, vars)
      })),
      body: substitute(body, vars),
      variables: vars
    };
  }

  function parseRestDocument(text) {
    const allLines = String(text || '').split(/\r?\n/);
    const blocks = [];
    let block = { name: '', start: 0, end: 0, lines: [] };

    for (let i = 0; i < allLines.length; i += 1) {
      const delim = allLines[i].match(/^###\s*(.*)$/);
      if (delim) {
        block.end = i - 1;
        if (block.lines.length > 0 || blocks.length === 0) {
          blocks.push(block);
        }
        block = { name: delim[1].trim(), start: i, end: i, lines: [] };
      } else {
        block.lines.push({ n: i, text: allLines[i] });
        block.end = i;
      }
    }
    blocks.push(block);

    const globalVars = {};
    const requests = [];
    blocks.forEach((item) => {
      const parsed = parseBlock(item, globalVars);
      if (parsed) requests.push(parsed);
    });

    return { variables: { ...globalVars }, requests };
  }

  function findRequestAtCursor(doc, line) {
    if (!doc || !doc.requests || doc.requests.length === 0) return null;
    const match = doc.requests.find((req) => line >= req.startLine && line <= req.endLine);
    if (match) return match;
    let chosen = doc.requests[0];
    doc.requests.forEach((req) => {
      if (req.startLine <= line) chosen = req;
    });
    return chosen;
  }

  return {
    parseRestDocument,
    findRequestAtCursor,
    substitute
  };
});
