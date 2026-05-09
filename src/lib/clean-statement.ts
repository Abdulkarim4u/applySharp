/**
 * Strip AI tells and markdown from generated statement text.
 *
 * Used as a safety net after Claude output and before the user sees / copies
 * the statement. NHS application forms (Trac, NHS Jobs, JobTrain) accept only
 * plain text — markdown formatting renders literally there.
 *
 * IMPORTANT: only run on raw model output. Don't run on user edits — if the
 * applicant chooses to write an em-dash, leave it alone.
 */
export function cleanStatementText(text: string): string {
  let s = text;

  // Markdown bold/italic — strip wrappers, keep content.
  s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, "$1"); // ***x***
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "$1"); // **x**
  s = s.replace(/__([^_\n]+)__/g, "$1"); // __x__
  s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1"); // *x*

  // Markdown ATX headings (#, ##, ###) — strip the # markers, keep the heading text.
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");

  // Markdown horizontal rules (--- or ***).
  s = s.replace(/^\s*[-*_]{3,}\s*$/gm, "");

  // Em-dashes and en-dashes — replace with comma + space (most natural fit
  // for the parenthetical-insertion pattern Claude likes to use).
  s = s.replace(/\s*—\s*/g, ", ");
  s = s.replace(/\s*–\s*/g, ", ");

  // Double-hyphens used as em-dash substitutes ("--") → comma + space.
  s = s.replace(/\s--\s/g, ", ");

  // Semicolons in prose → full stop, capitalise next word.
  // Skip semicolons followed by a digit (e.g. "page 5; 2024") and inside lists.
  s = s.replace(/;\s+([a-z])/g, (_, letter) => `. ${letter.toUpperCase()}`);

  // Tidy: collapse repeated commas, repeated full stops, stray spaces.
  s = s.replace(/,\s*,/g, ",");
  s = s.replace(/\.\s*\./g, ".");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]{2,}/g, " ");
  s = s.replace(/\s+([,.;:])/g, "$1");

  return s.trim();
}
