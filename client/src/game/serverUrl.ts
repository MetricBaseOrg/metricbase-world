const PRODUCTION_WS_URL = "wss://metricbaseserver-production.up.railway.app";
const PRODUCTION_HTTP_URL = "https://metricbaseserver-production.up.railway.app";

function isProductionClient(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "world.metricbase.org" || host.endsWith(".metricbase.org");
}

export function getWebSocketUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }

  if (isProductionClient()) {
    return PRODUCTION_WS_URL;
  }

  return `ws://${window.location.hostname}:2567`;
}

export function getHttpServerUrl(): string {
  if (import.meta.env.VITE_SERVER_HTTP_URL) {
    return import.meta.env.VITE_SERVER_HTTP_URL;
  }

  const wsUrl = import.meta.env.VITE_SERVER_URL;
  if (wsUrl) {
    return wsUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
  }

  if (isProductionClient()) {
    return PRODUCTION_HTTP_URL;
  }

  return `http://${window.location.hostname}:2567`;
}