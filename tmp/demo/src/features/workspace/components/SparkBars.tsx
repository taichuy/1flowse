interface SparkBarsProps {
  values: number[];
}

export function SparkBars({ values }: SparkBarsProps) {
  const maxValue = Math.max(...values, 1);

  return (
    <div className="sparkbars" aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className="sparkbar"
          style={{ height: `${Math.max((value / maxValue) * 100, 16)}%` }}
        />
      ))}
    </div>
  );
}
