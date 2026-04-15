import type { ReactNode } from 'react';

import {
  ApiOutlined,
  DeploymentUnitOutlined,
  FundOutlined,
  UnorderedListOutlined
} from '@ant-design/icons';

import type { SectionNavItem } from '../../../shared/ui/section-page-layout/SectionPageLayout';

export type ApplicationSectionKey = 'orchestration' | 'api' | 'logs' | 'monitoring';

const SECTION_DEFINITIONS: Array<{
  key: ApplicationSectionKey;
  label: string;
  icon: ReactNode;
}> = [
  {
    key: 'orchestration',
    label: '编排',
    icon: <DeploymentUnitOutlined />
  },
  {
    key: 'api',
    label: 'API',
    icon: <ApiOutlined />
  },
  {
    key: 'logs',
    label: '日志',
    icon: <UnorderedListOutlined />
  },
  {
    key: 'monitoring',
    label: '监控',
    icon: <FundOutlined />
  }
];

export function getApplicationSections(applicationId: string): SectionNavItem[] {
  return SECTION_DEFINITIONS.map((section) => ({
    key: section.key,
    label: section.label,
    icon: section.icon,
    to: `/applications/${applicationId}/${section.key}`
  }));
}
