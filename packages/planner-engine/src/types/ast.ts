export type NodeType = 'AND' | 'OR' | 'COURSE' | 'LEVEL' | 'PROGRAM' | 'UNIT' | 'RAW_TEXT';

export interface BaseNode {
  type: NodeType;
}

export interface LogicalNode extends BaseNode {
  type: 'AND' | 'OR';
  children: ASTNode[];
}

export interface CourseNode extends BaseNode {
  type: 'COURSE';
  subject: string;
  catalog: string;
  minGrade?: number;
  concurrent?: boolean;
}

export interface LevelNode extends BaseNode {
  type: 'LEVEL';
  operator: '>=' | '==' | '<=';
  level: string;
}

export interface ProgramNode extends BaseNode {
  type: 'PROGRAM';
  rule: 'INCLUDE' | 'EXCLUDE';
  programs: string[];
}

export interface UnitNode extends BaseNode {
  type: 'UNIT';
  operator: '>=' | '<=';
  units: number;
  subjects: string[];
  levelRestriction?: string;
}

export interface RawTextNode extends BaseNode {
  type: 'RAW_TEXT';
  text: string;
}

export type ASTNode = 
  | LogicalNode 
  | CourseNode 
  | LevelNode 
  | ProgramNode 
  | UnitNode 
  | RawTextNode;
