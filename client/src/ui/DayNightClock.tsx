import { getWorldTime, type WorldTime } from "@metricbase/shared";
import { useEffect, useState } from "react";

/** Small HUD pill showing the live in-world time of day. */
export function DayNightClock() {
  const [time, setTime] = useState<WorldTime>(() => getWorldTime());

  useEffect(() => {
    const tick = () => setTime(getWorldTime());
    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="chibi-stat-pill" title={`In-world time — ${time.label}`}>
      <span>{time.icon}</span> {time.clock} · {time.label}
    </div>
  );
}
