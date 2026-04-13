import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { RouteGuard } from '../route-guards';

describe('RouteGuard', () => {
  test('passes children through in bootstrap mode', () => {
    render(
      <RouteGuard permissionKey="home.view">
        <div>guarded content</div>
      </RouteGuard>
    );

    expect(screen.getByText('guarded content')).toBeInTheDocument();
  });
});
