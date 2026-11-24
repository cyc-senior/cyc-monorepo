/**
 * shadcn/ui (new-york, v4) as plain CSS for static HTML designs.
 *
 * Components are selected the way shadcn renders them: every component root
 * carries `data-slot` (button, card, card-header, …), and the props that
 * change its look are written as `data-variant` / `data-size` / `data-state`.
 * A design built from this markup maps 1:1 onto shadcn components.
 */
export const SHADCN_FONT =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'

export const SHADCN_CSS = `
:root {
  --radius: 0.625rem;
  --background: #ffffff;
  --foreground: #0a0a0a;
  --card: #ffffff;
  --card-foreground: #0a0a0a;
  --popover: #ffffff;
  --popover-foreground: #0a0a0a;
  --secondary: #f5f5f5;
  --secondary-foreground: #171717;
  --muted: #f5f5f5;
  /* Darker than shadcn's #737373, which is only 4.35:1 on the muted surface (WCAG AA needs 4.5). */
  --muted-foreground: #666666;
  --accent: #f5f5f5;
  --accent-foreground: #171717;
  --destructive: #e7000b;
  --border: #e5e5e5;
  --input: #e5e5e5;
  --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}
*, ::before, ::after { box-sizing: border-box; border-color: var(--border); }
body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font-family: "Inter", ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
[data-slot] :where(svg) { flex-shrink: 0; }
:where([data-slot]):focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent);
}

/* Layout primitives */
[data-layout="container"] { width: 100%; max-width: 1200px; margin-inline: auto; padding-inline: 1.5rem; }
@media (max-width: 640px) { [data-layout="container"] { padding-inline: 1rem; } }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

/* Toggle group (segmented choices: a radio/checkbox per item, visually hidden) */
[data-slot="toggle-group"] { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; }
[data-slot="toggle-group-item"] {
  position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
  height: 2.25rem; min-width: 2.25rem; padding: 0 0.75rem; cursor: pointer; user-select: none;
  border: 1px solid var(--input); border-radius: calc(var(--radius) - 2px); background: transparent;
  color: var(--foreground); font-family: inherit; font-size: 0.875rem; font-weight: 500; white-space: nowrap;
  box-shadow: var(--shadow-xs); transition: background-color .15s, color .15s;
}
[data-slot="toggle-group-item"]:hover { background: var(--muted); }
[data-slot="toggle-group-item"][data-state="on"],
[data-slot="toggle-group-item"]:has(input:checked) { background: var(--primary); border-color: var(--primary); color: var(--primary-foreground); }
[data-slot="toggle-group-item"]:has(input:focus-visible) { box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent); }

/* Button */
[data-slot="button"] {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
  white-space: nowrap; border-radius: calc(var(--radius) - 2px); border: 1px solid transparent;
  font-family: inherit; font-size: 0.875rem; font-weight: 500; line-height: 1.25rem; text-decoration: none;
  height: 2.25rem; padding: 0.5rem 1rem; cursor: pointer;
  background: var(--primary); color: var(--primary-foreground); box-shadow: var(--shadow-xs);
  transition: background-color .15s, color .15s, box-shadow .15s;
}
[data-slot="button"] svg { width: 1rem; height: 1rem; }
[data-slot="button"]:hover { background: color-mix(in oklab, var(--primary) 90%, transparent); }
[data-slot="button"][data-variant="destructive"] { background: var(--destructive); color: #fff; }
[data-slot="button"][data-variant="destructive"]:hover { background: color-mix(in oklab, var(--destructive) 90%, transparent); }
[data-slot="button"][data-variant="outline"] { background: var(--background); color: var(--foreground); border-color: var(--border); }
[data-slot="button"][data-variant="outline"]:hover,
[data-slot="button"][data-variant="ghost"]:hover { background: var(--accent); color: var(--accent-foreground); }
[data-slot="button"][data-variant="secondary"] { background: var(--secondary); color: var(--secondary-foreground); }
[data-slot="button"][data-variant="secondary"]:hover { background: color-mix(in oklab, var(--secondary) 80%, var(--foreground) 5%); }
[data-slot="button"][data-variant="ghost"] { background: transparent; color: var(--foreground); box-shadow: none; }
[data-slot="button"][data-variant="link"] { background: transparent; color: var(--primary-text); box-shadow: none; text-underline-offset: 4px; }
[data-slot="button"][data-variant="link"]:hover { text-decoration: underline; background: transparent; }
[data-slot="button"][data-size="sm"] { height: 2rem; gap: 0.375rem; padding: 0 0.75rem; }
[data-slot="button"][data-size="lg"] { height: 2.5rem; padding: 0 1.5rem; }
[data-slot="button"][data-size="icon"] { width: 2.25rem; height: 2.25rem; padding: 0; }
[data-slot="button"]:disabled, [data-slot="button"][aria-disabled="true"] { opacity: .5; pointer-events: none; }

/* Form controls */
[data-slot="label"] { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; font-weight: 500; line-height: 1; user-select: none; }
[data-slot="input"], [data-slot="select"], [data-slot="textarea"] {
  width: 100%; min-width: 0; border: 1px solid var(--input); border-radius: calc(var(--radius) - 2px);
  background: transparent; color: var(--foreground); font: inherit; font-size: 0.875rem;
  box-shadow: var(--shadow-xs); outline: none; transition: border-color .15s, box-shadow .15s;
}
[data-slot="input"], [data-slot="select"] { height: 2.25rem; padding: 0.25rem 0.75rem; }
[data-slot="textarea"] { min-height: 4rem; padding: 0.5rem 0.75rem; resize: vertical; }
[data-slot="select"] {
  appearance: none; padding-right: 2rem;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 0.5rem center;
}
[data-slot="input"]::placeholder, [data-slot="textarea"]::placeholder { color: var(--muted-foreground); }
[data-slot="input"]:focus-visible, [data-slot="select"]:focus-visible, [data-slot="textarea"]:focus-visible {
  border-color: var(--ring); box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent);
}
[data-slot="input"][aria-invalid="true"], [data-slot="textarea"][aria-invalid="true"] { border-color: var(--destructive); }
[data-slot="checkbox"], [data-slot="radio-group-item"] { width: 1rem; height: 1rem; accent-color: var(--primary); margin: 0; }
[data-slot="switch"] {
  display: inline-flex; align-items: center; width: 2rem; height: 1.15rem; padding: 1px;
  border-radius: 9999px; border: 1px solid transparent; background: var(--input); box-shadow: var(--shadow-xs); cursor: pointer;
}
[data-slot="switch"][data-state="checked"] { background: var(--primary); }
[data-slot="switch-thumb"] { display: block; width: 1rem; height: 1rem; border-radius: 9999px; background: var(--background); transition: transform .15s; }
[data-slot="switch"][data-state="checked"] [data-slot="switch-thumb"] { transform: translateX(calc(100% - 2px)); }
[data-slot="form-item"] { display: grid; gap: 0.5rem; }
[data-slot="form-description"] { color: var(--muted-foreground); font-size: 0.875rem; margin: 0; }
[data-slot="form-message"] { color: var(--destructive); font-size: 0.875rem; margin: 0; }

/* Card */
[data-slot="card"] {
  display: flex; flex-direction: column; gap: 1.5rem; padding: 1.5rem 0;
  background: var(--card); color: var(--card-foreground);
  border: 1px solid var(--border); border-radius: calc(var(--radius) + 4px); box-shadow: var(--shadow-sm);
}
[data-slot="card-header"] { display: grid; grid-auto-rows: min-content; align-items: start; gap: 0.375rem; padding: 0 1.5rem; }
[data-slot="card-header"]:has([data-slot="card-action"]) { grid-template-columns: 1fr auto; }
[data-slot="card-title"] { margin: 0; font-weight: 600; line-height: 1; font-size: 1rem; }
[data-slot="card-description"] { margin: 0; color: var(--muted-foreground); font-size: 0.875rem; }
[data-slot="card-action"] { grid-column-start: 2; grid-row: span 2 / span 2; align-self: start; justify-self: end; }
[data-slot="card-content"] { padding: 0 1.5rem; }
[data-slot="card-footer"] { display: flex; align-items: center; gap: 0.5rem; padding: 0 1.5rem; }

/* Badge */
[data-slot="badge"] {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.25rem; width: fit-content;
  white-space: nowrap; border-radius: calc(var(--radius) - 2px); border: 1px solid transparent;
  padding: 0.125rem 0.5rem; font-size: 0.75rem; font-weight: 500; line-height: 1rem;
  background: var(--primary); color: var(--primary-foreground);
}
[data-slot="badge"] svg { width: 0.75rem; height: 0.75rem; }
[data-slot="badge"][data-variant="secondary"] { background: var(--secondary); color: var(--secondary-foreground); }
[data-slot="badge"][data-variant="destructive"] { background: var(--destructive); color: #fff; }
[data-slot="badge"][data-variant="outline"] { background: transparent; color: var(--foreground); border-color: var(--border); }

/* Alert */
[data-slot="alert"] {
  position: relative; display: grid; grid-template-columns: 0 1fr; align-items: start; row-gap: 0.125rem;
  width: 100%; border: 1px solid var(--border); border-radius: var(--radius); padding: 0.75rem 1rem;
  font-size: 0.875rem; background: var(--card); color: var(--card-foreground);
}
[data-slot="alert"]:has(> svg) { grid-template-columns: 1rem 1fr; column-gap: 0.75rem; }
[data-slot="alert"] > svg { width: 1rem; height: 1rem; transform: translateY(0.125rem); }
[data-slot="alert"][data-variant="destructive"] { color: var(--destructive); }
[data-slot="alert-title"] { grid-column-start: 2; min-height: 1rem; font-weight: 500; letter-spacing: -0.01em; }
[data-slot="alert-description"] { grid-column-start: 2; display: grid; gap: 0.25rem; color: var(--muted-foreground); }

/* Tabs */
[data-slot="tabs"] { display: flex; flex-direction: column; gap: 0.5rem; }
[data-slot="tabs-list"] {
  display: inline-flex; align-items: center; justify-content: center; width: fit-content; height: 2.25rem;
  padding: 3px; border-radius: var(--radius); background: var(--muted); color: var(--muted-foreground);
}
[data-slot="tabs-trigger"] {
  display: inline-flex; flex: 1; align-items: center; justify-content: center; gap: 0.375rem;
  height: calc(100% - 1px); padding: 0.25rem 0.5rem; border: 1px solid transparent;
  border-radius: calc(var(--radius) - 2px); background: transparent; color: inherit;
  font: inherit; font-size: 0.875rem; font-weight: 500; white-space: nowrap; cursor: pointer; text-decoration: none;
}
[data-slot="tabs-trigger"][data-state="active"], [data-slot="tabs-trigger"][aria-selected="true"] {
  background: var(--background); color: var(--foreground); box-shadow: var(--shadow-sm);
}
[data-slot="tabs-content"] { flex: 1; outline: none; }

/* Table */
[data-slot="table-container"] { position: relative; width: 100%; overflow-x: auto; }
[data-slot="table"] { width: 100%; caption-side: bottom; border-collapse: collapse; font-size: 0.875rem; }
[data-slot="table-header"] [data-slot="table-row"] { border-bottom: 1px solid var(--border); }
[data-slot="table-row"] { border-bottom: 1px solid var(--border); transition: background-color .15s; }
[data-slot="table-body"] [data-slot="table-row"]:last-child { border-bottom: 0; }
[data-slot="table-body"] [data-slot="table-row"]:hover { background: color-mix(in oklab, var(--muted) 50%, transparent); }
[data-slot="table-row"][data-state="selected"] { background: var(--muted); }
[data-slot="table-head"] { height: 2.5rem; padding: 0 0.5rem; text-align: left; vertical-align: middle; font-weight: 500; white-space: nowrap; color: var(--foreground); }
[data-slot="table-cell"] { padding: 0.5rem; vertical-align: middle; white-space: nowrap; }
[data-slot="table-footer"] { background: color-mix(in oklab, var(--muted) 50%, transparent); font-weight: 500; border-top: 1px solid var(--border); }
[data-slot="table-caption"] { margin-top: 1rem; color: var(--muted-foreground); font-size: 0.875rem; }

/* Separator, Avatar, Progress, Skeleton */
[data-slot="separator"] { flex-shrink: 0; background: var(--border); border: 0; margin: 0; height: 1px; width: 100%; }
[data-slot="separator"][data-orientation="vertical"] { height: auto; width: 1px; align-self: stretch; }
[data-slot="avatar"] { position: relative; display: flex; width: 2rem; height: 2rem; flex-shrink: 0; overflow: hidden; border-radius: 9999px; }
[data-slot="avatar-image"] { width: 100%; height: 100%; aspect-ratio: 1; object-fit: cover; }
[data-slot="avatar-fallback"] { display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; border-radius: 9999px; background: var(--muted); font-size: 0.75rem; font-weight: 500; }
[data-slot="progress"] { position: relative; height: 0.5rem; width: 100%; overflow: hidden; border-radius: 9999px; background: color-mix(in oklab, var(--primary) 20%, transparent); }
[data-slot="progress-indicator"] { height: 100%; background: var(--primary); }
[data-slot="skeleton"] { border-radius: calc(var(--radius) - 2px); background: var(--accent); }

/* Breadcrumb */
[data-slot="breadcrumb-list"] { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem; margin: 0; padding: 0; list-style: none; font-size: 0.875rem; color: var(--muted-foreground); }
[data-slot="breadcrumb-item"] { display: inline-flex; align-items: center; gap: 0.375rem; }
[data-slot="breadcrumb-link"] { color: inherit; text-decoration: none; }
[data-slot="breadcrumb-link"]:hover { color: var(--foreground); }
[data-slot="breadcrumb-page"] { color: var(--foreground); font-weight: 400; }

/* Overlays shown statically */
[data-slot="dialog-overlay"], [data-slot="sheet-overlay"] { position: fixed; inset: 0; background: rgb(0 0 0 / 0.5); }
[data-slot="dialog-content"] {
  display: grid; gap: 1rem; width: 100%; max-width: 32rem; padding: 1.5rem; margin: 0 auto;
  background: var(--background); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg);
}
[data-slot="dialog-header"], [data-slot="sheet-header"] { display: flex; flex-direction: column; gap: 0.5rem; }
[data-slot="dialog-footer"], [data-slot="sheet-footer"] { display: flex; justify-content: flex-end; gap: 0.5rem; }
[data-slot="dialog-title"], [data-slot="sheet-title"] { margin: 0; font-size: 1.125rem; font-weight: 600; line-height: 1; }
[data-slot="dialog-description"], [data-slot="sheet-description"] { margin: 0; color: var(--muted-foreground); font-size: 0.875rem; }
[data-slot="sheet-content"] { display: flex; flex-direction: column; gap: 1rem; padding: 1.5rem; background: var(--background); box-shadow: var(--shadow-lg); }
[data-slot="popover-content"], [data-slot="dropdown-menu-content"], [data-slot="tooltip-content"] {
  border: 1px solid var(--border); border-radius: calc(var(--radius) - 2px); background: var(--popover); color: var(--popover-foreground);
  padding: 0.25rem; box-shadow: var(--shadow-lg);
}
[data-slot="popover-content"] { padding: 1rem; width: 18rem; }
[data-slot="tooltip-content"] { background: var(--foreground); color: var(--background); padding: 0.375rem 0.75rem; font-size: 0.75rem; border: 0; }
[data-slot="dropdown-menu-item"] { display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.5rem; border-radius: calc(var(--radius) - 4px); font-size: 0.875rem; }
[data-slot="dropdown-menu-item"]:hover { background: var(--accent); color: var(--accent-foreground); }
`

/** What the model is told about the kit: the markup of each component. */
export const SHADCN_REFERENCE = `shadcn/ui (new-york). Its stylesheet is added to your document for you; build every component from this markup (the data-* attributes select the styles; do not add classes or CSS for them, and never write a component name as a class such as class="card" or class="card-header": only data-slot is styled):
- Button: <button type="button" data-slot="button" data-variant="default|secondary|outline|ghost|destructive|link" data-size="default|sm|lg|icon">Label</button>. A link that looks like a button: <a href="#" data-slot="button" data-variant="…">.
- Label + Input: <label data-slot="label" for="x">Email</label> <input data-slot="input" id="x" type="email">. Also <textarea data-slot="textarea">, <select data-slot="select">, <input type="checkbox" data-slot="checkbox">, <input type="radio" data-slot="radio-group-item">, <button role="switch" aria-checked="true" data-slot="switch" data-state="checked"><span data-slot="switch-thumb"></span></button>. Group a field as <div data-slot="form-item">label, control, <p data-slot="form-description">…</p></div>.
- Toggle group (segmented choices such as group size or time slots): <div role="radiogroup" aria-label="Group size" data-slot="toggle-group"><label data-slot="toggle-group-item" data-state="on"><input type="radio" class="sr-only" name="size" value="4" checked> 4</label>…</div>. The input inside is visually hidden; never show a bare radio or checkbox next to a button-styled label.
- Card: <div data-slot="card"><div data-slot="card-header"><h3 data-slot="card-title">…</h3><p data-slot="card-description">…</p><div data-slot="card-action">…</div></div><div data-slot="card-content">…</div><div data-slot="card-footer">…</div></div>.
- Badge: <span data-slot="badge" data-variant="default|secondary|destructive|outline">…</span>.
- Alert: <div role="alert" data-slot="alert" data-variant="default|destructive"><svg …/><div data-slot="alert-title">…</div><div data-slot="alert-description">…</div></div>.
- Tabs: <div data-slot="tabs"><div role="tablist" data-slot="tabs-list"><button role="tab" data-slot="tabs-trigger" data-state="active" aria-selected="true">…</button>…</div><div role="tabpanel" data-slot="tabs-content">…</div></div>.
- Table: <div data-slot="table-container"><table data-slot="table"><thead data-slot="table-header"><tr data-slot="table-row"><th data-slot="table-head">…</th></tr></thead><tbody data-slot="table-body"><tr data-slot="table-row"><td data-slot="table-cell">…</td></tr></tbody></table></div>.
- Also: <hr data-slot="separator">, <span data-slot="avatar"><span data-slot="avatar-fallback">AB</span></span>, <div data-slot="progress"><div data-slot="progress-indicator" style="width:60%"></div></div>, <div data-slot="skeleton">, breadcrumb (<nav aria-label="breadcrumb"><ol data-slot="breadcrumb-list"><li data-slot="breadcrumb-item"><a data-slot="breadcrumb-link">…</a></li>…<li data-slot="breadcrumb-item"><span data-slot="breadcrumb-page">…</span></li></ol></nav>), dialog/sheet/popover/dropdown-menu/tooltip content (data-slot="dialog-content", "dialog-header", "dialog-title", "dialog-description", "dialog-footer", …) shown statically.
Layout: wrap the content of EVERY top-level region (the <header> bar, each <section> or block in <main>, the <footer>) in <div data-layout="container">, which centres it at max 1200px with consistent side padding, so every region lines up on the same left and right edges. Put your own grids/flex rows inside the container. .sr-only hides an element visually but keeps it for screen readers.
Tokens (CSS variables): --background, --foreground, --card, --primary, --primary-foreground, --primary-text (the primary color darkened enough to be readable as text on white), --secondary, --muted, --muted-foreground, --accent, --destructive, --border, --input, --ring, --radius.`
