import { format, parse } from "date-fns";

export interface ParsedCourse {
  courseCode: string;
  type: string;
  section: string;
  days: string[];
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  room: string;
  instructor: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isOnline: boolean;
}

export interface ParseResult {
  term: string;
  courses: ParsedCourse[];
}

/**
 * Standardizes time strings like "1:30PM" or "13:30" to "HH:mm"
 */
function standardizeTime(timeStr: string): string {
  const cleanTime = timeStr.trim().toUpperCase();
  try {
    if (cleanTime.includes("AM") || cleanTime.includes("PM")) {
      // Handle cases where there might be no colon, e.g., "1PM"
      const formatStr = cleanTime.includes(":") ? "hh:mmaa" : "hhaa";
      const parsedDate = parse(cleanTime, formatStr, new Date());
      return format(parsedDate, "HH:mm");
    } else {
      const parsedDate = parse(cleanTime, "HH:mm", new Date());
      return format(parsedDate, "HH:mm");
    }
  } catch (e) {
    console.error(`Failed to parse time: ${timeStr}`, e);
    return cleanTime;
  }
}

/**
 * Parses raw text from Quest 'My Class Schedule'
 */
export function parseQuestSchedule(rawText: string): ParseResult {
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  const fullText = lines.join("\n");

  // Detect Term
  const termMatch = fullText.match(/(Winter|Spring|Fall)\s\d{4}/);
  const term = termMatch ? termMatch[0] : "Unknown Term";

  // Split into course blocks
  // Headers look like: "CS 246 - Object-Oriented Software"
  const courseBlocks = fullText.split(/\n(?=[A-Z]{2,}\s\d+[A-Z]?\s-\s)/);
  const courses: ParsedCourse[] = [];

  for (const block of courseBlocks) {
    const lines = block.split("\n");
    if (lines.length < 2) continue;

    const header = lines[0];
    const codeMatch = header.match(/^([A-Z]{2,}\s\d+[A-Z]?)/);
    if (!codeMatch) continue;
    const courseCode = codeMatch[1];

    // Core pattern for components
    // We look for patterns like:
    // 5623 (Class Nbr)
    // 001 (Section)
    // LEC (Component)
    // MW 1:30PM - 2:50PM (Days & Times)
    // DC 1350 (Room)
    // Instructor Name (Instructor)
    // 2024/01/08 - 2024/04/08 (Date Range)
    
    // Using a more flexible line-by-line scanning approach for robustness
    for (let i = 0; i < lines.length; i++) {
      const componentMatch = lines[i].match(/^(LEC|TUT|LAB|TST)$/);
      if (componentMatch && i >= 2 && i + 4 < lines.length) {
        const type = componentMatch[1];
        if (type === "TST") continue; // Skip tests

        const section = lines[i - 1];
        const timeLine = lines[i + 1];
        const room = lines[i + 2];
        const instructor = lines[i + 3];
        const dateLine = lines[i + 4];

        if (timeLine.includes("TBA") || !timeLine.includes("-")) continue;

        // Parse Time: "MW 1:30PM - 2:50PM"
        const timeParts = timeLine.match(/^([MTWRFh]+)\s+(.+?)\s*-\s*(.+)$/);
        if (!timeParts) continue;

        const daysRaw = timeParts[1];
        const startTimeRaw = timeParts[2];
        const endTimeRaw = timeParts[3];

        // Parse days (handling 'Th')
        const days: string[] = [];
        for (let j = 0; j < daysRaw.length; j++) {
          const char = daysRaw[j];
          if (char === 'T' && daysRaw[j+1] === 'h') {
            days.push('TH');
            j++;
          } else if (char === 'M') days.push('MO');
          else if (char === 'T') days.push('TU');
          else if (char === 'W') days.push('WE');
          else if (char === 'F') days.push('FR');
        }

        // Parse Dates: "2024/01/08 - 2024/04/08" or "01/08/2024 - 04/08/2024"
        const dateParts = dateLine.split("-").map(d => d.trim());
        if (dateParts.length !== 2) continue;

        const formatDate = (d: string) => {
          try {
            // Try YYYY/MM/DD
            if (d.includes("/") && d.split("/")[0].length === 4) {
               return d.replace(/\//g, "-");
            }
            // Try MM/DD/YYYY
            const p = parse(d, "MM/dd/yyyy", new Date());
            return format(p, "yyyy-MM-dd");
          } catch {
            return d;
          }
        };

        courses.push({
          courseCode,
          type,
          section,
          days,
          startTime: standardizeTime(startTimeRaw),
          endTime: standardizeTime(endTimeRaw),
          room,
          instructor: instructor.includes("To be Announced") ? null : instructor,
          startDate: formatDate(dateParts[0]),
          endDate: formatDate(dateParts[1]),
          isOnline: room.includes("ONLN") || room.includes("Online"),
        });
      }
    }
  }

  return { term, courses };
}
