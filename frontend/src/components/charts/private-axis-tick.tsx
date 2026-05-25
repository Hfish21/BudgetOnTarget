"use client";

import { usePrivacy } from "@/components/privacy-provider";

interface PrivateAxisTickProps {
  x?: number;
  y?: number;
  payload?: { value: number };
  formatter: (value: number) => string;
  textAnchor?: string;
}

export function PrivateYAxisTick({ x, y, payload, formatter, textAnchor }: PrivateAxisTickProps) {
  const { privacyMode } = usePrivacy();

  if (!payload) return null;

  return (
    <text
      x={x}
      y={y}
      textAnchor={(textAnchor as "end" | "start" | "middle") || "end"}
      fill="oklch(0.65 0 0)"
      fontSize={11}
      style={privacyMode ? { filter: "blur(6px)" } : undefined}
    >
      {formatter(payload.value)}
    </text>
  );
}
