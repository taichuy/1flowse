import { describe, expect, test } from 'vitest';

import { ApplicationListPage } from '../../applications/pages/ApplicationListPage';
import { HomePage } from '../pages/HomePage';

describe('HomePage', () => {
  test('delegates to the application list page', () => {
    const element = HomePage();

    expect(element.type).toBe(ApplicationListPage);
  });
});
