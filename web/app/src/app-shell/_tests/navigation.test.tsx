import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { Navigation } from '../Navigation';

describe('Navigation', () => {
  test('renders labels from route config and marks embedded runtime under embedded apps', async () => {
    render(<Navigation pathname="/embedded/demo-app" useRouterLinks={false} />);

    const nav = await screen.findByRole('navigation', { name: 'Primary' });

    expect(within(nav).getByRole('link', { name: '工作台' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: '团队' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: '前台' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '团队', current: 'page' })).toBeInTheDocument();
  });
});
