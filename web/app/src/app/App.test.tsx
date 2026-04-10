import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@1flowse/api-client', () => ({
  fetchApiHealth: vi.fn().mockResolvedValue({
    service: 'api-server',
    status: 'ok',
    version: '0.1.0'
  })
}));

import { App } from './App';

test('renders the bootstrap shell and health state', async () => {
  render(<App />);

  expect(await screen.findByText('1Flowse Bootstrap')).toBeInTheDocument();
  expect(
    await screen.findByRole('link', { name: 'agentFlow' })
  ).toBeInTheDocument();
  expect(await screen.findByText(/api-server/i)).toBeInTheDocument();
});
