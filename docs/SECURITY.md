# Security

## Product boundary

DSH plugins run with the permissions of the DSH process. Profile Lab isolates
each experiment attempt in a copied workspace and dedicated `DSH_HOME`, but it
is not an operating-system sandbox.

By default, `run.credentials: inherit` copies the host DSH
`.credentials.yaml` into an attempt with mode `0600`, then removes it in a
`finally` block before retaining evidence. The credential content is never
written to manifests, journals, or reports. Set `run.credentials: env-only` to
disable this behavior, especially in CI. Only environment variable names listed
in `run.env_allowlist` or `judge.env_allowlist` are forwarded.

Raw session evidence under `.runs/` can still contain model output, tool
arguments, file contents, or credentials returned by external tools. Review raw
evidence before publishing it; prefer the sanitized JSON, Markdown, and HTML
reports.

## Reporting a vulnerability

Please use GitHub's private security advisory flow for
`young-tim/dsh-profile-lab`. Do not open a public issue containing credentials,
private session logs, or an unpatched exploit. Include the affected version,
reproduction steps, impact, and any suggested mitigation.
