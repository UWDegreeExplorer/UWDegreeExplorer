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
 * Port of Python's _standardize_time_range
 */
function _standardize_time_range(raw_time_str: string): string {
  if (!raw_time_str || raw_time_str.includes("TBA")) {
    return "TBA";
  }

  try {
    const match = raw_time_str.match(/\d/);
    if (!match) return raw_time_str;

    const days_part = raw_time_str.substring(0, match.index).trim();
    const times_part = raw_time_str.substring(match.index!).trim();

    const time_segments = times_part.split("-").map(t => t.trim());
    if (time_segments.length !== 2) return raw_time_str;

    const converted_times: string[] = [];
    for (const t of time_segments) {
      let dt: Date;
      if (t.includes("AM") || t.includes("PM")) {
        dt = parse(t, "h:mmaa", new Date());
        if (!isValid(dt)) dt = parse(t, "hh:mmaa", new Date());
      } else {
        dt = parse(t, "HH:mm", new Date());
      }
      converted_times.push(format(dt, "HH:mm"));
    }

    return `${days_part} ${converted_times[0]} - ${converted_times[1]}`;
  } catch (e) {
    return raw_time_str;
  }
}

/**
 * Port of Python's parse_waterloo_quest_schedule
 */
export function parseQuestSchedule(rawText: string): ParseResult {
  const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
  const fullText = lines.join("\n");

  // Detect Academic Term
  const termMatch = fullText.match(/(Winter|Spring|Fall)\s\d{4}/);
  const current_term = termMatch ? termMatch[0] : "Unknown Term";

  // Split text into blocks by course headers
  // Equivalent to Python's re.split(r'\n([A-Z]{2,}\s\d+[A-Z]?\s-\s.+)', full_text)
  // JS split with capturing group also includes the match in the array
  const course_blocks = fullText.split(/\n([A-Z]{2,}\s\d+[A-Z]?\s-\s.+)/);
  const courses: ParsedCourse[] = [];

  for (let i = 1; i < course_blocks.length; i += 2) {
    const course_header = course_blocks[i].trim();
    const course_body = course_blocks[i + 1];

    // Extract Course Code
    const codeMatch = course_header.match(/^([A-Z]{2,}\s\d+[A-Z]?)/);
    const course_code = codeMatch ? codeMatch[1] : "Unknown";

    // --- Core Regex Pattern (Ported from Python) ---
    // Note: [\s\S] is used as DOTALL flag equivalent
    const component_pattern = /(\d{3,4})\n(\d{3})\n(LEC|TUT|LAB|TST)\n([\s\S]+?)\n([\s\S]+?)\n([\s\S]+?)\n(\d{2,4}\/\d{2}\/\d{2,4})/g;

    const matches = Array.from(course_body.matchAll(component_pattern));

    for (const m of matches) {
      if (m[3] === "TST") continue;

      const standardized_time = _standardize_time_range(m[4]);
      const room = m[5].trim();
      const instructor = m[6].replace(/\n/g, ", ").trim();
      const date_line = m[7];

      // Parse days/times for object structure
      const timeParts = standardized_time.match(/^([MTWRFh]+)?\s*(.+?)\s*-\s*(.+)$/);
      const days: string[] = [];
      if (timeParts && timeParts[1]) {
        const daysRaw = timeParts[1];
        for (let j = 0; j < daysRaw.length; j++) {
          const char = daysRaw[j];
          if (char === 'T' && daysRaw[j + 1] === 'h') {
            days.push('TH');
            j++;
          } else if (char === 'M') days.push('MO');
          else if (char === 'T') days.push('TU');
          else if (char === 'W') days.push('WE');
          else if (char === 'F') days.push('FR');
        }
      }

      const dateParts = date_line.split("-").map(d => d.trim());
      const formatDate = (d: string) => {
        try {
          if (d.includes("/") && d.split("/")[0].length === 4) return d.replace(/\//g, "-");
          const p = parse(d, "MM/dd/yyyy", new Date());
          return isValid(p) ? format(p, "yyyy-MM-dd") : d;
        } catch { return d; }
      };

      courses.push({
        courseCode: course_code,
        type: m[3],
        section: m[2],
        days,
        startTime: timeParts ? timeParts[2] : "TBA",
        endTime: timeParts ? timeParts[3] : "TBA",
        room,
        instructor: instructor.includes("To be Announced") ? null : instructor,
        startDate: formatDate(dateParts[0]),
        endDate: formatDate(dateParts[1] || dateParts[0]), // Handle single date
        isOnline: room.includes("ONLN") || room.includes("Online"),
      });
    }
  }

  return { term: current_term, courses };
}
