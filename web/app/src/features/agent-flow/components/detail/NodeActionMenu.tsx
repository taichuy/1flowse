import { MoreOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';

export function NodeActionMenu({
  onLocate,
  onCopy,
  onDelete
}: {
  onLocate: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          {
            key: 'locate',
            label: '定位节点',
            onClick: onLocate
          },
          {
            key: 'copy',
            label: '复制节点',
            onClick: onCopy
          },
          {
            key: 'delete',
            label: '删除节点',
            danger: true,
            onClick: onDelete
          }
        ]
      }}
    >
      <Button aria-label="更多操作" icon={<MoreOutlined />} type="text" />
    </Dropdown>
  );
}
