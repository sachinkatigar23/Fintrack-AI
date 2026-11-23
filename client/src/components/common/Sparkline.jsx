// Small trend line drawn at the bottom of the summary cards
export default function Sparkline({ data = [], color = "#4FA8E8" }) {
  const values = data.length > 1 ? data : [0, 0, 0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 300;
  const h = 44;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => [i * step, h - 8 - ((v - min) / span) * (h - 16)]);
  const d = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} stroke={color} />
    </svg>
  );
}
