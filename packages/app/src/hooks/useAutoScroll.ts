import { useEffect, useRef } from "react";

export function useAutoScroll<T extends HTMLElement>({
  shouldScroll,
  behavior = "smooth",
}: {
  shouldScroll: boolean;
  behavior?: ScrollBehavior;
}) {
  const containerRef = useRef<T | null>(null);
  const shouldStickRef = useRef(true);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const handleWheel = () => {
      const distanceFromBottom =
        node.scrollHeight - (node.scrollTop + node.clientHeight);
      shouldStickRef.current = distanceFromBottom <= 48;
    };

    node.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      node.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    if (!shouldScroll) {
      return;
    }

    const node = containerRef.current;
    if (!node) {
      return;
    }

    if (shouldStickRef.current) {
      node.scrollTo({
        top: node.scrollHeight,
        behavior,
      });
    }
  }, [shouldScroll, behavior]);

  return containerRef;
}
