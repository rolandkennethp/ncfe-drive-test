// SAMPLE RULES — for testing the checker only.
// These are NOT official NCFE or CBSE guidelines. Replace them when the official guidelines are available.
import type { SheetModel } from "../sheetModel";
import type { RuleSet } from "../types";
import { headerRowBold, noEmptyRequiredCells, requiredColumns, requiredTabs } from "../rules/sheetRules";

const TAB = "Data";
const COLUMNS = ["Student Name", "Roll No", "Marks"];

export const sampleSheetRules: RuleSet<SheetModel> = {
  id: "sample-sheet",
  name: "Sample Google Sheets rules",
  kind: "sheet",
  sample: true,
  rules: [
    requiredTabs({ tabs: [TAB] }),
    requiredColumns({ tab: TAB, columns: COLUMNS }),
    noEmptyRequiredCells({ tab: TAB, columns: COLUMNS }),
    headerRowBold({ tab: TAB }),
  ],
};
