# Profile Lab case format

## Case YAML

```yaml
name: read-marker
prompt: Read README and return the alpha marker.
tags: [smoke]
retries: 0
assert:
  turn_end: completed
  output_contains: PROFILE_LAB_ALPHA
  tools_not_called: [dangerous_tool]
  max_steps: 8
  max_tokens: 5000
  no_tool_errors: true
```

Supported assertions:

- `turn_end`
- ordered `tools_called`
- `tools_exact`
- `tools_not_called`
- `output_contains`
- `output_not_contains`
- `output_matches` or `output_regex`
- `tool_args_contains`
- `tool_result_contains`
- `max_steps`
- `max_tokens`
- `no_tool_errors`
- `output_judge` when the experiment explicitly configures a judge adapter

String assertions may accept one string or a list where supported by the schema. Keep regular expressions bounded and readable.

## Experiment linkage

Cases live directly under the experiment's `cases_dir`. Paths are relative to the experiment file. The experiment selects an existing DSH profile and a patch per variant:

```yaml
schema_version: 1
name: routing-comparison
cases_dir: cases
workspace_template: repo
baseline: base
variants:
  - { id: base, profile: headless, patch: variants/base.yml }
  - { id: candidate, profile: headless, patch: variants/candidate.yml }
repetitions: 5
run:
  concurrency: 2
  timeout_ms: 600000
  max_runs: 100
  max_total_tokens: 100000
  credentials: inherit
```

Total model calls are approximately:

```text
selected cases × variants × repetitions × attempts
```

Retries increase the maximum attempts. Report both the normal call count and retry ceiling before asking to run.

## Case design checklist

- The prompt represents a real user task.
- The fixture contains only information the evaluated agent should see.
- The assertion measures the intended behavior, not incidental phrasing.
- Baseline and candidate receive identical case inputs.
- Expected tool use or prohibition is explicit when it matters.
- Time/token limits are realistic rather than tuned to force a preferred winner.
- The matrix includes enough repetitions to interpret stability; fewer than five is labeled insufficient.
