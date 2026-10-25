// Redact browser diagnostic traces before persistence/publication. This operates
// on diagnostic text, not replayable HTTP or browser storage-state documents.
export function redactAuthTrace(value) {
  let text = String(value ?? "");
  // Playwright may print plain or quoted JS-array request-header lines. Remove
  // the whole header value, including unrelated cookies and credentials.
  text = text.replace(
    /(^|[\r\n])([^\r\n]*?\b(?:cookie|set-cookie|authorization|proxy-authorization)(?:\\?["'])?\s*:)[^\r\n]*/gi,
    "$1$2 [REDACTED AUTHENTICATION HEADER]",
  );
  // Also catch values inside JSON-escaped errors, URL parameters or short lines
  // that do not include an HTTP header label.
  text = text.replace(
    /((?:__Secure-|__Host-)?better-auth\.[a-z0-9_.-]+\s*(?:=|%3d)\s*)(?!\[REDACTED\])[^\s;,'"\\<>]+/gi,
    "$1[REDACTED]",
  );
  text = text.replace(
    /((?:session[_-]?token|access[_-]?token|refresh[_-]?token)\s*(?:\\?["'])?\s*(?::|=|%3d)\s*(?:\\?["'])?)(?!\[REDACTED\])[^\s;,'"\\<>]+/gi,
    "$1[REDACTED]",
  );
  text = text.replace(
    /\b(Bearer|Basic)\s+[a-z0-9+\/_.~=%-]+/gi,
    "$1 [REDACTED]",
  );
  return text;
}

export function hasUnredactedAuthTrace(value) {
  const text = String(value ?? "");
  return redactAuthTrace(text) !== text;
}
