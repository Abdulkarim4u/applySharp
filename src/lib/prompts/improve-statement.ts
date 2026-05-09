export const IMPROVE_STATEMENT_SYSTEM = `You are revising an NHS supporting statement based on specific shortlister feedback.

Apply ONLY the fixes listed by the shortlister. Do NOT rewrite the whole statement. Do NOT change parts that the shortlister did not flag. Preserve the writer's voice, examples, structure and overall length.

REVISION RULES:
- Make the SMALLEST possible changes to address each fix.
- Keep all good parts of the statement intact, including specific examples and STAR stories.
- Where a fix says "add a sentence about X", insert that sentence in the most natural place.
- Where a fix says "strengthen X with a specific example", add ONE concise example. Do not bloat.
- Where a fix says "name the Trust earlier", weave a single reference into the body.
- Do not invent new biography (employers, dates, qualifications) the original statement didn't already contain. Only build on what's there.

VOICE RULES (same as the original generation prompt — these are AI tells):
- British English: behaviour, organisation, recognise, programme, whilst.
- First person "I". Do not write "we" when describing personal action.
- NEVER use em-dashes (—). Use commas, full stops or parentheses.
- NEVER use semicolons in body prose. Use full stops or "and".
- No banned phrases: "passionate about", "leverage", "robust", "delve", "wealth of experience", "proven track record", "team player".
- Vary sentence length. Short sentences are good.

FORMAT:
- Plain text only. NO markdown asterisks, no headings with #, no bullet markers.
- For section headings (when present in the original): keep them as plain Title Case lines, no asterisks.

LENGTH RULE (CRITICAL — NHS forms have a 1,500-word limit):
- You will be told the original word count. Stay within +50 of it.
- HARD MAXIMUM: 1,300 words. Never exceed this.
- If the fixes add new content, trim or condense existing repetitive or generic parts to stay within the budget.
- A focused, shorter statement scores better than a longer one with padding. Cut filler, don't add it.

Return ONLY the revised statement text. No preamble, no commentary, no explanation of what you changed.`;

export function buildImproveUser(input: {
  currentStatement: string;
  fixes: Array<{
    title: string;
    suggestion: string;
    userInput?: string;
  }>;
  jobTitle: string;
  organisation: string | null;
  currentWordCount: number;
}): string {
  const fixList = input.fixes
    .map((f, i) => {
      const base = `${i + 1}. ${f.title}\n   Guidance: ${f.suggestion}`;
      if (f.userInput && f.userInput.trim()) {
        return `${base}\n   USER-PROVIDED DETAIL (use these exact facts, do not invent or paraphrase numbers/names/dates): ${f.userInput.trim()}`;
      }
      return base;
    })
    .join("\n\n");

  const targetMax = Math.min(input.currentWordCount + 50, 1300);

  return `Revise this NHS supporting statement to address the shortlister's specific fixes.

<role>${input.jobTitle}</role>
<trust>${input.organisation ?? "Not specified"}</trust>

<word_budget>
Current statement: ${input.currentWordCount} words.
Your revision must stay between ${Math.max(800, input.currentWordCount - 100)} and ${targetMax} words.
HARD CAP: 1,300 words.
If the fixes need new content, condense existing repetitive or generic parts to stay within budget.
</word_budget>

<fixes_to_apply>
${fixList}
</fixes_to_apply>

CRITICAL: Where a fix has "USER-PROVIDED DETAIL", you MUST weave those exact facts (numbers, names, dates) into the relevant section verbatim. The user has personally provided these and they are correct. Do not change or paraphrase them. Phrase them naturally in your prose.

<current_statement>
${input.currentStatement}
</current_statement>

Return the revised statement only.`;
}
