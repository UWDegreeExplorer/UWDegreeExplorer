export const SECTION_LABELS: Record<string, string> = {
  carpool: "Carpool",
  academic: "Academic",
  roommate: "Find Roommate",
  other: "Other",
};

export const SECTION_ORDER = ["carpool", "academic", "roommate", "other"];

export function isValidSection(s: string): boolean {
  return SECTION_ORDER.includes(s);
}

export function excerpt(body: string, len = 180): string {
  const trimmed = body.replace(/\s+/g, " ").trim();
  if (trimmed.length <= len) return trimmed;
  return trimmed.slice(0, len - 1).trimEnd() + "…";
}
