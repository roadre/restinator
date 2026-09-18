ace.define(
  'ace/mode/rest_highlight_rules',
  ['require', 'exports', 'module', 'ace/lib/oop', 'ace/mode/text_highlight_rules'],
  function (require, exports) {
    const oop = require('ace/lib/oop');
    const TextHighlightRules = require('ace/mode/text_highlight_rules').TextHighlightRules;

    function RestHighlightRules() {
      this.$rules = {
        start: [
          { token: 'comment', regex: /^\s*\/\/.*$/ },
          { token: 'comment', regex: /^\s*#(?!##).*$/ },
          { token: 'keyword', regex: /^###.*$/ },
          { token: 'variable', regex: /@[A-Za-z_][\w]*/ },
          { token: 'string', regex: /\{\{\s*[A-Za-z_][\w]*\s*\}\}/ },
          {
            token: 'constant.language',
            regex: /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\b/
          },
          { token: 'string', regex: /https?:\/\/\S+/ },
          { token: 'entity.name.tag', regex: /^[A-Za-z0-9-]+(?=\s*:)/ },
          { token: 'keyword.operator', regex: /[?&=]/ }
        ]
      };
      this.normalizeRules();
    }

    oop.inherits(RestHighlightRules, TextHighlightRules);
    exports.RestHighlightRules = RestHighlightRules;
  }
);

ace.define(
  'ace/mode/rest',
  ['require', 'exports', 'module', 'ace/lib/oop', 'ace/mode/text', 'ace/mode/rest_highlight_rules'],
  function (require, exports) {
    const oop = require('ace/lib/oop');
    const TextMode = require('ace/mode/text').Mode;
    const RestHighlightRules = require('ace/mode/rest_highlight_rules').RestHighlightRules;

    function Mode() {
      this.HighlightRules = RestHighlightRules;
    }

    oop.inherits(Mode, TextMode);
    Mode.prototype.$id = 'ace/mode/rest';
    exports.Mode = Mode;
  }
);
