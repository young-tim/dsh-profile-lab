# Changelog

## 0.1.0

- Initial local-first experiment matrix, reports, policy gate, CLI and Cordis tool surface.
- Compatibility: Node `^22.19.0 || >=24.0.0`; `@deepseek-ai/dsh` `0.1.0-rc.7`.
- Breaking behavior: configuration, case fields, paths and CLI options are
  strict; changed run inputs require `--restart` before resume.
- Core product: official DSH argv and persisted-session support, isolated retry
  attempts, resumable journals, optional output judge, deterministic reports,
  all-candidate policy gate and three unload-safe DSH tools.
- Product boundary: no web UI, cloud/team service, automatic plugin management,
  in-place source execution or built-in model billing lookup.
- Distribution: public GitHub installation metadata, `dsh-plugin` manifest,
  prerelease-aware DSH peer ranges, security guidance and Node 22/24 CI.
- GitHub installs consume committed build artifacts without lifecycle-script
  approval; npm publication still runs the complete `prepublishOnly` gate.
