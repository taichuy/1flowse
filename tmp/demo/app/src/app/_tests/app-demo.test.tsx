import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach } from 'vitest';

import { App } from '../App';

beforeEach(() => {
  window.history.pushState({}, '', '/');
});

test('renders the control-plane shell and current primary navigation', async () => {
  render(<App />);

  expect(await screen.findByText('1Flowse')).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: '工作台' })).toBeInTheDocument();

  const primaryNavigation = await screen.findByRole('navigation', {
    name: 'Primary'
  });

  expect(within(primaryNavigation).getByRole('link', { name: '工作台' })).toBeInTheDocument();
  expect(within(primaryNavigation).getByRole('link', { name: '子系统' })).toBeInTheDocument();
  expect(within(primaryNavigation).getByRole('link', { name: '工具' })).toBeInTheDocument();
  expect(within(primaryNavigation).getByRole('link', { name: '设置' })).toBeInTheDocument();

  expect(screen.getByRole('link', { name: '进入 Agent Flow Studio' })).toBeInTheDocument();
  expect(screen.queryByText('Theme Preview')).not.toBeInTheDocument();
  expect(screen.queryByText('1Flowse Bootstrap')).not.toBeInTheDocument();
});

test('renders the studio route and updates the inspector when a node is focused', async () => {
  window.history.pushState({}, '', '/studio');

  render(<App />);

  expect(await screen.findByRole('heading', { name: 'Agent Flow Studio' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Knowledge Intake/i })).toBeInTheDocument();
  expect(screen.getByText('当前聚焦节点')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /发布网关/i }));

  expect(
    await screen.findByText('负责把已确认流程发布到宿主运行时，并同步更新入口版本。')
  ).toBeInTheDocument();
});

test('renders the tools route and opens a run drawer from the logs view', async () => {
  window.history.pushState({}, '', '/tools');

  render(<App />);

  expect(await screen.findByRole('heading', { name: '工具' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: '调用日志' }));
  fireEvent.click(screen.getByRole('button', { name: /查看 run_1021 详情/i }));

  expect(await screen.findByRole('dialog', { name: 'run_1021' })).toBeInTheDocument();
  expect(screen.getByText('最近一次发布任务已完成，等待 webhook 回写。')).toBeInTheDocument();
});

test('renders the settings route and switches to access control content', async () => {
  window.history.pushState({}, '', '/settings');

  render(<App />);

  expect(await screen.findByRole('heading', { name: '设置' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('menuitem', { name: '访问控制' }));

  expect(await screen.findByText('角色矩阵')).toBeInTheDocument();
  expect(screen.getByText('Platform Owner')).toBeInTheDocument();
});
