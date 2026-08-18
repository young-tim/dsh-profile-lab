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

Latest local verification (2026-08-18) additionally passed `lint`, `typecheck`,
unit tests (5 files / 19 tests), build, integration tests (2 tests), package
test, and `pnpm pack`. The event-based smoke output was:

```text
schema valid
run complete
reports written
candidate pass rate below minimum; pass rate drop exceeds policy
```

The final line is the deliberate regression and has exit code 1.

Temporary-profile package smoke (with `DSH_HOME` set to a fresh `mktemp -d`
directory) installed the tarball and produced:

```text
334:# == dsh-profile-lab
335:- id: dsh-profile-lab
336:  name: dsh-profile-lab
```

This proves the official DSH RC loader accepts the bundle patch. The three
tool registrations are covered by the local package contract test, but are not
yet observable in `--dump-config` and therefore are not claimed as a DSH dump
assertion.

Coverage gate passes after session-event and CLI contract tests:

```text
Statements   : 91.89%
Branches     : 85.02%
Functions    : 91.54%
Lines        : 100%
Test files   : 5 passed
Tests        : 19 passed
```
