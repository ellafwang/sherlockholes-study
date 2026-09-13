import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SlideLayout({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("slide-content", className)}>{children}</section>;
}

export function ScaledSlide({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => {
      const rect = frame.getBoundingClientRect();
      setScale(Math.min(rect.width / 1920, rect.height / 1080));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="slide-viewport">
      <div className="slide-scaler" style={{ "--slide-scale": scale } as React.CSSProperties}>
        {children}
      </div>
    </div>
  );
}
