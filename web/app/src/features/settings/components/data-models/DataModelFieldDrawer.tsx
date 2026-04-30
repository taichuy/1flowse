import { Descriptions, Drawer } from 'antd';

import type { SettingsDataModelField } from '../../api/data-models';

export function DataModelFieldDrawer({
  field,
  onClose
}: {
  field: SettingsDataModelField | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      title={field?.title ?? '字段'}
      open={Boolean(field)}
      width={420}
      onClose={onClose}
    >
      {field ? (
        <Descriptions
          column={1}
          items={[
            { key: 'code', label: 'Code', children: field.code },
            { key: 'kind', label: '类型', children: field.field_kind },
            {
              key: 'physical',
              label: '物理列',
              children: field.physical_column_name
            },
            {
              key: 'external',
              label: '外部字段',
              children: field.external_field_key ?? '-'
            }
          ]}
        />
      ) : null}
    </Drawer>
  );
}
