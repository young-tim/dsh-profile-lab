# Marketplace submission

DSH Profile Lab is prepared for the `dev` category in `awesome-dsh-plugin`.

## Listing

Create `data/plugins/young-tim__dsh-profile-lab.yml` in the marketplace repo:

```yaml
url: https://github.com/young-tim/dsh-profile-lab
name: young-tim/dsh-profile-lab
category: dev
description:
  en: Runs reproducible DSH profile and patch experiment matrices with assertions, reports, recovery, and policy gates.
  zh: 运行可复现的 DSH Profile 与 Patch 实验矩阵，并提供断言、报告、恢复和策略门禁。
```

Then run the marketplace generator and submit the YAML plus generated READMEs:

```bash
npm ci
node scripts/generate-readme.mjs
```

## Publication checklist

- Public GitHub repository has the `dsh-plugin` topic.
- `dsh.bundle.patch` and `cordis.patch.yml` are present.
- GitHub installation succeeds for both headless and web profiles.
- GitHub installation requires no pnpm `allowBuilds` exception.
- Repository is at least one day old and has at least ten commits.
- CI passes on Node 22.19 and Node 24.
- Description matches the three tools and CLI behavior exactly.
- Optional npm publication uses the available `dsh-profile-lab` package name.
