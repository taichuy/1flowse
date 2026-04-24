# Data Source HTTP Fixture

This checked-in template is a minimal example of a `data_source` runtime extension package.

It is intentionally small:

1. `manifest.yaml` declares the host/runtime contract.
2. `datasource/data_source_http_fixture.yaml` declares source metadata and config schema.
3. `bin/data_source_http_fixture` is a shell fixture that returns valid contract-shaped responses.

The template is exercised by `plugin-runner` integration tests to ensure the package stays loadable.

## Usage

1. Copy this directory.
2. Rename `plugin_id`, `source_code`, and the runtime executable.
3. Replace the shell fixture with your real runtime.
4. Keep the method names and output shapes identical to the contract.

## Boundary Rules

- The host owns migrations, durable writes, installation state, secret storage, and preview session lifecycle.
- The plugin must not register HTTP endpoints or manage OAuth callback endpoints directly.
- The plugin should focus on external protocol translation, resource discovery, preview reads, and import payload shaping.
