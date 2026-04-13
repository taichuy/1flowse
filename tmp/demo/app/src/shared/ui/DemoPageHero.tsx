import type { ReactNode } from 'react';

import { Space, Typography } from 'antd';

interface DemoPageHeroProps {
  kicker: string;
  title: string;
  description: string;
  actions?: ReactNode;
  aside?: ReactNode;
}

export function DemoPageHero({
  kicker,
  title,
  description,
  actions,
  aside
}: DemoPageHeroProps) {
  return (
    <section className={`demo-page-hero ${aside ? 'demo-page-hero-grid' : ''}`}>
      <div className="demo-page-hero-main">
        <span className="demo-kicker">{kicker}</span>
        <Typography.Title level={1}>{title}</Typography.Title>
        <Typography.Paragraph className="demo-page-lede">{description}</Typography.Paragraph>
        {actions ? <Space wrap>{actions}</Space> : null}
      </div>
      {aside ? <div className="demo-page-hero-aside">{aside}</div> : null}
    </section>
  );
}
