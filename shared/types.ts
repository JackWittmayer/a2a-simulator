export interface ReviewResult {
  title: string;
  summary: string;
  highlights: string[];
  outcome: "success" | "partial" | "failure" | "inconclusive";
}
