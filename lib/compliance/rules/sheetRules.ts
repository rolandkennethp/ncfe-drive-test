// Reusable Google Sheets rule templates (some with a quick fix the admin can apply after confirming).
// Each function takes SETTINGS and returns a rule. No sample values live here:
// rule sets (see ../ruleSets) decide the actual settings.
import type { SheetModel, SheetTab } from "../sheetModel";
import type { Rule, RuleOutcome } from "../types";

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const list = (items: string[]) => items.map((i) => `“${i}”`).join(", ");
const colLetter = (i: number) => String.fromCharCode(65 + i); // 0 → A (only A–Z are read)

/**
 * Finds the tab a rule should check. If the named tab doesn't exist,
 * falls back to the FIRST tab and returns a note saying so.
 */
function targetTab(m: SheetModel, name: string): { tab?: SheetTab; note?: string } {
  const tab = m.tabs.find((t) => norm(t.title) === norm(name));
  if (tab) return { tab };
  const first = m.tabs[0];
  return first
    ? { tab: first, note: `No tab named “${name}”, so the first tab “${first.title}” was checked instead.` }
    : {};
}

/** Column positions of the given headings in row 1 (missing ones are left out). */
function findColumns(tab: SheetTab, headings: string[]) {
  const header = tab.rows[0] ?? [];
  return headings
    .map((h) => ({ heading: h, index: header.findIndex((c) => norm(c.value) === norm(h)) }))
    .filter((c) => c.index >= 0);
}

const noTabs: RuleOutcome = {
  status: "warning",
  issue: "The spreadsheet has no tabs that could be read.",
  suggestion: "Add a tab with data, then run the check again.",
};

/** Tabs with these names must exist. */
export function requiredTabs(opts: { tabs: string[] }): Rule<SheetModel> {
  return {
    id: "sheet-required-tabs",
    name: "Tab names",
    checked: `Tab(s) present: ${list(opts.tabs)}`,
    run: (m) => {
      const names = new Set(m.tabs.map((t) => norm(t.title)));
      const missing = opts.tabs.filter((t) => !names.has(norm(t)));
      if (!missing.length) return { status: "pass" };
      return {
        status: "warning",
        issue: `Missing tab(s): ${list(missing)}. Current tabs: ${list(m.tabs.map((t) => t.title))}.`,
        suggestion: "Rename the right tab: double-click its name at the bottom of the sheet and type the expected name.",
        note: m.totalTabs > m.tabs.length ? `Only the first ${m.tabs.length} of ${m.totalTabs} tabs were read.` : undefined,
      };
    },
    fix: {
      label: "Rename tab",
      describe: (m) => `Renames the first tab “${m.tabs[0]?.title}” to “${tabRename(m, opts.tabs)?.to}”.`,
      plan: (m) => {
        const r = tabRename(m, opts.tabs);
        return r ? { type: "sheets", requests: [{ updateSheetProperties: { properties: { sheetId: r.tab.sheetId, title: r.to }, fields: "title" } }] } : null;
      },
    },
  };
}

/** Only offered when exactly ONE required tab is missing and the first tab isn't itself a required tab. */
function tabRename(m: SheetModel, required: string[]) {
  const names = new Set(m.tabs.map((t) => norm(t.title)));
  const missing = required.filter((t) => !names.has(norm(t)));
  const first = m.tabs[0];
  if (missing.length !== 1 || !first || required.some((r) => norm(r) === norm(first.title))) return null;
  return { tab: first, to: missing[0] };
}

/** These column headings must be in row 1 of the tab. */
export function requiredColumns(opts: { tab: string; columns: string[] }): Rule<SheetModel> {
  return {
    id: "sheet-required-columns",
    name: "Column headings",
    checked: `Row 1 of “${opts.tab}” has: ${list(opts.columns)}`,
    run: (m) => {
      const { tab, note } = targetTab(m, opts.tab);
      if (!tab) return noTabs;
      const found = new Set(findColumns(tab, opts.columns).map((c) => norm(c.heading)));
      const missing = opts.columns.filter((c) => !found.has(norm(c)));
      if (!missing.length) return { status: "pass", note };
      return {
        status: "warning",
        issue: `Row 1 of “${tab.title}” is missing: ${list(missing)}.`,
        suggestion: "Type each missing heading in an empty cell of row 1, spelled exactly as shown.",
        note,
      };
    },
    fix: {
      label: "Add headings",
      describe: (m) => {
        const p = columnsPlan(m, opts);
        return p ? `Adds ${list(p.missing)} to row 1 of “${p.tab.title}” (starting at cell ${colLetter(p.start)}1), in bold.` : "";
      },
      plan: (m) => {
        const p = columnsPlan(m, opts);
        if (!p) return null;
        return {
          type: "sheets",
          requests: [{
            updateCells: {
              start: { sheetId: p.tab.sheetId, rowIndex: 0, columnIndex: p.start },
              rows: [{ values: p.missing.map((h) => ({ userEnteredValue: { stringValue: h }, userEnteredFormat: { textFormat: { bold: true } } })) }],
              fields: "userEnteredValue,userEnteredFormat.textFormat.bold",
            },
          }],
        };
      },
    },
  };
}

/** Missing headings go into the empty cells right after the last filled heading in row 1 (within A–Z). */
function columnsPlan(m: SheetModel, opts: { tab: string; columns: string[] }) {
  const { tab } = targetTab(m, opts.tab);
  if (!tab) return null;
  const found = new Set(findColumns(tab, opts.columns).map((c) => norm(c.heading)));
  const missing = opts.columns.filter((c) => !found.has(norm(c)));
  const start = lastFilled(tab.rows[0] ?? []) + 1;
  if (!missing.length || start + missing.length > 26) return null;
  return { tab, missing, start };
}

const lastFilled = (row: { value: string }[]) => row.reduce((last, c, i) => (c.value ? i : last), -1);

/** In these columns, every row that has any data must have a value. */
export function noEmptyRequiredCells(opts: { tab: string; columns: string[] }): Rule<SheetModel> {
  return {
    id: "sheet-required-cells",
    name: "Required cells",
    checked: `No empty cells under ${list(opts.columns)} in “${opts.tab}”`,
    run: (m) => {
      const { tab, note } = targetTab(m, opts.tab);
      if (!tab) return noTabs;
      const cols = findColumns(tab, opts.columns);
      if (!cols.length)
        return { status: "pass", note: [note, "None of the required columns were found, so no cells were checked (see “Column headings”)."].filter(Boolean).join(" ") };

      const empty: string[] = [];
      tab.rows.forEach((row, r) => {
        if (r === 0) return;                                   // skip the header row
        if (!row.some((c) => c.value)) return;                 // skip completely blank rows
        for (const c of cols)
          if (!row[c.index]?.value) empty.push(`${c.heading} in ${colLetter(c.index)}${r + 1}`);
      });
      if (!empty.length) return { status: "pass", note };
      const shown = empty.slice(0, 6).join(", ") + (empty.length > 6 ? ` and ${empty.length - 6} more` : "");
      return {
        status: "warning",
        issue: `${empty.length} empty required cell(s): ${shown}.`,
        suggestion: "Fill in a value in each of these cells, or delete the row if it isn't needed.",
        note,
      };
    },
  };
}

/** Every filled heading in row 1 must be bold. */
export function headerRowBold(opts: { tab: string }): Rule<SheetModel> {
  return {
    id: "sheet-header-format",
    name: "Header formatting",
    checked: `Row 1 of “${opts.tab}” is bold`,
    run: (m) => {
      const { tab, note } = targetTab(m, opts.tab);
      if (!tab) return noTabs;
      const header = (tab.rows[0] ?? []).map((c, i) => ({ ...c, ref: `${colLetter(i)}1` })).filter((c) => c.value);
      if (!header.length)
        return { status: "warning", issue: `Row 1 of “${tab.title}” is empty.`, suggestion: "Put the column headings in row 1 and make them bold.", note };
      const notBold = header.filter((c) => !c.bold);
      if (!notBold.length) return { status: "pass", note };
      return {
        status: "warning",
        issue: `${notBold.length} heading(s) in row 1 are not bold: ${notBold.slice(0, 6).map((c) => `“${c.value}” (${c.ref})`).join(", ")}.`,
        suggestion: "Click the row number 1 to select the row, then press Cmd + B to make it bold.",
        note,
      };
    },
    fix: {
      label: "Make bold",
      describe: (m) => `Makes the headings in row 1 of “${targetTab(m, opts.tab).tab?.title}” bold.`,
      plan: (m) => {
        const { tab } = targetTab(m, opts.tab);
        const end = tab ? lastFilled(tab.rows[0] ?? []) + 1 : 0;
        if (!tab || !end) return null;
        return {
          type: "sheets",
          requests: [{
            repeatCell: {
              range: { sheetId: tab.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: end },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat.bold",
            },
          }],
        };
      },
    },
  };
}
