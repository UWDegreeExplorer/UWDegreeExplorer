import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow } from "date-fns"

/**
 * Merges class names using clsx and tailwind-merge for conflict resolution.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns a human-readable relative time string (e.g., "3 days ago").
 */
export function relTime(date: string | Date) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "some time ago";
  }
}

/**
 * Truncates text to a specified length and appends an ellipsis.
 */
export function excerpt(text: string, len: number) {
  if (text.length <= len) return text;
  return text.slice(0, len) + "…";
}

/**
 * Formats a UWaterloo 4-digit term code (e.g., "1249") into a readable string (e.g., "Fall 2024").
 */
export function formatTermCode(term: string) {
  if (!term || term.length !== 4) return term;
  
  const century = term[0] === '1' ? 2000 : 1900;
  const year = century + parseInt(term.substring(1, 3));
  const seasonCode = term[3];
  
  let season = "";
  switch (seasonCode) {
    case '1': season = "Winter"; break;
    case '5': season = "Spring"; break;
    case '9': season = "Fall"; break;
    default: return term;
  }
  
  return `${season} ${year}`;
}
