import type { ThemeConfig } from 'antd';

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#00d992',
    colorSuccess: '#19b36b',
    colorWarning: '#ffba00',
    colorError: '#fb565b',
    colorBgBase: '#050507',
    colorBgContainer: '#101010',
    colorBgElevated: '#151515',
    colorBorder: '#3d3a39',
    colorText: '#f2f2f2',
    colorTextSecondary: '#b8b3b0',
    colorTextTertiary: '#8b949e',
    colorSplit: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    borderRadiusLG: 8,
    borderRadiusSM: 6,
    fontFamily:
      '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    wireframe: false
  },
  components: {
    Button: {
      borderRadius: 6,
      controlHeight: 32,
      primaryColor: '#050507',
      defaultBg: '#101010',
      defaultBorderColor: '#3d3a39',
      defaultColor: '#f2f2f2'
    },
    Card: {
      colorBgContainer: '#101010',
      colorBorderSecondary: 'rgba(255, 255, 255, 0.06)',
      headerHeight: 48
    },
    Drawer: {
      colorBgElevated: '#101010',
      colorSplit: 'rgba(255, 255, 255, 0.08)'
    },
    Segmented: {
      itemColor: '#b8b3b0',
      itemHoverBg: 'rgba(255, 255, 255, 0.04)',
      itemSelectedBg: 'rgba(0, 217, 146, 0.16)',
      itemSelectedColor: '#f2f2f2',
      trackBg: '#0d0d10'
    }
  }
};
