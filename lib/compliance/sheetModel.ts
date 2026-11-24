// Turns a Google Sheets API response into a simple model that rules can check.
// Only a limited range is read (see route.ts): first 10 tabs, columns A–Z, rows 1–200.

export type SheetCell = { value: string; bold: boolean; font?: string; size?: number };

export type SheetTab = {
  title: string;
  sheetId: number;        // used by quick fixes
  rows: SheetCell[][];    // rows[0] is row 1
  rowsRead: number;
  mayHaveMoreRows: boolean;
};

export type SheetModel = {
  title: string;
  tabs: SheetTab[];
  totalTabs: number;      // tabs in the file (may be more than were read)
};

/* ---- Raw Google Sheets API shapes (only the parts we use) ---- */
type GCell = {
  formattedValue?: string;
  effectiveFormat?: { textFormat?: { bold?: boolean; fontFamily?: string; fontSize?: number } };
};
export type GSheet = {
  properties?: { title?: string };
  sheets?: { properties?: { title?: string; sheetId?: number }; data?: { rowData?: { values?: GCell[] }[] }[] }[];
};

export const SHEET_MAX_ROWS = 200;
export const SHEET_MAX_TABS = 10;

export function buildSheetModel(data: GSheet, totalTabs: number): SheetModel {
  return {
    title: data.properties?.title ?? "",
    totalTabs,
    tabs: (data.sheets ?? []).map((s) => {
      const rowData = s.data?.[0]?.rowData ?? [];
      const rows = rowData.map((r) =>
        (r.values ?? []).map((c) => ({
          value: (c.formattedValue ?? "").trim(),
          bold: c.effectiveFormat?.textFormat?.bold ?? false,
          font: c.effectiveFormat?.textFormat?.fontFamily,
          size: c.effectiveFormat?.textFormat?.fontSize,
        })),
      );
      return {
        title: s.properties?.title ?? "",
        sheetId: s.properties?.sheetId ?? 0,
        rows,
        rowsRead: rows.length,
        mayHaveMoreRows: rows.length >= SHEET_MAX_ROWS,
      };
    }),
  };
}

/** Plain-language notes about what was not checked. */
export function sheetLimitations(m: SheetModel): string[] {
  const out: string[] = [];
  if (m.totalTabs > m.tabs.length)
    out.push(`Only the first ${m.tabs.length} of ${m.totalTabs} tabs were checked.`);
  for (const t of m.tabs)
    if (t.mayHaveMoreRows) out.push(`Tab "${t.title}": only rows 1–${SHEET_MAX_ROWS} were checked.`);
  out.push("Only columns A–Z are checked. Formulas are checked by their displayed values.");
  return out;
}
