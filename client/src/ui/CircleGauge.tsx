interface CircleGaugeProps {
  /** Progress from 0 to 1. */
  value: number;
  label: string;
  detail?: string;
  title?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
}

export function CircleGauge({
  value,
  label,
  detail,
  title,
  size = 36,
  strokeWidth = 4,
  color = "var(--chibi-lavender)",
  trackColor = "var(--chibi-outline-light)",
}: CircleGaugeProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  const center = size / 2;

  return (
    <div className="chibi-circle-gauge" title={title} aria-label={title ?? `${label} ${Math.round(clamped * 100)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="chibi-circle-gauge__center">
        <span className="chibi-circle-gauge__label">{label}</span>
        {detail ? <span className="chibi-circle-gauge__detail">{detail}</span> : null}
      </div>
    </div>
  );
}