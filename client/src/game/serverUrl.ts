export function getWebSocketUrl(): string {
  return (
    import.meta.env.VITE_SERVER_URL ??
    `ws://${window.location.hostname}:2567`
  );
}

export function getHttpServerUrl(): string {
  if (import.meta.env.VITE_SERVER_HTTP_URL) {
    return import.meta.env.VITE_SERVER_HTTP_URL;
  }

  const wsUrl = import.meta.env.VITE_SERVER_URL;
  if (wsUrl) {
    return wsUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
  }

  return `http://${window.location.hostname}:2567`;
}