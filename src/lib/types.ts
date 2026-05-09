export type Sector = "nhs";

export type CriterionType = "essential" | "desirable";
export type CriterionCategory = "experience" | "skills" | "qualifications" | "values";

export interface Criterion {
  id: string;
  text: string;
  type: CriterionType;
  category: CriterionCategory;
}

export interface PersonSpec {
  jobTitle: string;
  band: string | null;
  organisation: string | null;
  criteria: Criterion[];
}

export interface GapFillQuestion {
  criterionId: string;
  criterionText: string;
  question: string;
  hint: string;
}

export interface GapFillAnswer {
  criterionId: string;
  answer: string;
}

export type StatementStatus = "draft" | "in_progress" | "completed";

export type ShortlistDecision = "shortlist" | "borderline" | "reject";

export interface CriterionScore {
  criterionId: string;
  criterionText: string;
  score: 0 | 1 | 2 | 3;
  label: "Not evidenced" | "Partially evidenced" | "Met" | "Strongly met";
  feedback: string;
}

export interface ReviewFix {
  title: string;
  suggestion: string;
  /** True when the fix requires real-world info the AI doesn't have (e.g. specific dates, registration numbers, real incidents). When true, auto-improve cannot apply it; the user must provide the detail. */
  requiresUserInput: boolean;
  /** When requiresUserInput=true, a single specific friendly question to ask the user. */
  userQuestion?: string;
  /** When requiresUserInput=true, an example answer to show as placeholder. */
  inputPlaceholder?: string;
}

export interface ReviewResult {
  overallScore: number;
  shortlistDecision: ShortlistDecision;
  verdict: string;
  criterionScores: CriterionScore[];
  strengths: string[];
  weaknesses: string[];
  topFixes: ReviewFix[];
}

export interface StatementRecord {
  id: string;
  user_id: string;
  title: string;
  sector: Sector;
  job_advert_text: string | null;
  cv_text: string | null;
  person_spec: PersonSpec | null;
  gap_fills: GapFillAnswer[] | null;
  draft_text: string | null;
  final_text: string | null;
  status: StatementStatus;
  step: number;
  created_at: string;
  updated_at: string;
}
