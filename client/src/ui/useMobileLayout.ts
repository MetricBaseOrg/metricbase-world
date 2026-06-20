import { useEffect, useState } from "react";

const MOBILE_LAYOUT_QUERY = "(max-width: 768px), (pointer: coarse)";

export function useMobileLayout(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_LAYOUT_QUERY).matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia(MOBILE_LAYOUT_QUERY);
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return mobile;
}