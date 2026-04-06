import { Spin } from "antd";

export type AuthoringSurfaceLoadingStateProps = {
  title: string;
  summary: string;
  detail: string;
};

export function AuthoringSurfaceLoadingState(props: AuthoringSurfaceLoadingStateProps) {
  return (
    <section
      aria-busy="true"
      aria-label={props.title}
      className="authoring-surface-loading-card"
      data-component="authoring-surface-loading-state"
      data-loading-ui="antd"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255, 255, 255, 0.72)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        zIndex: 40
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          color: "rgba(0, 0, 0, 0.72)",
          fontSize: 14,
          lineHeight: "22px"
        }}
      >
        <Spin size="large" />
        <span>加载中</span>
      </div>
    </section>
  );
}
