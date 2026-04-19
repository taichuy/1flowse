import { Alert, Input, Segmented, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import type { SchemaFieldRendererProps } from '../../../../../shared/schema-ui/registry/create-renderer-registry';
import {
  getLlmResponseFormat
} from '../../../lib/llm-node-config';

function getNodeConfig(adapter: SchemaFieldRendererProps['adapter']) {
  const node = adapter.getDerived('node') as { config?: Record<string, unknown> } | null | undefined;
  return node?.config ?? {};
}

const DEFAULT_JSON_SCHEMA = {
  type: 'object'
} satisfies Record<string, unknown>;

export function LlmResponseFormatField({ adapter, block }: SchemaFieldRendererProps) {
  const responseFormat = getLlmResponseFormat(getNodeConfig(adapter));
  const [schemaText, setSchemaText] = useState(
    JSON.stringify(responseFormat.schema ?? DEFAULT_JSON_SCHEMA, null, 2)
  );

  useEffect(() => {
    setSchemaText(JSON.stringify(responseFormat.schema ?? DEFAULT_JSON_SCHEMA, null, 2));
  }, [responseFormat.mode, responseFormat.schema]);

  const parseError = useMemo(() => {
    if (responseFormat.mode !== 'json_schema') {
      return null;
    }

    try {
      const parsed = JSON.parse(schemaText);

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return 'JSON Schema 必须是对象。';
      }

      return null;
    } catch {
      return 'JSON Schema 不是合法 JSON。';
    }
  }, [responseFormat.mode, schemaText]);

  function updateMode(mode: 'text' | 'json_object' | 'json_schema') {
    if (mode === 'json_schema') {
      adapter.setValue('config.response_format', {
        mode,
        schema: responseFormat.schema ?? DEFAULT_JSON_SCHEMA
      });
      return;
    }

    adapter.setValue('config.response_format', {
      mode
    });
  }

  return (
    <Space direction="vertical" size={12} style={{ display: 'flex' }}>
      <Segmented
        block
        value={responseFormat.mode}
        options={[
          { label: '文本', value: 'text' },
          { label: 'JSON 对象', value: 'json_object' },
          { label: 'JSON Schema', value: 'json_schema' }
        ]}
        onChange={(nextValue) =>
          updateMode(nextValue as 'text' | 'json_object' | 'json_schema')
        }
      />
      {responseFormat.mode === 'json_schema' ? (
        <>
          <Typography.Text type="secondary">
            仅约束模型返回格式，不自动反推节点输出契约。
          </Typography.Text>
          <Input.TextArea
            rows={8}
            aria-label={`${block.label} JSON Schema`}
            value={schemaText}
            onChange={(event) => {
              const nextText = event.target.value;
              setSchemaText(nextText);

              try {
                const parsed = JSON.parse(nextText);

                if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                  adapter.setValue('config.response_format', {
                    mode: 'json_schema',
                    schema: parsed
                  });
                }
              } catch {
                // Keep local draft only until JSON becomes valid.
              }
            }}
          />
          {parseError ? <Alert type="warning" showIcon message={parseError} /> : null}
        </>
      ) : null}
    </Space>
  );
}
