import type { PickedElement } from "./versions";
import { designDocument, originalHtml } from "./design-document";
import { detectKit, UiKitId } from "./kit-code";

/** A notable part of a generated design, shown in the Components tab. */
export interface DesignComponent {
  id: string;
  name: string;
  /** Kind shown in the type tag: Heading, Button, Table, … */
  type: string;
  /** The element itself, shown in the code view. */
  html: string;
  /**
   * The element inside empty copies of its ancestors (and the body's
   * attributes), so styles that depend on where it sits, such as white nav
   * text on a dark header, still apply in the thumbnail.
   */
  previewHtml: string;
  bodyAttributes: string;
  /** Big components span two columns in the bento. */
  wide: boolean;
  /** The design system it comes from; its code view shows kit JSX. */
  kit: UiKitId | null;
}

const MAX_COMPONENTS = 12;
const MAX_ELEMENT_HTML = 1500;

/**
 * What to list, most useful first, each with its own limit so one kind (say,
 * ten headings) can't crowd out the buttons and inputs.
 */
const KINDS: Array<{ selector: string; type: string; max: number; wide?: boolean }> = [
  { selector: "form", type: "Form", max: 1, wide: true },
  { selector: "table, [role='grid'], [role='table']", type: "Table", max: 1, wide: true },
  { selector: "button, [role='button'], a[class*='btn' i], input[type='submit']", type: "Button", max: 4 },
  { selector: "input:not([type='submit']):not([type='hidden']), select, textarea", type: "Input", max: 3 },
  { selector: "article, [role='article'], [class*='card' i]", type: "Card", max: 3 },
  { selector: "nav, [role='navigation']", type: "Navigation", max: 1, wide: true },
  { selector: "h1, h2", type: "Heading", max: 2 },
  { selector: "[role='tablist'], [role='list'], ul, ol", type: "List", max: 1 },
  { selector: "img, svg[role='img']", type: "Image", max: 1 },
];
/** Kind of a picked element as the chip shows it ("button", "heading", …). */
export function elementKind(el: Element): string {
  const slot = el.getAttribute("data-slot");
  if (slot) return slot;
  const mui = (el.getAttribute("class") ?? "").match(/\bMui([A-Za-z]+)-root\b/)?.[1];
  if (mui) return mui.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role");
  if (role) return role;
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "a") return "link";
  if (tag === "img") return "image";
  if (tag === "ul" || tag === "ol") return "list";
  return tag;
}

/** Text of an element with its pieces spaced ("Room" + "A1" → "Room A1"). */
function spacedText(el: Element): string {
  const parts: string[] = [];
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (text) parts.push(text);
  }
  return parts.join(" ");
}

export function elementName(el: Element): string {
  const heading = el.matches("h1, h2, h3, h4, h5, h6") ? null : el.querySelector("h1, h2, h3, h4, h5, h6, strong");
  const label =
    el.getAttribute("aria-label") ||
    el.getAttribute("alt") ||
    el.getAttribute("placeholder") ||
    (el.children.length > 3 && heading ? spacedText(heading) : "") ||
    spacedText(el) ||
    "";
  const text = label.replace(/\s+/g, " ").trim();
  if (!text) return elementKind(el);
  return text.length > 32 ? `${text.slice(0, 31)}…` : text;
}

export function toPickedElement(el: Element): PickedElement {
  const html = originalHtml(el);
  return {
    kind: elementKind(el),
    name: elementName(el),
    html: html.length > MAX_ELEMENT_HTML ? `${html.slice(0, MAX_ELEMENT_HTML)}…` : html,
  };
}

/**
 * A CSS path from body to `el` (`body > div:nth-of-type(2) > button:nth-of-type(1)`),
 * used to find a pinned element again after a reload, scroll or zoom.
 */
export function elementPath(el: Element): string {
  const parts: string[] = [];
  for (let node: Element | null = el; node && node.tagName !== "BODY"; node = node.parentElement) {
    const tag = node.tagName.toLowerCase();
    let index = 1;
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (sib.tagName === node.tagName) index += 1;
    }
    parts.unshift(`${tag}:nth-of-type(${index})`);
  }
  return ["body", ...parts].join(" > ");
}

function attributesOf(el: Element): string {
  return Array.from(el.attributes)
    .map((attr) => `${attr.name}="${attr.value.replace(/"/g, "&quot;")}"`)
    .join(" ");
}

/**
 * `el` wrapped in childless copies of its ancestors up to (not incl.) body,
 * so inherited colors and fonts (white nav text on a dark header) still apply.
 * The copies are marked so their layout (grids, fixed positions, widths) is
 * neutralized in the thumbnail.
 */
function inAncestors(el: Element): string {
  let html = el.outerHTML;
  for (let parent = el.parentElement; parent && parent.tagName !== "BODY"; parent = parent.parentElement) {
    const tag = parent.tagName.toLowerCase();
    const attrs = attributesOf(parent);
    html = `<${tag} data-preview-ancestor${attrs ? ` ${attrs}` : ""}>${html}</${tag}>`;
  }
  return html;
}

interface KitKind {
  type: string;
  wide?: boolean;
  /** Not listed when inside one of these (e.g. an input inside a field). */
  skipInside?: string;
}

/**
 * Every kit component root, in the order they are listed. Parts of a
 * component (card-header, tabs-trigger, …) belong to their root.
 */
const KIT_ROOTS: Record<UiKitId, Array<[selector: string, kind: KitKind]>> = {
  shadcn: [
    ['[data-slot="card"]', { type: "Card", wide: true }],
    ['[data-slot="form-item"]', { type: "Field" }],
    ['[data-slot="button"]', { type: "Button" }],
    ['[data-slot="toggle-group"]', { type: "ToggleGroup" }],
    ['[data-slot="input"], [data-slot="select"], [data-slot="textarea"]', { type: "Input", skipInside: '[data-slot="form-item"]' }],
    ['[data-slot="checkbox"], [data-slot="switch"]', { type: "Checkbox", skipInside: '[data-slot="form-item"], [data-slot="toggle-group"]' }],
    ['[data-slot="tabs"]', { type: "Tabs", wide: true }],
    ['[data-slot="table-container"], [data-slot="table"]', { type: "Table", wide: true, skipInside: '[data-slot="table-container"]' }],
    ['[data-slot="alert"]', { type: "Alert", wide: true }],
    ['[data-slot="badge"]', { type: "Badge" }],
    ['[data-slot="avatar"]', { type: "Avatar" }],
    ['[data-slot="progress"]', { type: "Progress" }],
    ['[data-slot="breadcrumb-list"]', { type: "Breadcrumb" }],
    ['[data-slot="dialog-content"], [data-slot="sheet-content"]', { type: "Dialog", wide: true }],
    ['[data-slot="dropdown-menu-content"], [data-slot="popover-content"]', { type: "Menu" }],
    ['[data-slot="tooltip-content"]', { type: "Tooltip" }],
    ['[data-slot="skeleton"]', { type: "Skeleton" }],
  ],
  mui: [
    [".MuiCard-root", { type: "Card", wide: true }],
    [".MuiAppBar-root", { type: "AppBar", wide: true }],
    [".MuiTextField-root", { type: "TextField" }],
    [".MuiButton-root, .MuiIconButton-root", { type: "Button" }],
    [".MuiToggleButtonGroup-root", { type: "ToggleButtonGroup" }],
    [".MuiFormControlLabel-root", { type: "Checkbox" }],
    [".MuiTabs-root", { type: "Tabs", wide: true }],
    [".MuiTableContainer-root, .MuiTable-root", { type: "Table", wide: true, skipInside: ".MuiTableContainer-root" }],
    [".MuiAlert-root", { type: "Alert", wide: true }],
    [".MuiChip-root", { type: "Chip" }],
    [".MuiList-root", { type: "List", wide: true }],
    [".MuiAvatar-root", { type: "Avatar" }],
    [".MuiLinearProgress-root", { type: "Progress" }],
    [".MuiBreadcrumbs-ol", { type: "Breadcrumbs" }],
    [".MuiBottomNavigation-root", { type: "BottomNavigation", wide: true }],
    [".MuiDialog-paper", { type: "Dialog", wide: true }],
    [".MuiSnackbarContent-root", { type: "Snackbar" }],
  ],
};

/** Enough for any one screen; past this the list stops growing. */
const MAX_KIT_COMPONENTS = 60;

/** A card or field is named by its title or label, not all of its text. */
function componentName(el: Element): string {
  if (el.matches('[data-slot="card"], .MuiCard-root')) {
    const title = el.querySelector('[data-slot="card-title"], .MuiCardHeader-title, h2, h3, h4');
    if (title) return elementName(title);
  }
  if (el.matches('[data-slot="form-item"], .MuiTextField-root, [data-slot="toggle-group"], .MuiToggleButtonGroup-root')) {
    const label = el.getAttribute("aria-label") ?? el.querySelector("label, legend")?.textContent;
    if (label?.trim()) return elementName(Object.assign(document.createElement("span"), { textContent: label }));
  }
  return elementName(el);
}

function component(el: Element, type: string, wide: boolean, kit: UiKitId | null, index: number, bodyAttributes: string): DesignComponent {
  return {
    id: `${type}-${index}`,
    name: componentName(el),
    type,
    html: originalHtml(el),
    previewHtml: inAncestors(el),
    bodyAttributes,
    wide,
    kit,
  };
}

/** Every component of a kit design, in list order; identical repeats once. */
function extractKitComponents(doc: Document, kit: UiKitId): DesignComponent[] {
  const bodyAttributes = attributesOf(doc.body);
  const seen = new Set<string>();
  const found: DesignComponent[] = [];
  for (const [selector, kind] of KIT_ROOTS[kit]) {
    for (const el of Array.from(doc.body.querySelectorAll(selector))) {
      if (found.length >= MAX_KIT_COMPONENTS) return found;
      if (kind.skipInside && el.parentElement?.closest(kind.skipInside)) continue;
      // The same component with the same content (four "Book" buttons) is one entry.
      const key = `${kind.type}:${el.outerHTML.replace(/\s+(id|for|name|value)="[^"]*"/g, "")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(component(el, kind.type, Boolean(kind.wide), kit, found.length, bodyAttributes));
    }
  }
  return found;
}

/**
 * The components of a design for the Components tab. Kit designs list every
 * component the design is built from; older designs fall back to finding the
 * notable parts (forms, buttons, headings, …) by their tags.
 */
export function extractComponents(html: string): DesignComponent[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const kit = detectKit(html);
  if (kit) return extractKitComponents(doc, kit);

  const containers: Element[] = [];
  const seen = new Set<string>();
  const found: DesignComponent[] = [];
  const bodyAttributes = attributesOf(doc.body);
  for (const kind of KINDS) {
    let taken = 0;
    for (const el of Array.from(doc.body.querySelectorAll(kind.selector))) {
      if (found.length >= MAX_COMPONENTS || taken >= kind.max) break;
      if (containers.some((c) => c === el || c.contains(el))) continue;
      if (kind.type === "List" && el.children.length > 12) continue;
      const name = componentName(el);
      const key = `${kind.type}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (kind.wide) containers.push(el);
      taken++;
      found.push(component(el, kind.type, Boolean(kind.wide), null, found.length, bodyAttributes));
    }
  }
  return found;
}

/** A standalone document that renders one component with the design's styles. */
export function componentDocument(designHtml: string, component: DesignComponent): string {
  return designDocument(componentShell(designHtml, component));
}

/** Ancestor copies keep their colors and fonts but none of their layout. */
const PREVIEW_CSS = `html,body{margin:0;min-height:100%;}
body{display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;}
body>*{width:100%;}
[data-preview-ancestor]{display:block!important;position:static!important;inset:auto!important;transform:none!important;
width:100%!important;max-width:none!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;
margin:0!important;padding:8px!important;overflow:visible!important;opacity:1!important;visibility:visible!important;
grid-template-columns:none!important;border:0!important;box-shadow:none!important;}`;

function componentShell(designHtml: string, component: DesignComponent): string {
  const head = designHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  return `<!doctype html><html><head>${head}<style>${PREVIEW_CSS}</style></head><body ${component.bodyAttributes}>${component.previewHtml}</body></html>`;
}

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr",
]);

/** Indents HTML one tag per line for the code view. */
export function formatHtml(html: string): string[] {
  const tokens = html
    .replace(/>\s+</g, "><")
    .split(/(<[^>]+>)/g)
    .map((t) => t.trim())
    .filter(Boolean);
  const lines: string[] = [];
  let depth = 0;
  for (const token of tokens) {
    const closing = token.startsWith("</");
    const tag = token.match(/^<\/?([a-zA-Z0-9-]+)/)?.[1]?.toLowerCase();
    const opening =
      token.startsWith("<") && !closing && !token.startsWith("<!") && !token.endsWith("/>") && tag && !VOID_TAGS.has(tag);
    if (closing) depth = Math.max(0, depth - 1);
    lines.push(`${"  ".repeat(depth)}${token}`);
    if (opening) depth++;
  }
  // Fold "<b>text</b>" back onto one line.
  const folded: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const [open, text, close] = [lines[i], lines[i + 1], lines[i + 2]];
    if (
      open?.trim().startsWith("<") && !open.trim().startsWith("</") &&
      text !== undefined && !text.trim().startsWith("<") &&
      close?.trim().startsWith("</")
    ) {
      folded.push(`${open}${text.trim()}${close.trim()}`);
      i += 2;
    } else {
      folded.push(open);
    }
  }
  return folded;
}

/** "Book room" -> "BookRoom.html" for the code block title. */
export function componentFileName(name: string, type: string): string {
  const base = name
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  return `${base || type}.html`;
}
