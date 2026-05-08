export type CourseInput = {
  courseCode: string; // e.g., "CS 240"
  subject: string;    // e.g., "CS"
  catalog: string;    // e.g., "240"
  units: number;      // e.g., 0.5
  category?: string;  // e.g., "Social Sciences"
  isList1?: boolean;
  isList2?: boolean;
};

export type RuleType = "exact" | "regex" | "category" | "list1" | "list2" | "free";

export interface DegreeRule {
  id: string;
  name: string;
  type: RuleType;
  unitsRequired: number;
  
  // Conditionally used based on 'type'
  exactCourses?: string[];   // For "exact"
  pattern?: RegExp;          // For "regex"
  categoryName?: string;     // For "category"
  
  // Result tracking
  satisfiedUnits: number;
  consumedCourses: string[];
}

export class DegreeEngine {
  private rules: DegreeRule[];

  constructor(rules: DegreeRule[]) {
    // Clone rules to maintain state
    this.rules = rules.map(r => ({
      ...r,
      satisfiedUnits: 0,
      consumedCourses: []
    }));
  }

  public evaluate(transcript: CourseInput[]) {
    // 1. Create a pool of available courses
    let availableCourses = [...transcript];

    // Priority 1: Exact matches (Core Courses)
    this.processRulesOfType("exact", availableCourses, (rule, course) => {
      return rule.exactCourses!.includes(course.courseCode);
    });

    // Priority 2: Communication Lists
    this.processRulesOfType("list1", availableCourses, (rule, course) => !!course.isList1);
    this.processRulesOfType("list2", availableCourses, (rule, course) => !!course.isList2);

    // Priority 3: Regex Matches (e.g., any CS 3xx or 4xx)
    this.processRulesOfType("regex", availableCourses, (rule, course) => {
      return rule.pattern!.test(course.courseCode);
    });

    // Priority 4: Category Matches (Breadth Requirements)
    this.processRulesOfType("category", availableCourses, (rule, course) => {
      return course.category === rule.categoryName;
    });

    // Priority 5: Free Electives (catch-all)
    this.processRulesOfType("free", availableCourses, (rule, course) => true);

    // Generate Report
    const totalRequired = this.rules.reduce((acc, r) => acc + r.unitsRequired, 0);
    const totalSatisfied = this.rules.reduce((acc, r) => acc + r.satisfiedUnits, 0);
    
    return {
      isComplete: totalSatisfied >= totalRequired,
      totalUnitsRequired: totalRequired,
      totalUnitsSatisfied: totalSatisfied,
      rulesDetails: this.rules,
      unusedCourses: availableCourses // Courses that didn't fit anywhere
    };
  }

  private processRulesOfType(
    targetType: RuleType, 
    availableCourses: CourseInput[], 
    evaluator: (rule: DegreeRule, course: CourseInput) => boolean
  ) {
    const targetRules = this.rules.filter(r => r.type === targetType);
    
    for (const rule of targetRules) {
      // While the rule still needs units, try to find matching courses
      for (let i = availableCourses.length - 1; i >= 0; i--) {
        if (rule.satisfiedUnits >= rule.unitsRequired) break; // Rule satisfied

        const course = availableCourses[i];
        if (evaluator(rule, course)) {
          // Determine how many units we can consume from this course for this rule
          const needed = rule.unitsRequired - rule.satisfiedUnits;
          const toConsume = Math.min(needed, course.units);
          
          rule.satisfiedUnits += toConsume;
          rule.consumedCourses.push(course.courseCode);
          
          // Deduct units from course. If 0, remove from available pool
          course.units -= toConsume;
          if (course.units <= 0) {
            availableCourses.splice(i, 1);
          }
        }
      }
    }
  }
}

// ==========================================
// MVP Data: Partial BCS Degree Requirements
// ==========================================
export const bcsMvpRules: DegreeRule[] = [
  {
    id: "core_math",
    name: "Core Math (MATH 135, 136, 239, STAT 230, 231)",
    type: "exact",
    exactCourses: ["MATH 135", "MATH 136", "MATH 239", "STAT 230", "STAT 231"],
    unitsRequired: 2.5,
    satisfiedUnits: 0,
    consumedCourses: []
  },
  {
    id: "core_cs",
    name: "Core CS (CS 135, 136, 240, 241, 245, 246, 251, 341, 350)",
    type: "exact",
    exactCourses: ["CS 135", "CS 136", "CS 240", "CS 241", "CS 245", "CS 246", "CS 251", "CS 341", "CS 350"],
    unitsRequired: 4.5,
    satisfiedUnits: 0,
    consumedCourses: []
  },
  {
    id: "comm_1",
    name: "Communication List I",
    type: "list1",
    unitsRequired: 0.5,
    satisfiedUnits: 0,
    consumedCourses: []
  },
  {
    id: "comm_2",
    name: "Communication List II",
    type: "list2",
    unitsRequired: 0.5,
    satisfiedUnits: 0,
    consumedCourses: []
  },
  {
    id: "cs_electives",
    name: "CS 3xx/4xx Electives",
    type: "regex",
    pattern: /^CS\s[34]\d{2}$/, // Matches CS 3xx or 4xx
    unitsRequired: 1.5,
    satisfiedUnits: 0,
    consumedCourses: []
  },
  {
    id: "breadth_social",
    name: "Social Science Breadth",
    type: "category",
    categoryName: "Social Sciences",
    unitsRequired: 1.0,
    satisfiedUnits: 0,
    consumedCourses: []
  },
  {
    id: "free_electives",
    name: "Additional Free Electives",
    type: "free",
    unitsRequired: 3.0,
    satisfiedUnits: 0,
    consumedCourses: []
  }
];
