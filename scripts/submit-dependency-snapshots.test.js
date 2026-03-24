const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPnpmResolvedDependencies,
  buildSnapshotPayload,
  buildUvResolvedDependencies,
  collectDirectDependencyScopes,
  parseArgs,
  selectRoots,
} = require('./submit-dependency-snapshots');

test('collectDirectDependencyScopes prefers runtime over development for duplicated names', () => {
  const scopes = collectDirectDependencyScopes({
    dependencies: {
      react: '^19.0.0',
    },
    devDependencies: {
      react: '^19.0.0',
      vitest: '^3.2.4',
    },
    optionalDependencies: {
      sharp: '^0.34.5',
    },
  });

  assert.equal(scopes.get('react'), 'runtime');
  assert.equal(scopes.get('vitest'), 'development');
  assert.equal(scopes.get('sharp'), 'runtime');
});

test('buildPnpmResolvedDependencies keeps direct/runtime and indirect/development facts stable', () => {
  const resolved = buildPnpmResolvedDependencies(
    {
      dependencies: {
        next: {
          version: '15.5.14',
          dependencies: {
            react: {
              version: '19.2.4',
            },
            flatted: {
              version: '3.4.2',
            },
          },
        },
        vitest: {
          version: '3.2.4',
          dependencies: {
            react: {
              version: '19.2.4',
            },
            chai: {
              version: '5.2.1',
            },
          },
        },
      },
    },
    {
      dependencies: {
        next: '^15.5.14',
      },
      devDependencies: {
        vitest: '^3.2.4',
      },
    },
  );

  assert.deepEqual(resolved['next@15.5.14'], {
    package_url: 'pkg:/npm/next@15.5.14',
    relationship: 'direct',
    scope: 'runtime',
    dependencies: ['flatted@3.4.2', 'react@19.2.4'],
  });
  assert.deepEqual(resolved['vitest@3.2.4'], {
    package_url: 'pkg:/npm/vitest@3.2.4',
    relationship: 'direct',
    scope: 'development',
    dependencies: ['chai@5.2.1', 'react@19.2.4'],
  });
  assert.deepEqual(resolved['react@19.2.4'], {
    package_url: 'pkg:/npm/react@19.2.4',
    relationship: 'indirect',
    scope: 'runtime',
    dependencies: [],
  });
  assert.deepEqual(resolved['chai@5.2.1'], {
    package_url: 'pkg:/npm/chai@5.2.1',
    relationship: 'indirect',
    scope: 'development',
    dependencies: [],
  });
});

test('buildSnapshotPayload uses lockfile manifest and stable correlator', () => {
  const payload = buildSnapshotPayload({
    root: {
      rootDir: 'web',
      rootLabel: 'web',
      manifestPath: 'web/package.json',
      lockfilePath: 'web/pnpm-lock.yaml',
    },
    runtimeTree: {
      dependencies: {
        next: {
          version: '15.5.14',
        },
      },
    },
    developmentTree: {
      dependencies: {
        vitest: {
          version: '3.2.4',
        },
      },
    },
    repository: {
      owner: 'taichuy',
      repo: '7flows',
    },
    sha: 'abc123',
    ref: 'refs/heads/taichuy_dev',
  });

  assert.equal(payload.version, 0);
  assert.equal(payload.sha, 'abc123');
  assert.equal(payload.ref, 'refs/heads/taichuy_dev');
  assert.equal(payload.job.correlator, '7flows-dependency-submission:web');
  assert.equal(payload.detector.name, '7flows-dependency-submission');
  assert.deepEqual(payload.manifests, {
    'web/pnpm-lock.yaml': {
      name: 'web/pnpm-lock.yaml',
      file: {
        source_location: 'web/pnpm-lock.yaml',
      },
      resolved: {
        'next@15.5.14': {
          package_url: 'pkg:/npm/next@15.5.14',
          relationship: 'direct',
          scope: 'runtime',
          dependencies: [],
        },
        'vitest@3.2.4': {
          package_url: 'pkg:/npm/vitest@3.2.4',
          relationship: 'direct',
          scope: 'development',
          dependencies: [],
        },
      },
    },
  });
});

test('parseArgs and selectRoots support explicit root selection', () => {
  const options = parseArgs(['--root', 'web', '--dry-run', '--output', 'tmp/snapshot.json']);
  assert.equal(options.dryRun, true);
  assert.equal(options.outputPath, 'tmp/snapshot.json');
  assert.deepEqual(options.requestedRoots, ['web']);

  const selected = selectRoots(
    [
      { rootDir: 'web', rootLabel: 'web' },
      { rootDir: 'docs/demo', rootLabel: 'docs/demo' },
    ],
    ['web'],
  );
  assert.deepEqual(selected, [{ rootDir: 'web', rootLabel: 'web' }]);
});

test('buildUvResolvedDependencies keeps runtime and development facts stable', () => {
  const resolved = buildUvResolvedDependencies(`version = 1

[[package]]
name = "sevenflows-api"
version = "0.1.0"
source = { editable = "." }
dependencies = [
    { name = "fastapi" },
    { name = "pydantic-settings" },
]

[package.optional-dependencies]
dev = [
    { name = "pytest" },
]

[[package]]
name = "fastapi"
version = "0.135.1"
source = { registry = "https://pypi.org/simple" }
dependencies = [
    { name = "pydantic" },
    { name = "starlette" },
]

[[package]]
name = "pydantic-settings"
version = "2.13.1"
source = { registry = "https://pypi.org/simple" }
dependencies = [
    { name = "pydantic" },
    { name = "python-dotenv" },
]

[[package]]
name = "pytest"
version = "8.4.2"
source = { registry = "https://pypi.org/simple" }
dependencies = [
    { name = "pluggy" },
]

[[package]]
name = "pydantic"
version = "2.12.5"
source = { registry = "https://pypi.org/simple" }
dependencies = [
    { name = "annotated-types" },
]

[[package]]
name = "starlette"
version = "1.0.0"
source = { registry = "https://pypi.org/simple" }

[[package]]
name = "python-dotenv"
version = "1.2.2"
source = { registry = "https://pypi.org/simple" }

[[package]]
name = "pluggy"
version = "1.6.0"
source = { registry = "https://pypi.org/simple" }

[[package]]
name = "annotated-types"
version = "0.7.0"
source = { registry = "https://pypi.org/simple" }
`);

  assert.deepEqual(resolved['fastapi@0.135.1'], {
    package_url: 'pkg:pypi/fastapi@0.135.1',
    relationship: 'direct',
    scope: 'runtime',
    dependencies: ['pydantic@2.12.5', 'starlette@1.0.0'],
  });
  assert.deepEqual(resolved['pydantic-settings@2.13.1'], {
    package_url: 'pkg:pypi/pydantic-settings@2.13.1',
    relationship: 'direct',
    scope: 'runtime',
    dependencies: ['pydantic@2.12.5', 'python-dotenv@1.2.2'],
  });
  assert.deepEqual(resolved['pytest@8.4.2'], {
    package_url: 'pkg:pypi/pytest@8.4.2',
    relationship: 'direct',
    scope: 'development',
    dependencies: ['pluggy@1.6.0'],
  });
  assert.deepEqual(resolved['pydantic@2.12.5'], {
    package_url: 'pkg:pypi/pydantic@2.12.5',
    relationship: 'indirect',
    scope: 'runtime',
    dependencies: ['annotated-types@0.7.0'],
  });
  assert.deepEqual(resolved['pluggy@1.6.0'], {
    package_url: 'pkg:pypi/pluggy@1.6.0',
    relationship: 'indirect',
    scope: 'development',
    dependencies: [],
  });
});
