import { parseQuestSchedule } from "./src/utils/scheduleParser.ts";

const sampleText = `
GO!
Go To
Kaius Jin
My Academics
Course Selection (Undergrad only)
Search for Classes
Enroll
    My Class Schedule           |           Shopping Cart           |           Add         |           Drop            |           Swap            |           Edit            |           Term Information            |           Exam Information     
My Class Schedule
Select Display Option
List View
Weekly Calendar View
Winter 2026 | Undergraduate | University of Waterloo
Group Box
Class Schedule Filter Options Collapsible section Class Schedule Filter Options 
Show Enrolled Classes
Show Dropped Classes
Show Waitlisted Classes
COMMST 225 - Interviewing
Status  Units   Grading Grade   Deadlines
Enrolled
0.50
Numeric Grading Basis
Academic Calendar Deadlines
Class Nbr   Section Component   Days & Times    Room    Instructor  Start/End Date
3929
001
LEC
TTh 12:30 - 14:20
SJ1 2011
Shira Schwartz
2026/01/05 - 2026/04/06
CS 136 - Elem Algo Dsgn & Data Abstrac
Status  Units   Grading Grade   Deadlines
Enrolled
0.50
Numeric Grading Basis
Academic Calendar Deadlines
Class Nbr   Section Component   Days & Times    Room    Instructor  Start/End Date
5943
201
TST
M 19:00 - 20:50
TBA
Dalibor Dvorski
2026/03/02 - 2026/03/02
6096
006
LEC
TTh 10:00 - 11:20
DWE 2527
Nomair Naeem
2026/01/05 - 2026/04/06
7645
108
TUT
W 16:30 - 17:20
MC 4040
To be Announced
2026/01/05 - 2026/04/06
CS 136L - Tools & Tech for Software Dev
Status  Units   Grading Grade   Deadlines
Enrolled
0.25
Credit / Non-Credit Basis
Academic Calendar Deadlines
Class Nbr   Section Component   Days & Times    Room    Instructor  Start/End Date
6369
004
LAB
T 11:30 - 12:20
MC 3003
Sylvie Lynne Davies
2026/01/05 - 2026/04/06
FR 101 - Beginner French
Status  Units   Grading Grade   Deadlines
Enrolled
0.50
Numeric Grading Basis
Academic Calendar Deadlines
Class Nbr   Section Component   Days & Times    Room    Instructor  Start/End Date
3697
081
LEC
TBA
ONLN - Online
Mikalai Kliashchuk
2026/01/05 - 2026/04/06
MATH 136 - Linear Algebra 1 (Honours)
Status  Units   Grading Grade   Deadlines
Enrolled
0.50
Numeric Grading Basis
Academic Calendar Deadlines
Class Nbr   Section Component   Days & Times    Room    Instructor  Start/End Date
5836
004
LEC
MWF 11:30 - 12:20
RCH 301
Bruno Barbosa
2026/01/05 - 2026/04/06
5976
201
TST
M 19:00 - 20:50
TBA
To be Announced
2026/02/09 - 2026/02/09
6229
103
TUT
M 16:30 - 17:50
M3 1006
To be Announced
2026/01/05 - 2026/04/06
MATH 138 - Calculus 2 (Honours)
Status  Units   Grading Grade   Deadlines
Enrolled
0.50
Numeric Grading Basis
Academic Calendar Deadlines
Class Nbr   Section Component   Days & Times    Room    Instructor  Start/End Date
5877
006
LEC
MWF 13:30 - 14:20
STC 0050
Carrie Knoll
2026/01/05 - 2026/04/06
5977
201
TST
M 19:00 - 20:50
TBA
To be Announced
2026/02/23 - 2026/02/23
6185
104
TUT
Th 16:30 - 17:20
EXP 1689
To be Announced
2026/01/05 - 2026/04/06
STAT 230 - Probability
Status  Units   Grading Grade   Deadlines
Enrolled
0.50
Numeric Grading Basis
Academic Calendar Deadlines
Class Nbr   Section Component   Days & Times    Room    Instructor  Start/End Date
5769
001
LEC
MWF 14:30 - 15:20
DC 1350
Chelsea Uggenti
2026/01/05 - 2026/04/06
6158
103
TUT
F 09:30 - 10:20
MC 2017
Yi Shen
2026/01/05 - 2026/04/06
6357
201
TST
Th 19:00 - 20:20
TBA
Han Le,
Chelsea Uggenti,
Yi Shen
2026/02/12 - 2026/02/12
 
    
 
Th 19:00 - 20:20
TBA
Chelsea Uggenti,
Yi Shen,
Han Le
2026/03/19 - 2026/03/19
Printer Friendly Page
Go to top iconGo to top
`;

try {
  console.log("Starting test parse with NEW text...");
  const result = parseQuestSchedule(sampleText);
  console.log("Term:", result.term);
  console.log("Found", result.courses.length, "courses.");
  
  result.courses.forEach((c, idx) => {
    console.log(`\n[${idx + 1}] ${c.courseCode} ${c.type}`);
    console.log(`    Time: ${c.days.join(",")} ${c.startTime} - ${c.endTime}`);
    console.log(`    Room: ${c.room}`);
    console.log(`    Instructor: ${c.instructor}`);
    console.log(`    Dates: ${c.startDate} to ${c.endDate}`);
  });
} catch (err) {
  console.error("FAILED to parse:", err);
}
