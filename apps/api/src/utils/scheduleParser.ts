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

function _standardize_time_range(raw_time_str: string): string {
    if (!raw_time_str || raw_time_str.includes("TBA")) {
        return "TBA";
    }
    try {
        const match = raw_time_str.match(/\d/);
        if (!match) return raw_time_str;
        const start_idx = match.index!;
        const days_part = raw_time_str.substring(0, start_idx).trim();
        const times_part = raw_time_str.substring(start_idx).trim();
        
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
            if (isValid(dt)) {
                converted_times.push(format(dt, "HH:mm"));
            } else {
                converted_times.push(t);
            }
        }
        return `${days_part} ${converted_times[0]} - ${converted_times[1]}`;
    } catch (e) {
        return raw_time_str;
    }
}

export function parseQuestSchedule(rawText: string): ParseResult {
    // Exact Python cleaning logic
    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line !== "");
    const full_text = lines.join('\n');

    // Detect Academic Term
    const term_match = full_text.match(/(Winter|Spring|Fall)\s\d{4}/);
    const current_term = term_match ? term_match[0] : "Unknown Term";

    // Split text into blocks by course headers
    // Python: re.split(r'\n([A-Z]{2,}\s\d+[A-Z]?\s-\s.+)', full_text)
    // We use a manual split to mimic the behavior of keeping the delimiter
    const course_header_regex = /\n([A-Z]{2,}\s\d+[A-Z]?\s-\s.+)/g;
    let match;
    const course_blocks: string[] = [];
    let lastIndex = 0;
    while ((match = course_header_regex.exec(full_text)) !== null) {
        course_blocks.push(full_text.substring(lastIndex, match.index));
        course_blocks.push(match[1]);
        lastIndex = course_header_regex.lastIndex;
    }
    course_blocks.push(full_text.substring(lastIndex));

    const parsed_results: ParseResult = { term: current_term, courses: [] };

    for (let i = 1; i < course_blocks.length; i += 2) {
        const course_header = course_blocks[i].trim();
        const course_body = course_blocks[i + 1];

        const code_match = course_header.match(/^([A-Z]{2,}\s\d+[A-Z]?)/);
        const course_code = code_match ? code_match[1] : "Unknown";

        // Python pattern
        const component_pattern = /(\d{3,4})\n(\d{3})\n(LEC|TUT|LAB|TST)\n([\s\S]+?)\n([\s\S]+?)\n([\s\S]+?)\n(\d{2,4}\/\d{2}\/\d{2,4})/g;
        
        let m;
        while ((m = component_pattern.exec(course_body)) !== null) {
            if (m[3] === "TST") continue;

            const standardized_time = _standardize_time_range(m[4]);
            const room = m[5].trim();
            const instructor = m[6].replace(/\n/g, ", ").trim();
            const start_date_raw = m[7];

            // For the end date, Python matched only the first date. 
            // To get the end date correctly from the line "2026/05/11 - 2026/08/05",
            // we look at the line in course_body where the date was found.
            const date_line_match = course_body.substring(m.index).split('\n').find(l => l.includes(start_date_raw));
            const end_date_raw = date_line_match?.split("-")[1]?.trim() || start_date_raw;

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

            const formatDate = (d: string) => {
                try {
                    if (d.includes("/") && d.split("/")[0].length === 4) return d.replace(/\//g, "-");
                    const p = parse(d, "MM/dd/yyyy", new Date());
                    return isValid(p) ? format(p, "yyyy-MM-dd") : d;
                } catch { return d; }
            };

            parsed_results.courses.push({
                courseCode: course_code,
                type: m[3],
                section: m[2],
                days,
                startTime: timeParts ? timeParts[2] : "TBA",
                endTime: timeParts ? timeParts[3] : "TBA",
                room,
                instructor: instructor.includes("To be Announced") ? null : instructor,
                startDate: formatDate(start_date_raw),
                endDate: formatDate(end_date_raw),
                isOnline: room.includes("ONLN") || room.includes("Online"),
            });
        }
    }

    return parsed_results;
}
