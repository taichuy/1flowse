import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { EmbeddedAppsPage } from '../pages/EmbeddedAppsPage';

describe('EmbeddedAppsPage', () => {
  test('renders formal product copy instead of placeholder language', () => {
    render(<EmbeddedAppsPage />);

    expect(screen.getByText('子系统')).toBeInTheDocument();
    expect(screen.getByText('管理已接入子系统的发布清单、路由前缀与宿主约束。')).toBeInTheDocument();
    expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
  });
});
