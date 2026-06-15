import { useEffect } from "react";

function scrollParent(node) {
  let el = node instanceof Element ? node : node?.parentElement;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    const canScroll = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
    if (canScroll) return el;
    el = el.parentElement;
  }
  return document.querySelector("main") || document.scrollingElement || document.documentElement;
}

export default function PullToRefreshBlocker() {
  useEffect(() => {
    let startY = 0;
    let startX = 0;

    const onTouchStart = (event) => {
      if (!event.touches || event.touches.length !== 1) return;
      startY = event.touches[0].clientY;
      startX = event.touches[0].clientX;
    };

    const onTouchMove = (event) => {
      if (!event.touches || event.touches.length !== 1) return;
      const target = event.target;
      if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;

      const currentY = event.touches[0].clientY;
      const currentX = event.touches[0].clientX;
      const deltaY = currentY - startY;
      const deltaX = Math.abs(currentX - startX);
      if (Math.abs(deltaY) <= deltaX) return;

      const scroller = scrollParent(target);
      const atTop = scroller.scrollTop <= 0;
      const atBottom = Math.ceil(scroller.scrollTop + scroller.clientHeight) >= scroller.scrollHeight;

      if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
        event.preventDefault();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return null;
}
