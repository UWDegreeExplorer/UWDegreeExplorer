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
  isConstraint?: boolean;
  
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

  public evaluate(transcript: CourseInput[], assignments: Record<string, string[]> = {}) {
    // 1. Create a pool of available courses
    let availableCourses = [...transcript.map(c => ({ ...c }))];

    // Priority 0: Explicit assignments (Manual overrides)
    for (const ruleId in assignments) {
      const rule = this.rules.find(r => r.id === ruleId);
      if (!rule) continue;
      
      const assignedCodes = assignments[ruleId];
      for (const code of assignedCodes) {
        if (rule.satisfiedUnits >= rule.unitsRequired) break;
        
        const idx = availableCourses.findIndex(c => c.courseCode === code && c.units > 0);
        if (idx !== -1) {
          const course = availableCourses[idx];
          const needed = rule.unitsRequired - rule.satisfiedUnits;
          const toConsume = Math.min(needed, course.units);
          
          rule.satisfiedUnits += toConsume;
          rule.consumedCourses.push(course.courseCode);
          course.units -= toConsume;
          if (course.units <= 0) availableCourses.splice(idx, 1);
        }
      }
    }

    // Priority 1: Exact matches (Core Courses)
    this.processRulesOfType("exact", availableCourses, (rule, course) => {
      return rule.exactCourses!.includes(course.courseCode);
    });

    // Priority 2: Communication Lists
    this.processRulesOfType("list1", availableCourses, (rule, course) => !!course.isList1);
    this.processRulesOfType("list2", availableCourses, (rule, course) => !!course.isList2);

    // Priority 3: Regex Matches (e.g., any CS 3xx or 4xx)
    this.processRulesOfType("regex", availableCourses, (rule, course) => {
      return rule.pattern! && new RegExp(rule.pattern).test(course.courseCode);
    });

    // Priority 4: Category Matches (Breadth Requirements)
    this.processRulesOfType("category", availableCourses, (rule, course) => {
      return course.category === rule.categoryName;
    });

    // Priority 5: Free Electives (catch-all)
    this.processRulesOfType("free", availableCourses, (rule, course) => true);

    // Generate Report
    const totalRequired = this.rules.filter(r => !r.isConstraint).reduce((acc, r) => acc + r.unitsRequired, 0);
    const totalSatisfied = this.rules.filter(r => !r.isConstraint).reduce((acc, r) => acc + (r.satisfiedUnits || 0), 0);
    
    // Group rules by their defined group property if available, otherwise "Default"
    const groupsMap = new Map<string, any[]>();
    this.rules.filter(r => !r.isConstraint).forEach(r => {
      const g = (r as any).group || "Requirements";
      if (!groupsMap.has(g)) groupsMap.set(g, []);
      groupsMap.get(g)!.push({
        name: r.name,
        unitsRequired: r.unitsRequired,
        satisfiedUnits: r.satisfiedUnits,
        isSatisfied: r.satisfiedUnits >= r.unitsRequired,
        consumedCourses: r.consumedCourses
      });
    });

    const groups = Array.from(groupsMap.entries()).map(([name, rules]) => ({ name, rules }));

    return {
      isComplete: totalSatisfied >= totalRequired,
      totalUnitsRequired: totalRequired,
      totalUnitsSatisfied: totalSatisfied,
      groups,
      unusedCourses: availableCourses
    };
  }

  public evaluateConstraints(transcript: CourseInput[], options: Record<string, any> = {}) {
    const constraints = this.rules.filter(r => r.isConstraint);
    return constraints.map(c => {
      let isMet = true;
      let message = "Requirement met";

      // Simple implementation for common constraints
      if (c.id === 'coop_requirement') {
        isMet = options.is_coop ? true : true; // logic placeholder
        message = options.is_coop ? "Co-op sequence active" : "Regular sequence";
      }

      return {
        name: c.name,
        isMet,
        message
      };
    });
  }

  private processRulesOfType(
    targetType: RuleType, 
    availableCourses: any[], 
    evaluator: (rule: any, course: CourseInput) => boolean
  ) {
    const targetRules = this.rules.filter(r => r.type === targetType && !r.isConstraint);
    
    for (const rule of targetRules) {
      for (let i = availableCourses.length - 1; i >= 0; i--) {
        if (rule.satisfiedUnits >= rule.unitsRequired) break;

        const course = availableCourses[i];
        if (evaluator(rule, course)) {
          const needed = rule.unitsRequired - rule.satisfiedUnits;
          const toConsume = Math.min(needed, course.units);
          
          rule.satisfiedUnits += toConsume;
          rule.consumedCourses.push(course.courseCode);
          
          course.units -= toConsume;
          if (course.units <= 0) {
            availableCourses.splice(i, 1);
          }
        }
      }
    }
  }
}
