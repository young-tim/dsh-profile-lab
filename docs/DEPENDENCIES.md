# Runtime dependencies

`yaml` provides safe YAML parsing with duplicate-key and alias controls. `ajv`
validates complete experiment and report contracts against Draft 2020-12 JSON
Schemas. `@deepseek-ai/dsh-session` decodes official packed session records, and
`@deepseek-ai/dsh-tools` supplies the official tool registration contract.

Node's standard library handles hashing, zstd frames, process groups, filesystem
isolation, atomic persistence, reporting, redaction and HTML escaping. The
repository has no `file:` self-dependency; source-tree acceptance invokes
`node dist/cli.js`, while an installed tarball exposes `dsh-profile-lab` normally.
