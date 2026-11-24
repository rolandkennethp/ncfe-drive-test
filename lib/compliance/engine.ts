// The validation engine. It knows nothing about specific rules:
// it simply runs every rule in the given rule set against the document model.
import type { CheckReport, FixInfo, Rule, RuleResult, RuleSet } from "./types";

export function runRules<M>(ruleSet: RuleSet<M>, model: M, limitations: string[] = []): CheckReport {
  const results: RuleResult[] = ruleSet.rules.map((rule) => runOne(rule, model));
  const passed = results.filter((r) => r.status === "pass").length;

  return {
    ruleSet: { id: ruleSet.id, name: ruleSet.name, sample: ruleSet.sample },
    total: results.length,
    passed,
    warnings: results.length - passed,
    results,
    limitations,
    checkedAt: new Date().toISOString(),
  };
}

function runOne<M>(rule: Rule<M>, model: M): RuleResult {
  const base = { ruleId: rule.id, ruleName: rule.name, checked: rule.checked };
  try {
    const out = rule.run(model);
    const note = out.note ? { note: out.note } : {};
    if (out.status === "pass") return { ...base, status: "pass", ...note };
    const fix = fixInfo(rule, model);
    return { ...base, status: "warning", issue: out.issue, suggestion: out.suggestion, ...note, ...(fix ? { fix } : {}) };
  } catch {
    // A broken rule must never crash the check or block the admin.
    return {
      ...base,
      status: "warning",
      issue: "This rule could not be checked on this document.",
      suggestion: "Ignore this warning, or report it so the rule can be fixed.",
    };
  }
}

/** Describes the quick fix for a warning, if the rule has one and it can be applied to this document. */
function fixInfo<M>(rule: Rule<M>, model: M): FixInfo | undefined {
  if (!rule.fix) return undefined;
  try {
    const suggested = rule.fix.input?.suggest(model);
    if (!rule.fix.plan(model, suggested)) return undefined;
    return {
      label: rule.fix.label,
      description: rule.fix.describe(model),
      ...(rule.fix.input ? { input: { label: rule.fix.input.label, defaultValue: suggested ?? "" } } : {}),
    };
  } catch {
    return undefined;
  }
}
