import { motion } from "framer-motion";

// Circular progress ring (financial health score, savings rate)
export default function Ring({ value = 0, max = 100, size = 120, stroke = 10, color = "#F5B944", gradient, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pctVal = Math.max(0, Math.min(1, (Number(value) || 0) / max));
  const id = `ring-${Math.round(size)}-${(gradient || []).join("").replace(/#/g, "")}`;

  return (
    <div className="ringwrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {gradient && (
          <defs>
            <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
              {gradient.map((g, i) => (
                <stop key={g} offset={`${(i / (gradient.length - 1)) * 100}%`} stopColor={g} />
              ))}
            </linearGradient>
          </defs>
        )}
        <circle className="tr" cx={size / 2} cy={size / 2} r={r} style={{ strokeWidth: stroke }} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={gradient ? `url(#${id})` : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - c * pctVal }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
      </svg>
      <div className="ctr">{children}</div>
    </div>
  );
}
