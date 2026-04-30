import { parseQuestSchedule } from "./src/utils/scheduleParser.ts";

const sampleText = `
GO!
Go To
Kaius Jin
My Academics
Course Selection (Undergrad only)
Search for Classes
Enroll
 	My Class Schedule	 	 	|	 	 	Shopping Cart	 	 	|	 	 	Add	 	 	|	 	 	Drop	 	 	|	 	 	Swap	 	 	|	 	 	Edit	 	 	|	 	 	Term Information	 	 	|	 	 	Exam Information	 
My Class Schedule
Select Display Option
List View
Weekly Calendar View
Spring 2026 | Undergraduate | University of Waterloo
Group Box
Class Schedule Filter Options Collapsible section Class Schedule Filter Options 
Show Enrolled Classes
Show Dropped Classes
Show Waitlisted Classes
AFM 102 - Intro Managerial Accounting
Status	Units	Grading	Grade	Deadlines
Enrolled
0.50
Numeric Grading Basis
Academic Calendar Deadlines
Class Nbr	Section	Component	Days & Times	Room	Instructor	Start/End Date
2213
081
LEC
TBA
ONLN - Online
Hector Abullarade Gamez
2026/05/11 - 2026/08/05
CS 245 - Logic & Computation
Status	Units	Grading	Grade	Deadlines
Enrolled
0.50
Numeric Grading Basis
Academic Calendar Deadlines
Class Nbr	Section	Component	Days & Times	Room	Instructor	Start/End Date
3677
201
TST
W 7:00PM - 8:50PM
TBA
Dalibor Dvorski
2026/06/17 - 2026/06/17
3741
002
LEC
TTh 1:00PM - 2:20PM
MC 2017
Shalev Ben-David
2026/05/11 - 2026/08/05
4033
105
TUT
F 2:30PM - 3:20PM
MC 4042
To be Announced
2026/05/11 - 2026/08/05
CS 246 - Obj-Oriented Soft Dev
Status	Units	Grading	Grade	Deadlines
Enrolled
0.50
Numeric Grading Basis
Academic Calendar Deadlines
Class Nbr	Section	Component	Days & Times	Room	Instructor	Start/End Date
3611
002
LEC
TTh 11:30AM - 12:50PM
MC 2017
Adrian Reetz
2026/05/11 - 2026/08/05
3673
201
TST
Th 4:30PM - 6:20PM
TBA
Patrick Roh
2026/06/25 - 2026/06/25
3841
105
TUT
W 2:30PM - 3:20PM
MC 3003
To be Announced
2026/05/11 - 2026/08/05
ECON 101 - Intro Microeconomics
Status	Units	Grading	Grade	Deadlines
Enrolled
0.50
Numeric Grading Basis
Academic Calendar Deadlines
Class Nbr	Section	Component	Days & Times	Room	Instructor	Start/End Date
2379
081
LEC
TBA
ONLN - Online
Corey Van De Waal
2026/05/11 - 2026/08/05
MATH 239 - Intro Combinatorics
Status	Units	Grading	Grade	Deadlines
Enrolled
0.50
Numeric Grading Basis
Academic Calendar Deadlines
Class Nbr	Section	Component	Days & Times	Room	Instructor	Start/End Date
3645
002
LEC
MWF 10:30AM - 11:20AM
STC 0020
Oliver Pechenik
2026/05/11 - 2026/08/05
3650
102
TUT
T 9:30AM - 10:20AM
MC 4020
To be Announced
2026/05/11 - 2026/08/05
3663
201
TST
Th 7:00PM - 8:50PM
TBA
To be Announced
2026/06/04 - 2026/06/04
 
 	
 
Th 7:00PM - 8:50PM
TBA
To be Announced
2026/07/09 - 2026/07/09
PD 1 - Career Fundamentals
Status	Units	Grading	Grade	Deadlines
Enrolled
0.50
Credit/No Credit Co-op
Academic Calendar Deadlines
Class Nbr	Section	Component	Days & Times	Room	Instructor	Start/End Date
4472
081
LEC
TBA
ONLN - Online
Andrea Prier,
Olivia Muysson
2026/05/11 - 2026/08/05
STAT 230 - Probability
Status	Units	Grading	Grade	Deadlines
Enrolled
0.50
Numeric Grading Basis
Academic Calendar Deadlines
Class Nbr	Section	Component	Days & Times	Room	Instructor	Start/End Date
3587
001
LEC
MWF 11:30AM - 12:20PM
M3 1006
Surya Banerjee
2026/05/11 - 2026/08/05
3770
201
TST
T 4:30PM - 6:20PM
TBA
Surya Banerjee
2026/06/02 - 2026/06/02
 
 	
 
T 4:30PM - 6:20PM
TBA
Surya Banerjee
2026/07/14 - 2026/07/14
3821
102
TUT
F 1:30PM - 2:20PM
M3 1006
Surya Banerjee
2026/05/11 - 2026/08/05
Printer Friendly Page
Go to top iconGo to top
`;

try {
  console.log("Starting test parse...");
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
