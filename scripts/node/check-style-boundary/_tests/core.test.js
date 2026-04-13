const test = require('node:test');
const assert = require('node:assert/strict');

const { createProbeUrl, parseCliArgs, resolveSceneIds } = require('../core.js');

test('parseCliArgs supports component, page, file, and all-pages modes', () => {
  assert.deepEqual(parseCliArgs(['component', 'component.account-popup']), {
    mode: 'component',
    target: 'component.account-popup',
    help: false
  });
  assert.deepEqual(parseCliArgs(['page', 'page.home']), {
    mode: 'page',
    target: 'page.home',
    help: false
  });
  assert.deepEqual(parseCliArgs(['file', 'web/app/src/styles/global.css']), {
    mode: 'file',
    target: 'web/app/src/styles/global.css',
    help: false
  });
  assert.deepEqual(parseCliArgs(['all-pages']), {
    mode: 'all-pages',
    target: null,
    help: false
  });
});

test('resolveSceneIds expands explicit file mappings and errors on missing coverage', () => {
  const manifest = [
    {
      id: 'component.account-popup',
      kind: 'component',
      files: ['web/app/src/styles/global.css']
    },
    {
      id: 'page.home',
      kind: 'page',
      files: ['web/app/src/styles/global.css', 'web/app/src/features/home/HomePage.tsx']
    }
  ];

  assert.deepEqual(
    resolveSceneIds(manifest, {
      mode: 'file',
      target: 'web/app/src/features/home/HomePage.tsx'
    }),
    ['page.home']
  );
  assert.throws(
    () =>
      resolveSceneIds(manifest, {
        mode: 'file',
        target: 'web/app/src/features/unknown/Missing.tsx'
      }),
    /No style boundary scenes declare coverage/u
  );
});

test('createProbeUrl targets the dedicated Vite entry', () => {
  assert.equal(
    createProbeUrl('http://127.0.0.1:3100', 'page.home'),
    'http://127.0.0.1:3100/style-boundary.html?scene=page.home'
  );
});
