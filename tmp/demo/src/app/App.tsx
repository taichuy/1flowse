import { App as AntdApp, ConfigProvider } from 'antd';

import { DemoRouterProvider } from './router';
import { appTheme } from './theme';

export function App() {
  return (
    <ConfigProvider theme={appTheme}>
      <AntdApp>
        <DemoRouterProvider />
      </AntdApp>
    </ConfigProvider>
  );
}
