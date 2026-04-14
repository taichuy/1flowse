import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { navigateSpy, signInWithPassword, fetchCurrentMe } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  signInWithPassword: vi.fn(),
  fetchCurrentMe: vi.fn()
}));

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router'
  );

  return {
    ...actual,
    useNavigate: () => navigateSpy
  };
});

vi.mock('../api/session', () => ({
  signInWithPassword,
  fetchCurrentMe
}));

import { AppProviders } from '../../../app/AppProviders';
import { useAuthStore } from '../../../state/auth-store';
import { SignInPage } from '../pages/SignInPage';

describe('SignInPage', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    signInWithPassword.mockReset();
    fetchCurrentMe.mockReset();
    useAuthStore.getState().setAnonymous();
  });

  test('submits account/password and redirects to home on success', async () => {
    signInWithPassword.mockResolvedValue({
      csrf_token: 'csrf-123',
      effective_display_role: 'manager',
      current_workspace_id: 'workspace-1'
    });
    fetchCurrentMe.mockResolvedValue({
      id: 'user-1',
      account: 'root',
      email: 'root@example.com',
      phone: null,
      nickname: 'Root',
      name: 'Root',
      avatar_url: null,
      introduction: '',
      effective_display_role: 'manager',
      permissions: ['route_page.view.all']
    });

    render(
      <AppProviders>
        <SignInPage />
      </AppProviders>
    );

    fireEvent.change(screen.getByLabelText('账号'), {
      target: { value: 'root' }
    });
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'change-me' }
    });
    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({
        identifier: 'root',
        password: 'change-me'
      })
    );
    await waitFor(() => expect(fetchCurrentMe).toHaveBeenCalled());
    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith({ to: '/' })
    );

    expect(useAuthStore.getState()).toEqual(
      expect.objectContaining({
        sessionStatus: 'authenticated',
        csrfToken: 'csrf-123',
        actor: expect.objectContaining({
          account: 'root',
          current_workspace_id: 'workspace-1'
        }),
        me: expect.objectContaining({
          name: 'Root'
        })
      })
    );
  });
});
