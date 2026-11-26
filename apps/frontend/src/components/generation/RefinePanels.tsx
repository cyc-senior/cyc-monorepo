"use client";

import * as React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { HugeIcon } from "@/components/ui/huge-icon";
import {
  ArrowUp02Icon,
  BracketsIcon,
  Cancel01Icon,
  CodeIcon,
  Copy01Icon,
  CursorEdit02Icon,
  Loading02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import {
  componentDocument,
  componentFileName,
  DesignComponent,
  formatHtml,
} from "./html-components";
import { kitComponentCode } from "./kit-code";
import {
  DesignVersion,
  PickedElement,
  PinnedComment,
  timeAgo,
  versionName,
} from "./versions";

/* ------------------------------------------------------------------ */
/* Code                                                                */
/* ------------------------------------------------------------------ */

export function CodeEmptyState() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 rounded-[10px] bg-[var(--cyc-bg-brand)] px-8 text-center">
      <HugeIcon icon={BracketsIcon} size={24} className="text-primary" />
      <p className="font-heading text-xl font-medium leading-7 text-white">
        Pick any component to see source code.
      </p>
    </div>
  );
}

export function CodeBlock({ component }: { component: DesignComponent }) {
  const [copied, setCopied] = React.useState(false);
  // Kit designs show the component code a developer writes (shadcn/MUI JSX);
  // older designs show their HTML.
  const { fileName, lines } = React.useMemo(() => {
    if (component.kit) {
      const doc = new DOMParser().parseFromString(`<body>${component.html}</body>`, "text/html");
      const el = doc.body.firstElementChild;
      if (el) return kitComponentCode(el, component.kit, component.name, component.type);
    }
    return { fileName: componentFileName(component.name, component.type), lines: formatHtml(component.html) };
  }, [component]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; nothing to undo.
    }
  };

  return (
    <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-[10px] bg-muted">
      <div className="flex items-center gap-2 px-4 pt-4">
        <div className="flex min-w-0 flex-1 items-center">
          <span className="pr-1 text-muted-foreground">
            <HugeIcon icon={CodeIcon} size={16} />
          </span>
          <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy code"}
          title={copied ? "Copied" : "Copy code"}
          className="size-6 rounded-[10px]"
        >
          <HugeIcon icon={copied ? Tick02Icon : Copy01Icon} size={12} />
        </Button>
      </div>
      <div className="min-h-0 overflow-auto px-4 pb-4 pt-2">
        <ol className="flex flex-col font-mono text-xs font-medium leading-[18px]">
          {lines.map((line, i) => (
            <li key={i} className="flex gap-4 px-4">
              <span className="w-6 shrink-0 select-none text-right text-muted-foreground">
                {i + 1}
              </span>
              <code className="flex-1 whitespace-pre-wrap break-all text-foreground">{line}</code>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Components bento                                                    */
/* ------------------------------------------------------------------ */

export function ComponentsBento({
  designHtml,
  components,
  selectedId,
  onSelect,
}: {
  designHtml: string;
  components: DesignComponent[];
  selectedId: string | null;
  onSelect: (component: DesignComponent) => void;
}) {
  if (components.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-[14px] bg-muted-foreground p-4 text-sm text-white">
        No components found in this design.
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-[14px] bg-muted-foreground p-4">
      <div className="grid grid-flow-dense grid-cols-3 gap-3">
        {components.map((component) => {
          const selected = component.id === selectedId;
          return (
            <button
              key={component.id}
              type="button"
              onClick={() => onSelect(component)}
              aria-pressed={selected}
              className={cn(
                "flex flex-col gap-2.5 rounded-[12px] bg-card p-3 text-left cursor-pointer",
                selected ? "border-2 border-brand-500" : "border border-border",
                component.wide && "col-span-2 row-span-2"
              )}
            >
              <div
                className={cn(
                  "relative w-full overflow-hidden rounded-[8px] border border-dashed border-border bg-card",
                  component.wide ? "h-[196px]" : "h-[80px]"
                )}
              >
                <iframe
                  title={`${component.name} preview`}
                  srcDoc={componentDocument(designHtml, component)}
                  sandbox=""
                  tabIndex={-1}
                  className="pointer-events-none absolute left-0 top-0 h-[200%] w-[200%] origin-top-left scale-50 border-0"
                />
              </div>
              <div className="flex w-full items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {component.name}
                </p>
                <span className="shrink-0 rounded-[4px] bg-brand-500 px-1.5 py-px text-xs leading-4 text-white">
                  {component.type}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  id: string;
  role: "ai" | "you";
  text: string;
  elementKind?: string;
  pending?: boolean;
  /** A follow-up the designer can start from this message. */
  action?: { id: string; label: string };
}

function AiMark() {
  return (
    <Image src="/brand/cyc-ai-mark.svg" alt="" width={20} height={20} className="shrink-0" />
  );
}

export function ChatPanel({
  messages,
  label,
  picked,
  pins = [],
  pickMode,
  onTogglePick,
  onClearPicked,
  onPinPicked,
  onRemovePin,
  onSend,
  sending,
  disabled,
  onAction,
}: {
  messages: ChatMessage[];
  /** The design being refined: "A" or "B". */
  label: string;
  picked: PickedElement | null;
  pins?: PinnedComment[];
  pickMode: boolean;
  onTogglePick: () => void;
  onClearPicked: () => void;
  onPinPicked?: (comment: string) => void;
  onRemovePin?: (pinId: string) => void;
  onSend: (text: string) => Promise<boolean>;
  sending: boolean;
  disabled: boolean;
  onAction?: (actionId: string) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);
  const isA = label === "A";

  React.useEffect(() => {
    // Scroll only the message list, never the page around it.
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if ((!text && pins.length === 0) || sending || disabled) return;
    if (await onSend(text)) setDraft("");
  };

  const pinCurrent = () => {
    const text = draft.trim();
    if (!picked || !text || !onPinPicked) return;
    onPinPicked(text);
    setDraft("");
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
      {/* Only the message list scrolls; messages sit at its bottom. */}
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto" aria-live="polite">
        <div className="mt-auto" aria-hidden="true" />
        {messages.map((m) =>
          m.role === "ai" ? (
            <div key={m.id} className="flex items-start gap-2">
              <AiMark />
              <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                <p
                  className={cn(
                    "text-sm leading-5 text-foreground",
                    m.pending && "text-muted-foreground"
                  )}
                >
                  {m.pending && (
                    <HugeIcon
                      icon={Loading02Icon}
                      size={14}
                      className="mr-1.5 inline animate-spin align-[-2px]"
                    />
                  )}
                  {m.text}
                </p>
                {m.action && onAction && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || sending}
                    onClick={() => onAction(m.action!.id)}
                    className="h-7 rounded-[10px] px-2.5 text-xs"
                  >
                    {m.action.label}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex flex-col items-end gap-1">
              {m.elementKind && (
                <span className="rounded-[6px] border border-brand-500 bg-background px-1.5 text-xs leading-5 text-brand-500">
                  {m.elementKind}
                </span>
              )}
              <div className="w-[280px] max-w-full rounded-[10px] bg-primary-subtle px-3 py-2.5">
                <p className="whitespace-pre-line text-sm leading-5 text-foreground">{m.text}</p>
              </div>
            </div>
          )
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div
          className={cn(
            "flex flex-col rounded-[10px]",
            isA ? "bg-design-a-subtle" : "bg-design-b-subtle"
          )}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <span
              className={cn("size-2 rounded-full", isA ? "bg-design-a" : "bg-design-b")}
              aria-hidden="true"
            />
            <p className={cn("text-sm leading-5", isA ? "text-design-a-text" : "text-design-b-text")}>
              Refining Design {label}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-background px-2.5 py-2">
            {pins.length > 0 && (
              <div className="flex flex-col gap-1 pb-1.5 mb-1 border-b border-border/60 max-h-36 overflow-y-auto">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Pinned comments ({pins.length})
                </span>
                {pins.map((pin, idx) => (
                  <div
                    key={pin.id}
                    className="flex items-start justify-between gap-2 rounded-[6px] bg-muted/50 px-2 py-1 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-brand-500 mr-1.5">
                        #{idx + 1} [{pin.element.kind}]
                      </span>
                      <span className="text-foreground break-words">{pin.comment}</span>
                    </div>
                    {onRemovePin && (
                      <button
                        type="button"
                        onClick={() => onRemovePin(pin.id)}
                        aria-label={`Remove pinned comment ${idx + 1}`}
                        className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer mt-0.5"
                      >
                        <HugeIcon icon={Cancel01Icon} size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {picked && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex w-fit items-center gap-1 rounded-[6px] border border-brand-500 px-1.5 text-xs leading-5 text-brand-500">
                  {picked.kind}: {picked.name}
                  <button
                    type="button"
                    onClick={onClearPicked}
                    aria-label="Remove picked element"
                    className="cursor-pointer"
                  >
                    <HugeIcon icon={Cancel01Icon} size={10} />
                  </button>
                </span>
                {onPinPicked && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={pinCurrent}
                    disabled={!draft.trim() || disabled}
                    className="h-6 rounded-[6px] px-2 text-xs cursor-pointer"
                  >
                    Pin comment
                  </Button>
                )}
              </div>
            )}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (picked && onPinPicked && draft.trim()) {
                    pinCurrent();
                  } else {
                    void send();
                  }
                }
              }}
              rows={2}
              maxLength={2000}
              disabled={disabled}
              aria-label={`Ask for a change to ${label}`}
              placeholder={
                picked
                  ? `Comment on ${picked.name} (Enter to pin)…`
                  : pins.length > 0
                    ? `Add an overall note or send ${pins.length} pinned edit${pins.length === 1 ? "" : "s"}…`
                    : `Ask for a change to ${label}…`
              }
              className="min-h-10 w-full resize-y bg-transparent text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={onTogglePick}
            aria-pressed={pickMode}
            aria-label={pickMode ? "Stop picking" : "Pick an element in the preview"}
            title={pickMode ? "Stop picking" : "Pick an element in the preview"}
            className={cn("size-8 rounded-[10px]", pickMode && "ring-2 ring-brand-500")}
          >
            <HugeIcon icon={CursorEdit02Icon} size={16} />
          </Button>
          <Button
            type="button"
            size={pins.length > 0 ? "sm" : "icon"}
            onClick={() => void send()}
            disabled={(!draft.trim() && pins.length === 0) || sending || disabled}
            aria-label={pins.length > 0 ? `Send all (${pins.length})` : "Send"}
            className={cn(
              "h-8 rounded-[10px] bg-primary-subtle text-primary-text hover:bg-primary-subtle/80",
              pins.length > 0 ? "px-3 text-xs font-medium gap-1.5" : "w-8"
            )}
          >
            {pins.length > 0 && <span>Send all ({pins.length})</span>}
            <HugeIcon icon={sending ? Loading02Icon : ArrowUp02Icon} size={16} className={cn(sending && "animate-spin")} />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Versions                                                            */
/* ------------------------------------------------------------------ */

export function VersionsPanel({
  versions,
  summaries,
  previewedId,
  restoringId,
  onPreview,
  onRestore,
}: {
  /** Newest first. */
  versions: DesignVersion[];
  summaries: Record<string, string>;
  previewedId: string | null;
  restoringId: string | null;
  onPreview: (version: DesignVersion) => void;
  onRestore: (version: DesignVersion) => void;
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto">
      <p className="text-sm leading-5 text-muted-foreground">
        Every change saves a new version. Restoring makes a new one, so nothing is lost.
      </p>
      {versions.map((version) => (
        <div
          key={version.variant.id}
          className={cn(
            "flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5",
            previewedId === version.variant.id ? "border-brand-500" : "border-border"
          )}
        >
          <button
            type="button"
            onClick={() => onPreview(version)}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-muted text-sm text-muted-foreground">
              {version.label}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm font-medium leading-5 text-card-foreground">
                {versionName(version)}
                {version.isCurrent && " (current)"}
              </span>
              <span className="text-sm leading-5 text-muted-foreground">
                <span className="line-clamp-2">{summaries[version.variant.id]}</span>
                <span>{timeAgo(version.variant.createdAt)}</span>
              </span>
            </span>
          </button>
          {!version.isCurrent && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRestore(version)}
              disabled={restoringId !== null}
              className="h-7 rounded-[10px] px-2.5 text-xs"
            >
              {restoringId === version.variant.id ? "Restoring…" : "Restore"}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
