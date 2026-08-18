# Blocked

## Root CLI resolution resolved (2026-08-18)

pnpm does not automatically expose a root package's own `bin` to `pnpm exec`.
The development dependency `"dsh-profile-lab": "file:"` creates the local
bin link without a registry publication. Verified:

```text
$ pnpm exec dsh-profile-lab schema --check examples/experiment.yml
schema valid
```

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
