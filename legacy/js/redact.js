/* Redaction markup: [[N:text]] where N is the clearance level needed to read it.
   Hidden passages are replaced with block characters, so the real text never
   reaches the DOM. An unclosed marker hides everything up to the end. */

window.escapeHTML = function (s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

window.Redact = (function () {
  const MARK = /\[\[([1-3]):([\s\S]*?)(?:\]\]|$)/g;

  function bar(text) {
    // Keep the original word shapes so the bar wraps like real text.
    return text.replace(/\s+/g, " ").replace(/\S/g, "█");
  }

  // Returns HTML. Render inside an element with white-space: pre-line.
  function render(text, level) {
    return escapeHTML(text).replace(MARK, (_, need, inner) => {
      need = Number(need);
      if (level >= need) {
        return `<span class="declassified" data-level="${need}" title="Clearance ${need} material">${inner}</span>`;
      }
      return `<span class="redacted" title="INSUFFICIENT CLEARANCE: LEVEL ${need} REQUIRED" aria-label="redacted">${bar(inner)}</span>`;
    });
  }

  return { render };
})();
