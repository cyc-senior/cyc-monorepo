"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowDown01Icon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
  RefreshIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { toPickedElement } from "./html-components";
import { designDocument } from "./design-document";
import type { PickedElement } from "./versions";

export interface DevicePreset {
  id: string;
  name: string;
  width: number;
  height: number;
}

export const RESPONSIVE = "responsive";
export const CUSTOM = "custom";

const PRESET_GROUPS: Array<{ label: string; presets: DevicePreset[] }> = [
  {
    label: "Desktop",
    presets: [
      { id: "desktop", name: "Desktop", width: 1440, height: 900 },
      { id: "laptop", name: "Laptop", width: 1280, height: 800 },
      { id: "full-hd", name: "Full HD", width: 1920, height: 1080 },
    ],
  },
  {
    label: "Tablet",
    presets: [
      { id: "ipad-air", name: "iPad Air", width: 820, height: 1180 },
      { id: "ipad-mini", name: "iPad mini", width: 768, height: 1024 },
    ],
  },
  {
    label: "Mobile",
    presets: [
      { id: "iphone-15-pro", name: "iPhone 15 Pro", width: 393, height: 852 },
      { id: "iphone-se", name: "iPhone SE", width: 375, height: 667 },
      { id: "pixel-8", name: "Pixel 8", width: 412, height: 915 },
      { id: "galaxy-s24", name: "Galaxy S24", width: 360, height: 780 },
    ],
  },
];

export const MOBILE_PRESET = "iphone-15-pro";
const ALL_PRESETS = PRESET_GROUPS.flatMap((g) => g.presets);
/** Width a responsive preview is laid out at before it is fitted. */
const RESPONSIVE_WIDTH = 1280;
const ZOOMS = [0.5, 0.75, 1];
const VIEWPORT_PADDING = 40;

export interface ViewportState {
  presetId: string;
  /** Used for CUSTOM; presets carry their own size. */
  width: number;
  height: number;
  zoom: "fit" | number;
}

export const DEFAULT_VIEWPORT: ViewportState = {
  presetId: RESPONSIVE,
  width: RESPONSIVE_WIDTH,
  height: 800,
  zoom: "fit",
};

export function isMobileViewport(viewport: ViewportState): boolean {
  const preset = ALL_PRESETS.find((p) => p.id === viewport.presetId);
  return (preset?.width ?? viewport.width) < 600;
}

export interface Selection {
  kind: string;
  /** In the design's CSS pixels, relative to the frame. */
  rect: { x: number; y: number; width: number; height: number };
}

interface PreviewCanvasProps {
  html: string;
  /** Changes when another version is shown. */
  documentKey: string;
  viewport: ViewportState;
  onViewportChange: (next: ViewportState) => void;
  pickMode: boolean;
  onPick: (element: PickedElement, selection: Selection) => void;
  selection: Selection | null;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="size-8 rounded-[10px] text-foreground"
    >
      {children}
    </Button>
  );
}

function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const commit = () => {
    const n = Number(draft);
    if (draft !== null && Number.isFinite(n) && n >= 200 && n <= 4000) onCommit(Math.round(n));
    setDraft(null);
  };
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(null);
      }}
      className="h-8 w-[72px] rounded-[10px] border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    />
  );
}

/**
 * A browser-like frame around a generated design: device presets, size,
 * zoom, reload and resize handles. The design is a sanitized, script-free
 * document in a sandboxed iframe. Only while picking an element does the
 * sandbox add `allow-same-origin` (still no `allow-scripts`, so nothing in
 * the design can run) so this page can see which element was clicked.
 */
export function PreviewCanvas({
  html,
  documentKey,
  viewport,
  onViewportChange,
  pickMode,
  onPick,
  selection,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: PreviewCanvasProps) {
  // Links stay inside the design instead of loading the app in the frame.
  const previewHtml = React.useMemo(() => designDocument(html), [html]);
  const areaRef = React.useRef<HTMLDivElement>(null);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [area, setArea] = React.useState({ width: 0, height: 0 });
  const [reloads, setReloads] = React.useState(0);
  const [hover, setHover] = React.useState<Selection | null>(null);
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setArea({
        width: Math.max(0, entry.contentRect.width - VIEWPORT_PADDING * 2),
        height: Math.max(0, entry.contentRect.height - VIEWPORT_PADDING * 2),
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const preset = ALL_PRESETS.find((p) => p.id === viewport.presetId);
  const responsive = viewport.presetId === RESPONSIVE;
  const width = preset?.width ?? (responsive ? RESPONSIVE_WIDTH : viewport.width);
  const responsiveHeight =
    area.width > 0 ? Math.round((area.height / area.width) * RESPONSIVE_WIDTH) : viewport.height;
  const height = preset?.height ?? (responsive ? Math.max(320, responsiveHeight) : viewport.height);
  const fit = area.width > 0 ? Math.min(area.width / width, area.height / height, 1) : 1;
  const scale = viewport.zoom === "fit" ? fit : viewport.zoom;
  const presetName = preset?.name ?? (responsive ? "Responsive" : "Custom");

  const setSize = (next: Partial<Pick<ViewportState, "width" | "height">>) =>
    onViewportChange({ ...viewport, presetId: CUSTOM, width, height, ...next });

  // Element picking: read the design's DOM (same origin only while picking).
  const attachPicker = React.useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!pickMode || !doc?.body) return;
    doc.body.style.cursor = "crosshair";
    // The iframe has its own realm, so `instanceof Element` would be false.
    const asElement = (target: EventTarget | null): Element | null =>
      target && (target as Node).nodeType === Node.ELEMENT_NODE ? (target as Element) : null;
    const toSelection = (el: Element): Selection => {
      const r = el.getBoundingClientRect();
      return { kind: toPickedElement(el).kind, rect: { x: r.left, y: r.top, width: r.width, height: r.height } };
    };
    doc.addEventListener("mousemove", (e) => {
      const el = asElement(e.target);
      setHover(el && el !== doc.body && el !== doc.documentElement ? toSelection(el) : null);
    });
    doc.addEventListener("mouseleave", () => setHover(null));
    doc.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        const el = asElement(e.target);
        if (!el || el === doc.body || el === doc.documentElement) return;
        setHover(null);
        onPick(toPickedElement(el), toSelection(el));
      },
      true
    );
  }, [pickMode, onPick]);

  const startResize = (edge: "right" | "bottom" | "corner") => (e: React.PointerEvent) => {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, width, height };
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    setDragging(true);
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) / scale;
      const dy = (ev.clientY - start.y) / scale;
      onViewportChange({
        ...viewport,
        presetId: CUSTOM,
        width: edge === "bottom" ? start.width : Math.round(Math.max(240, start.width + dx)),
        height: edge === "right" ? start.height : Math.round(Math.max(240, start.height + dy)),
      });
    };
    const up = () => {
      setDragging(false);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  };

  const box = (s: Selection) => ({
    left: s.rect.x * scale,
    top: s.rect.y * scale,
    width: s.rect.width * scale,
    height: s.rect.height * scale,
  });

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col rounded-[14px] border border-border bg-card">
      {/* Device toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <IconButton label="Older version" onClick={onBack} disabled={!canGoBack}>
          <HugeIcon icon={ArrowLeft02Icon} size={16} />
        </IconButton>
        <IconButton label="Newer version" onClick={onForward} disabled={!canGoForward}>
          <HugeIcon icon={ArrowRight02Icon} size={16} />
        </IconButton>
        <div className="h-5 w-px bg-border" aria-hidden="true" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-[136px] items-center gap-2 rounded-[10px] border border-border bg-background px-2.5 text-sm text-foreground shadow-xs cursor-pointer"
            >
              <span className="flex-1 truncate text-left">{presetName}</span>
              <HugeIcon icon={ArrowDown01Icon} size={16} className="text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[184px]">
            <DropdownMenuItem onSelect={() => onViewportChange({ ...viewport, presetId: RESPONSIVE })}>
              <span className="flex-1">Responsive</span>
              {responsive ? (
                <HugeIcon icon={Tick02Icon} size={14} />
              ) : (
                <span className="font-mono text-xs text-muted-foreground">Fit to window</span>
              )}
            </DropdownMenuItem>
            {PRESET_GROUPS.map((group) => (
              <React.Fragment key={group.label}>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {group.label}
                </DropdownMenuLabel>
                <DropdownMenuGroup>
                  {group.presets.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onSelect={() => onViewportChange({ ...viewport, presetId: p.id })}
                    >
                      <span className="flex-1">{p.name}</span>
                      {viewport.presetId === p.id ? (
                        <HugeIcon icon={Tick02Icon} size={14} />
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">
                          {p.width} × {p.height}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <NumberField label="Width" value={width} onCommit={(w) => setSize({ width: w })} />
        <span className="text-sm text-muted-foreground" aria-hidden="true">×</span>
        <NumberField label="Height" value={height} onCommit={(h) => setSize({ height: h })} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-[112px] items-center gap-2 rounded-[10px] border border-border bg-background px-2.5 text-sm text-foreground shadow-xs cursor-pointer"
            >
              <span className="flex-1 truncate text-left">
                {viewport.zoom === "fit"
                  ? `Fit (${Math.round(fit * 100)}%)`
                  : `${Math.round(viewport.zoom * 100)}%`}
              </span>
              <HugeIcon icon={ArrowDown01Icon} size={16} className="text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => onViewportChange({ ...viewport, zoom: "fit" })}>
              Fit to window
            </DropdownMenuItem>
            {ZOOMS.map((z) => (
              <DropdownMenuItem key={z} onSelect={() => onViewportChange({ ...viewport, zoom: z })}>
                {Math.round(z * 100)}%
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />
        <IconButton label="Reload preview" onClick={() => setReloads((n) => n + 1)}>
          <HugeIcon icon={RefreshIcon} size={16} />
        </IconButton>
      </div>

      {/* Viewport */}
      <div
        ref={areaRef}
        className="flex min-h-0 flex-1 overflow-auto rounded-b-[14px] bg-muted-foreground p-10"
      >
        <div className="m-auto flex items-end bg-black/50">
          <div className="flex flex-col items-center">
            <div
              className="relative overflow-hidden bg-background"
              style={{ width: width * scale, height: height * scale }}
            >
              <iframe
                // A new document per version, pick mode and reload.
                key={`${documentKey}-${pickMode}-${reloads}`}
                ref={iframeRef}
                title="Design preview"
                srcDoc={previewHtml}
                sandbox={pickMode ? "allow-same-origin" : ""}
                onLoad={attachPicker}
                className={cn(
                  "absolute left-0 top-0 origin-top-left border-0 bg-white",
                  dragging && "pointer-events-none"
                )}
                style={{ width, height, transform: `scale(${scale})` }}
              />
              {hover && (
                <div
                  className="pointer-events-none absolute rounded-[2px] border border-brand-500 bg-brand-500/10"
                  style={box(hover)}
                  aria-hidden="true"
                />
              )}
              {selection && (
                <div
                  className="pointer-events-none absolute rounded-[4px] border-2 border-brand-500"
                  style={box(selection)}
                  aria-hidden="true"
                >
                  <span className="absolute -top-[18px] left-0 rounded-[3px] bg-brand-500 px-1 text-[10px] leading-4 text-white">
                    {selection.kind}
                  </span>
                </div>
              )}
            </div>
            <div className="flex w-full justify-center p-[3px]">
              <div
                role="separator"
                aria-label="Resize height"
                onPointerDown={startResize("bottom")}
                className="h-1.5 w-10 cursor-ns-resize rounded-[3px] bg-neutral-400"
              />
            </div>
          </div>
          <div className="flex flex-col items-center justify-between self-stretch">
            <div className="size-3" />
            <div className="flex h-10 w-1.5 items-center justify-center px-[3px]">
              <div
                role="separator"
                aria-label="Resize width"
                onPointerDown={startResize("right")}
                className="h-10 w-1.5 cursor-ew-resize rounded-[3px] bg-neutral-400"
              />
            </div>
            <div
              role="separator"
              aria-label="Resize"
              onPointerDown={startResize("corner")}
              className="size-3 cursor-nwse-resize"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
