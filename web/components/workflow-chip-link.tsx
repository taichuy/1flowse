import Link from "next/link";
import { Card, Typography, Tag, Space } from "antd";
import { 
  AppstoreOutlined, 
  WarningOutlined, 
  NodeIndexOutlined,
  ToolOutlined 
} from "@ant-design/icons";

import type { WorkflowListItem } from "@/lib/get-workflows";
import { getWorkflowLegacyPublishAuthBacklogCount } from "@/lib/workflow-definition-governance";
import {
  buildWorkflowCatalogGapDetail,
  buildWorkflowGovernanceHandoff
} from "@/lib/workflow-governance-handoff";
import { isCurrentWorkbenchHref } from "@/lib/workbench-entry-links";

const { Text, Title } = Typography;

type WorkflowChipLinkProps = {
  workflow: WorkflowListItem;
  href: string;
  selected?: boolean;
  currentHref?: string | null;
};

export function WorkflowChipLink({
  workflow,
  href,
  selected = false,
  currentHref = null
}: WorkflowChipLinkProps) {
  const governedToolCount = workflow.tool_governance?.governed_tool_count ?? 0;
  const strongIsolationToolCount = workflow.tool_governance?.strong_isolation_tool_count ?? 0;
  const legacyPublishAuthBacklogCount = getWorkflowLegacyPublishAuthBacklogCount(workflow);
  
  const workflowGovernanceHandoff = buildWorkflowGovernanceHandoff({
    workflowId: workflow.id,
    workflowName: workflow.name,
    workflowDetailHref: href,
    toolGovernance: workflow.tool_governance ?? null,
    legacyAuthGovernance: workflow.legacy_auth_governance ?? null,
    workflowCatalogGapDetail: buildWorkflowCatalogGapDetail({
      toolGovernance: workflow.tool_governance ?? null,
      subjectLabel: "workflow",
      returnDetail:
        "打开当前 workflow 即可继续补齐 binding / LLM Agent tool policy，并沿同一份治理 handoff 收口。"
    })
  });
  
  const missingToolSummary = workflowGovernanceHandoff.workflowCatalogGapSummary;
  const hasMissingToolIssues = Boolean(missingToolSummary);
  const legacyAuthHandoff = workflowGovernanceHandoff.legacyAuthHandoff;
  
  const isCurrentPage = isCurrentWorkbenchHref(href, currentHref);

  const cardStyle = {
    height: '160px',
    cursor: 'pointer',
    borderColor: isCurrentPage ? '#1C64F2' : (selected ? '#1C64F2' : '#e5e7eb'),
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '12px',
    background: '#ffffff',
    transition: 'all 0.2s',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const,
    overflow: 'hidden'
  };

  const content = (
    <div style={cardStyle} className="group hover:shadow-lg">
      <div style={{ display: 'flex', height: '66px', alignItems: 'center', padding: '14px 14px 12px', gap: '12px' }}>
        <div style={{ 
          width: 40, height: 40, borderRadius: 8, background: '#EFF4FF', 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#1C64F2', fontSize: 20, flexShrink: 0
        }}>
          <AppstoreOutlined />
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: '1px 0' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '20px' }}>
            {workflow.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#6B7280', lineHeight: '18px', fontWeight: 500 }}>
            <span>v{workflow.version}</span>
            <span>·</span>
            <span>{workflow.status}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 14px', height: '45px', fontSize: 12, color: '#6B7280', lineHeight: '1.5' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <NodeIndexOutlined /> {workflow.node_count} nodes
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ToolOutlined /> {governedToolCount} tools
          </span>
        </div>
      </div>

      <div style={{ 
        position: 'absolute', bottom: 4, left: 0, right: 0, 
        height: '42px', display: 'flex', alignItems: 'center', 
        padding: '4px 6px 6px 14px', gap: '4px' 
      }}>
        {strongIsolationToolCount > 0 && (
          <Tag color="purple" variant="filled" style={{ margin: 0 }}>strong iso</Tag>
        )}
        {hasMissingToolIssues && (
          <Tag icon={<WarningOutlined />} color="error" variant="filled" style={{ margin: 0 }}>catalog gap</Tag>
        )}
        {legacyPublishAuthBacklogCount > 0 && (
          <Tag color="warning" variant="filled" style={{ margin: 0 }}>{legacyPublishAuthBacklogCount} auth</Tag>
        )}
      </div>
    </div>
  );

  return isCurrentPage ? (
    <div aria-current="page" style={{ height: '100%' }}>{content}</div>
  ) : (
    <Link href={href} style={{ textDecoration: 'none', height: '100%', display: 'block' }}>
      {content}
    </Link>
  );
}
