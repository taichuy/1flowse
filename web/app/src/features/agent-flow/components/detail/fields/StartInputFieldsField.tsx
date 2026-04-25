import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { Button, Empty, Input, Select, Switch, Typography } from 'antd';

import type {
  FlowStartInputField,
  FlowStartInputType
} from '@1flowbase/flow-schema';

import {
  getStartInputValueType,
  normalizeStartInputField,
  startInputTypeOptions,
  startSystemVariables
} from '../../../lib/start-node-variables';

function normalizeList(value: unknown): FlowStartInputField[] {
  return Array.isArray(value)
    ? value.map((field, index) => normalizeStartInputField(field, index))
    : [];
}

function createNextField(index: number): FlowStartInputField {
  const key = `input_${index + 1}`;

  return {
    key,
    label: key,
    inputType: 'text',
    valueType: 'string',
    required: false
  };
}

function replaceAt(
  fields: FlowStartInputField[],
  index: number,
  patch: Partial<FlowStartInputField>
) {
  return fields.map((field, fieldIndex) =>
    fieldIndex === index ? { ...field, ...patch } : field
  );
}

function moveItem(fields: FlowStartInputField[], from: number, to: number) {
  if (to < 0 || to >= fields.length) {
    return fields;
  }

  const nextFields = [...fields];
  const [item] = nextFields.splice(from, 1);

  if (!item) {
    return fields;
  }

  nextFields.splice(to, 0, item);
  return nextFields;
}

export function StartInputFieldsField({
  value,
  onChange
}: {
  value: unknown;
  onChange: (value: FlowStartInputField[]) => void;
}) {
  const fields = normalizeList(value);

  return (
    <div className="agent-flow-start-input-fields">
      <div className="agent-flow-start-input-fields__header">
        <Typography.Text className="agent-flow-node-detail__section-subtitle">
          设置的输入可在工作流程中使用
        </Typography.Text>
        <Button
          aria-label="新增输入字段"
          icon={<PlusOutlined />}
          size="small"
          type="text"
          onClick={() => onChange([...fields, createNextField(fields.length)])}
        />
      </div>

      {fields.length > 0 ? (
        <div className="agent-flow-start-input-fields__list">
          {fields.map((field, index) => (
            <div
              key={`${field.key}-${index}`}
              className="agent-flow-start-input-fields__item"
            >
              <div className="agent-flow-start-input-fields__item-grid">
                <Input
                  aria-label={`输入字段变量名 ${index + 1}`}
                  value={field.key}
                  onChange={(event) =>
                    onChange(
                      replaceAt(fields, index, { key: event.target.value })
                    )
                  }
                />
                <Input
                  aria-label={`输入字段显示名 ${index + 1}`}
                  value={field.label}
                  onChange={(event) =>
                    onChange(
                      replaceAt(fields, index, { label: event.target.value })
                    )
                  }
                />
                <Select
                  aria-label={`输入字段类型 ${index + 1}`}
                  options={startInputTypeOptions}
                  value={field.inputType}
                  onChange={(inputType: FlowStartInputType) =>
                    onChange(
                      replaceAt(fields, index, {
                        inputType,
                        valueType: getStartInputValueType(inputType)
                      })
                    )
                  }
                />
                <Switch
                  aria-label={`必填输入字段 ${field.key}`}
                  checked={field.required}
                  checkedChildren="必填"
                  unCheckedChildren="可选"
                  onChange={(required) =>
                    onChange(replaceAt(fields, index, { required }))
                  }
                />
              </div>
              {field.inputType === 'select' ? (
                <Input
                  aria-label={`输入字段选项 ${index + 1}`}
                  placeholder="用英文逗号分隔选项"
                  value={(field.options ?? []).join(',')}
                  onChange={(event) =>
                    onChange(
                      replaceAt(fields, index, {
                        options: event.target.value
                          .split(',')
                          .map((option) => option.trim())
                          .filter(Boolean)
                      })
                    )
                  }
                />
              ) : null}
              <div className="agent-flow-start-input-fields__actions">
                <Button
                  aria-label={`上移输入字段 ${field.key}`}
                  disabled={index === 0}
                  icon={<ArrowUpOutlined />}
                  size="small"
                  type="text"
                  onClick={() => onChange(moveItem(fields, index, index - 1))}
                />
                <Button
                  aria-label={`下移输入字段 ${field.key}`}
                  disabled={index === fields.length - 1}
                  icon={<ArrowDownOutlined />}
                  size="small"
                  type="text"
                  onClick={() => onChange(moveItem(fields, index, index + 1))}
                />
                <Button
                  aria-label={`删除输入字段 ${field.key}`}
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  type="text"
                  onClick={() =>
                    onChange(
                      fields.filter((_, fieldIndex) => fieldIndex !== index)
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无自定义输入字段"
        />
      )}

      <div className="agent-flow-start-input-fields__system">
        <Typography.Text
          strong
          className="agent-flow-start-input-fields__system-title"
        >
          系统变量
        </Typography.Text>
        <div className="agent-flow-node-detail__list">
          {startSystemVariables.map((variable) => (
            <div
              key={variable.key}
              className="agent-flow-node-detail__list-item"
            >
              <div className="agent-flow-node-detail__list-item-left">
                <span className="agent-flow-node-detail__list-item-icon">
                  {'{x}'}
                </span>
                <span className="agent-flow-node-detail__list-item-name">
                  {variable.title}
                </span>
              </div>
              <span className="agent-flow-node-detail__list-item-type">
                {variable.key === 'files' ? 'Array[File]' : 'String'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
