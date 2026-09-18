(function registerCatppuccin(id, cssClass, isDark, css) {
  ace.define('ace/theme/' + id + '-css', ['require', 'exports', 'module'], function (_require, exports) {
    exports.cssClass = cssClass;
    exports.cssText = css;
  });
  ace.define(
    'ace/theme/' + id,
    ['require', 'exports', 'module', 'ace/theme/' + id + '-css', 'ace/lib/dom'],
    function (require, exports) {
      exports.isDark = isDark;
      exports.cssClass = cssClass;
      exports.cssText = require('ace/theme/' + id + '-css').cssText;
      require('ace/lib/dom').importCssString(exports.cssText, exports.cssClass, false);
    }
  );
})(
  'catppuccin_mocha',
  'ace-catppuccin-mocha',
  true,
  `
.ace-catppuccin-mocha .ace_gutter { background: #181825; color: #6c7086; }
.ace-catppuccin-mocha .ace_print-margin { width: 1px; background: #313244; }
.ace-catppuccin-mocha { background-color: #1e1e2e; color: #cdd6f4; }
.ace-catppuccin-mocha .ace_cursor { color: #f5e0dc; }
.ace-catppuccin-mocha .ace_marker-layer .ace_selection { background: #45475a; }
.ace-catppuccin-mocha .ace_marker-layer .ace_active-line { background: #313244; }
.ace-catppuccin-mocha .ace_gutter-active-line { background-color: #313244; }
.ace-catppuccin-mocha .ace_marker-layer .ace_selected-word { border: 1px solid #585b70; }
.ace-catppuccin-mocha .ace_marker-layer .ace_bracket { margin: -1px 0 0 -1px; border: 1px solid #585b70; }
.ace-catppuccin-mocha .ace_fold { background-color: #89b4fa; border-color: #cdd6f4; }
.ace-catppuccin-mocha .ace_keyword { color: #cba6f7; }
.ace-catppuccin-mocha .ace_keyword.ace_operator { color: #89dceb; }
.ace-catppuccin-mocha .ace_constant.ace_language { color: #fab387; }
.ace-catppuccin-mocha .ace_constant.ace_numeric { color: #fab387; }
.ace-catppuccin-mocha .ace_constant.ace_character { color: #89dceb; }
.ace-catppuccin-mocha .ace_support.ace_function { color: #89b4fa; }
.ace-catppuccin-mocha .ace_support.ace_class, .ace-catppuccin-mocha .ace_support.ace_type { color: #f9e2af; }
.ace-catppuccin-mocha .ace_storage { color: #cba6f7; }
.ace-catppuccin-mocha .ace_invalid { color: #cdd6f4; background-color: #f38ba8; }
.ace-catppuccin-mocha .ace_string { color: #a6e3a1; }
.ace-catppuccin-mocha .ace_string.ace_regexp { color: #f38ba8; }
.ace-catppuccin-mocha .ace_comment { font-style: italic; color: #6c7086; }
.ace-catppuccin-mocha .ace_variable { color: #f38ba8; }
.ace-catppuccin-mocha .ace_variable.ace_parameter { color: #fab387; }
.ace-catppuccin-mocha .ace_entity.ace_name.ace_function { color: #89b4fa; }
.ace-catppuccin-mocha .ace_entity.ace_name.ace_tag { color: #89b4fa; }
.ace-catppuccin-mocha .ace_entity.ace_other.ace_attribute-name { color: #f9e2af; }
.ace-catppuccin-mocha .ace_meta.ace_tag { color: #89b4fa; }
.ace-catppuccin-mocha .ace_indent-guide { background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQImWNgYGBgYPj/nyoAAwQBmq0KXgAAAABJRU5ErkJggg==) right repeat-y; }
`
);

(function registerCatppuccin(id, cssClass, isDark, css) {
  ace.define('ace/theme/' + id + '-css', ['require', 'exports', 'module'], function (_require, exports) {
    exports.cssClass = cssClass;
    exports.cssText = css;
  });
  ace.define(
    'ace/theme/' + id,
    ['require', 'exports', 'module', 'ace/theme/' + id + '-css', 'ace/lib/dom'],
    function (require, exports) {
      exports.isDark = isDark;
      exports.cssClass = cssClass;
      exports.cssText = require('ace/theme/' + id + '-css').cssText;
      require('ace/lib/dom').importCssString(exports.cssText, exports.cssClass, false);
    }
  );
})(
  'catppuccin_latte',
  'ace-catppuccin-latte',
  false,
  `
.ace-catppuccin-latte .ace_gutter { background: #e6e9ef; color: #9ca0b0; }
.ace-catppuccin-latte .ace_print-margin { width: 1px; background: #ccd0da; }
.ace-catppuccin-latte { background-color: #eff1f5; color: #4c4f69; }
.ace-catppuccin-latte .ace_cursor { color: #dc8a78; }
.ace-catppuccin-latte .ace_marker-layer .ace_selection { background: #acb0be; }
.ace-catppuccin-latte .ace_marker-layer .ace_active-line { background: #ccd0da; }
.ace-catppuccin-latte .ace_gutter-active-line { background-color: #ccd0da; }
.ace-catppuccin-latte .ace_marker-layer .ace_selected-word { border: 1px solid #bcc0cc; }
.ace-catppuccin-latte .ace_marker-layer .ace_bracket { margin: -1px 0 0 -1px; border: 1px solid #bcc0cc; }
.ace-catppuccin-latte .ace_fold { background-color: #1e66f5; border-color: #4c4f69; }
.ace-catppuccin-latte .ace_keyword { color: #8839ef; }
.ace-catppuccin-latte .ace_keyword.ace_operator { color: #04a5e5; }
.ace-catppuccin-latte .ace_constant.ace_language { color: #fe640b; }
.ace-catppuccin-latte .ace_constant.ace_numeric { color: #fe640b; }
.ace-catppuccin-latte .ace_constant.ace_character { color: #04a5e5; }
.ace-catppuccin-latte .ace_support.ace_function { color: #1e66f5; }
.ace-catppuccin-latte .ace_support.ace_class, .ace-catppuccin-latte .ace_support.ace_type { color: #df8e1d; }
.ace-catppuccin-latte .ace_storage { color: #8839ef; }
.ace-catppuccin-latte .ace_invalid { color: #eff1f5; background-color: #d20f39; }
.ace-catppuccin-latte .ace_string { color: #40a02b; }
.ace-catppuccin-latte .ace_string.ace_regexp { color: #d20f39; }
.ace-catppuccin-latte .ace_comment { font-style: italic; color: #9ca0b0; }
.ace-catppuccin-latte .ace_variable { color: #d20f39; }
.ace-catppuccin-latte .ace_variable.ace_parameter { color: #fe640b; }
.ace-catppuccin-latte .ace_entity.ace_name.ace_function { color: #1e66f5; }
.ace-catppuccin-latte .ace_entity.ace_name.ace_tag { color: #1e66f5; }
.ace-catppuccin-latte .ace_entity.ace_other.ace_attribute-name { color: #df8e1d; }
.ace-catppuccin-latte .ace_meta.ace_tag { color: #1e66f5; }
.ace-catppuccin-latte .ace_indent-guide { background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQImWP4////fyYAAvMA5jzKOgAAAABJRU5ErkJggg==) right repeat-y; }
`
);
