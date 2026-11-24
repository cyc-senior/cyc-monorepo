/**
 * Turns a design's UI-kit markup back into the component code a developer
 * would write: shadcn/ui JSX (from `data-slot` / `data-variant` / `data-size`)
 * or @mui/material JSX (from MUI's own class names). Elements that are not
 * kit components stay as plain JSX elements.
 */
export type UiKitId = "shadcn" | "mui";

export interface KitCode {
  /** e.g. "BookButton.tsx" */
  fileName: string;
  lines: string[];
}

const VOID = new Set(["area", "br", "col", "hr", "img", "input", "meta", "source", "wbr"]);
const INDENT = "  ";

/** Which kit a design was generated with (its injected stylesheet says). */
export function detectKit(html: string): UiKitId | null {
  const match = html.match(/data-ui-kit="(shadcn|mui)"/);
  return match ? (match[1] as UiKitId) : null;
}

const pascal = (s: string) =>
  s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function quote(value: string): string {
  return value.includes('"') ? `{${JSON.stringify(value)}}` : `"${value}"`;
}

function jsxText(text: string): string {
  const t = text.replace(/\s+/g, " ");
  return /[{}<>]/.test(t) ? `{${JSON.stringify(t)}}` : t;
}

function styleObject(style: string): string | null {
  const entries = style
    .split(";")
    .map((d) => d.split(":"))
    .filter(([k, v]) => k?.trim() && v?.trim())
    .map(([k, ...v]) => `${camel(k.trim())}: ${JSON.stringify(v.join(":").trim())}`);
  return entries.length ? `{{ ${entries.join(", ")} }}` : null;
}

/** Plain HTML attributes as JSX props (class → className, for → htmlFor, …). */
function htmlProps(el: Element, skip: Set<string> = new Set()): string[] {
  const props: string[] = [];
  for (const { name, value } of Array.from(el.attributes)) {
    if (skip.has(name) || name.startsWith("data-") || name === "class") continue;
    if (name === "style") {
      const obj = styleObject(value);
      if (obj) props.push(`style=${obj}`);
      continue;
    }
    if (name === "href" && el.getAttribute("data-href") !== null) continue;
    const prop =
      name === "for" ? "htmlFor" : name.startsWith("aria-") ? name : name.includes("-") ? camel(name) : name;
    props.push(value === "" ? prop : `${prop}=${quote(value)}`);
  }
  const original = el.getAttribute("data-href");
  if (original !== null) props.push(`href=${quote(original)}`);
  const cls = el.getAttribute("class");
  if (cls && !/\bMui[A-Z]/.test(cls)) props.unshift(`className=${quote(cls)}`);
  return props;
}

interface Imports {
  add(module: string, name: string): void;
  lines(): string[];
}

function importSet(): Imports {
  const map = new Map<string, Set<string>>();
  return {
    add(module, name) {
      if (!map.has(module)) map.set(module, new Set());
      map.get(module)!.add(name);
    },
    lines() {
      return [...map.entries()].map(
        ([module, names]) => `import { ${[...names].sort().join(", ")} } from "${module}";`
      );
    },
  };
}

/* ---------------------------------------------------------------- shadcn */

/** Slot prefixes that are one shadcn module (radio-group-item → radio-group). */
const SHADCN_MODULES = [
  "alert-dialog", "aspect-ratio", "context-menu", "dropdown-menu", "hover-card", "input-otp",
  "native-select", "navigation-menu", "radio-group", "scroll-area", "toggle-group",
];
const SHADCN_COMPONENT: Record<string, string> = {
  select: "NativeSelect",
  "radio-group-item": "RadioGroupItem",
};
const SHADCN_SKIP = new Set(["switch-thumb", "progress-indicator"]);

function shadcnModule(slot: string): string {
  if (slot === "select") return "native-select";
  return SHADCN_MODULES.find((m) => slot === m || slot.startsWith(`${m}-`)) ?? slot.split("-")[0];
}

function shadcnElement(el: Element, depth: number, out: string[], imports: Imports) {
  const pad = INDENT.repeat(depth);
  const slot = el.getAttribute("data-slot");
  if (!slot) return plainElement(el, depth, out, imports, shadcnElement);
  if (SHADCN_SKIP.has(slot)) return;
  if (slot === "table-container") {
    // shadcn's <Table> renders its own scroll container.
    for (const child of Array.from(el.children)) shadcnElement(child, depth, out, imports);
    return;
  }

  const name = SHADCN_COMPONENT[slot] ?? pascal(slot);
  imports.add(`@/components/ui/${shadcnModule(slot)}`, name);
  const props: string[] = [];
  const variant = el.getAttribute("data-variant");
  const size = el.getAttribute("data-size");
  if (variant && variant !== "default") props.push(`variant=${quote(variant)}`);
  if (size && size !== "default") props.push(`size=${quote(size)}`);
  if (el.getAttribute("data-orientation") === "vertical") props.push('orientation="vertical"');
  if (slot === "switch" && el.getAttribute("data-state") === "checked") props.push("defaultChecked");
  if (slot === "progress") {
    const width = el.querySelector('[data-slot="progress-indicator"]')?.getAttribute("style") ?? "";
    const value = width.match(/width\s*:\s*(\d+)/)?.[1];
    if (value) props.push(`value={${value}}`);
  }
  const skip = new Set(["role", "data-state", "aria-selected", "aria-checked"]);
  // A link that looks like a button: <Button asChild><a href>…</a></Button>.
  if (slot === "button" && el.tagName === "A") {
    out.push(`${pad}<${name}${props.length ? ` ${props.join(" ")}` : ""} asChild>`);
    plainElement(el, depth + 1, out, imports, shadcnElement, new Set(["data-slot"]));
    out.push(`${pad}</${name}>`);
    return;
  }
  if (slot === "button" && el.getAttribute("type") === "button") skip.add("type");
  props.push(...htmlProps(el, skip));
  writeElement(name, props, el, depth, out, imports, shadcnElement);
}

/* ------------------------------------------------------------------- MUI */

const MUI_COMPONENTS = new Set([
  "Button", "IconButton", "Card", "CardHeader", "CardContent", "CardActions", "Chip", "Alert", "AlertTitle",
  "Tabs", "Tab", "TableContainer", "Table", "TableRow", "TableCell", "Avatar", "Divider", "AppBar",
  "Toolbar", "Container", "List", "ListItem", "ListItemButton", "ListItemIcon", "ListItemText",
  "LinearProgress", "Typography", "Paper", "TextField", "FormControlLabel", "BottomNavigation",
  "BottomNavigationAction", "Link", "Badge",
]);

/** The MUI component an element is the root of, if any. */
function muiComponent(el: Element): string | null {
  const cls = el.getAttribute("class") ?? "";
  const roots = [...cls.matchAll(/\bMui([A-Za-z]+)-root\b/g)].map((m) => m[1]);
  // A card is also a Paper; a text field is also a FormControl: prefer the specific one.
  const pick = roots.find((r) => r !== "Paper" && r !== "FormControl" && r !== "InputBase") ?? roots[0];
  if (pick && MUI_COMPONENTS.has(pick)) return pick;
  if (/\bMuiDialog-paper\b/.test(cls)) return "DialogContentPaper";
  return null;
}

function muiProps(el: Element, name: string): string[] {
  const cls = el.getAttribute("class") ?? "";
  const props: string[] = [];
  const has = (suffix: string) => new RegExp(`\\bMui${name}-${suffix}\\b`).exec(cls);
  const variant =
    has("(contained|outlined|text|filled|standard|dense)")?.[1] ??
    (name === "Typography" ? cls.match(/\bMuiTypography-(h[1-6]|subtitle[12]|body[12]|caption|overline)\b/)?.[1] : undefined);
  if (variant && !(name === "Button" && variant === "text")) props.push(`variant=${quote(variant)}`);
  const severity = cls.match(/\bMuiAlert-(?:standard|filled|outlined)(Success|Info|Warning|Error)\b/)?.[1];
  if (severity) props.push(`severity=${quote(severity.toLowerCase())}`);
  const size = has("size(Small|Large)")?.[1];
  if (size) props.push(`size=${quote(size.toLowerCase())}`);
  const color = has("color(Primary|Secondary|Error|Success|Warning|Info|Default)")?.[1];
  if (color && !(color === "Primary" && name !== "AppBar")) props.push(`color=${quote(color.toLowerCase())}`);
  if (has("fullWidth") || /\bMuiFormControl-fullWidth\b/.test(cls)) props.push("fullWidth");
  const elevation = cls.match(/\bMuiPaper-elevation(\d+)\b/)?.[1];
  if (elevation && name === "Paper") props.push(`elevation={${elevation}}`);
  if (/\bMui-selected\b/.test(cls) && name !== "Tab") props.push("selected");
  const maxWidth = cls.match(/\bMuiContainer-maxWidth(Lg|Md|Sm|Xl)\b/)?.[1];
  if (maxWidth) props.push(`maxWidth=${quote(maxWidth.toLowerCase())}`);
  return props;
}

const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, " ").trim() ?? "";

function muiElement(el: Element, depth: number, out: string[], imports: Imports) {
  const pad = INDENT.repeat(depth);
  const name = muiComponent(el);
  if (!name) {
    // Inner MUI parts (MuiChip-label, MuiAlert-message, …) are rendered by
    // their component: keep only what they contain.
    if (/\bMui[A-Z]\w*-(?!root)/.test(el.getAttribute("class") ?? "") && !/\bMui[A-Z]\w*-root\b/.test(el.getAttribute("class") ?? "")) {
      if (/\bMuiAlert-icon\b/.test(el.getAttribute("class") ?? "")) return;
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE) muiElement(node as Element, depth, out, imports);
        else if (node.textContent?.trim()) out.push(`${pad}${jsxText(node.textContent.trim())}`);
      }
      return;
    }
    return plainElement(el, depth, out, imports, muiElement);
  }
  if (name === "DialogContentPaper") {
    imports.add("@mui/material", "Dialog");
    out.push(`${pad}<Dialog open>`);
    for (const child of Array.from(el.children)) muiElement(child, depth + 1, out, imports);
    out.push(`${pad}</Dialog>`);
    return;
  }
  imports.add("@mui/material", name);
  const props = muiProps(el, name);
  const selfClose = (extra: string[]) =>
    out.push(`${pad}<${name}${[...props, ...extra].length ? ` ${[...props, ...extra].join(" ")}` : ""} />`);

  switch (name) {
    case "Chip":
      return selfClose([`label=${quote(text(el))}`]);
    case "CardHeader": {
      const title = text(el.querySelector(".MuiCardHeader-title"));
      const sub = text(el.querySelector(".MuiCardHeader-subheader"));
      return selfClose([title && `title=${quote(title)}`, sub && `subheader=${quote(sub)}`].filter(Boolean) as string[]);
    }
    case "ListItemText": {
      const primary = text(el.querySelector(".MuiListItemText-primary")) || text(el);
      const secondary = text(el.querySelector(".MuiListItemText-secondary"));
      return selfClose([`primary=${quote(primary)}`, secondary && `secondary=${quote(secondary)}`].filter(Boolean) as string[]);
    }
    case "TextField": {
      const field = el.querySelector("input, select, textarea");
      const extra = [
        text(el.querySelector(".MuiInputLabel-root")) && `label=${quote(text(el.querySelector(".MuiInputLabel-root")))}`,
        field?.getAttribute("id") && `id=${quote(field.getAttribute("id")!)}`,
        field?.getAttribute("type") && field.getAttribute("type") !== "text" && `type=${quote(field.getAttribute("type")!)}`,
        field?.getAttribute("placeholder") && `placeholder=${quote(field.getAttribute("placeholder")!)}`,
        field?.tagName === "TEXTAREA" && "multiline",
        field?.tagName === "SELECT" && "select",
        text(el.querySelector(".MuiFormHelperText-root")) && `helperText=${quote(text(el.querySelector(".MuiFormHelperText-root")))}`,
      ].filter(Boolean) as string[];
      return selfClose(extra);
    }
    case "LinearProgress": {
      const value = el.querySelector(".MuiLinearProgress-bar")?.getAttribute("style")?.match(/width\s*:\s*(\d+)/)?.[1];
      return selfClose(value ? ['variant="determinate"', `value={${value}}`] : []);
    }
    case "Divider":
      return selfClose([]);
    case "Tab":
      return selfClose([`label=${quote(text(el))}`]);
    default: {
      const skip = new Set(["role", "aria-selected"]);
      if (name === "Button" && el.getAttribute("type") === "button") skip.add("type");
      props.push(...htmlProps(el, skip));
      writeElement(name, props, el, depth, out, imports, muiElement);
    }
  }
}

/* ---------------------------------------------------------------- common */

type Walker = (el: Element, depth: number, out: string[], imports: Imports) => void;

function plainElement(
  el: Element,
  depth: number,
  out: string[],
  imports: Imports,
  walk: Walker,
  skip?: Set<string>
) {
  const tag = el.tagName.toLowerCase();
  writeElement(tag, htmlProps(el, skip), el, depth, out, imports, walk);
}

function writeElement(
  name: string,
  props: string[],
  el: Element,
  depth: number,
  out: string[],
  imports: Imports,
  walk: Walker
) {
  const pad = INDENT.repeat(depth);
  const open = `<${name}${props.length ? ` ${props.join(" ")}` : ""}`;
  const children = Array.from(el.childNodes).filter(
    (n) => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
  );
  if (VOID.has(el.tagName.toLowerCase()) || children.length === 0) {
    out.push(`${pad}${open} />`);
    return;
  }
  if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
    out.push(`${pad}${open}>${jsxText(children[0].textContent!.trim())}</${name}>`);
    return;
  }
  out.push(`${pad}${open}>`);
  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) out.push(`${pad}${INDENT}${jsxText(child.textContent!.trim())}`);
    else walk(child as Element, depth + 1, out, imports);
  }
  out.push(`${pad}</${name}>`);
}

/**
 * The component code for one element of a kit design, as a small React
 * component file: imports, then `export function <Name>() { return (…) }`.
 */
export function kitComponentCode(el: Element, kit: UiKitId, name: string, type: string): KitCode {
  const imports = importSet();
  const body: string[] = [];
  (kit === "shadcn" ? shadcnElement : muiElement)(el, 2, body, imports);
  // "Book this room · 4 seats" + Button → BookThisRoomButton (like BookButton.tsx).
  const words = name.replace(/[^a-zA-Z ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 3);
  const base = pascal(words.join(" "));
  const fnName = base ? (base.endsWith(type) ? base : `${base}${type}`) : type;
  const lines = [
    ...imports.lines(),
    ...(imports.lines().length ? [""] : []),
    `export function ${fnName}() {`,
    "  return (",
    ...body,
    "  );",
    "}",
  ];
  return { fileName: `${fnName}.tsx`, lines };
}
