import type { MarketChartPayload, MarketCandle } from "@metricbase/shared";

interface GoldMarketChartProps {
  chart: MarketChartPayload | undefined;
}

const VIEW_WIDTH = 480;
const VIEW_HEIGHT = 210;
const PADDING = { top: 16, right: 52, bottom: 28, left: 10 };

function formatPrice(value: number): string {
  return value >= 10 ? value.toFixed(2) : value.toFixed(3);
}

function formatTimeLabel(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:00`;
}

function visibleCandles(candles: MarketCandle[]): MarketCandle[] {
  return candles.filter((candle) => candle.close > 0);
}

export function GoldMarketChart({ chart }: GoldMarketChartProps) {
  if (!chart) return null;

  const candles = visibleCandles(chart.candles);
  const plotWidth = VIEW_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = VIEW_HEIGHT - PADDING.top - PADDING.bottom;

  if (candles.length === 0) {
    return (
      <div
        style={{
          marginTop: 16,
          padding: "14px 16px",
          borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Gold / Token Price</div>
        <div style={{ fontSize: 12, opacity: 0.65 }}>
          No trades yet. Candlesticks appear after the first market fills.
        </div>
      </div>
    );
  }

  const pricePoints = candles.flatMap((candle) => [candle.high, candle.low]);
  const rawMin = Math.min(...pricePoints);
  const rawMax = Math.max(...pricePoints);
  const spread = rawMax - rawMin || rawMax * 0.05 || 0.1;
  const minPrice = rawMin - spread * 0.12;
  const maxPrice = rawMax + spread * 0.12;
  const priceRange = maxPrice - minPrice || 1;

  const yForPrice = (price: number) =>
    PADDING.top + ((maxPrice - price) / priceRange) * plotHeight;

  const slotWidth = plotWidth / candles.length;
  const bodyWidth = Math.max(3, slotWidth * 0.62);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(
    (ratio) => minPrice + priceRange * (1 - ratio),
  );

  const timeLabels = [
    candles[0],
    candles[Math.floor(candles.length / 2)],
    candles[candles.length - 1],
  ];

  const changeColor =
    chart.changePercent === null
      ? "rgba(255,255,255,0.7)"
      : chart.changePercent >= 0
        ? "#5dffb1"
        : "#ff8f8f";

  return (
    <div
      style={{
        marginTop: 16,
        padding: "14px 16px 10px",
        borderRadius: 10,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Gold / Token Price</div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Tokens per 1 gold · {chart.intervalLabel} candles</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#ffd27a" }}>
            {chart.lastPrice !== null ? formatPrice(chart.lastPrice) : "—"}
          </div>
          {chart.changePercent !== null && (
            <div style={{ fontSize: 11, color: changeColor, marginTop: 2 }}>
              {chart.changePercent >= 0 ? "+" : ""}
              {chart.changePercent.toFixed(2)}% (24h)
            </div>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        width="100%"
        height={VIEW_HEIGHT}
        style={{ display: "block", marginTop: 10 }}
        role="img"
        aria-label="Gold market candlestick chart"
      >
        {yTicks.map((tick) => {
          const y = yForPrice(tick);
          return (
            <g key={tick}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={VIEW_WIDTH - PADDING.right}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
              <text
                x={VIEW_WIDTH - PADDING.right + 6}
                y={y + 4}
                fill="rgba(255,255,255,0.45)"
                fontSize="10"
              >
                {formatPrice(tick)}
              </text>
            </g>
          );
        })}

        {candles.map((candle, index) => {
          const centerX = PADDING.left + slotWidth * index + slotWidth / 2;
          const openY = yForPrice(candle.open);
          const closeY = yForPrice(candle.close);
          const highY = yForPrice(candle.high);
          const lowY = yForPrice(candle.low);
          const bullish = candle.close >= candle.open;
          const color = bullish ? "#2ecc71" : "#e74c3c";
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

          return (
            <g key={candle.time}>
              <line
                x1={centerX}
                y1={highY}
                x2={centerX}
                y2={lowY}
                stroke={color}
                strokeWidth={1.2}
              />
              <rect
                x={centerX - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={bodyHeight}
                fill={bullish ? color : color}
                stroke={color}
                strokeWidth={1}
                opacity={candle.volume > 0 ? 1 : 0.35}
              />
            </g>
          );
        })}

        {timeLabels.map((candle) => {
          const index = candles.findIndex((entry) => entry.time === candle.time);
          if (index < 0) return null;
          const x = PADDING.left + slotWidth * index + slotWidth / 2;
          return (
            <text
              key={`label-${candle.time}`}
              x={x}
              y={VIEW_HEIGHT - 8}
              textAnchor="middle"
              fill="rgba(255,255,255,0.42)"
              fontSize="10"
            >
              {formatTimeLabel(candle.time)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}