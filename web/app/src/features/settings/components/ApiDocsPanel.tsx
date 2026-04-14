import { Typography } from 'antd';

import { getAuthApiBaseUrl } from '../../auth/api/session';

export function ApiDocsPanel() {
  const apiBaseUrl = getAuthApiBaseUrl();

  return (
    <div>
      <Typography.Title level={3}>API 文档</Typography.Title>
      <Typography.Paragraph>
        当前后端 OpenAPI 文档直接嵌入控制台，便于联调与排查。
      </Typography.Paragraph>
      <iframe
        title="API 文档"
        src={`${apiBaseUrl}/docs`}
        style={{
          width: '100%',
          minHeight: 720,
          border: '1px solid rgba(15, 23, 42, 0.08)',
          borderRadius: 16,
          background: '#fff'
        }}
      />
    </div>
  );
}
