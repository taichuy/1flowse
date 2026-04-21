const test = require('node:test');
const assert = require('node:assert/strict');

const {
  collectRelationshipViolations,
  createProbeUrl,
  formatBoundaryFailure,
  formatRelationshipFailure,
  parseCliArgs,
  resolveSceneIds
} = require('../core.js');

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
      impactFiles: ['web/app/src/styles/global.css']
    },
    {
      id: 'page.home',
      kind: 'page',
      impactFiles: [
        'web/app/src/styles/global.css',
        'web/app/src/features/home/HomePage.tsx'
      ]
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
    /样式扩散失败/u
  );
});

test('createProbeUrl targets the dedicated Vite entry', () => {
  assert.equal(
    createProbeUrl('http://127.0.0.1:3100', 'page.home'),
    'http://127.0.0.1:3100/style-boundary.html?scene=page.home'
  );
});

test('formatBoundaryFailure labels style boundary regressions explicitly', () => {
  assert.equal(
    formatBoundaryFailure('page.home', [
      {
        nodeId: 'shell-header',
        property: 'display',
        expected: 'flex',
        actual: 'block',
        matchedRules: [
          {
            sourceUrl: 'http://127.0.0.1:3100/src/styles/global.css',
            selector: '.app-shell-header'
          }
        ]
      }
    ]),
    '样式边界失败：page.home shell-header.display expected=flex actual=block source=http://127.0.0.1:3100/src/styles/global.css::.app-shell-header'
  );
});

test('collectRelationshipViolations detects no_overlap, within_container, min_gap, and fully_visible regressions', () => {
  const assertions = [
    {
      id: 'left-vs-sidebar',
      type: 'no_overlap',
      subjectSelector: '.left',
      referenceSelector: '.sidebar'
    },
    {
      id: 'actions-within-left',
      type: 'within_container',
      subjectSelector: '.actions',
      containerSelector: '.left'
    },
    {
      id: 'left-gap-sidebar',
      type: 'min_gap',
      axis: 'horizontal',
      minGap: 24,
      subjectSelector: '.left',
      referenceSelector: '.sidebar'
    },
    {
      id: 'actions-visible',
      type: 'fully_visible',
      subjectSelector: '.actions'
    }
  ];
  const measurements = {
    '.left': {
      exists: true,
      rect: { left: 0, top: 0, right: 300, bottom: 200, width: 300, height: 200 }
    },
    '.sidebar': {
      exists: true,
      rect: { left: 280, top: 0, right: 520, bottom: 200, width: 240, height: 200 }
    },
    '.actions': {
      exists: true,
      rect: { left: 260, top: 20, right: 340, bottom: 60, width: 80, height: 40 },
      withinViewport: true,
      visibleSamples: [true, false, true, true, true]
    }
  };

  assert.deepEqual(
    collectRelationshipViolations(assertions, measurements).map((violation) => ({
      id: violation.assertionId,
      type: violation.type,
      actual: violation.actual
    })),
    [
      { id: 'left-vs-sidebar', type: 'no_overlap', actual: 'overlap' },
      { id: 'actions-within-left', type: 'within_container', actual: 'outside_container' },
      { id: 'left-gap-sidebar', type: 'min_gap', actual: 'gap_too_small' },
      { id: 'actions-visible', type: 'fully_visible', actual: 'partially_occluded' }
    ]
  );
});

test('formatRelationshipFailure labels layout relationship regressions explicitly', () => {
  assert.equal(
    formatRelationshipFailure('page.settings', [
      {
        assertionId: 'left-vs-sidebar',
        type: 'no_overlap',
        actual: 'overlap',
        details: 'intersection=20x200',
        subjectSelector: '.left',
        referenceSelector: '.sidebar'
      }
    ]),
    '布局关系失败：page.settings left-vs-sidebar.no_overlap actual=overlap subject=.left reference=.sidebar details=intersection=20x200'
  );
});
