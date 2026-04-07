"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, Button, Form, Input, Modal, Select } from "antd";

import { buildBlankWorkflowStarterFallback } from "@/components/workflow-create-wizard/fallback-starters";
import type { WorkflowCreateWizardProps } from "@/components/workflow-create-wizard/types";
import {
  createWorkflow,
  WorkflowDefinitionValidationError
} from "@/lib/get-workflows";
import { buildWorkflowEditorHrefFromWorkspaceStarterViewState } from "@/lib/workspace-starter-governance-query";

type WorkspaceCreateAppModalProps = {
  activeModeLabel: string | null;
  focusedCreateHref: string;
  open: boolean;
  onCancel: () => void;
  workflowCreateWizardProps: WorkflowCreateWizardProps;
};

type CreateAppFormValues = {
  starterId?: string;
  name: string;
  description?: string;
};

export function WorkspaceCreateAppModal({
  activeModeLabel,
  focusedCreateHref,
  open,
  onCancel,
  workflowCreateWizardProps
}: WorkspaceCreateAppModalProps) {
  const router = useRouter();
  const [form] = Form.useForm<CreateAppFormValues>();
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const starterId = Form.useWatch("starterId", form);
  const starters = useMemo(
    () =>
      workflowCreateWizardProps.starters.length > 0
        ? workflowCreateWizardProps.starters
        : [buildBlankWorkflowStarterFallback()],
    [workflowCreateWizardProps.starters]
  );
  const starterMap = useMemo(
    () => new Map(starters.map((starter) => [starter.id, starter] as const)),
    [starters]
  );
  const defaultStarterId = useMemo(() => {
    const preferredStarterId = workflowCreateWizardProps.governanceQueryScope.selectedTemplateId;

    if ((activeModeLabel === null || activeModeLabel === "ChatFlow") && starterMap.has("blank")) {
      return "blank";
    }

    if (preferredStarterId && starterMap.has(preferredStarterId)) {
      return preferredStarterId;
    }

    if (starterMap.has("blank")) {
      return "blank";
    }

    return starters[0]?.id;
  }, [activeModeLabel, starterMap, starters, workflowCreateWizardProps.governanceQueryScope.selectedTemplateId]);
  const resolvedStarter = useMemo(() => {
    if (starterId && starterMap.has(starterId)) {
      return starterMap.get(starterId) ?? null;
    }

    return defaultStarterId ? starterMap.get(defaultStarterId) ?? null : null;
  }, [defaultStarterId, starterId, starterMap]);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.setFieldsValue({
      starterId: defaultStarterId,
      name: "",
      description: ""
    });
    setErrorMessage(null);
  }, [defaultStarterId, form, open]);

  const handleClose = useCallback(() => {
    setErrorMessage(null);
    setIsCreating(false);
    form.resetFields();
    onCancel();
  }, [form, onCancel]);

  const handleFinish = useCallback(
    async (values: CreateAppFormValues) => {
      const nextStarter =
        (values.starterId ? starterMap.get(values.starterId) : null) ?? resolvedStarter;

      if (!nextStarter?.definition) {
        setErrorMessage("当前模板不可用，已尝试回退默认 Blank Flow，请刷新后重试。");
        return;
      }

      setIsCreating(true);
      setErrorMessage(null);

      try {
        const normalizedName = values.name.trim();
        if (!normalizedName) {
          setErrorMessage("请输入应用名称。");
          setIsCreating(false);
          return;
        }
        const body = await createWorkflow({
          name: normalizedName,
          definition: structuredClone(nextStarter.definition)
        });

        handleClose();
        router.push(
          buildWorkflowEditorHrefFromWorkspaceStarterViewState(body.id, {
            ...workflowCreateWizardProps.governanceQueryScope,
            selectedTemplateId: nextStarter.id
          })
        );
        router.refresh();
      } catch (error) {
        setIsCreating(false);
        setErrorMessage(
          error instanceof WorkflowDefinitionValidationError
            ? error.message
            : error instanceof Error
              ? error.message
              : "创建应用失败，请确认 API 已启动。"
        );
      }
    },
    [handleClose, resolvedStarter, router, starterMap, workflowCreateWizardProps.governanceQueryScope]
  );

  const handleTemplateChange = useCallback(
    (nextStarterId: string | undefined) => {
      const nextStarter =
        (nextStarterId ? starterMap.get(nextStarterId) : null) ??
        (defaultStarterId ? starterMap.get(defaultStarterId) : null);

      form.setFieldsValue({
        starterId: nextStarterId
      });
      setErrorMessage(null);
    },
    [defaultStarterId, form, starterMap]
  );

  return (
    <Modal
      confirmLoading={isCreating}
      okText="确认创建"
      cancelText="取消"
      onCancel={handleClose}
      onOk={() => form.submit()}
      open={open}
      title={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            paddingRight: 32
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.4 }}>创建新应用</div>
          <Button size="small" type="dashed" href={focusedCreateHref} target="_blank">
            全屏打开
          </Button>
        </div>
      }
      width={640}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{
          starterId: defaultStarterId,
          name: "",
          description: ""
        }}
      >
        <Form.Item
          label="应用名称"
          name="name"
          rules={[{ required: true, whitespace: true, message: "请输入应用名称。" }]}
        >
          <Input maxLength={80} placeholder="请输入应用名称" />
        </Form.Item>

        <Form.Item label="模板（可选）" name="starterId">
          <Select
            allowClear
            options={starters.map((starter) => ({
              label: starter.name,
              value: starter.id
            }))}
            placeholder="选择模板"
            onChange={handleTemplateChange}
          />
        </Form.Item>

        <Form.Item label="应用描述（可选）" name="description">
          <Input.TextArea rows={4} placeholder="简要描述这个应用的功能和用途..." />
        </Form.Item>

        {errorMessage ? <Alert title={errorMessage} type="error" showIcon /> : null}
      </Form>
    </Modal>
  );
}
