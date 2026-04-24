# API Plugin Packages

## Data Source Plugin Rules

1. Data-source plugins must declare `consumption_kind: runtime_extension`.
2. Data-source plugins must use `slot_codes: [data_source]`.
3. Data-source plugins implement `validate_config`, `test_connection`, `discover_catalog`, `describe_resource`, `preview_read`, and `import_snapshot`.
4. Data-source plugins must not run platform migrations or write the platform database directly.
5. OAuth callback endpoints belong to the host, not the plugin.
6. Preview access is temporary; only host-controlled import writes durable platform state.

## Host Boundary

- Main repo durable storage officially supports PostgreSQL only.
- Data-source plugins integrate external databases, SaaS APIs, or HTTP systems through the runtime-extension host path.
- The host owns installation, assignment, secret storage, validation workflow, preview session lifetime, and durable imports.

## Template

- Start from `plugins/templates/data_source_http_fixture`.
- Keep the method names and JSON output shapes aligned with the runtime contract.
- Replace the shell fixture runtime with your real executable after the package loads cleanly through `plugin-runner`.
