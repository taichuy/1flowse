import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { AppProviders } from '../../../app/AppProviders';

const modalShellSpies = vi.hoisted(() => ({
  SchemaModalPanel: vi.fn()
}));

vi.mock('../../../shared/schema-ui/overlay-shell/SchemaModalPanel', () => ({
  SchemaModalPanel: modalShellSpies.SchemaModalPanel
}));

import { ApplicationCreateModal } from '../components/ApplicationCreateModal';

describe('ApplicationCreateModal', () => {
  test('keeps form semantics after migrating to the shared modal shell', () => {
    modalShellSpies.SchemaModalPanel.mockReset();
    modalShellSpies.SchemaModalPanel.mockImplementation(
      ({
        children,
        schema
      }: {
        children?: ReactNode;
        schema: { title: string };
      }) => (
        <div data-testid="mock-schema-modal">
          <div data-testid="mock-schema-modal-title">{schema.title}</div>
          {children}
        </div>
      )
    );

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

    expect(modalShellSpies.SchemaModalPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        schema: expect.objectContaining({
          title: '新建应用',
          destroyOnHidden: true
        }),
        onClose: expect.any(Function)
      }),
      undefined
    );
    expect(screen.getByRole('textbox', { name: '名称' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建应用' })).toBeInTheDocument();
  });

  test('shows agent_flow as enabled and workflow as disabled', () => {
    modalShellSpies.SchemaModalPanel.mockReset();
    modalShellSpies.SchemaModalPanel.mockImplementation(
      ({
        children,
        schema
      }: {
        children?: ReactNode;
        schema: { title: string };
      }) => (
        <div data-testid="mock-schema-modal">
          <div data-testid="mock-schema-modal-title">{schema.title}</div>
          {children}
        </div>
      )
    );

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
