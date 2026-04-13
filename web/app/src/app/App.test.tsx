import { render, screen, within } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';

vi.mock('@1flowse/api-client', () => ({
  getDefaultApiBaseUrl: vi.fn().mockReturnValue('http://127.0.0.1:7800'),
  fetchApiHealth: vi.fn().mockResolvedValue({
    service: 'api-server',
    status: 'ok',
    version: '0.1.0'
  })
}));

import { App } from './App';

beforeEach(() => {
  window.history.pushState({}, '', '/');
});

test('renders the bootstrap shell and health state', async () => {
  render(<App />);

  expect(await screen.findByText('1Flowse Bootstrap')).toBeInTheDocument();
  const primaryNavigation = await screen.findByRole('navigation', {
    name: 'Primary'
  });

  expect(within(primaryNavigation).getByRole('menu')).toBeInTheDocument();
  expect(within(primaryNavigation).getByRole('link', { name: 'Home' })).toBeInTheDocument();
  expect(
    within(primaryNavigation).getByRole('link', { name: 'Embedded Apps' })
  ).toBeInTheDocument();
  expect(
    within(primaryNavigation).getByRole('link', { name: 'Agent Flow' })
  ).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Taichu' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Theme Preview' })).not.toBeInTheDocument();
  expect(await screen.findByText(/api-server/i)).toBeInTheDocument();
});

test('renders the embedded apps placeholder route', async () => {
  window.history.pushState({}, '', '/embedded-apps');

  render(<App />);

  expect(await screen.findByText('Embedded Apps')).toBeInTheDocument();
});

test('renders the embedded app detail placeholder route', async () => {
  window.history.pushState({}, '', '/embedded-apps/demo-app');

  render(<App />);

  expect(await screen.findByText('Embedded App Detail')).toBeInTheDocument();
});

test('renders the embedded mount placeholder route', async () => {
  window.history.pushState({}, '', '/embedded/demo-app');

  render(<App />);

  expect(await screen.findByText('Embedded App Mount')).toBeInTheDocument();
});
