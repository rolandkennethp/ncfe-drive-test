// SAMPLE RULES — for testing the checker only.
// These are NOT official NCFE or CBSE guidelines. Replace them when the official
// ACP / Lesson Plan / Self Practice (HOTS) guidelines are available.
import type { DocModel } from "../docModel";
import type { RuleSet } from "../types";
import { bodyFont, bodyFontSize, requiredHeadings, sectionsHaveContent, titleStartsWith } from "../rules/docRules";

const HEADINGS = ["Learning Objectives", "Activities", "Assessment"];

export const sampleDocRules: RuleSet<DocModel> = {
  id: "sample-doc",
  name: "Sample Google Docs rules",
  kind: "doc",
  sample: true,
  rules: [
    titleStartsWith({ prefixes: ["ACP", "Lesson Plan", "Self Practice"], example: "Lesson Plan – Maths Grade 1", suggestPrefix: "Lesson Plan" }),
    requiredHeadings({ headings: HEADINGS }),
    sectionsHaveContent({ headings: HEADINGS, minWords: 5 }),
    bodyFont({ font: "Arial" }),
    bodyFontSize({ size: 11 }),
  ],
};
