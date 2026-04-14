import { describe, expect, test } from 'vitest';

import {
  buildApiDocsCategorySearchText,
  normalizeApiDocsCategorySearchText
} from '../api-docs-category-search';

describe('api docs category search helpers', () => {
  test('normalizes case and common separators', () => {
    expect(normalizeApiDocsCategorySearchText('Single:Health / Runtime_Test')).toBe(
      'singlehealthruntimetest'
    );
  });

  test('combines label and id into a single searchable string', () => {
    expect(
      buildApiDocsCategorySearchText({
        id: 'single:health',
        label: '/health'
      })
    ).toBe('healthsinglehealth');
  });
});
