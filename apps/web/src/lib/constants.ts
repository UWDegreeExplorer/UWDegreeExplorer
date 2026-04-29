import { Car, GraduationCap, Home as HomeIcon, Layers } from "lucide-react";
import type { Section } from "@workspace/api-client-react";

export type SectionFilter = Section | "all" | "my-posts" | "messages" | "inbox" | "bookmarks" | "likes" | "drafts" | "settings" | "courses" | "calendar";

export const SECTION_LABELS: Record<Section, string> = {
  carpool: "Carpool",
  academic: "Academic",
  roommate: "Find Roommate",
  other: "Other",
};

export const SECTION_ICONS: Record<Section, any> = {
  carpool: Car,
  academic: GraduationCap,
  roommate: HomeIcon,
  other: Layers,
};
