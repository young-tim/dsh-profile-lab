# Blocked

## Acceptance CLI resolution (2026-08-18)

After `pnpm install` and `pnpm build`, the frozen acceptance invocation cannot
resolve the root package's own bin:

```text
$ pnpm exec dsh-profile-lab schema --check examples/experiment.yml
undefined
[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command "dsh-profile-lab" not found
```

`node dist/cli.js schema --check examples/experiment.yml` works. This is pnpm
self-bin resolution behavior, not a DSH operation. The root package is not a
dependency of itself; changing that would require a workspace/package layout
decision. This blocks only the literal `pnpm exec` acceptance spelling.

## Upstream metadata verification (2026-08-18)

`pnpm view @deepseek-ai/dsh@0.1.0-rc.7 engines bin --json` returned:

```json
{
  "bin": { "dsh": "lib/bin.js" }
}
```

The registry did not return the documented `engines` field, so its exact Node
range cannot be independently verified from registry metadata. Node `v24.12.0`,
pnpm `11.9.0`, package version `0.1.0-rc.7`, and the `dsh` binary were verified.
This only blocks the upstream-dependent real-profile load assertion; the local
fake-driver/package contract continues.
