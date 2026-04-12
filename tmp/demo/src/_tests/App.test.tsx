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
      screen.getByRole('heading', { name: '最近运行摘要' })
    ).toBeInTheDocument();
  });

  it('opens the waiting run drawer from overview recent runs', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '查看等待态 run_2048' }));

    expect(await screen.findByRole('heading', { name: '调用日志' })).toBeInTheDocument();
    expect(await screen.findByText(/为什么停在这里/i)).toBeInTheDocument();
    expect(await screen.findByText(/Checkpoint persisted/i)).toBeInTheDocument();
  });
});
