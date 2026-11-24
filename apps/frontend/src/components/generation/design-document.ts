/**
 * Prepares a generated design for an `<iframe srcdoc>` preview.
 *
 * A srcdoc document resolves links against the *parent page's* URL, so a
 * design's `<a href="#">` points at the app itself and clicking it loaded the
 * app inside the preview. Here every link stays inside the design:
 * - `<base href="about:srcdoc">` makes `#section` links scroll the design;
 * - any other link (a page path, an external site) becomes `#`, with the
 *   original kept in `data-href` for the code view and the AI.
 * Forms cannot submit and popups cannot open: the iframe sandbox blocks them.
 */
export function designDocument(html: string): string {
  if (typeof DOMParser === "undefined" || !html) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.querySelectorAll("base").forEach((base) => base.remove());
  const base = doc.createElement("base");
  base.setAttribute("href", "about:srcdoc");
  doc.head.prepend(base);

  doc.querySelectorAll("a[href], area[href]").forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    if (!href.startsWith("#")) {
      link.setAttribute("data-href", href);
      link.setAttribute("href", "#");
    }
    link.removeAttribute("target");
  });

  // Designs saved before the server quoted them: `<rect rx=2/>` was parsed as
  // rx="2/", which breaks SVG geometry. No SVG number or keyword ends in "/".
  // The unclosed tag also swallowed the shapes after it, and SVG does not draw
  // a shape's children, so they are moved back after it.
  doc.querySelectorAll("svg, svg *").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (!/href$/i.test(attr.name) && /^[\w.#%-]+\/$/.test(attr.value)) {
        el.setAttribute(attr.name, attr.value.slice(0, -1));
      }
    }
  });
  const shapes = "rect, circle, ellipse, line, path, polyline, polygon";
  doc.querySelectorAll("svg").forEach((svg) => {
    // Deepest first, so nested chains unwind in document order.
    Array.from(svg.querySelectorAll(shapes))
      .reverse()
      .forEach((shape) => {
        const kids = Array.from(shape.children).filter((kid) => kid.matches(shapes));
        if (kids.length) shape.after(...kids);
      });
  });

  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

/** An element's HTML with the links `designDocument` neutralized restored. */
export function originalHtml(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  const links = [clone, ...Array.from(clone.querySelectorAll("[data-href]"))];
  for (const link of links) {
    const href = link.getAttribute("data-href");
    if (href !== null) {
      link.setAttribute("href", href);
      link.removeAttribute("data-href");
    }
  }
  return clone.outerHTML;
}
