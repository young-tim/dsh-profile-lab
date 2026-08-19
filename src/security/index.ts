const secretPatterns = [
  /\b(?:sk|ds|api)[_-][A-Za-z0-9_-]{8,}\b/gi,
  /(authorization\s*[:=]\s*)([^\s,;]+)/gi,
  /((?:api[_-]?key|token|secret|password)\s*[:=]\s*)([^\s,;]+)/gi,
] as const;

export const redact = (value: string) =>
  secretPatterns.reduce(
    (text, pattern, index) =>
      text.replace(pattern, index === 0 ? "[REDACTED]" : "$1[REDACTED]"),
    value,
  );

export const sanitize = <T>(value: T): T => {
  if (typeof value === "string") return redact(value) as T;
  if (Array.isArray(value)) return value.map(sanitize) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitize(item),
      ]),
    ) as T;
  return value;
};
