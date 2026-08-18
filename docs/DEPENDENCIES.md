# Runtime dependencies

`yaml` is the sole runtime dependency. It provides safe YAML document parsing
with duplicate-key detection; Node's standard library handles schemas, hashing,
processes, filesystem isolation, reporting, and HTML escaping. DSH is invoked
through an adapter/driver and is intentionally not installed or mutated by Lab.
