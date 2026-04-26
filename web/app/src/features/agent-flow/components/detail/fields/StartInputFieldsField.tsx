import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { Button, Empty, Input, Select, Switch, Typography } from 'antd';
import { useRef, useState } from 'react';

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
import { FloatingSettingsPanel } from '../FloatingSettingsPanel';

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

type EditingInputField = {
  index: number | null;
  field: FlowStartInputField;
};

export function StartInputFieldsField({
  value,
  onChange
}: {
  value: unknown;
  onChange: (value: FlowStartInputField[]) => void;
}) {
  const fields = normalizeList(value);
  const [editing, setEditing] = useState<EditingInputField | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  function openAddPanel() {
    setEditing({
      index: null,
      field: createNextField(fields.length)
    });
  }

  function openEditPanel(field: FlowStartInputField, index: number) {
    setEditing({
      index,
      field: normalizeStartInputField(field, index)
    });
  }

  function closePanel() {
    setEditing(null);
  }

  function updateDraft(patch: Partial<FlowStartInputField>) {
    setEditing((current) =>
      current
        ? {
            ...current,
            field: {
              ...current.field,
              ...patch
            }
          }
        : current
    );
  }

  function saveDraft() {
    if (!editing) {
      return;
    }

    const nextField = normalizeStartInputField(
      editing.field,
      editing.index ?? fields.length
    );

    if (editing.index === null) {
      onChange([...fields, nextField]);
    } else {
      onChange(replaceAt(fields, editing.index, nextField));
    }

    closePanel();
  }

  const floatingPanel = editing ? (
    <FloatingSettingsPanel
      open
      title="输入字段设置"
      closeLabel="关闭输入字段设置"
      triggerRef={triggerRef}
      className="agent-flow-start-input-fields__panel"
      defaultWidth={360}
      minWidth={320}
      defaultHeight={360}
      gap={16}
      onClose={closePanel}
      footer={
        <div className="agent-flow-start-input-fields__panel-footer">
          <Button onClick={closePanel}>取消</Button>
          <Button aria-label="保存输入字段" type="primary" onClick={saveDraft}>
            保存
          </Button>
        </div>
      }
    >
      <div className="agent-flow-start-input-fields__form">
        <label className="agent-flow-start-input-fields__form-row">
          <span>变量名</span>
          <Input
            aria-label="输入字段变量名"
            value={editing.field.key}
            onChange={(event) => updateDraft({ key: event.target.value })}
          />
        </label>
        <label className="agent-flow-start-input-fields__form-row">
          <span>显示名</span>
          <Input
            aria-label="输入字段显示名"
            value={editing.field.label}
            onChange={(event) => updateDraft({ label: event.target.value })}
          />
        </label>
        <label className="agent-flow-start-input-fields__form-row">
          <span>类型</span>
          <Select
            aria-label="输入字段类型"
            options={startInputTypeOptions}
            value={editing.field.inputType}
            onChange={(inputType: FlowStartInputType) =>
              updateDraft({
                inputType,
                valueType: getStartInputValueType(inputType),
                options:
                  inputType === 'select' ? editing.field.options : undefined
              })
            }
          />
        </label>
        <div className="agent-flow-start-input-fields__form-row">
          <span>必填</span>
          <Switch
            aria-label="必填输入字段"
            checked={editing.field.required}
            checkedChildren="必填"
            unCheckedChildren="可选"
            onChange={(required) => updateDraft({ required })}
          />
        </div>
        {editing.field.inputType === 'select' ? (
          <label className="agent-flow-start-input-fields__form-row">
            <span>选项</span>
            <Input
              aria-label="输入字段选项"
              placeholder="用英文逗号分隔选项"
              value={(editing.field.options ?? []).join(',')}
              onChange={(event) =>
                updateDraft({
                  options: event.target.value
                    .split(',')
                    .map((option) => option.trim())
                    .filter(Boolean)
                })
              }
            />
          </label>
        ) : null}
      </div>
    </FloatingSettingsPanel>
  ) : null;

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
          onClick={openAddPanel}
          ref={triggerRef}
        />
      </div>

      {fields.length > 0 ? (
        <div className="agent-flow-start-input-fields__list">
          {fields.map((field, index) => (
            <div
              key={`${field.key}-${index}`}
              className="agent-flow-start-input-fields__item"
            >
              <div className="agent-flow-start-input-fields__item-main">
                <div className="agent-flow-start-input-fields__item-copy">
                  <Typography.Text strong>{field.label}</Typography.Text>
                  <Typography.Text className="agent-flow-start-input-fields__item-key">
                    userinput.{field.key}
                  </Typography.Text>
                </div>
                <span className="agent-flow-node-detail__list-item-type">
                  {field.valueType}
                  {field.required ? ' · 必填' : ''}
                </span>
              </div>
              <div className="agent-flow-start-input-fields__actions">
                <Button
                  aria-label={`编辑输入字段 ${field.key}`}
                  icon={<EditOutlined />}
                  size="small"
                  type="text"
                  onClick={() => openEditPanel(field, index)}
                />
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
      {floatingPanel}
    </div>
  );
}
