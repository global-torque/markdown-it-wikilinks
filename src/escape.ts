/** Escape untrusted text for HTML text or quoted attribute contexts. */
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character as keyof typeof HTML_ESCAPES],
  );
}

/** Escape an untrusted quoted HTML attribute value. */
export function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

const HTML_ESCAPES = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
} as const);
