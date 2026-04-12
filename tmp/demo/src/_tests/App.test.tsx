import {
  fireEvent,
  render,
  screen
} from '@testing-library/react';

import { App } from '../app/App';

describe('workspace demo', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('renders overview with a single main CTA into orchestration', async () => {
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: /Revenue Copilot workspace demo/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '进入编排' })
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/真实代码已打通 bootstrap 与 API health/i).length
    ).toBeGreaterThan(0);
  });

  it('opens a run drawer from the logs page', async () => {
    window.history.pushState({}, '', '/logs');

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', { name: '查看 run_2048 详情' })
    );

    expect(await screen.findByText(/为什么停在这里/i)).toBeInTheDocument();
    expect(await screen.findByText(/Checkpoint persisted/i)).toBeInTheDocument();
  });
});
