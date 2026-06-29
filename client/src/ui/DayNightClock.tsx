import { getWeather, getWorldTime, type WeatherState, type WorldTime } from "@metricbase/shared";
import { useEffect, useState } from "react";

/** Small HUD pill showing the live in-world time of day and current weather. */
export function DayNightClock({ className = "chibi-stat-pill" }: { className?: string } = {}) {
  const [time, setTime] = useState<WorldTime>(() => getWorldTime());
  const [weather, setWeather] = useState<WeatherState>(() => getWeather());

  useEffect(() => {
    const tick = () => {
      setTime(getWorldTime());
      setWeather(getWeather());
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className={className}
      title={`In-world time — ${time.label} · Weather — ${weather.label}`}
    >
      <span>{time.icon}</span> {time.clock} · <span>{weather.icon}</span> {weather.label}
    </div>
  );
}
