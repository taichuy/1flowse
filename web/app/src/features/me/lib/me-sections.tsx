import { KeyOutlined, UserOutlined } from '@ant-design/icons';

import type { SectionNavItem } from '../../../shared/ui/section-page-layout/SectionPageLayout';

export type MeSectionKey = 'profile' | 'security';

const ME_SECTIONS: SectionNavItem[] = [
  { key: 'profile', label: '个人信息', to: '/me/profile', icon: <UserOutlined /> },
  { key: 'security', label: '安全设置', to: '/me/security', icon: <KeyOutlined /> }
];

export function getMeSections(): SectionNavItem[] {
  return ME_SECTIONS;
}
