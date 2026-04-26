import { ASTNode } from "../types/ast";

export interface EvaluationContext {
  completedCourses: Set<string>; // e.g. "CS135", "MATH136"
  currentLevel: string;          // e.g. "3A"
  currentPrograms: string[];     // e.g. ["Computer Science", "Honours Mathematics"]
  totalUnits: number;
}

export function evaluate(node: ASTNode, context: EvaluationContext): boolean {
  switch (node.type) {
    case 'AND':
      return node.children.every(child => evaluate(child, context));
    
    case 'OR':
      return node.children.some(child => evaluate(child, context));
    
    case 'COURSE': {
      const courseCode = `${node.subject}${node.catalog}`.toUpperCase();
      return context.completedCourses.has(courseCode);
    }

    case 'LEVEL': {
      // Basic level comparison: 1A < 1B < 2A < 2B ...
      const levels = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'];
      const currentIdx = levels.indexOf(context.currentLevel);
      const targetIdx = levels.indexOf(node.level);
      
      if (node.operator === '>=') return currentIdx >= targetIdx;
      if (node.operator === '==') return currentIdx === targetIdx;
      if (node.operator === '<=') return currentIdx <= targetIdx;
      return false;
    }

    case 'PROGRAM': {
      const hasMatch = node.programs.some(p => 
        context.currentPrograms.some(cp => cp.toLowerCase().includes(p.toLowerCase()))
      );
      return node.rule === 'INCLUDE' ? hasMatch : !hasMatch;
    }

    case 'UNIT': {
      // This is complex and usually requires counting units in the context
      // For now, return false as a placeholder or implement basic logic
      return false; 
    }

    case 'RAW_TEXT':
      // Raw text requires manual review, so we default to false or true depending on policy
      return false;

    default:
      return false;
  }
}
