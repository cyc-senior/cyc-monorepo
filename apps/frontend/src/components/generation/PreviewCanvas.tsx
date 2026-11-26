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
  Delete02Icon,
  RefreshIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { elementPath, toPickedElement } from "./html-components";
import { designDocument } from "./design-document";
import type { PickedElement, PinAnchor } from "./versions";

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

/** A comment pin drawn on the design, Figma style. */
export interface CanvasPin {
  id: string;
  /** 1-based number shown in the marker. */
  number: number;
  kind: string;
  comment: string;
  anchor: PinAnchor;
  /** Set once the pin was sent: "Applied in A v2", "Sending…". */
  resolvedLabel?: string;
}

/** A pin being written: the element was clicked, the comment not saved yet. */
export interface DraftPin {
  kind: string;
  anchor: PinAnchor;
}

interface PinPosition {
  /** The pin point, in the design's CSS pixels relative to the frame. */
  x: number;
  y: number;
  rect: Selection["rect"];
}

interface PreviewCanvasProps {
  html: string;
  /** Changes when another version is shown. */
  documentKey: string;
  viewport: ViewportState;
  onViewportChange: (next: ViewportState) => void;
  /** Comment mode: a click on the design drops a pin instead of interacting. */
  pickMode: boolean;
  onPick: (element: PickedElement, anchor: PinAnchor) => void;
  pins: CanvasPin[];
  draft: DraftPin | null;
  activePinId: string | null;
  onSaveDraft: (comment: string) => void;
  onCancelDraft: () => void;
  onActivatePin: (pinId: string | null) => void;
  onRemovePin: (pinId: string) => void;
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

const POPOVER_WIDTH = 260;

/** Crosshair over the design while comment mode is on. */
function setCursor(doc: Document | null | undefined, picking: boolean) {
  if (doc?.body) doc.body.style.cursor = picking ? "crosshair" : "";
}

/** Left offset of a popover next to a pin, flipped when it would overflow. */
function popoverLeft(left: number, frameWidth: number): number {
  return left + 16 + POPOVER_WIDTH > frameWidth ? -POPOVER_WIDTH - 8 : 16;
}

function PinBubble({
  label,
  resolved,
  active,
}: {
  label: React.ReactNode;
  resolved?: boolean;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-full rounded-bl-none border-2 border-white text-[11px] font-semibold shadow-md",
        resolved ? "bg-muted text-muted-foreground" : "bg-brand-500 text-white",
        active && "ring-2 ring-brand-500/40"
      )}
    >
      {label}
    </span>
  );
}

function PinMarker({
  pin,
  left,
  top,
  active,
  frameWidth,
  onToggle,
  onRemove,
}: {
  pin: CanvasPin;
  left: number;
  top: number;
  active: boolean;
  frameWidth: number;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const resolved = Boolean(pin.resolvedLabel);
  return (
    <div className="pointer-events-auto absolute" style={{ left, top: top - 24 }}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={`Comment ${pin.number}: ${pin.comment}`}
        aria-expanded={active}
        className="cursor-pointer"
      >
        <PinBubble label={resolved ? <HugeIcon icon={Tick02Icon} size={12} /> : pin.number} resolved={resolved} active={active} />
      </button>
      {active && (
        <div
          role="dialog"
          aria-label={`Comment ${pin.number}`}
          className="absolute top-0 z-10 flex flex-col gap-2 rounded-[10px] border border-border bg-popover p-3 text-popover-foreground shadow-lg"
          style={{ width: POPOVER_WIDTH, left: popoverLeft(left, frameWidth) }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-[6px] border border-brand-500 px-1.5 text-xs leading-5 text-brand-500">
              {pin.kind}
            </span>
            {pin.resolvedLabel ? (
              <span className="text-xs text-muted-foreground">{pin.resolvedLabel}</span>
            ) : (
              <button
                type="button"
                onClick={onRemove}
                aria-label={`Delete comment ${pin.number}`}
                className="cursor-pointer text-muted-foreground hover:text-destructive"
              >
                <HugeIcon icon={Delete02Icon} size={14} />
              </button>
            )}
          </div>
          <p className="whitespace-pre-line text-sm leading-5">{pin.comment}</p>
        </div>
      )}
    </div>
  );
}

function DraftComposer({
  number,
  left,
  top,
  frameWidth,
  onSave,
  onCancel,
}: {
  number: number;
  left: number;
  top: number;
  frameWidth: number;
  onSave: (comment: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = React.useState("");
  const save = () => {
    if (text.trim()) onSave(text.trim());
  };
  return (
    <div className="pointer-events-auto absolute" style={{ left, top: top - 24 }}>
      <PinBubble label={number} active />
      <div
        role="dialog"
        aria-label="New comment"
        className="absolute top-0 z-10 flex flex-col gap-2 rounded-[10px] border border-border bg-popover p-2 shadow-lg"
        style={{ width: POPOVER_WIDTH, left: popoverLeft(left, frameWidth) }}
      >
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") onCancel();
          }}
          rows={2}
          maxLength={1000}
          placeholder="What should change here?"
          aria-label="Comment"
          className="min-h-14 w-full resize-none rounded-[6px] bg-transparent px-1 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="flex justify-end gap-1.5">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="h-7 rounded-[8px] px-2 text-xs">
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={!text.trim()} className="h-7 rounded-[8px] px-2.5 text-xs">
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * A browser-like frame around a generated design: device presets, size,
 * zoom, reload and resize handles. The design is a sanitized, script-free
 * document in a sandboxed iframe with `allow-same-origin` but never
 * `allow-scripts`, so nothing in the design can run while this page reads its
 * DOM to drop and follow comment pins.
 */
export function PreviewCanvas({
  html,
  documentKey,
  viewport,
  onViewportChange,
  pickMode,
  onPick,
  pins,
  draft,
  activePinId,
  onSaveDraft,
  onCancelDraft,
  onActivatePin,
  onRemovePin,
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

  // The design document is same-origin (still no `allow-scripts`, so nothing
  // in it can run) so this page can find pinned elements and follow scroll.
  const pickModeRef = React.useRef(pickMode);
  const onPickRef = React.useRef(onPick);
  React.useEffect(() => {
    pickModeRef.current = pickMode;
    onPickRef.current = onPick;
    setCursor(iframeRef.current?.contentDocument, pickMode);
  }, [pickMode, onPick]);

  const [positions, setPositions] = React.useState<Record<string, PinPosition>>({});
  const anchors = React.useMemo(() => {
    const list: Array<[string, PinAnchor]> = pins.map((p) => [p.id, p.anchor]);
    if (draft) list.push(["draft", draft.anchor]);
    return list;
  }, [pins, draft]);
  const anchorsRef = React.useRef(anchors);

  /** Where every pin is now: elements move with scroll, resize and reload. */
  const measure = React.useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    const next: Record<string, PinPosition> = {};
    for (const [id, anchor] of anchorsRef.current) {
      let el: Element | null = null;
      try {
        el = doc.querySelector(anchor.path);
      } catch {
        el = null;
      }
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next[id] = {
        x: r.left + anchor.x * r.width,
        y: r.top + anchor.y * r.height,
        rect: { x: r.left, y: r.top, width: r.width, height: r.height },
      };
    }
    setPositions(next);
  }, []);

  React.useEffect(() => {
    anchorsRef.current = anchors;
    measure();
  }, [anchors, measure, width, height]);

  const attachDocument = React.useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    setCursor(doc, pickModeRef.current);
    // The iframe has its own realm, so `instanceof Element` would be false.
    const asElement = (target: EventTarget | null): Element | null =>
      target && (target as Node).nodeType === Node.ELEMENT_NODE ? (target as Element) : null;
    const isContent = (el: Element | null): el is Element =>
      Boolean(el) && el !== doc.body && el !== doc.documentElement;
    doc.addEventListener("mousemove", (e) => {
      if (!pickModeRef.current) return;
      const el = asElement(e.target);
      if (!isContent(el)) return setHover(null);
      const r = el.getBoundingClientRect();
      setHover({ kind: toPickedElement(el).kind, rect: { x: r.left, y: r.top, width: r.width, height: r.height } });
    });
    doc.addEventListener("mouseleave", () => setHover(null));
    doc.addEventListener(
      "click",
      (e) => {
        if (!pickModeRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const el = asElement(e.target);
        if (!isContent(el)) return;
        const r = el.getBoundingClientRect();
        const clamp = (n: number) => Math.min(1, Math.max(0, n));
        setHover(null);
        onPickRef.current(toPickedElement(el), {
          path: elementPath(el),
          x: r.width > 0 ? clamp((e.clientX - r.left) / r.width) : 0.5,
          y: r.height > 0 ? clamp((e.clientY - r.top) / r.height) : 0.5,
        });
      },
      true
    );
    doc.addEventListener("scroll", measure, { capture: true, passive: true });
    doc.defaultView?.addEventListener("resize", measure);
    measure();
  }, [measure]);

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
                key={`${documentKey}-${reloads}`}
                ref={iframeRef}
                title="Design preview"
                srcDoc={previewHtml}
                sandbox="allow-same-origin"
                onLoad={attachDocument}
                className={cn(
                  "absolute left-0 top-0 origin-top-left border-0 bg-white",
                  dragging && "pointer-events-none"
                )}
                style={{ width, height, transform: `scale(${scale})` }}
              />
              {pickMode && hover && (
                <div
                  className="pointer-events-none absolute rounded-[2px] border border-brand-500 bg-brand-500/10"
                  style={box(hover)}
                  aria-hidden="true"
                />
              )}
              {/* Outline of the pin being written, or the focused pin. */}
              {(() => {
                const focus = draft ? positions.draft : activePinId ? positions[activePinId] : undefined;
                const kind = draft?.kind ?? pins.find((p) => p.id === activePinId)?.kind;
                if (!focus) return null;
                return (
                  <div
                    className="pointer-events-none absolute rounded-[4px] border-2 border-brand-500"
                    style={box({ kind: kind ?? "", rect: focus.rect })}
                    aria-hidden="true"
                  >
                    {kind && (
                      <span className="absolute -top-[18px] left-0 rounded-[3px] bg-brand-500 px-1 text-[10px] leading-4 text-white">
                        {kind}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Pin markers */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {pins.map((pin) => {
                  const pos = positions[pin.id];
                  if (!pos) return null;
                  const active = pin.id === activePinId;
                  return (
                    <PinMarker
                      key={pin.id}
                      pin={pin}
                      left={pos.x * scale}
                      top={pos.y * scale}
                      active={active}
                      frameWidth={width * scale}
                      onToggle={() => onActivatePin(active ? null : pin.id)}
                      onRemove={() => onRemovePin(pin.id)}
                    />
                  );
                })}
                {draft && positions.draft && (
                  <DraftComposer
                    key={`${draft.anchor.path}-${draft.anchor.x}-${draft.anchor.y}`}
                    number={pins.filter((p) => !p.resolvedLabel).length + 1}
                    left={positions.draft.x * scale}
                    top={positions.draft.y * scale}
                    frameWidth={width * scale}
                    onSave={onSaveDraft}
                    onCancel={onCancelDraft}
                  />
                )}
              </div>
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
