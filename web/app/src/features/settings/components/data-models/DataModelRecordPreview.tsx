import { Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import type { SettingsRuntimeRecordPreview } from '../../api/data-models';

function recordColumns(records: Record<string, unknown>[]): ColumnsType<Record<string, unknown>> {
  const keys = Array.from(
    records.reduce((set, record) => {
      Object.keys(record).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  ).slice(0, 8);

  return keys.map((key) => ({
    title: key,
    dataIndex: key,
    key,
    render: (value: unknown) =>
      typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : String(value ?? '')
  }));
}

export function DataModelRecordPreview({
  preview,
  loading
}: {
  preview: SettingsRuntimeRecordPreview | undefined;
  loading: boolean;
}) {
  const records = (preview?.items ?? []).map((record, index) => ({
    ...record,
    __row_key: String(record.id ?? `record-${index}`)
  }));

  return (
    <div className="data-model-panel__records">
      <Typography.Text type="secondary">Total {preview?.total ?? 0}</Typography.Text>
      <Table
        size="small"
        rowKey="__row_key"
        loading={loading}
        dataSource={records}
        columns={recordColumns(records)}
        pagination={false}
      />
    </div>
  );
}
