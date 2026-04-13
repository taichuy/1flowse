import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';

import { App } from '../App';

beforeEach(() => {
  window.history.pushState({}, '', '/');
});

describe('demo ux regression coverage', () => {
  test('home uses product-facing copy and exposes concrete console entry points', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: '工作台' })).toBeInTheDocument();
    expect(screen.queryByText('CURRENT PRODUCT DEMO')).not.toBeInTheDocument();
    expect(screen.queryByText('本轮批判')).not.toBeInTheDocument();
    expect(screen.queryByText('Agent Flow Studio')).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: '进入流程编排' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看子系统接入' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看工具台' })).toBeInTheDocument();
  });

  test('subsystems page opens a concrete detail drawer from the list', async () => {
    window.history.pushState({}, '', '/subsystems');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '子系统' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看 Growth Portal 详情' }));

    const dialog = await screen.findByRole('dialog', { name: 'Growth Portal' });
    expect(within(dialog).getByText('/embedded/growth-portal')).toBeInTheDocument();
    expect(within(dialog).getByText('Growth Systems')).toBeInTheDocument();
  });

  test('tools page surfaces pending work and opens incident review directly', async () => {
    window.history.pushState({}, '', '/tools');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '工具' })).toBeInTheDocument();
    expect(screen.getByText('待处理事项')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看 Policy Review / role-grid' }));

    const dialog = await screen.findByRole('dialog', { name: 'Policy Review / role-grid' });
    expect(
      within(dialog).getByText('角色矩阵中存在一条 own/all 语义冲突，需要人工回到访问控制面板处理。')
    ).toBeInTheDocument();
  });

  test('settings uses account and security sections instead of a team placeholder', async () => {
    window.history.pushState({}, '', '/settings');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '设置' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '安全设置' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '团队' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: '安全设置' }));

    expect(await screen.findByText('密码与会话')).toBeInTheDocument();
    expect(screen.getByText('最近 30 天未出现异常设备登录。')).toBeInTheDocument();
  });
});
