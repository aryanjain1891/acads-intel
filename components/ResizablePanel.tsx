"use client";

import { useRef, useCallback, useState, type ReactNode } from "react";

interface ResizablePanelProps {
  children: ReactNode;
  defaultHeight?: number;
  minHeight?: number;
  className?: string;
}

export default function ResizablePanel({
  children,
  defaultHeight = 600,
  minHeight = 150,
  className = "",
}: ResizablePanelProps) {
  const [height, setHeight] = useState(defaultHeight);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startY.current = e.clientY;
      startH.current = height;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY.current;
        setHeight(Math.max(minHeight, startH.current + delta));
      };

      const onMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [height, minHeight]
  );

  return (
    <div className={className} style={{ position: "relative" }}>
      <div style={{ height }} className="overflow-y-auto overflow-x-hidden">
        {children}
      </div>
      {isDragging && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, cursor: "row-resize" }} />
      )}
      <div
        onMouseDown={onMouseDown}
        className="flex h-3 cursor-row-resize items-center justify-center border-t border-border/50 bg-surface/50 transition-colors hover:bg-surface-hover"
      >
        <div className="h-[2px] w-10 rounded-full bg-muted/40" />
      </div>
    </div>
  );
}
