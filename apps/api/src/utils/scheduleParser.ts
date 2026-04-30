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

  // Support formats with and without spaces before AM/PM
  const formats = ["h:mmaa", "hh:mmaa", "h:mm aa", "hh:mm aa", "haa", "hhaa", "HH:mm", "H:mm"];
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
  const rawLines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const fullText = rawLines.join("\n");

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
      const tokens = line.split(/\s+/);
      
      // Look for Component Type (LEC, TUT, LAB)
      const typeIdx = tokens.findIndex(t => /^(LEC|TUT|LAB)$/.test(t));
      
      if (typeIdx !== -1) {
        let classNbr = "";
        let section = "";
        const type = tokens[typeIdx];

        // Layout A: Same line (ClassNbr Section Type ...)
        if (typeIdx >= 2 && /^\d{3,5}$/.test(tokens[typeIdx-2]) && /^\d{1,3}$/.test(tokens[typeIdx-1])) {
          classNbr = tokens[typeIdx-2];
          section = tokens[typeIdx-1];
        } 
        // Layout B: Multi-line (ClassNbr\nSection\nType)
        else if (i >= 2 && /^\d{3,5}$/.test(blockLines[i-2]) && /^\d{1,3}$/.test(blockLines[i-1])) {
          classNbr = blockLines[i-2];
          section = blockLines[i-1];
        }

        if (classNbr && section) {
          // FLEXIBLE SCANNING: Look forward for the Date Range line
          let dateLineIdx = -1;
          for (let k = i; k < Math.min(i + 10, blockLines.length); k++) {
            if (blockLines[k].match(/(\d{2,4}[/-]\d{2}[/-]\d{2,4})\s*-\s*(\d{2,4}[/-]\d{2}[/-]\d{2,4})/)) {
              dateLineIdx = k;
              break;
            }
          }

          if (dateLineIdx !== -1) {
            // Collect all potential meeting info tokens from the suffix of the current line 
            // and all lines up to the date line.
            const sameLineSuffix = tokens.slice(typeIdx + 1).join(" ");
            const midLines = blockLines.slice(i + 1, dateLineIdx);
            const rawInfoLines = [sameLineSuffix, ...midLines].filter(Boolean);

            let timeLine = "TBA";
            let roomLine = "TBA";
            const instructorParts: string[] = [];

            // Heuristic allocation
            for (const infoLine of rawInfoLines) {
              // If it looks like Time (contains digits and hyphen or is TBA)
              if (infoLine.match(/(\d+:\d+|TBA)/) && timeLine === "TBA") {
                timeLine = infoLine;
              } 
              // If it looks like Room (no comma, usually short or starts with building code)
              else if (roomLine === "TBA" && !infoLine.includes(",")) {
                roomLine = infoLine;
              } 
              // Otherwise, it's an Instructor
              else {
                instructorParts.push(infoLine.replace(/To be Announced/g, "").trim());
              }
            }

            const instructor = instructorParts.filter(Boolean).join(", ").replace(/,\s*,/g, ",").trim() || null;
            const dateMatch = blockLines[dateLineIdx].match(/(\d{2,4}[/-]\d{2}[/-]\d{2,4})\s*-\s*(\d{2,4}[/-]\d{2}[/-]\d{2,4})/);
            
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
                instructor,
                startDate: formatDate(dateMatch[1]),
                endDate: formatDate(dateMatch[2]),
                isOnline: roomLine.includes("ONLN") || roomLine.includes("Online"),
              });
            }
            
            // Sync index to avoid reprocessing
            i = dateLineIdx;
          }
        }
      }
    }
  }

  return { term, courses };
}
