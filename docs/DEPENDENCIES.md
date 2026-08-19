# Runtime dependencies

`yaml` provides safe YAML parsing with duplicate-key and alias controls. `ajv`
validates complete experiment and report contracts against Draft 2020-12 JSON
Schemas. `@deepseek-ai/dsh-session` decodes official packed session records, and
`@deepseek-ai/dsh-tools` supplies the official tool registration contract.

The analysis tab uses DSH's official browser-side conversation slot contracts as
peer-provided platform modules. React is likewise supplied by the DSH Web shell;
`esbuild` is development-only and wraps the typed client entry in DSH's browser
module-loader format. None of these additions execute in experiment workspaces.

Node's standard library handles hashing, zstd frames, process groups, filesystem
isolation, atomic persistence, reporting, redaction and HTML escaping. The
repository has no `file:` self-dependency; source-tree acceptance invokes
`node dist/cli.js`, while an installed tarball exposes `dsh-profile-lab` normally.
