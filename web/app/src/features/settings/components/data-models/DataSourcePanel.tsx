import { Button, Checkbox, Grid, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import type { SettingsDataSourceInstance } from '../../api/data-models';

export function DataSourcePanel({
  sources,
  loading,
  onOpenSource
}: {
  sources: SettingsDataSourceInstance[];
  loading: boolean;
  onOpenSource: (sourceId: string) => void;
}) {
  const screens = Grid.useBreakpoint();
  const useMobileList = Boolean(screens.xs && !screens.md);
  const columns: ColumnsType<SettingsDataSourceInstance> = [
    {
      title: '数据源标识',
      dataIndex: 'source_code',
      key: 'source_code',
      width: 220,
      render: (value: string) => <Typography.Text>{value}</Typography.Text>
    },
    {
      title: '数据源名称',
      dataIndex: 'display_name',
      key: 'display_name',
      render: (value: string) => <Typography.Text>{value}</Typography.Text>
    },
    {
      title: '类型',
      dataIndex: 'source_kind',
      key: 'source_kind',
      render: (value: string) => <Tag>{value}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => (
        <Tag color={value === 'ready' ? 'green' : 'default'}>{value}</Tag>
      )
    },
    {
      title: '启用',
      key: 'enabled',
      width: 120,
      render: (_, source) => (
        <Checkbox
          aria-label={`${source.display_name} 启用`}
          checked={source.status === 'ready'}
          disabled
        />
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_, source) => (
        <Button
          type="link"
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            onOpenSource(source.id);
          }}
        >
          配置
        </Button>
      )
    }
  ];

  return (
    <div className="data-model-panel__sources">
      {!useMobileList ? (
        <Table
          rowKey="id"
          size="middle"
          loading={loading}
          columns={columns}
          dataSource={sources}
          pagination={false}
          scroll={{ x: 760 }}
        />
      ) : null}
      {useMobileList ? (
        <div className="data-model-panel__mobile-list">
          {sources.map((source) => (
            <div key={source.id} className="data-model-panel__mobile-item">
              <span>
                <Typography.Text strong>{source.display_name}</Typography.Text>
                <Typography.Text type="secondary">
                  {source.source_code}
                </Typography.Text>
              </span>
              <span>
                <Tag>{source.source_kind}</Tag>
                <Tag color={source.status === 'ready' ? 'green' : 'default'}>
                  {source.status}
                </Tag>
                <Checkbox
                  aria-label={`${source.display_name} 启用`}
                  checked={source.status === 'ready'}
                  disabled
                />
              </span>
              <Button
                type="link"
                size="small"
                onClick={() => onOpenSource(source.id)}
              >
                配置
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
