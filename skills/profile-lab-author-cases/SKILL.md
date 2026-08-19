---
name: profile-lab-author-cases
description: Collaboratively design and create DSH Profile Lab evaluation cases and experiment fixtures. Use when a user asks to build, add, plan, improve, or review benchmark cases, test scenarios, assertions, case YAML, experiment coverage, or an evaluation suite for profile_lab_run.
---

# Author Profile Lab Cases

Build decision-useful cases with the user; do not jump straight to file creation.

## Workflow

1. Inspect any supplied experiment, existing cases, workspace fixture, and variants. Do not mutate files yet.
2. Ask the user to confirm the evaluation scope. Cover, in one concise question set:
   - the behavior or decision being evaluated;
   - representative happy paths, edge cases, and forbidden behavior;
   - required evidence/assertions and acceptable variability;
   - practical budget constraints such as repetitions, calls, time, or tokens.
3. Propose a compact case matrix before writing. For each case state its purpose, prompt/fixture, tags, assertions, and why it distinguishes the variants. Point out blind spots, flaky assertions, data leakage, and cases that merely test formatting.
4. Ask for explicit approval of the proposed matrix. Treat edits or partial agreement as feedback, not approval to write.
5. After approval, create or update case YAML and only the required fixture files. Preserve unrelated files and never overwrite an existing case without reading it first.
6. Validate the experiment and cases. Prefer the installed CLI:

   ```bash
   dsh-profile-lab schema --check <experiment.yml>
   ```

   If the command is not globally available, use the package-local executable appropriate to the workspace. Do not run model calls during validation.
7. Summarize created files, coverage, assertions, estimated matrix size, and remaining risks.
8. Ask whether the user wants to run the cases now. State the exact run count and that model calls may cost money. Do not call `profile_lab_run` until the user explicitly says yes.
9. If approved, choose a new output directory and call `profile_lab_run`. Never reuse a failed or incompatible result directory unless the user explicitly requests a supported restart flow.

## Authoring rules

- Prefer observable structural assertions over stylistic output matching.
- Keep one primary behavior per case; use tags for subsets such as `smoke`, `edge`, or `safety`.
- Include at least one positive case and, when relevant, one negative/forbidden-action case.
- Do not put secrets, production data, or destructive instructions in fixtures.
- Do not invent tool names or expected outputs; inspect the target profile/plugin when available.
- Avoid assertions that expose the expected answer verbatim in the prompt unless the goal is deterministic plumbing validation.
- Use `retries` only for genuinely transient behavior; do not hide systematic failures.
- Read [references/case-format.md](references/case-format.md) before creating files.

