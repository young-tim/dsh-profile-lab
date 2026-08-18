# Acceptance evidence (partial)

2026-08-18 local fake-driver smoke:

```text
$ pnpm build
$ node dist/cli.js run examples/experiment.yml --driver fixtures/fake-dsh --output .profile-lab/acceptance
run complete
$ node dist/cli.js compare .profile-lab/acceptance
reports written
$ node dist/cli.js gate .profile-lab/acceptance --policy examples/policy.yml
candidate pass rate below minimum; pass rate drop exceeds policy
```

The last command deliberately exits 1. Full specification acceptance remains pending.

Coverage currently fails (59.92% statements, 50.94% branches, 57.97%
functions); the required thresholds have not been claimed as passed.
