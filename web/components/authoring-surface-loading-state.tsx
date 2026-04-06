import { Spin } from "antd";

export type AuthoringSurfaceLoadingStateProps = {
  title: string;
  summary: string;
  detail: string;
};

export function AuthoringSurfaceLoadingState({
  title,
  summary,
  detail
}: AuthoringSurfaceLoadingStateProps) {
  return (
    <section
      aria-busy="true"
      className="authoring-surface-loading-card"
      data-component="authoring-surface-loading-state"
      data-loading-ui="antd"
      style={{
        width: "100%",
        maxWidth: 720,
        margin: "0 auto",
        padding: 32,
        background: "#fff",
        border: "1px solid #f0f0f0"
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 16
          }}
        >
          <Spin size="large" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: "rgba(0, 0, 0, 0.45)",
                fontSize: 14,
                lineHeight: "22px"
              }}
            >
              加载中
            </div>
            <h2
              style={{
                margin: "8px 0 0",
                fontSize: 24,
                lineHeight: 1.3
              }}
            >
              {title}
            </h2>
            <p
              style={{
                margin: "8px 0 0",
                color: "rgba(0, 0, 0, 0.65)",
                lineHeight: 1.7
              }}
            >
              {summary}
            </p>
          </div>
        </div>

        <p
          style={{
            margin: 0,
            color: "rgba(0, 0, 0, 0.65)",
            lineHeight: 1.7
          }}
        >
          {detail}
        </p>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
          }}
        >
          <div
            style={{
              padding: 16,
              background: "#fafafa",
              border: "1px solid #f0f0f0"
            }}
          >
            <strong style={{ display: "block", marginBottom: 8 }}>首屏策略</strong>
            <span style={{ color: "rgba(0, 0, 0, 0.65)", lineHeight: 1.7 }}>
              先交付作者壳层，再按需加载编辑器与次级面板。
            </span>
          </div>
          <div
            style={{
              padding: 16,
              background: "#fafafa",
              border: "1px solid #f0f0f0"
            }}
          >
            <strong style={{ display: "block", marginBottom: 8 }}>当前阶段</strong>
            <span style={{ color: "rgba(0, 0, 0, 0.65)", lineHeight: 1.7 }}>
              正在拆离作者热路径里的重客户端工作台与 no-store 次级数据。
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
