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

/**
 * Standardizes time strings like "1:30PM", "01:30PM", "13:30" to "HH:mm"
 */
function standardizeTime(timeStr: string): string {
  const cleanTime = timeStr.trim().toUpperCase();
  if (!cleanTime || cleanTime === "TBA") return "TBA";

  const formats = [
    "h:mmaa",   // 1:30PM
    "hh:mmaa",  // 01:30PM
    "haa",      // 1PM
    "hhaa",     // 01PM
    "HH:mm",    // 13:30
    "H:mm"      // 1:30
  ];

  for (const fmt of formats) {
    try {
      const parsedDate = parse(cleanTime, fmt, new Date());
      if (isValid(parsedDate)) {
        return format(parsedDate, "HH:mm");
      }
    } catch (e) {
      // Try next format
    }
  }

  console.error(`Failed to parse time: ${timeStr}`);
  return cleanTime;
}

/**
 * Parses raw text from Quest 'My Class Schedule'
 */
export function parseQuestSchedule(rawText: string): ParseResult {
  // Normalize line endings and remove empty lines
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const fullText = lines.join("\n");

  // Detect Term
  const termMatch = fullText.match(/(Winter|Spring|Fall)\s\d{4}/i);
  const term = termMatch ? termMatch[0] : "Unknown Term";

  const courses: ParsedCourse[] = [];
  
  // Use a scanning approach to find Course Headers and Components
  // Quest List View structure:
  // [Course Name]
  // [Status]
  // [Class Nbr] (3-5 digits)
  // [Section] (3 digits)
  // [Component] (LEC/TUT/LAB/TST)
  // [Days & Times] (e.g., "MW 1:30PM - 2:50PM" or "TBA")
  // [Room]
  // [Instructor]
  // [Dates] (e.g., "2024/01/08 - 2024/04/08")

  let currentCourseCode = "Unknown";
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect Course Header: "CS 246 - Object-Oriented Software" or "CS 246"
    const headerMatch = line.match(/^([A-Z]{2,}\s\d+[A-Z]?)(?:\s+-\s+.*)?$/);
    if (headerMatch) {
      currentCourseCode = headerMatch[1];
      continue;
    }

    // Detect Component block start
    // We look for: Class Nbr, Section, Component
    // Sometimes there are lines BEFORE the Class Nbr that belong to the meeting (as seen in user screenshot)
    // But the "Anchor" is the sequence: Number(3-5), Number(3), LEC|TUT|LAB|TST
    const componentMatch = line.match(/^(LEC|TUT|LAB|TST)$/);
    if (componentMatch && i >= 2) {
      const classNbr = lines[i - 2];
      const section = lines[i - 1];
      
      // Verify they look like numbers
      if (/^\d{3,5}$/.test(classNbr) && /^\d{2,3}$/.test(section)) {
        const type = componentMatch[1];
        if (type === "TST") continue;

        // Found a component! Now find its meetings.
        // There can be one meeting immediately following, 
        // OR one meeting ABOVE it (as seen in user screenshot)
        
        const processMeeting = (timeLine: string, roomLine: string, instructorLine: string, dateLine: string) => {
          if (!timeLine || timeLine.includes("TBA") || !timeLine.includes("-")) return null;
          
          const timeParts = timeLine.match(/^([MTWRFh]+)?\s*(.+?)\s*-\s*(.+)$/);
          if (!timeParts) return null;

          const daysRaw = timeParts[1] || "";
          const startTimeRaw = timeParts[2];
          const endTimeRaw = timeParts[3];

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

          const dateParts = dateLine.split("-").map(d => d.trim());
          if (dateParts.length !== 2) return null;

          const formatDate = (d: string) => {
            try {
              if (d.includes("/") && d.split("/")[0].length === 4) return d.replace(/\//g, "-");
              const p = parse(d, "MM/dd/yyyy", new Date());
              return isValid(p) ? format(p, "yyyy-MM-dd") : d;
            } catch { return d; }
          };

          return {
            courseCode: currentCourseCode,
            type,
            section,
            days,
            startTime: standardizeTime(startTimeRaw),
            endTime: standardizeTime(endTimeRaw),
            room: roomLine,
            instructor: instructorLine.includes("To be Announced") ? null : instructorLine,
            startDate: formatDate(dateParts[0]),
            endDate: formatDate(dateParts[1]),
            isOnline: roomLine.includes("ONLN") || roomLine.includes("Online"),
          };
        };

        // Check for meeting AFTER the component header (Standard Case)
        if (i + 4 < lines.length) {
          const meeting = processMeeting(lines[i+1], lines[i+2], lines[i+3], lines[i+4]);
          if (meeting) courses.push(meeting);
        }

        // Check for meeting BEFORE the component header (User Screenshot Case)
        // In the screenshot, the meeting lines are i-6 to i-3
        if (i >= 6) {
          const meeting = processMeeting(lines[i-6], lines[i-5], lines[i-4], lines[i-3]);
          if (meeting) courses.push(meeting);
        }
      }
    }
  }

  return { term, courses };
}
