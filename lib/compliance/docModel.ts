// Turns a Google Docs API response into a simple model that rules can check.
// Supported: normal paragraphs, headings and list items (as text).
// Counted but NOT checked: tables, images, tables of contents.

export type DocRun = { text: string; font: string; size: number; bold: boolean; startIndex?: number; endIndex?: number };

export type DocParagraph = {
  style: string;        // NORMAL_TEXT, TITLE, SUBTITLE, HEADING_1 ... HEADING_6
  headingLevel: number; // 0 = not a heading, 1–6 = Heading 1–6
  text: string;
  isListItem: boolean;
  runs: DocRun[];
  startIndex?: number;  // position in the document (used by quick fixes)
  endIndex?: number;
};

export type DocSection = {
  heading: string;
  level: number;
  text: string;          // all text under the heading, up to the next heading of the same or higher level
  wordCount: number;
};

export type DocModel = {
  title: string;
  revisionId?: string;   // used so a quick fix only applies to the version it was planned for
  endIndex: number;      // end of the document body (used to add missing headings)
  paragraphs: DocParagraph[];
  headings: { text: string; level: number }[];
  sections: DocSection[];
  bodyRuns: DocRun[];    // text in normal (non-heading) paragraphs
  skipped: { tables: number; images: number; tablesOfContents: number };
};

/* ---- Raw Google Docs API shapes (only the parts we use) ---- */
type GTextStyle = { fontSize?: { magnitude?: number }; weightedFontFamily?: { fontFamily?: string }; bold?: boolean };
type GElement = { startIndex?: number; endIndex?: number; textRun?: { content?: string; textStyle?: GTextStyle }; inlineObjectElement?: unknown };
type GParagraph = { paragraphStyle?: { namedStyleType?: string }; elements?: GElement[]; bullet?: unknown };
type GStructural = { startIndex?: number; endIndex?: number; paragraph?: GParagraph; table?: unknown; tableOfContents?: unknown };
export type GDoc = {
  title?: string;
  revisionId?: string;
  body?: { content?: GStructural[] };
  namedStyles?: { styles?: { namedStyleType?: string; textStyle?: GTextStyle }[] };
};

// Google's own defaults when nothing else is set
const DEFAULT_FONT = "Arial";
const DEFAULT_SIZE = 11;

export function buildDocModel(doc: GDoc): DocModel {
  const named = new Map((doc.namedStyles?.styles ?? []).map((s) => [s.namedStyleType ?? "", s.textStyle ?? {}]));
  const normal = named.get("NORMAL_TEXT") ?? {};
  const skipped = { tables: 0, images: 0, tablesOfContents: 0 };
  const paragraphs: DocParagraph[] = [];

  for (const block of doc.body?.content ?? []) {
    if (block.table) { skipped.tables++; continue; }
    if (block.tableOfContents) { skipped.tablesOfContents++; continue; }
    const p = block.paragraph;
    if (!p) continue;

    const style = p.paragraphStyle?.namedStyleType ?? "NORMAL_TEXT";
    const styleText = named.get(style) ?? {};
    const runs: DocRun[] = [];

    for (const el of p.elements ?? []) {
      if (el.inlineObjectElement) { skipped.images++; continue; }
      const r = el.textRun;
      if (!r?.content) continue;
      const own = r.textStyle ?? {};
      // Actual formatting = the text's own style → its paragraph style → Normal text → Google default
      runs.push({
        text: r.content,
        font: own.weightedFontFamily?.fontFamily ?? styleText.weightedFontFamily?.fontFamily
          ?? normal.weightedFontFamily?.fontFamily ?? DEFAULT_FONT,
        size: own.fontSize?.magnitude ?? styleText.fontSize?.magnitude ?? normal.fontSize?.magnitude ?? DEFAULT_SIZE,
        bold: own.bold ?? styleText.bold ?? normal.bold ?? false,
        startIndex: el.startIndex,
        endIndex: el.endIndex,
      });
    }

    const match = /^HEADING_(\d)$/.exec(style);
    paragraphs.push({
      style,
      headingLevel: match ? Number(match[1]) : 0,
      text: runs.map((r) => r.text).join("").replace(/\s+/g, " ").trim(),
      isListItem: !!p.bullet,
      runs,
      startIndex: block.startIndex,
      endIndex: block.endIndex,
    });
  }

  const content = doc.body?.content ?? [];
  return {
    title: doc.title ?? "",
    revisionId: doc.revisionId,
    endIndex: content[content.length - 1]?.endIndex ?? 1,
    paragraphs,
    headings: paragraphs.filter((p) => p.headingLevel > 0 && p.text).map((p) => ({ text: p.text, level: p.headingLevel })),
    sections: buildSections(paragraphs),
    bodyRuns: paragraphs
      .filter((p) => p.style === "NORMAL_TEXT")
      .flatMap((p) => p.runs)
      .filter((r) => r.text.trim()),
    skipped,
  };
}

function buildSections(paragraphs: DocParagraph[]): DocSection[] {
  const sections: DocSection[] = [];
  paragraphs.forEach((p, i) => {
    if (!p.headingLevel || !p.text) return;
    const body: string[] = [];
    for (const next of paragraphs.slice(i + 1)) {
      if (next.headingLevel && next.headingLevel <= p.headingLevel) break;
      if (!next.headingLevel && next.text) body.push(next.text);
    }
    const text = body.join("\n");
    sections.push({ heading: p.text, level: p.headingLevel, text, wordCount: text ? text.split(/\s+/).length : 0 });
  });
  return sections;
}

/** Plain-language notes about what was not checked. */
export function docLimitations(m: DocModel): string[] {
  const out: string[] = [];
  if (m.skipped.tables) out.push(`${m.skipped.tables} table(s) were not checked. Text inside tables is not validated yet.`);
  if (m.skipped.images) out.push(`${m.skipped.images} image(s) were not checked.`);
  if (m.skipped.tablesOfContents) out.push("The table of contents was not checked.");
  if (m.paragraphs.some((p) => p.isListItem)) out.push("Bullet and numbered lists are checked as normal text; list formatting is not checked.");
  return out;
}
