# Runtime dependencies

`yaml` provides safe YAML document parsing with duplicate-key detection.
`@deepseek-ai/dsh-tools` is the official DSH RC tool registry contract used to
register the three Cordis model tools. Node's standard library handles schemas,
hashing, processes, filesystem isolation, reporting, and HTML escaping.

The development-only `file:` self-reference exists solely to let `pnpm exec`
resolve the package's own CLI from a clean checkout; it is not shipped.
