"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Hue 0-360, saturation and value 0-1. */
interface Hsv {
  h: number;
  s: number;
  v: number;
}

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

function hexToHsv(hex: string): Hsv {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`.toUpperCase();
}

/** Calls `onMove` with the pointer's 0-1 position inside the element while dragging. */
function useDrag(onMove: (x: number, y: number) => void) {
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onMove(
      clamp((e.clientX - rect.left) / rect.width),
      clamp((e.clientY - rect.top) / rect.height)
    );
  };
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.focus();
      move(e);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e);
    },
  };
}

interface ColorPickerProps {
  /** `#RRGGBB`. Other values (half-typed hex) are ignored until valid. */
  value: string;
  onChange: (hex: string) => void;
  className?: string;
}

/**
 * Inline colour picker: a saturation/brightness area and a hue slider. Drag
 * with the pointer, or focus a control and use the arrow keys (Shift = 10x).
 */
export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [hsv, setHsv] = React.useState<Hsv>(() =>
    hexToHsv(HEX_PATTERN.test(value) ? value : "#1A73E8")
  );
  // Follow a value typed elsewhere (e.g. the hex field) without losing the
  // hue when it is grey, by syncing only when it differs from ours.
  const [seenValue, setSeenValue] = React.useState(value);
  if (value !== seenValue) {
    setSeenValue(value);
    if (HEX_PATTERN.test(value) && value.toUpperCase() !== hsvToHex(hsv)) {
      setHsv(hexToHsv(value));
    }
  }

  const update = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setSeenValue(hex);
    onChange(hex);
  };

  const areaDrag = useDrag((x, y) => update({ ...hsv, s: x, v: 1 - y }));
  const hueDrag = useDrag((x) => update({ ...hsv, h: x * 360 }));

  const onAreaKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { s: clamp(hsv.s - step) },
      ArrowRight: { s: clamp(hsv.s + step) },
      ArrowUp: { v: clamp(hsv.v + step) },
      ArrowDown: { v: clamp(hsv.v - step) },
    };
    if (moves[e.key]) {
      e.preventDefault();
      update({ ...hsv, ...moves[e.key] });
    }
  };

  const onHueKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    const delta = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[
      e.key
    ];
    if (delta !== undefined) {
      e.preventDefault();
      update({ ...hsv, h: clamp(hsv.h + delta, 0, 360) });
    }
  };

  const pureHue = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const current = hsvToHex(hsv);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        onKeyDown={onAreaKey}
        {...areaDrag}
        className="relative h-44 w-full cursor-crosshair touch-none rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={{
          backgroundColor: pureHue,
          backgroundImage:
            "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
        }}
      >
        <span
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            backgroundColor: current,
          }}
        />
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onKeyDown={onHueKey}
        {...hueDrag}
        className="relative h-3 w-full cursor-pointer touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={{
          background:
            "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
      >
        <span
          className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: pureHue }}
        />
      </div>
    </div>
  );
}
