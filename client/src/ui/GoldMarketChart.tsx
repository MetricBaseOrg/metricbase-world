import {
  normalizeMarketChart,
  type MarketChartPayload,
  type MarketCandle,
} from "@metricbase/shared";

interface GoldMarketChartProps {
  chart?: MarketChartPayload;
  /** Currency the chart is priced in (e.g. "$BASE", "USDC"). */
  currencyLabel?: string;
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

function tradedCandles(candles: MarketCandle[]): MarketCandle[] {
  return candles.filter((candle) => candle.volume > 0);
}

function chartPanelStyle(): React.CSSProperties {
  return { marginTop: 16 };
}

export function GoldMarketChart({ chart, currencyLabel = "tokens" }: GoldMarketChartProps) {
  const payload = normalizeMarketChart(chart);

  if (!payload.hasTrades) {
    return (
      <div className="chibi-card chibi-card--info" style={chartPanelStyle()}>
        <div className="chibi-title chibi-title--sm" style={{ marginBottom: 8 }}>Gold / Token Price</div>
        <div
          style={{
            padding: "18px 14px",
            borderRadius: 12,
            background: "#fff",
            border: "2px dashed var(--chibi-sky-deep)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--chibi-ink)" }}>No {currencyLabel} trades yet</div>
          <div className="chibi-text-muted" style={{ marginTop: 6, lineHeight: 1.45 }}>
            Candlesticks appear after the first {currencyLabel} gold-market trade fills on-chain. Switch the currency above to see other markets.
          </div>
          {payload.indicativePrice !== null && (
            <div style={{ fontSize: "0.82rem", marginTop: 10, color: "var(--chibi-gold-deep)", fontWeight: 800 }}>
              Order book mid: {formatPrice(payload.indicativePrice)} {currencyLabel}/gold
            </div>
          )}
        </div>
      </div>
    );
  }

  const candles = tradedCandles(payload.candles);
  if (candles.length === 0) {
    return (
      <div className="chibi-card chibi-card--info" style={chartPanelStyle()}>
        <div className="chibi-title chibi-title--sm" style={{ marginBottom: 8 }}>Gold / Token Price</div>
        <div className="chibi-text-muted" style={{ textAlign: "center", padding: "12px 0" }}>
          No trade data to chart yet.
        </div>
      </div>
    );
  }

  const plotWidth = VIEW_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = VIEW_HEIGHT - PADDING.top - PADDING.bottom;

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
    payload.changePercent === null
      ? "var(--chibi-ink-soft)"
      : payload.changePercent >= 0
        ? "var(--chibi-mint-deep)"
        : "var(--chibi-danger)";

  return (
    <div className="chibi-card" style={{ ...chartPanelStyle(), paddingBottom: 10, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div className="chibi-title chibi-title--sm">Gold / Token Price</div>
          <div className="chibi-text-muted" style={{ marginTop: 4 }}>
            {currencyLabel} per 1 gold · {payload.intervalLabel} candles
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--chibi-gold-deep)" }}>
            {payload.lastPrice !== null ? formatPrice(payload.lastPrice) : "—"}
          </div>
          {payload.changePercent !== null && (
            <div style={{ fontSize: "0.75rem", color: changeColor, marginTop: 2, fontWeight: 700 }}>
              {payload.changePercent >= 0 ? "+" : ""}
              {payload.changePercent.toFixed(2)}% (24h)
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
                stroke="rgba(74, 55, 40, 0.12)"
                strokeWidth={1}
              />
              <text
                x={VIEW_WIDTH - PADDING.right + 6}
                y={y + 4}
                fill="var(--chibi-ink-soft)"
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
                fill={color}
                stroke={color}
                strokeWidth={1}
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
              fill="var(--chibi-ink-soft)"
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