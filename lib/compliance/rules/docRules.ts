// Reusable Google Docs rule templates (some with a quick fix the admin can apply after confirming).
// Each function takes SETTINGS and returns a rule. No sample values live here:
// rule sets (see ../ruleSets) decide the actual settings.
import type { DocModel, DocParagraph, DocRun } from "../docModel";
import type { Rule } from "../types";

/** Lower-case and collapse spaces, so "  Learning  objectives " matches "Learning Objectives". */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const quote = (s: string, max = 30) => `“${s.trim().slice(0, max)}${s.trim().length > max ? "…" : ""}”`;
const list = (items: string[]) => items.map((i) => `“${i}”`).join(", ");

/** The document title must start with one of the given prefixes. */
export function titleStartsWith(opts: { prefixes: string[]; example: string; suggestPrefix?: string }): Rule<DocModel> {
  const prefix = opts.suggestPrefix ?? opts.prefixes[0];
  return {
    id: "doc-title",
    name: "Document title",
    checked: `Title starts with ${opts.prefixes.map((p) => `“${p}”`).join(" or ")}`,
    run: (m) => {
      const ok = opts.prefixes.some((p) => norm(m.title).startsWith(norm(p)));
      return ok
        ? { status: "pass" }
        : {
            status: "warning",
            issue: `The title ${quote(m.title, 60)} does not start with ${opts.prefixes.map((p) => `“${p}”`).join(" or ")}.`,
            suggestion: `Rename the file (File → Rename in Google Docs), e.g. “${opts.example}”.`,
          };
    },
    fix: {
      label: "Rename file",
      describe: () => "Renames the file in Google Drive. Edit the suggested name if needed.",
      input: { label: "New file name", suggest: (m) => `${prefix} – ${m.title}`.slice(0, 200) },
      plan: (_m, input) => (input?.trim() ? { type: "rename", name: input.trim() } : null),
    },
  };
}

/** Each listed heading must exist (any heading level). */
export function requiredHeadings(opts: { headings: string[] }): Rule<DocModel> {
  return {
    id: "doc-required-headings",
    name: "Required headings",
    checked: `Headings present: ${list(opts.headings)}`,
    run: (m) => {
      const found = new Set(m.headings.map((h) => norm(h.text)));
      const missing = opts.headings.filter((h) => !found.has(norm(h)));
      if (!missing.length) return { status: "pass" };

      // Helpful hint: the text exists but isn't styled as a heading
      const asPlainText = missing.filter((h) => m.paragraphs.some((p) => !p.headingLevel && norm(p.text) === norm(h)));
      return {
        status: "warning",
        issue: `Missing heading(s): ${list(missing)}.` +
          (asPlainText.length ? ` ${list(asPlainText)} exists as normal text, not as a heading.` : ""),
        suggestion: "Add each missing heading on its own line and set its style to “Heading 1” (Format → Paragraph styles, or the “Normal text” dropdown in the toolbar).",
      };
    },
    fix: {
      label: "Fix headings",
      describe: (m) => {
        const { convert, append } = headingFix(m, opts.headings);
        const parts: string[] = [];
        if (convert.length) parts.push(`Turns ${list(convert.map((p) => p.text))} into Heading 1.`);
        if (append.length) parts.push(`Adds ${list(append)} as Heading 1 at the END of the document — move them to the right place afterwards.`);
        return parts.join(" ");
      },
      plan: (m) => {
        const { convert, append } = headingFix(m, opts.headings);
        const requests: object[] = convert
          .filter((p) => p.startIndex !== undefined && p.endIndex !== undefined)
          .map((p) => headingStyle(p.startIndex!, p.endIndex!));
        if (append.length) {
          // Insert "\nHeading" for each missing heading just before the document's final line break
          const at = Math.max(1, m.endIndex - 1);
          requests.push({ insertText: { location: { index: at }, text: append.map((h) => `\n${h}`).join("") } });
          let pos = at;
          for (const h of append) { pos += 1; requests.push(headingStyle(pos, pos + h.length)); pos += h.length; }
        }
        return requests.length ? { type: "docs", requests } : null;
      },
    },
  };
}

/** Which missing headings exist as normal text (convert them) and which are completely missing (append them). */
function headingFix(m: DocModel, headings: string[]) {
  const found = new Set(m.headings.map((h) => norm(h.text)));
  const missing = headings.filter((h) => !found.has(norm(h)));
  const convert: DocParagraph[] = [];
  const append: string[] = [];
  for (const h of missing) {
    const p = m.paragraphs.find((x) => !x.headingLevel && norm(x.text) === norm(h));
    if (p) convert.push(p); else append.push(h);
  }
  return { convert, append };
}

const headingStyle = (startIndex: number, endIndex: number) => ({
  updateParagraphStyle: { range: { startIndex, endIndex }, paragraphStyle: { namedStyleType: "HEADING_1" }, fields: "namedStyleType" },
});

/** Requests that change the given text runs' style. */
const styleRuns = (runs: DocRun[], textStyle: object, fields: string) =>
  runs
    .filter((r) => r.startIndex !== undefined && r.endIndex !== undefined)
    .map((r) => ({ updateTextStyle: { range: { startIndex: r.startIndex, endIndex: r.endIndex }, textStyle, fields } }));

/** Each listed heading must have at least `minWords` words of text under it. */
export function sectionsHaveContent(opts: { headings: string[]; minWords: number }): Rule<DocModel> {
  return {
    id: "doc-section-content",
    name: "Section content",
    checked: `At least ${opts.minWords} words under: ${list(opts.headings)}`,
    run: (m) => {
      const problems: string[] = [];
      for (const h of opts.headings) {
        const section = m.sections.find((s) => norm(s.heading) === norm(h));
        if (!section) continue; // a missing heading is reported by requiredHeadings
        if (section.wordCount < opts.minWords)
          problems.push(`“${h}” has ${section.wordCount === 0 ? "no text" : `only ${section.wordCount} word(s)`}`);
      }
      return problems.length
        ? {
            status: "warning",
            issue: `${problems.join("; ")}.`,
            suggestion: `Write at least ${opts.minWords} words under each of these headings, as normal text (not as a heading).`,
          }
        : { status: "pass" };
    },
  };
}

/** All body (Normal text) text must use the given font. Headings and title are not checked. */
export function bodyFont(opts: { font: string }): Rule<DocModel> {
  return {
    id: "doc-body-font",
    name: "Body font",
    checked: `Normal text uses ${opts.font}`,
    run: (m) => {
      const wrong = m.bodyRuns.filter((r) => norm(r.font) !== norm(opts.font));
      if (!wrong.length) return { status: "pass" };
      return {
        status: "warning",
        issue: `${wrong.length} piece(s) of text use another font: ${describe(wrong, (r) => r.font)}.`,
        suggestion: `Select the text and change the font to ${opts.font}. Tip: select all (Cmd + A) and set ${opts.font}, then re-style headings if needed.`,
      };
    },
    fix: {
      label: `Change to ${opts.font}`,
      describe: (m) => `Changes ${m.bodyRuns.filter((r) => norm(r.font) !== norm(opts.font)).length} piece(s) of normal text to ${opts.font}. Headings are not changed.`,
      plan: (m) => {
        const requests = styleRuns(m.bodyRuns.filter((r) => norm(r.font) !== norm(opts.font)),
          { weightedFontFamily: { fontFamily: opts.font } }, "weightedFontFamily");
        return requests.length ? { type: "docs", requests } : null;
      },
    },
  };
}

/** All body (Normal text) text must use the given size in points. Headings and title are not checked. */
export function bodyFontSize(opts: { size: number }): Rule<DocModel> {
  return {
    id: "doc-body-size",
    name: "Body font size",
    checked: `Normal text is ${opts.size} pt`,
    run: (m) => {
      const wrong = m.bodyRuns.filter((r) => r.size !== opts.size);
      if (!wrong.length) return { status: "pass" };
      return {
        status: "warning",
        issue: `${wrong.length} piece(s) of text are not ${opts.size} pt: ${describe(wrong, (r) => `${r.size} pt`)}.`,
        suggestion: `Select the text and set the font size to ${opts.size}.`,
      };
    },
    fix: {
      label: `Set to ${opts.size} pt`,
      describe: (m) => `Sets ${m.bodyRuns.filter((r) => r.size !== opts.size).length} piece(s) of normal text to ${opts.size} pt. Headings are not changed.`,
      plan: (m) => {
        const requests = styleRuns(m.bodyRuns.filter((r) => r.size !== opts.size),
          { fontSize: { magnitude: opts.size, unit: "PT" } }, "fontSize");
        return requests.length ? { type: "docs", requests } : null;
      },
    },
  };
}

/** e.g. “Count to 20…” (Comic Sans MS), “Draw a…” (Times New Roman) and 2 more */
function describe(runs: DocRun[], label: (r: DocRun) => string) {
  const shown = runs.slice(0, 3).map((r) => `${quote(r.text, 25)} (${label(r)})`).join(", ");
  return runs.length > 3 ? `${shown} and ${runs.length - 3} more` : shown;
}
