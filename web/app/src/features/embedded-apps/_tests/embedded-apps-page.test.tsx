import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { EmbeddedAppsPage } from '../pages/EmbeddedAppsPage';

describe('EmbeddedAppsPage', () => {
  test('renders formal product copy instead of placeholder language', () => {
    render(<EmbeddedAppsPage />);

    expect(screen.getByText('Embedded Apps')).toBeInTheDocument();
    expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
  });
});
