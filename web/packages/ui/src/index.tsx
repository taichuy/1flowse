import { Layout, Typography } from 'antd';
import type { PropsWithChildren, ReactNode } from 'react';

const { Header, Content } = Layout;

export interface AppShellProps extends PropsWithChildren {
  title: string;
  navigation?: ReactNode;
}

export function AppShell({ title, navigation, children }: AppShellProps) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Typography.Title level={3} style={{ margin: 0, color: '#fff' }}>
          {title}
        </Typography.Title>
        {navigation}
      </Header>
      <Content style={{ maxWidth: 960, margin: '0 auto', padding: 24, width: '100%' }}>{children}</Content>
    </Layout>
  );
}
