import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { AppProviders } from '../../../app/AppProviders';
import { ApplicationCreateModal } from '../components/ApplicationCreateModal';

describe('ApplicationCreateModal', () => {
  test('shows agent_flow as enabled and workflow as disabled', () => {
    render(
      <AppProviders>
        <ApplicationCreateModal
          open
          csrfToken="csrf-123"
          onClose={vi.fn()}
          onCreated={vi.fn()}
        />
      </AppProviders>
    );

    expect(screen.getByRole('radio', { name: /AgentFlow/i })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /Workflow/i })).toBeDisabled();
    expect(screen.getByText('未开放')).toBeInTheDocument();
  });
});
