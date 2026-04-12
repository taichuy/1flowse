import type { SummaryStat } from '../../../data/workspace-data';

interface SummaryStatsProps {
  items: SummaryStat[];
}

export function SummaryStats({ items }: SummaryStatsProps) {
  return (
    <section className="summary-grid" aria-label="关键摘要">
      {items.map((item) => (
        <article key={item.label} className="summary-card panel">
          <span className="summary-value">{item.value}</span>
          <strong>{item.label}</strong>
          <p>{item.note}</p>
        </article>
      ))}
    </section>
  );
}
