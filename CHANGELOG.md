# Changelog

## 0.1.0

- Initial local-first experiment matrix, reports, policy gate, CLI and Cordis tool surface.
- Compatibility: Node `^22.19.0 || >=24.0.0`; `@deepseek-ai/dsh` `0.1.0-rc.7`.
- Breaking behavior: configuration, case fields, paths and CLI options are
  strict; changed run inputs require `--restart` before resume.
- Known MVP limits: no web UI/cloud service/team features, automatic plugin
  management, in-place source execution, or live billing/model calls.
