import { Menu } from 'antd';
import type { MenuProps } from 'antd';

export interface SettingsSection {
  key: string;
  label: string;
  visible: boolean;
}

export function SettingsSidebar({
  sections,
  activeKey,
  onSelect
}: {
  sections: SettingsSection[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const visibleSections = sections.filter((section) => section.visible);

  if (visibleSections.length <= 1) {
    return null;
  }

  const items: MenuProps['items'] = visibleSections.map((section) => ({
    key: section.key,
    label: section.label
  }));

  return (
    <Menu
      mode="inline"
      selectedKeys={[activeKey]}
      items={items}
      onClick={({ key }) => onSelect(String(key))}
      style={{ width: 220, borderInlineEnd: 'none' }}
    />
  );
}
