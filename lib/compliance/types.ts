// Shared types for the Document Compliance Checker.
// A rule result is ONLY ever "pass" or "warning". There is no "fail" and nothing blocks the admin.
// Some rules offer a QUICK FIX. A fix is only ever applied after the admin clicks and confirms it.

export type Status = "pass" | "warning";

/** What a rule's check function returns. */
export type RuleOutcome = {
  status: Status;
  issue?: string;       // what is wrong (warnings only)
  suggestion?: string;  // how the admin can fix it (warnings only)
  note?: string;        // optional extra info, e.g. "Checked the first tab instead"
};

/** The change a quick fix makes: Google API requests, or a file rename. */
export type FixPlan =
  | { type: "docs"; requests: object[] }
  | { type: "sheets"; requests: object[] }
  | { type: "rename"; name: string };

/** Optional quick fix attached to a rule. */
export type RuleFix<M> = {
  label: string;                                  // button text, e.g. "Fix font"
  describe: (model: M) => string;                 // what will change, shown before confirming
  input?: { label: string; suggest: (model: M) => string }; // asks the admin for a value (e.g. new name)
  plan: (model: M, input?: string) => FixPlan | null;       // null = can't be fixed automatically
};

/** One rule. `M` is the document model it checks (DocModel or SheetModel). */
export type Rule<M> = {
  id: string;
  name: string;      // e.g. "Required headings"
  checked: string;   // e.g. "Headings: Learning Objectives, Activities, Assessment"
  run: (model: M) => RuleOutcome;
  fix?: RuleFix<M>;
};

/** Quick-fix info sent to the browser (no API requests, just text). */
export type FixInfo = { label: string; description: string; input?: { label: string; defaultValue: string } };

/** A named list of rules, e.g. "Sample Doc rules" or later "Lesson Plan". */
export type RuleSet<M> = {
  id: string;
  name: string;
  kind: "doc" | "sheet";
  sample: boolean;   // true = example rules, not official NCFE guidelines
  rules: Rule<M>[];
};

/** One row in the results. */
export type RuleResult = {
  ruleId: string;
  ruleName: string;
  checked: string;
  status: Status;
  issue?: string;
  suggestion?: string;
  note?: string;
  fix?: FixInfo;       // present only when a quick fix is available for this warning
};

/** What the engine returns. */
export type CheckReport = {
  ruleSet: { id: string; name: string; sample: boolean };
  total: number;
  passed: number;
  warnings: number;
  results: RuleResult[];
  limitations: string[]; // parts of the document that were NOT checked
  checkedAt: string;     // ISO time
};
