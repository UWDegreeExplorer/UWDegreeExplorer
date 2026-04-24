import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function relTime(date: string | Date) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "some time ago";
  }
}

export function excerpt(text: string, len: number) {
  if (text.length <= len) return text;
  return text.slice(0, len) + "…";
}
