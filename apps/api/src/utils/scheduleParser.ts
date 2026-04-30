import { format, parse, isValid } from "date-fns";

export interface ParsedCourse {
  courseCode: string;
  type: string;
  section: string;
  days: string[];
  startTime: string; // HH:mm or "TBA"
  endTime: string;   // HH:mm or "TBA"
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

function standardizeTime(timeStr: string): string {
  const cleanTime = timeStr.trim().toUpperCase();
  if (!cleanTime || cleanTime === "TBA") return "TBA";

  const formats = ["h:mmaa", "hh:mmaa", "haa", "hhaa", "HH:mm", "H:mm"];
  for (const fmt of formats) {
    try {
      const parsedDate = parse(cleanTime, fmt, new Date());
      if (isValid(parsedDate)) return format(parsedDate, "HH:mm");
    } catch { /* ignore */ }
  }
  return cleanTime;
}

export function parseQuestSchedule(rawText: string): ParseResult {
  // 1. Clean and normalize text
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const fullText = lines.join("\n");

  // 2. Detect Term
  const termMatch = fullText.match(/(Winter|Spring|Fall)\s\d{4}/i);
  const term = termMatch ? termMatch[0] : "Unknown Term";

  // 3. Split into course blocks
  const courseBlocks = fullText.split(/\n(?=[A-Z]{1,5}\s\d+[A-Z]?\s*-\s*)/);
  const courses: ParsedCourse[] = [];

  for (const block of courseBlocks) {
    const blockLines = block.split("\n");
    if (blockLines.length === 0) continue;

    const headerMatch = blockLines[0].match(/^([A-Z]{1,5}\s\d+[A-Z]?)/);
    const courseCode = headerMatch ? headerMatch[1] : "Unknown";

    for (let i = 0; i < blockLines.length; i++) {
      const line = blockLines[i];
      
      // Look for Class Nbr, Section, Component sequence
      // Note: We check if i >= 2 to ensure we have ClassNbr and Section above
      if (/^(LEC|TUT|LAB|TST)$/.test(line) && i >= 2) {
        const classNbr = blockLines[i-2];
        const section = blockLines[i-1];

        if (/^\d{3,5}$/.test(classNbr) && /^\d{1,3}$/.test(section)) {
          const type = line;

          // FLEXIBLE SCANNING: Look forward for the Date Range line
          let dateLineIdx = -1;
          // Look ahead up to 8 lines to find the date range "YYYY/MM/DD - YYYY/MM/DD"
          for (let k = i + 1; k < Math.min(i + 8, blockLines.length); k++) {
            if (blockLines[k].match(/(\d{2,4}[/-]\d{2}[/-]\d{2,4})\s*-\s*(\d{2,4}[/-]\d{2}[/-]\d{2,4})/)) {
              dateLineIdx = k;
              break;
            }
          }

          if (dateLineIdx !== -1) {
            // Lines between 'type' and 'dateLine' are the meeting details
            // meetingLines[0]: Time
            // meetingLines[1]: Room
            // meetingLines[2+]: Instructor
            const meetingLines = blockLines.slice(i + 1, dateLineIdx);
            const dateLine = blockLines[dateLineIdx];
            
            const timeLine = meetingLines[0] || "TBA";
            const roomLine = meetingLines[1] || "TBA";
            const instructorLines = meetingLines.slice(2);
            const instructor = instructorLines.length > 0 
              ? instructorLines
                  .map(line => line.replace(/To be Announced/g, "").trim())
                  .filter(Boolean)
                  .join(", ")
                  .replace(/,\s*,/g, ",") // Remove double commas
                  .replace(/^,|,$/g, "") // Remove leading/trailing commas
                  .trim() 
              : null;

            const dateMatch = dateLine.match(/(\d{2,4}[/-]\d{2}[/-]\d{2,4})\s*-\s*(\d{2,4}[/-]\d{2}[/-]\d{2,4})/);
            if (dateMatch) {
              const timeParts = timeLine.match(/^([MTWRFh]+)?\s*(.+?)\s*-\s*(.+)$/);
              const startTimeRaw = timeParts ? timeParts[2] : "TBA";
              const endTimeRaw = timeParts ? timeParts[3] : "TBA";
              const daysRaw = timeParts ? timeParts[1] || "" : "";

              const days: string[] = [];
              for (let j = 0; j < daysRaw.length; j++) {
                const char = daysRaw[j];
                if (char === 'T' && daysRaw[j+1] === 'h') { days.push('TH'); j++; }
                else if (char === 'M') days.push('MO');
                else if (char === 'T') days.push('TU');
                else if (char === 'W') days.push('WE');
                else if (char === 'F') days.push('FR');
              }

              const formatDate = (d: string) => {
                try {
                  if (d.includes("/") && d.split("/")[0].length === 4) return d.replace(/\//g, "-");
                  const formats = ["MM/dd/yyyy", "MM-dd-yyyy", "yyyy/MM/dd"];
                  for (const f of formats) {
                    const p = parse(d, f, new Date());
                    if (isValid(p)) return format(p, "yyyy-MM-dd");
                  }
                  return d;
                } catch { return d; }
              };

              courses.push({
                courseCode,
                type,
                section,
                days,
                startTime: standardizeTime(startTimeRaw),
                endTime: standardizeTime(endTimeRaw),
                room: roomLine,
                instructor: instructor || null,
                startDate: formatDate(dateMatch[1]),
                endDate: formatDate(dateMatch[2]),
                isOnline: roomLine.includes("ONLN") || roomLine.includes("Online"),
              });
            }
            
            // Advance outer loop index to the date line we just processed
            i = dateLineIdx;
          }
        }
      }
    }
  }

  return { term, courses };
}
