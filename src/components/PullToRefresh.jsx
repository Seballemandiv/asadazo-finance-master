import React, { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

export default function PullToRefresh({ onRefresh, children }) {
  const startY = useRef(0);
  const startX = useRef(0);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const begin = (event) => {
    if (!event.touches || event.touches.length !== 1) return;
    startY.current = event.touches[0].clientY;
    startX.current = event.touches[0].clientX;
  };

  const move = (event) => {
    if (!event.touches || event.touches.length !== 1 || refreshing) return;
    const target = event.currentTarget;
    if (target.scrollTop > 2) return;
    const dy = event.touches[0].clientY - startY.current;
    const dx = Math.abs(event.touches[0].clientX - startX.current);
    if (dy > 12 && dy > dx) setPull(Math.min(96, dy * 0.45));
  };

  const end = async () => {
    if (pull < 64 || refreshing) { setPull(0); return; }
    setRefreshing(true);
    setPull(76);
    try { await onRefresh?.(); }
    finally {
      setRefreshing(false);
      setPull(0);
    }
  };

  return (
    <div className="relative" onTouchStart={begin} onTouchMove={move} onTouchEnd={end} onTouchCancel={end}>
      <div className="md:hidden pointer-events-none fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-card px-3 py-2 text-xs shadow transition-all" style={{ top: `calc(env(safe-area-inset-top) + ${Math.max(8, pull)}px)`, opacity: pull > 8 || refreshing ? 1 : 0 }}>
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Refreshing" : pull >= 64 ? "Release to refresh" : "Pull to refresh"}
      </div>
      {children}
    </div>
  );
}
