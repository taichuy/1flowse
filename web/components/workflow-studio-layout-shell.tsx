"use client";

import { useState, type ReactNode } from "react";
import { Layout } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Button } from "antd";

const { Content, Sider } = Layout;
const STUDIO_SIDEBAR_WIDTH = 196;
const STUDIO_SIDEBAR_COLLAPSED_WIDTH = 24;

type WorkflowStudioLayoutShellProps = {
  className: string;
  contentClassName: string;
  sidebar: ReactNode;
  children: ReactNode;
  dataComponent?: string;
  dataSurfaceLayout?: string;
};

export function WorkflowStudioLayoutShell({
  className,
  contentClassName,
  sidebar,
  children,
  dataComponent = "workflow-studio-shell",
  dataSurfaceLayout
}: WorkflowStudioLayoutShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [isNarrowViewportExpanded, setIsNarrowViewportExpanded] = useState(false);
  const effectiveCollapsed = isNarrowViewport ? !isNarrowViewportExpanded : collapsed;

  const handleToggleCollapsed = () => {
    if (isNarrowViewport) {
      setIsNarrowViewportExpanded((current) => !current);
      return;
    }

    setCollapsed((current) => !current);
  };

  const handleBreakpoint = (broken: boolean) => {
    setIsNarrowViewport(broken);

    if (!broken) {
      setIsNarrowViewportExpanded(false);
    }
  };

  return (
    <Layout
      className={className}
      data-component={dataComponent}
      data-surface-layout={dataSurfaceLayout}
      hasSider
    >
      <Sider
        className="workflow-studio-shell-sider"
        breakpoint="xl"
        collapsed={effectiveCollapsed}
        collapsedWidth={STUDIO_SIDEBAR_COLLAPSED_WIDTH}
        onBreakpoint={handleBreakpoint}
        theme="light"
        trigger={null}
        width={STUDIO_SIDEBAR_WIDTH}
      >
        {effectiveCollapsed ? (
          <div
            className="workflow-studio-shell-sider-collapsed"
            data-component="workflow-studio-shell-sider-collapsed"
          />
        ) : (
          <div className="workflow-studio-shell-sider-body">
            {sidebar}
          </div>
        )}

        <Button
          aria-label={effectiveCollapsed ? "展开左侧栏" : "收起左侧栏"}
          className="workflow-studio-shell-sider-trigger"
          data-action={effectiveCollapsed ? "expand-studio-sidebar" : "collapse-studio-sidebar"}
          icon={effectiveCollapsed ? <RightOutlined /> : <LeftOutlined />}
          onClick={handleToggleCollapsed}
          type="text"
        />
      </Sider>

      <Content className={contentClassName}>{children}</Content>
    </Layout>
  );
}
