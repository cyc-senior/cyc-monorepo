import type { GenerationJob, UIVariant } from "@/lib/generation-client";

/** One saved design in an A/B line: "A v1", "A v2", … */
export interface DesignVersion {
  variant: UIVariant;
  label: string;
  /** 1 for the first build, +1 for every refinement or restore. */
  number: number;
  isCurrent: boolean;
}

export type VersionsByLabel = Record<string, DesignVersion[]>;

/**
 * Groups a round's variants into A/B version lines. A variant's version is its
 * depth in the refinement lineage (`parentVariantId`); the newest version of a
 * line is the current one. Archived variants are left out.
 */
export function buildVersions(variants: UIVariant[]): VersionsByLabel {
  const byId = new Map(variants.map((v) => [v.id, v]));
  const depth = (variant: UIVariant): number => {
    let n = 1;
    let parent = variant.parentVariantId && byId.get(variant.parentVariantId);
    const seen = new Set([variant.id]);
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id);
      n++;
      parent = parent.parentVariantId ? byId.get(parent.parentVariantId) : undefined;
    }
    return n;
  };

  const lines: VersionsByLabel = {};
  for (const variant of variants) {
    if (variant.status === "ARCHIVED" || !variant.html) continue;
    const label = variant.label ?? "A";
    (lines[label] ??= []).push({
      variant,
      label,
      number: depth(variant),
      isCurrent: false,
    });
  }
  for (const line of Object.values(lines)) {
    line.sort(
      (a, b) =>
        a.number - b.number ||
        a.variant.createdAt.localeCompare(b.variant.createdAt)
    );
    line[line.length - 1].isCurrent = true;
  }
  return lines;
}

export function versionName(version: DesignVersion): string {
  return `${version.label} v${version.number}`;
}

export function findVersion(
  lines: VersionsByLabel,
  variantId: string | null | undefined
): DesignVersion | undefined {
  if (!variantId) return undefined;
  for (const line of Object.values(lines)) {
    const found = line.find((v) => v.variant.id === variantId);
    if (found) return found;
  }
  return undefined;
}

const ELEMENT_MARK = "\n\n---\nSelected element (";
const BATCH_MARK = "\n\n---\nPinned element edits (";

/** The element a refinement is about, as sent to the model. */
export interface PickedElement {
  /** Short kind shown in the chip, e.g. "button". */
  kind: string;
  /** Readable name, e.g. "Book room". */
  name: string;
  html: string;
}

/** One pinned element comment queued to be sent in a batch refinement. */
export interface PinnedComment {
  id: string;
  element: PickedElement;
  comment: string;
}

/** Adds the picked element to the prompt so the model changes that part. */
export function encodeRefinePrompt(text: string, element: PickedElement | null): string {
  if (!element) return text;
  return `${text}${ELEMENT_MARK}${element.kind}): change only this element unless asked otherwise.\n${element.html}`;
}

/** Encodes a batch of pinned element comments (plus optional overall note) for the LLM. */
export function encodeBatchRefinePrompt(
  text: string,
  element: PickedElement | null,
  pins: PinnedComment[]
): string {
  if (pins.length === 0) {
    return encodeRefinePrompt(text, element);
  }
  const header = text.trim() || `Apply ${pins.length} pinned element edit${pins.length === 1 ? "" : "s"}.`;
  const blocks = pins.map(
    (p, idx) =>
      `${idx + 1}. [${p.element.kind} "${p.element.name}"] ${p.comment}\nElement HTML:\n${p.element.html}`
  );
  return `${header}${BATCH_MARK}${pins.length}): apply every listed change and keep all other parts unchanged.\n${blocks.join("\n\n")}`;
}

/** Splits a stored refinement prompt back into what the designer typed. */
export function decodeRefinePrompt(prompt: string): { text: string; elementKind?: string } {
  const batchAt = prompt.indexOf(BATCH_MARK);
  if (batchAt !== -1) {
    const header = prompt.slice(0, batchAt).trim();
    const rest = prompt.slice(batchAt);
    const items = [...rest.matchAll(/^\d+\.\s+\[([^\]]+)\]\s+(.+)$/gm)].map(
      (m) => `• [${m[1]}] ${m[2]}`
    );
    const count = items.length;
    return {
      text: items.length > 0 ? `${header}\n${items.join("\n")}` : header,
      elementKind: count > 0 ? `${count} pinned edit${count === 1 ? "" : "s"}` : undefined,
    };
  }
  const at = prompt.indexOf(ELEMENT_MARK);
  if (at === -1) return { text: prompt };
  const rest = prompt.slice(at + ELEMENT_MARK.length);
  return { text: prompt.slice(0, at), elementKind: rest.slice(0, rest.indexOf(")")) };
}

/** What the first build or a refinement did, for the version list. */
export function versionSummary(version: DesignVersion, jobs: GenerationJob[]): string {
  const job = jobs.find((j) => j.id === version.variant.generationJobId);
  if (!job) return version.number === 1 ? "First build" : "Restored version";
  if (!job.baseVariantId) return "First build from the structured prompt";
  return decodeRefinePrompt(job.prompt ?? "").text || "Refinement";
}

export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}
