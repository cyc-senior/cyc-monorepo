/**
 * MUI (Material UI, default theme) as plain CSS for static HTML designs.
 *
 * Components are selected by MUI's own class names (`MuiButton-root
 * MuiButton-contained`, `MuiCard-root`, …), the same ones MUI renders, so a
 * design built from this markup maps 1:1 onto @mui/material components.
 */
export const MUI_FONT =
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap'

const ELEVATION = {
  1: '0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12)',
  2: '0px 3px 1px -2px rgba(0,0,0,0.2),0px 2px 2px 0px rgba(0,0,0,0.14),0px 1px 5px 0px rgba(0,0,0,0.12)',
  4: '0px 2px 4px -1px rgba(0,0,0,0.2),0px 4px 5px 0px rgba(0,0,0,0.14),0px 1px 10px 0px rgba(0,0,0,0.12)',
  8: '0px 5px 5px -3px rgba(0,0,0,0.2),0px 8px 10px 1px rgba(0,0,0,0.14),0px 3px 14px 2px rgba(0,0,0,0.12)',
  24: '0px 11px 15px -7px rgba(0,0,0,0.2),0px 24px 38px 3px rgba(0,0,0,0.14),0px 9px 46px 8px rgba(0,0,0,0.12)',
}

export const MUI_CSS = `
:root {
  --mui-text-primary: rgba(0,0,0,0.87);
  --mui-text-secondary: rgba(0,0,0,0.6);
  --mui-text-disabled: rgba(0,0,0,0.38);
  --mui-divider: rgba(0,0,0,0.12);
  --mui-background: #ffffff;
  --mui-background-default: #fafafa;
  --mui-error: #d32f2f;
  --mui-success: #2e7d32;
  --mui-warning: #ed6c02;
  --mui-info: #0288d1;
}
*, ::before, ::after { box-sizing: border-box; }
body {
  margin: 0; background: var(--mui-background-default); color: var(--mui-text-primary);
  font-family: "Roboto", "Helvetica", "Arial", sans-serif; font-size: 1rem; line-height: 1.5; letter-spacing: 0.00938em;
  -webkit-font-smoothing: antialiased;
}

/* Layout primitives (also accepts MuiContainer-root) */
[data-layout="container"] { width: 100%; max-width: 1200px; margin-inline: auto; padding-inline: 24px; }
@media (max-width: 600px) { [data-layout="container"] { padding-inline: 16px; } }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.MuiToggleButtonGroup-root { display: inline-flex; flex-wrap: wrap; border-radius: 4px; }
.MuiToggleButton-root {
  display: inline-flex; align-items: center; justify-content: center; padding: 11px; min-width: 48px; cursor: pointer;
  border: 1px solid rgba(0,0,0,0.12); background: transparent; color: rgba(0,0,0,0.54);
  font-family: inherit; font-weight: 500; font-size: 0.875rem; line-height: 1.75; text-transform: uppercase;
}
.MuiToggleButton-root + .MuiToggleButton-root { margin-left: -1px; }
.MuiToggleButton-root.Mui-selected, .MuiToggleButton-root:has(input:checked) { background: color-mix(in srgb, var(--mui-primary) 12%, transparent); color: var(--mui-primary-text); }

/* Typography */
.MuiTypography-root { margin: 0; }
.MuiTypography-h1 { font-weight: 300; font-size: 6rem; line-height: 1.167; letter-spacing: -0.01562em; }
.MuiTypography-h2 { font-weight: 300; font-size: 3.75rem; line-height: 1.2; letter-spacing: -0.00833em; }
.MuiTypography-h3 { font-weight: 400; font-size: 3rem; line-height: 1.167; }
.MuiTypography-h4 { font-weight: 400; font-size: 2.125rem; line-height: 1.235; letter-spacing: 0.00735em; }
.MuiTypography-h5 { font-weight: 400; font-size: 1.5rem; line-height: 1.334; }
.MuiTypography-h6 { font-weight: 500; font-size: 1.25rem; line-height: 1.6; letter-spacing: 0.0075em; }
.MuiTypography-subtitle1 { font-weight: 400; font-size: 1rem; line-height: 1.75; letter-spacing: 0.00938em; }
.MuiTypography-subtitle2 { font-weight: 500; font-size: 0.875rem; line-height: 1.57; letter-spacing: 0.00714em; }
.MuiTypography-body1 { font-weight: 400; font-size: 1rem; line-height: 1.5; letter-spacing: 0.00938em; }
.MuiTypography-body2 { font-weight: 400; font-size: 0.875rem; line-height: 1.43; letter-spacing: 0.01071em; }
.MuiTypography-caption { font-weight: 400; font-size: 0.75rem; line-height: 1.66; letter-spacing: 0.03333em; }
.MuiTypography-overline { font-weight: 400; font-size: 0.75rem; line-height: 2.66; letter-spacing: 0.08333em; text-transform: uppercase; }
.MuiTypography-colorTextSecondary, .MuiTypography-root.text-secondary { color: var(--mui-text-secondary); }

/* Button */
.MuiButton-root {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; position: relative;
  min-width: 64px; padding: 6px 16px; border: 0; border-radius: 4px; cursor: pointer; text-decoration: none;
  font-family: inherit; font-weight: 500; font-size: 0.875rem; line-height: 1.75; letter-spacing: 0.02857em; text-transform: uppercase;
  background: transparent; color: var(--mui-primary-text);
  transition: background-color 250ms cubic-bezier(0.4,0,0.2,1), box-shadow 250ms cubic-bezier(0.4,0,0.2,1);
}
.MuiButton-root svg { width: 20px; height: 20px; }
.MuiButton-text { padding: 6px 8px; }
.MuiButton-text:hover, .MuiButton-outlined:hover { background: color-mix(in srgb, var(--mui-primary) 4%, transparent); }
.MuiButton-contained { background: var(--mui-primary); color: var(--mui-primary-contrast); box-shadow: ${ELEVATION[2]}; }
.MuiButton-contained:hover { background: color-mix(in srgb, var(--mui-primary) 85%, #000); box-shadow: ${ELEVATION[4]}; }
.MuiButton-outlined { padding: 5px 15px; border: 1px solid color-mix(in srgb, var(--mui-primary) 50%, transparent); }
.MuiButton-colorSecondary { color: var(--mui-secondary-text); }
.MuiButton-contained.MuiButton-colorSecondary { background: var(--mui-secondary); color: var(--mui-secondary-contrast); }
.MuiButton-outlined.MuiButton-colorSecondary { border-color: color-mix(in srgb, var(--mui-secondary) 50%, transparent); }
.MuiButton-colorError { color: var(--mui-error); }
.MuiButton-contained.MuiButton-colorError { background: var(--mui-error); color: #fff; }
.MuiButton-sizeSmall { padding: 4px 10px; font-size: 0.8125rem; }
.MuiButton-outlined.MuiButton-sizeSmall { padding: 3px 9px; }
.MuiButton-sizeLarge { padding: 8px 22px; font-size: 0.9375rem; }
.MuiButton-outlined.MuiButton-sizeLarge { padding: 7px 21px; }
.MuiButton-fullWidth { width: 100%; }
.MuiButton-root.Mui-disabled, .MuiButton-root:disabled { color: var(--mui-text-disabled); box-shadow: none; pointer-events: none; }
.MuiButton-contained.Mui-disabled, .MuiButton-contained:disabled { background: rgba(0,0,0,0.12); }
.MuiIconButton-root {
  display: inline-flex; align-items: center; justify-content: center; padding: 8px; border: 0; border-radius: 50%;
  background: transparent; color: rgba(0,0,0,0.54); cursor: pointer;
}
.MuiIconButton-root:hover { background: rgba(0,0,0,0.04); }
.MuiIconButton-root svg { width: 24px; height: 24px; }
.MuiIconButton-colorPrimary { color: var(--mui-primary-text); }

/* Surfaces */
.MuiPaper-root { background: var(--mui-background); color: var(--mui-text-primary); border-radius: 4px; }
.MuiPaper-elevation0 { box-shadow: none; }
.MuiPaper-elevation1 { box-shadow: ${ELEVATION[1]}; }
.MuiPaper-elevation2 { box-shadow: ${ELEVATION[2]}; }
.MuiPaper-elevation4 { box-shadow: ${ELEVATION[4]}; }
.MuiPaper-elevation8 { box-shadow: ${ELEVATION[8]}; }
.MuiPaper-outlined { border: 1px solid var(--mui-divider); box-shadow: none; }
.MuiCard-root { overflow: hidden; background: var(--mui-background); border-radius: 4px; box-shadow: ${ELEVATION[1]}; }
.MuiCardHeader-root { display: flex; align-items: center; gap: 16px; padding: 16px; }
.MuiCardHeader-content { flex: 1 1 auto; }
.MuiCardHeader-title { margin: 0; font-size: 1.5rem; font-weight: 400; line-height: 1.334; }
.MuiCardHeader-subheader { margin: 0; font-size: 0.875rem; color: var(--mui-text-secondary); }
.MuiCardContent-root { padding: 16px; }
.MuiCardContent-root:last-child { padding-bottom: 24px; }
.MuiCardActions-root { display: flex; align-items: center; gap: 8px; padding: 8px; }
.MuiAppBar-root {
  display: flex; flex-direction: column; width: 100%; flex-shrink: 0; box-shadow: ${ELEVATION[4]};
  background: var(--mui-primary); color: var(--mui-primary-contrast);
}
.MuiAppBar-colorDefault { background: #f5f5f5; color: var(--mui-text-primary); }
.MuiAppBar-colorSecondary { background: var(--mui-secondary); color: var(--mui-secondary-contrast); }
.MuiToolbar-root { display: flex; align-items: center; gap: 16px; min-height: 64px; padding: 0 24px; }
.MuiContainer-root { width: 100%; margin: 0 auto; padding: 0 16px; }
.MuiContainer-maxWidthLg { max-width: 1200px; }
.MuiContainer-maxWidthMd { max-width: 900px; }
.MuiContainer-maxWidthSm { max-width: 600px; }
@media (min-width: 600px) { .MuiContainer-root { padding: 0 24px; } .MuiToolbar-root { min-height: 64px; } }

/* Text fields (outlined, label kept visible above the value) */
.MuiTextField-root, .MuiFormControl-root { display: inline-flex; flex-direction: column; position: relative; min-width: 0; margin: 0; border: 0; padding: 0; vertical-align: top; }
.MuiFormControl-fullWidth { width: 100%; }
.MuiInputLabel-root {
  position: absolute; top: -8px; left: 10px; z-index: 1; padding: 0 4px; background: var(--mui-background);
  font-size: 0.75rem; line-height: 1.4375em; letter-spacing: 0.00938em; color: var(--mui-text-secondary);
}
.MuiOutlinedInput-root, .MuiInputBase-root {
  position: relative; display: inline-flex; align-items: center; width: 100%; border-radius: 4px;
  border: 1px solid rgba(0,0,0,0.23); background: var(--mui-background); color: var(--mui-text-primary);
}
.MuiOutlinedInput-root:hover { border-color: var(--mui-text-primary); }
.MuiOutlinedInput-root:focus-within { border-color: var(--mui-primary); box-shadow: inset 0 0 0 1px var(--mui-primary); }
.MuiTextField-root:focus-within .MuiInputLabel-root { color: var(--mui-primary); }
.MuiInputBase-input, .MuiOutlinedInput-input, .MuiNativeSelect-select {
  width: 100%; min-width: 0; padding: 16.5px 14px; border: 0; outline: 0; background: transparent;
  font: inherit; font-size: 1rem; color: inherit; appearance: none;
}
.MuiInputBase-sizeSmall .MuiInputBase-input, .MuiInputBase-sizeSmall .MuiOutlinedInput-input { padding: 8.5px 14px; }
.MuiInputBase-multiline { padding: 0; }
.MuiNativeSelect-select {
  padding-right: 32px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='rgba(0,0,0,0.54)'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 7px center;
}
.MuiFormHelperText-root { margin: 3px 14px 0; font-size: 0.75rem; line-height: 1.66; letter-spacing: 0.03333em; color: var(--mui-text-secondary); }
.MuiFormControl-root.Mui-error .MuiOutlinedInput-root, .MuiOutlinedInput-root.Mui-error { border-color: var(--mui-error); }
.Mui-error .MuiInputLabel-root, .MuiFormHelperText-root.Mui-error { color: var(--mui-error); }
.MuiFormControlLabel-root { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
.MuiCheckbox-input, .MuiRadio-input, .MuiSwitch-input { width: 18px; height: 18px; margin: 0 4px; accent-color: var(--mui-primary); }
.MuiFormLabel-root { font-size: 1rem; color: var(--mui-text-secondary); }

/* Chip */
.MuiChip-root {
  display: inline-flex; align-items: center; justify-content: center; height: 32px; max-width: 100%;
  border-radius: 16px; border: 0; background: rgba(0,0,0,0.08); color: var(--mui-text-primary);
  font-family: inherit; font-size: 0.8125rem; white-space: nowrap; vertical-align: middle;
}
.MuiChip-label { padding: 0 12px; overflow: hidden; text-overflow: ellipsis; }
.MuiChip-outlined { background: transparent; border: 1px solid #bdbdbd; }
.MuiChip-colorPrimary { background: var(--mui-primary); color: var(--mui-primary-contrast); }
.MuiChip-outlined.MuiChip-colorPrimary { background: transparent; color: var(--mui-primary-text); border-color: color-mix(in srgb, var(--mui-primary) 70%, transparent); }
.MuiChip-colorSecondary { background: var(--mui-secondary); color: var(--mui-secondary-contrast); }
.MuiChip-colorSuccess { background: var(--mui-success); color: #fff; }
.MuiChip-colorError { background: var(--mui-error); color: #fff; }
.MuiChip-sizeSmall { height: 24px; }
.MuiChip-sizeSmall .MuiChip-label { padding: 0 8px; }

/* Alert */
.MuiAlert-root { display: flex; padding: 6px 16px; border-radius: 4px; font-size: 0.875rem; line-height: 1.43; letter-spacing: 0.01071em; }
.MuiAlert-icon { display: flex; margin-right: 12px; padding: 7px 0; opacity: 0.9; font-size: 22px; }
.MuiAlert-icon svg { width: 22px; height: 22px; }
.MuiAlert-message { padding: 8px 0; min-width: 0; overflow: auto; }
.MuiAlert-action { display: flex; align-items: flex-start; margin-left: auto; padding: 4px 0 0 16px; margin-right: -8px; }
.MuiAlertTitle-root { margin: -2px 0 0.35em; font-weight: 500; font-size: 1rem; line-height: 1.5; }
.MuiAlert-standardSuccess { background: rgb(237,247,237); color: rgb(30,70,32); }
.MuiAlert-standardInfo { background: rgb(229,246,253); color: rgb(1,67,97); }
.MuiAlert-standardWarning { background: rgb(255,244,229); color: rgb(102,60,0); }
.MuiAlert-standardError { background: rgb(253,237,237); color: rgb(95,33,32); }
.MuiAlert-filledSuccess { background: var(--mui-success); color: #fff; }
.MuiAlert-filledError { background: var(--mui-error); color: #fff; }

/* Tabs */
.MuiTabs-root { display: flex; min-height: 48px; overflow: hidden; border-bottom: 1px solid var(--mui-divider); }
.MuiTabs-flexContainer { display: flex; }
.MuiTab-root {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 90px; max-width: 360px; min-height: 48px;
  padding: 12px 16px; border: 0; background: transparent; cursor: pointer; text-decoration: none;
  font-family: inherit; font-weight: 500; font-size: 0.875rem; line-height: 1.25; letter-spacing: 0.02857em; text-transform: uppercase;
  color: var(--mui-text-secondary);
}
.MuiTab-root.Mui-selected, .MuiTab-root[aria-selected="true"] { color: var(--mui-primary-text); box-shadow: inset 0 -2px 0 var(--mui-primary); }

/* Table */
.MuiTableContainer-root { width: 100%; overflow-x: auto; }
.MuiTable-root { width: 100%; border-collapse: collapse; border-spacing: 0; display: table; }
.MuiTableCell-root {
  display: table-cell; padding: 16px; text-align: left; vertical-align: inherit;
  border-bottom: 1px solid rgba(224,224,224,1); font-size: 0.875rem; line-height: 1.43; letter-spacing: 0.01071em;
}
.MuiTableCell-head { font-weight: 500; line-height: 1.5rem; color: var(--mui-text-primary); }
.MuiTableCell-sizeSmall { padding: 6px 16px; }
.MuiTableRow-hover:hover { background: rgba(0,0,0,0.04); }
.MuiTableRow-root.Mui-selected { background: color-mix(in srgb, var(--mui-primary) 8%, transparent); }

/* Lists, divider, avatar, progress, badges */
.MuiList-root { margin: 0; padding: 8px 0; list-style: none; position: relative; }
.MuiListItem-root { display: flex; align-items: center; gap: 16px; position: relative; padding: 8px 16px; text-align: left; }
.MuiListItemButton-root { display: flex; align-items: center; gap: 16px; width: 100%; padding: 8px 16px; border: 0; background: transparent; cursor: pointer; text-align: left; color: inherit; text-decoration: none; font: inherit; }
.MuiListItemButton-root:hover { background: rgba(0,0,0,0.04); }
.MuiListItemButton-root.Mui-selected { background: color-mix(in srgb, var(--mui-primary) 8%, transparent); }
.MuiListItemIcon-root { display: inline-flex; min-width: 40px; color: rgba(0,0,0,0.54); }
.MuiListItemText-root { flex: 1 1 auto; min-width: 0; margin: 4px 0; }
.MuiListItemText-primary { display: block; font-size: 1rem; line-height: 1.5; }
.MuiListItemText-secondary { display: block; font-size: 0.875rem; line-height: 1.43; color: var(--mui-text-secondary); }
.MuiDivider-root { margin: 0; flex-shrink: 0; border: 0; border-bottom: 1px solid var(--mui-divider); }
.MuiDivider-vertical { border-bottom: 0; border-right: 1px solid var(--mui-divider); align-self: stretch; height: auto; }
.MuiAvatar-root {
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; position: relative; overflow: hidden;
  width: 40px; height: 40px; border-radius: 50%; background: #bdbdbd; color: #fff; font-size: 1.25rem; line-height: 1;
}
.MuiAvatar-img { width: 100%; height: 100%; object-fit: cover; }
.MuiLinearProgress-root { position: relative; overflow: hidden; display: block; height: 4px; background: color-mix(in srgb, var(--mui-primary) 30%, #fff); }
.MuiLinearProgress-bar { height: 100%; background: var(--mui-primary); }
.MuiBadge-badge {
  display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 6px;
  border-radius: 10px; background: var(--mui-primary); color: var(--mui-primary-contrast); font-size: 0.75rem; font-weight: 500;
}

/* Navigation */
.MuiBottomNavigation-root { display: flex; justify-content: center; height: 56px; background: var(--mui-background); box-shadow: ${ELEVATION[8]}; }
.MuiBottomNavigationAction-root {
  flex: 1; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  max-width: 168px; padding: 6px 12px; border: 0; background: transparent; color: var(--mui-text-secondary);
  font-family: inherit; font-size: 0.75rem; text-decoration: none; cursor: pointer;
}
.MuiBottomNavigationAction-root.Mui-selected { color: var(--mui-primary); font-size: 0.875rem; }
.MuiBreadcrumbs-ol { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; padding: 0; list-style: none; color: var(--mui-text-secondary); }
.MuiLink-root { color: var(--mui-primary-text); text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--mui-primary) 40%, transparent); }

/* Overlays shown statically */
.MuiDialog-paper { margin: 32px auto; max-width: 600px; background: var(--mui-background); border-radius: 4px; box-shadow: ${ELEVATION[24]}; }
.MuiDialogTitle-root { margin: 0; padding: 16px 24px; font-size: 1.25rem; font-weight: 500; line-height: 1.6; }
.MuiDialogContent-root { padding: 20px 24px; }
.MuiDialogActions-root { display: flex; justify-content: flex-end; gap: 8px; padding: 8px; }
.MuiSnackbarContent-root {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 6px 16px; border-radius: 4px;
  background: rgb(50,50,50); color: #fff; font-size: 0.875rem; box-shadow: ${ELEVATION[8]};
}
`

/** What the model is told about the kit: the markup of each component. */
export const MUI_REFERENCE = `Material UI (MUI v6, default theme). Its stylesheet is added to your document for you; build every component from this markup (MUI's own class names select the styles; do not write CSS for these classes):
- Button: <button type="button" class="MuiButton-root MuiButton-contained|MuiButton-outlined|MuiButton-text [MuiButton-colorSecondary] [MuiButton-sizeSmall|MuiButton-sizeLarge] [MuiButton-fullWidth]">Label</button>. Icon button: <button class="MuiIconButton-root" aria-label="…"><svg …/></button>. A link that looks like a button: <a href="#" class="MuiButton-root MuiButton-…">.
- Text field: <div class="MuiFormControl-root MuiTextField-root [MuiFormControl-fullWidth]"><label class="MuiInputLabel-root" for="x">Email</label><div class="MuiOutlinedInput-root MuiInputBase-root"><input class="MuiOutlinedInput-input MuiInputBase-input" id="x" type="email"></div><p class="MuiFormHelperText-root">…</p></div>. Select: same with <select class="MuiNativeSelect-select MuiInputBase-input">. Multiline: <textarea class="MuiInputBase-input"> inside "MuiOutlinedInput-root MuiInputBase-root MuiInputBase-multiline".
- Checkbox/radio/switch: <label class="MuiFormControlLabel-root"><input type="checkbox" class="MuiCheckbox-input"> Label</label> (MuiRadio-input, MuiSwitch-input).
- Card: <div class="MuiPaper-root MuiCard-root"><div class="MuiCardHeader-root"><div class="MuiCardHeader-content"><h3 class="MuiCardHeader-title">…</h3><p class="MuiCardHeader-subheader">…</p></div></div><div class="MuiCardContent-root">…</div><div class="MuiCardActions-root">buttons</div></div>.
- Typography: <h1 class="MuiTypography-root MuiTypography-h4">, <p class="MuiTypography-root MuiTypography-body1|body2|caption">, overline, subtitle1/2.
- App bar: <header class="MuiPaper-root MuiAppBar-root [MuiAppBar-colorDefault]"><div class="MuiToolbar-root">…</div></header>. Layout container: <div class="MuiContainer-root MuiContainer-maxWidthLg">.
- Toggle buttons (segmented choices): <div role="radiogroup" aria-label="…" class="MuiToggleButtonGroup-root"><label class="MuiToggleButton-root Mui-selected"><input type="radio" class="sr-only" name="x" value="4" checked> 4</label>…</div>. Never show a bare radio or checkbox next to a button-styled label.
- Chip: <span class="MuiChip-root [MuiChip-outlined] [MuiChip-colorPrimary] [MuiChip-sizeSmall]"><span class="MuiChip-label">…</span></span>.
- Alert: <div role="alert" class="MuiPaper-root MuiAlert-root MuiAlert-standardSuccess|Info|Warning|Error"><div class="MuiAlert-icon"><svg …/></div><div class="MuiAlert-message"><div class="MuiAlertTitle-root">…</div>…</div></div>.
- Tabs: <div class="MuiTabs-root"><div role="tablist" class="MuiTabs-flexContainer"><button role="tab" class="MuiTab-root Mui-selected" aria-selected="true">…</button>…</div></div>.
- Table: <div class="MuiPaper-root MuiTableContainer-root"><table class="MuiTable-root"><thead><tr class="MuiTableRow-root"><th class="MuiTableCell-root MuiTableCell-head">…</th></tr></thead><tbody><tr class="MuiTableRow-root MuiTableRow-hover"><td class="MuiTableCell-root">…</td></tr></tbody></table></div>.
- Also: lists (MuiList-root, MuiListItem-root, MuiListItemButton-root [Mui-selected], MuiListItemIcon-root, MuiListItemText-root with MuiListItemText-primary/secondary), <hr class="MuiDivider-root">, <div class="MuiAvatar-root">AB</div>, MuiLinearProgress-root + MuiLinearProgress-bar, MuiBadge-badge, MuiBottomNavigation-root + MuiBottomNavigationAction-root (mobile), MuiBreadcrumbs-ol, MuiLink-root, dialog (MuiDialog-paper, MuiDialogTitle-root, MuiDialogContent-root, MuiDialogActions-root) and MuiSnackbarContent-root shown statically. Surfaces: MuiPaper-root + MuiPaper-elevation1|2|4|8 or MuiPaper-outlined.
Layout: wrap the content of EVERY top-level region (the app bar, each section or block in <main>, the footer) in <div class="MuiContainer-root MuiContainer-maxWidthLg"> (or <div data-layout="container">) so every region lines up on the same left and right edges. Put your own grids/flex rows inside it. .sr-only hides an element visually but keeps it for screen readers.
Tokens (CSS variables): --mui-primary, --mui-primary-contrast, --mui-primary-text (primary darkened to be readable as text on white), --mui-secondary, --mui-secondary-contrast, --mui-secondary-text, --mui-text-primary, --mui-text-secondary, --mui-divider, --mui-background, --mui-error, --mui-success.`
