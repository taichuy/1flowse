const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPnpmResolvedDependencies,
  buildSnapshotPayload,
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
  assert.equal(payload.job.correlator, '7flows-pnpm-dependency-submission:web');
  assert.equal(payload.detector.name, '7flows-pnpm-dependency-submission');
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
