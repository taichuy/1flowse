import {
  CheckOutlined,
  CopyOutlined,
  FullscreenOutlined
} from '@ant-design/icons';
import { Button, Modal, Tooltip, Typography, message } from 'antd';
import { useRef, useState, type MouseEvent, type ReactNode } from 'react';

import { type FlowSelectorOption } from '../../lib/selector-options';
import {
  LexicalTemplatedTextEditor,
  type LexicalTemplatedTextEditorHandle
} from './template-editor/LexicalTemplatedTextEditor';

interface TemplatedTextFieldProps {
  label: string;
  labelContent?: ReactNode;
  toolbarExtraActions?: ReactNode;
  ariaLabel: string;
  placeholder?: string;
  options?: FlowSelectorOption[];
  value: string;
  onChange: (value: string) => void;
}

export function TemplatedTextField({
  label,
  labelContent,
  toolbarExtraActions,
  ariaLabel,
  placeholder,
  options = [],
  value,
  onChange
}: TemplatedTextFieldProps) {
  const editorRef = useRef<LexicalTemplatedTextEditorHandle | null>(null);
  const expandedEditorRef = useRef<LexicalTemplatedTextEditorHandle | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    message.success('已复制');
    window.setTimeout(() => setCopied(false), 1600);
  }

  function handleFrameMouseDown(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.closest('button,a,input,textarea,select,[role="button"]')) {
      return;
    }

    const editorElement = event.currentTarget.querySelector<HTMLElement>(
      '[contenteditable="true"]'
    );

    if (!editorElement) {
      return;
    }

    if (!target.closest('[contenteditable="true"]')) {
      event.preventDefault();
    }

    editorRef.current?.focus();
    editorElement.focus();
  }

  return (
    <div className="agent-flow-templated-text-field">
      <div
        className="agent-flow-templated-text-field__frame"
        onMouseDown={handleFrameMouseDown}
      >
        <div className="agent-flow-templated-text-field__toolbar">
          {labelContent ?? (
            <Typography.Text
              strong
              className="agent-flow-templated-text-field__label"
            >
              {label}
            </Typography.Text>
          )}
          <div className="agent-flow-templated-text-field__actions">
            {toolbarExtraActions}
            <span className="agent-flow-templated-text-field__action agent-flow-templated-text-field__counter">
              {value.length}
            </span>
            <Tooltip title="插入变量">
              <Button
                className="agent-flow-templated-text-field__action"
                type="text"
                size="small"
                icon={
                  <span className="agent-flow-templated-text-field__variable-icon">
                    {'{x}'}
                  </span>
                }
                disabled={options.length === 0}
                aria-label="插入变量"
                onClick={() => editorRef.current?.openVariablePicker()}
              />
            </Tooltip>
            <Tooltip title="复制内容">
              <Button
                className="agent-flow-templated-text-field__action"
                type="text"
                size="small"
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                aria-label={`复制${label}`}
                onClick={handleCopy}
              />
            </Tooltip>
            <Tooltip title="放大编辑">
              <Button
                className="agent-flow-templated-text-field__action"
                type="text"
                size="small"
                icon={<FullscreenOutlined />}
                aria-label={`放大编辑${label}`}
                onClick={() => setExpanded(true)}
              />
            </Tooltip>
          </div>
        </div>
        <LexicalTemplatedTextEditor
          ref={editorRef}
          value={value}
          options={options}
          ariaLabel={ariaLabel}
          placeholder={placeholder}
          onChange={onChange}
        />
      </div>
      <Modal
        centered
        className="agent-flow-templated-text-field__modal"
        footer={null}
        onCancel={() => setExpanded(false)}
        open={expanded}
        title={label}
        width="min(880px, calc(100vw - 48px))"
      >
        <LexicalTemplatedTextEditor
          ref={expandedEditorRef}
          value={value}
          options={options}
          ariaLabel={`${ariaLabel} 放大编辑`}
          placeholder={placeholder}
          onChange={onChange}
        />
      </Modal>
    </div>
  );
}
