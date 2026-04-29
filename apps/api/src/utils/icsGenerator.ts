import { ParsedCourse } from "./scheduleParser";
import { format, addDays, parseISO, isBefore, isEqual, getDay } from "date-fns";

const DAY_MAP: Record<string, number> = {
  'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
};

/**
 * Generates an RFC 5545 compliant iCalendar string
 */
export function generateICS(courses: ParsedCourse[]): string {
  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UWDegree Explorer//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-TIMEZONE:America/Toronto",
    "BEGIN:VTIMEZONE",
    "TZID:America/Toronto",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0400",
    "TZNAME:EDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0400",
    "TZOFFSETTO:-0500",
    "TZNAME:EST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE"
  ];

  for (const course of courses) {
    if (course.isOnline && !course.startTime) continue;

    const startDate = parseISO(course.startDate);
    const endDate = parseISO(course.endDate);
    
    // Find the first occurrence of the class
    let eventStart = startDate;
    const dayIndices = course.days.map(d => DAY_MAP[d]);
    
    while (!dayIndices.includes(getDay(eventStart))) {
      eventStart = addDays(eventStart, 1);
      if (isBefore(endDate, eventStart)) break;
    }

    if (isBefore(endDate, eventStart)) continue;

    const startStr = format(eventStart, "yyyyMMdd") + "T" + course.startTime.replace(":", "") + "00";
    const endStr = format(eventStart, "yyyyMMdd") + "T" + course.endTime.replace(":", "") + "00";
    const untilStr = format(endDate, "yyyyMMdd") + "T235959Z";

    ics.push("BEGIN:VEVENT");
    ics.push(`UID:${course.courseCode}-${course.type}-${course.section}-${startStr}@uwdegree.org`);
    ics.push(`DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`);
    ics.push(`DTSTART;TZID=America/Toronto:${startStr}`);
    ics.push(`DTEND;TZID=America/Toronto:${endStr}`);
    ics.push(`RRULE:FREQ=WEEKLY;BYDAY=${course.days.join(",")};UNTIL=${untilStr}`);
    ics.push(`SUMMARY:${course.courseCode} (${course.type} ${course.section})`);
    ics.push(`LOCATION:${course.room}`);
    ics.push(`DESCRIPTION:Instructor: ${course.instructor || 'TBA'}`);
    ics.push("END:VEVENT");
  }

  ics.push("END:VCALENDAR");
  return ics.join("\r\n");
}
