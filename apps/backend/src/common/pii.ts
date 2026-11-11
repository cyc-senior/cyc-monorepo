// Free text from participants can contain contact details they typed in. They
// are removed before text is sent to an external AI service (PDPA data
// minimisation). This is best effort pattern matching, not anonymisation.
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
// 8+ digits with optional separators / country code: phone and national id numbers.
const LONG_NUMBER = /(?:\+?\d[\s().-]?){8,}\d/g
const URL = /\bhttps?:\/\/\S+/gi

/** Replaces emails, phone/ID-like numbers and URLs with placeholders. */
export function redactPii(text: string): string {
  return text
    .replace(EMAIL, '[email]')
    .replace(URL, '[link]')
    .replace(LONG_NUMBER, '[number]')
}
