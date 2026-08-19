const secretPatterns = [
    /\b(?:sk|ds|api)[_-][A-Za-z0-9_-]{8,}\b/gi,
    /(authorization\s*[:=]\s*)([^\s,;]+)/gi,
    /((?:api[_-]?key|token|secret|password)\s*[:=]\s*)([^\s,;]+)/gi,
];
export const redact = (value) => secretPatterns.reduce((text, pattern, index) => text.replace(pattern, index === 0 ? "[REDACTED]" : "$1[REDACTED]"), value);
export const sanitize = (value) => {
    if (typeof value === "string")
        return redact(value);
    if (Array.isArray(value))
        return value.map(sanitize);
    if (value && typeof value === "object")
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [
            key,
            sanitize(item),
        ]));
    return value;
};
