import { format, parse, isValid } from "date-fns";

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

  // 3. Split into course blocks using a lookahead for course headers
  // Pattern: [Subject] [Catalog] - [Title]
  const courseBlocks = fullText.split(/\n(?=[A-Z]{1,5}\s\d+[A-Z]?\s*-\s*)/);
  const courses: ParsedCourse[] = [];

  for (const block of courseBlocks) {
    const blockLines = block.split("\n");
    if (blockLines.length === 0) continue;

    // Find course code in the first line of the block
    const headerMatch = blockLines[0].match(/^([A-Z]{1,5}\s\d+[A-Z]?)/);
    const courseCode = headerMatch ? headerMatch[1] : "Unknown";

    // 4. Scan for component blocks (Class Nbr -> Section -> Component)
    // We look for 3 consecutive lines that match the pattern
    for (let i = 0; i < blockLines.length; i++) {
      const line = blockLines[i];
      
      // Potential Class Nbr (3-5 digits)
      if (/^\d{3,5}$/.test(line)) {
        // Look ahead for Section and Component
        if (i + 2 < blockLines.length) {
          const section = blockLines[i+1];
          const type = blockLines[i+2];

          if (/^\d{1,3}$/.test(section) && /^(LEC|TUT|LAB|TST)$/.test(type)) {
            if (type === "TST") {
              i += 2; // Skip TST header
              continue;
            }

            // We found a component! Now look for its meetings.
            // A meeting consists of 4 lines: Time, Room, Instructor, Dates
            // We search greedily for these 4 lines following the header
            let searchIdx = i + 3;
            while (searchIdx + 3 < blockLines.length) {
              const timeLine = blockLines[searchIdx];
              const roomLine = blockLines[searchIdx+1];
              const instructorLine = blockLines[searchIdx+2];
              const dateLine = blockLines[searchIdx+3];

              // Check if dateLine looks like a date range
              const dateMatch = dateLine.match(/(\d{2,4}[/-]\d{2}[/-]\d{2,4})\s*-\s*(\d{2,4}[/-]\d{2}[/-]\d{2,4})/);
              
              if (dateMatch) {
                // This is a valid meeting
                const timeParts = timeLine.match(/^([MTWRFh]+)?\s*(.+?)\s*-\s*(.+)$/);
                if (timeParts || timeLine === "TBA") {
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
                    instructor: instructorLine.includes("To be Announced") ? null : instructorLine,
                    startDate: formatDate(dateMatch[1]),
                    endDate: formatDate(dateMatch[2]),
                    isOnline: roomLine.includes("ONLN") || roomLine.includes("Online"),
                  });
                  
                  searchIdx += 4; // Move to next potential meeting
                  continue;
                }
              }
              
              // If we didn't find a meeting, stop searching this component
              break;
            }
            
            i = searchIdx - 1; // Move outer loop to end of processed meetings
          }
        }
      }
    }
  }

  return { term, courses };
}
