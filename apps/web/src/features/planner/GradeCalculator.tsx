import React, { useState, useEffect, useMemo } from "react";
import { 
  Trash2, 
  Calculator, 
  ChevronRight, 
  ChevronDown, 
  Target, 
  TrendingUp, 
  AlertCircle,
  GraduationCap,
  RefreshCw,
  FolderPlus,
  FilePlus,
  MoreVertical,
  ArrowLeft,
  Calendar,
  GripVertical
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { customFetch, useGetCurrentUser } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

import { LoginRequired } from "@/components/shared/LoginRequired";

interface GradeComponent {
  id: number;
  courseGradeId: number;
  parentId: number | null;
  name: string;
  weight: number;
  score: number | null;
  isLeaf: boolean;
  updatedAt?: string | Date;
}

interface CourseGrade {
  id: number;
  term: string;
  courseCode: string;
  targetGrade: number;
  components: GradeComponent[];
  isActive?: boolean;
  currentGrade?: number;
  totalWeight?: number;
}

export const GradeCalculator: React.FC = () => {
  const { data: userData } = useGetCurrentUser();
  const currentUser = userData?.user;
  const [courseSummaries, setCourseSummaries] = useState<CourseGrade[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseGrade | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (currentUser) {
      fetchSummaries();
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <LoginRequired 
        title="Grade Calculator" 
        description="Sync your courses from the calendar and track your assignments, exams, and target grades in one place. Sign in to start managing your academic performance."
        icon={<Calculator size={48} className="text-primary/20" />}
      />
    );
  }

  const fetchSummaries = async () => {
    setIsLoading(true);
    try {
      const data = await customFetch<CourseGrade[]>("/api/planner/grades");
      setCourseSummaries(data);
    } catch (err) {
      toast({ title: "Failed to load grades", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      await customFetch("/api/planner/grades/sync", { method: "POST" });
      await fetchSummaries();
      toast({ title: "Courses Synced", description: "Updated courses from your calendar." });
    } catch (err) {
      toast({ title: "Sync Failed", variant: "destructive" });
    }
  };

  const loadCourseDetail = async (term: string, code: string) => {
    setIsLoading(true);
    try {
      const data = await customFetch<CourseGrade>(`/api/planner/grades/${encodeURIComponent(term)}/${encodeURIComponent(code)}`);
      setSelectedCourse(data);
    } catch (err) {
      toast({ title: "Failed to load course details", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComponent = async (parentId: number | null, isLeaf: boolean) => {
    if (!selectedCourse) return;
    try {
      const newComp = await customFetch<GradeComponent>("/api/planner/grades/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseGradeId: selectedCourse.id,
          parentId,
          name: isLeaf ? "New Item" : "New Category",
          weight: 0,
          score: isLeaf ? 0 : null,
          isLeaf
        })
      });
      setSelectedCourse({
        ...selectedCourse,
        components: [...selectedCourse.components, newComp]
      });
    } catch (err) {
      toast({ title: "Failed to add item", variant: "destructive" });
    }
  };

  const handleDeleteComponent = async (id: number) => {
    try {
      await customFetch(`/api/planner/grades/components/${id}`, { method: "DELETE" });
      setSelectedCourse({
        ...selectedCourse!,
        components: selectedCourse!.components.filter(c => c.id !== id && c.parentId !== id)
      });
    } catch (err) {
      toast({ title: "Failed to delete item", variant: "destructive" });
    }
  };

  const handleUpdateComponent = async (comp: GradeComponent) => {
    try {
      await customFetch("/api/planner/grades/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comp)
      });
      setSelectedCourse({
        ...selectedCourse!,
        components: selectedCourse!.components.map(c => c.id === comp.id ? comp : c)
      });
    } catch (err) {
      toast({ title: "Failed to update item", variant: "destructive" });
    }
  };

  const handleDeleteCourse = async (id: number) => {
    try {
      await customFetch(`/api/planner/grades/course/${id}`, { method: "DELETE" });
      setCourseSummaries(courseSummaries.filter(c => c.id !== id));
      toast({ title: "Course Removed" });
    } catch (err) {
      toast({ title: "Failed to delete course", variant: "destructive" });
    }
  };

  const handleUpdateTargetGrade = async (val: number) => {
    if (!selectedCourse) return;
    try {
      const updated = await customFetch<CourseGrade>(`/api/planner/grades/course/${selectedCourse.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetGrade: val })
      });
      setSelectedCourse({
        ...selectedCourse,
        targetGrade: updated.targetGrade
      });
      setCourseSummaries(courseSummaries.map(c => c.id === updated.id ? { ...c, targetGrade: updated.targetGrade } : c));
    } catch (err) {
      toast({ title: "Failed to update target grade", variant: "destructive" });
    }
  };

  const groupedTerms = useMemo(() => {
    const groups: Record<string, CourseGrade[]> = {};
    courseSummaries.forEach(c => {
      if (!groups[c.term]) groups[c.term] = [];
      groups[c.term].push(c);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [courseSummaries]);

  const totals = useMemo(() => {
    if (!selectedCourse) return { current: 0, totalWeight: 0 };
    
    const calculateNode = (nodes: GradeComponent[], parentId: number | null, depth: number): number => {
      if (depth > 10) return 0;
      let contribution = 0;
      const children = nodes.filter(n => n.parentId === parentId);
      for (const child of children) {
        if (child.isLeaf) {
          contribution += (child.score || 0) * (child.weight / 100);
        } else {
          contribution += calculateNode(nodes, child.id, depth + 1) * (child.weight / 100);
        }
      }
      return contribution;
    };

    return { 
      current: calculateNode(selectedCourse.components, null, 0),
      totalWeight: selectedCourse.components.reduce((acc, curr) => curr.parentId === null ? acc + curr.weight : acc, 0)
    };
  }, [selectedCourse]);

  // View 1: Detailed Course Editor
  if (selectedCourse) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" onClick={() => setSelectedCourse(null)} className="h-10 w-10">
            <ArrowLeft size={24} />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <Badge variant="secondary" className="font-mono px-2 py-0 text-xs font-bold uppercase">{selectedCourse.term}</Badge>
              <h1 className="text-4xl font-black tracking-tight">{selectedCourse.courseCode}</h1>
            </div>
            <p className="text-muted-foreground font-medium text-sm">Real-time grade forecasting and syllabus breakdown.</p>
          </div>
          <Button variant="outline" className="gap-2 border-2 hover:bg-muted" onClick={() => loadCourseDetail(selectedCourse.term, selectedCourse.courseCode)}>
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            Refresh Data
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="bg-primary/[0.03] border-primary/20 relative overflow-hidden shadow-sm">
            <div className="absolute -right-4 -bottom-4 opacity-5">
              <TrendingUp size={120} />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Current Total</CardDescription>
              <CardTitle className="text-5xl font-black text-primary">{totals.current.toFixed(1)}<span className="text-sm opacity-50 ml-1 font-bold">/ 100</span></CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={totals.current} className="h-1.5 bg-primary/10" />
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-2 border-dashed bg-card/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em]">Weight Defined</CardDescription>
              <CardTitle className="text-5xl font-black">{totals.totalWeight.toFixed(0)}<span className="text-sm opacity-50 ml-1 font-bold">%</span></CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={totals.totalWeight} className="h-1.5" />
            </CardContent>
          </Card>

          <Card className="bg-card border-2 shadow-sm flex flex-col justify-between p-6">
              <div className="flex justify-between items-start">
                 <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Target Grade</span>
                 <div className="relative group/input">
                    <Input 
                      type="number"
                      className="h-8 w-20 text-right pr-6 font-black text-sm bg-indigo-50 border-indigo-200 text-indigo-700 focus-visible:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      defaultValue={selectedCourse.targetGrade}
                      onBlur={(e) => handleUpdateTargetGrade(parseFloat(e.target.value) || 80)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateTargetGrade(parseFloat((e.target as HTMLInputElement).value) || 80)}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-400">%</span>
                 </div>
              </div>
             <div className="pt-4 space-y-1">
                <div className="text-[10px] uppercase text-muted-foreground font-black tracking-tight">Required avg. remaining</div>
                <div className="text-3xl font-black text-indigo-500">
                  {totals.totalWeight < 100 
                    ? `${((selectedCourse.targetGrade - totals.current) / (100 - totals.totalWeight) * 100).toFixed(1)}%`
                    : "Reached"}
                </div>
             </div>
          </Card>
        </div>

        <Card className="border-2 shadow-md overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between bg-muted/30 border-b py-5 px-8">
            <div className="space-y-1">
              <CardTitle className="text-xl font-black">Syllabus Breakdown</CardTitle>
              <CardDescription className="font-medium">Map your assignments and exams to track progress.</CardDescription>
            </div>
            <div className="flex bg-background rounded-lg border-2 p-1 gap-1">
              <Button size="sm" variant="ghost" className="gap-2 h-8 px-3 font-bold text-xs" onClick={() => handleAddComponent(null, false)}>
                <FolderPlus size={14} className="text-primary" /> Category
              </Button>
              <Separator orientation="vertical" className="h-4 self-center" />
              <Button size="sm" variant="ghost" className="gap-2 h-8 px-3 font-bold text-xs" onClick={() => handleAddComponent(null, true)}>
                <FilePlus size={14} className="text-primary" /> Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
             <div className="divide-y-2 divide-border/50">
                {selectedCourse.components.filter(c => c.parentId === null).map((comp) => (
                  <ComponentRow 
                    key={`${comp.id}-${comp.updatedAt || ''}`} 
                    component={comp} 
                    allComponents={selectedCourse.components}
                    onUpdate={handleUpdateComponent}
                    onDelete={handleDeleteComponent}
                    onAddChild={handleAddComponent}
                  />
                ))}
                {selectedCourse.components.filter(c => c.parentId === null).length === 0 && (
                  <div className="py-32 text-center text-muted-foreground space-y-6">
                    <div className="flex justify-center"><Calculator className="opacity-10" size={80} /></div>
                    <div className="space-y-1">
                      <p className="text-lg font-black text-foreground/50">Your breakdown is empty</p>
                      <p className="text-sm font-medium">Start by adding a high-level category like "Assignments" or "Exams".</p>
                    </div>
                  </div>
                )}
             </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // View 2: Courses within a selected Term
  if (selectedTerm) {
    const coursesInTerm = courseSummaries.filter(c => c.term === selectedTerm);
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in slide-in-from-right-4 duration-500">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedTerm(null)}>
            <ArrowLeft size={20} />
          </Button>
          <div className="flex-1">
            <h1 className="text-4xl font-black tracking-tighter">{selectedTerm}</h1>
            <p className="text-muted-foreground font-medium">Pick a course to manage your grades.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {coursesInTerm.map((course) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              onClick={() => loadCourseDetail(course.term, course.courseCode)}
            >
              <Card className="cursor-pointer group hover:border-primary/50 transition-all border-2 bg-card/50 backdrop-blur-sm overflow-hidden relative shadow-md hover:shadow-xl p-2">
                <CardHeader className="flex flex-row items-center justify-between pb-6">
                  <div className="space-y-1">
                    <CardTitle className="text-3xl font-black tracking-tight">{course.courseCode}</CardTitle>
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{course.term}</div>
                  </div>
                  {course.isActive === false ? (
                    <Badge variant="destructive" className="text-[10px] font-black uppercase px-2 py-0">Archived</Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-black uppercase px-2 py-0">Active</Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Current Score</div>
                      <div className="text-4xl font-black text-primary">{(course.currentGrade || 0).toFixed(1)}<span className="text-sm opacity-40 ml-1">/ 100</span></div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Progress</div>
                      <div className="text-4xl font-black">{(course.totalWeight || 0).toFixed(0)}<span className="text-sm opacity-40 ml-1">%</span></div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-muted-foreground">Syllabus Completion</span>
                      <span className="text-primary">{course.totalWeight}%</span>
                    </div>
                    <Progress value={course.totalWeight} className="h-2 bg-primary/10" />
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-500">
                      <Target size={14} /> Target: {course.targetGrade}%
                    </div>
                    <Button size="sm" variant="outline" className="group-hover:bg-primary group-hover:text-primary-foreground border-2 font-black px-6 h-10 transition-all">
                      Open Gradebook <ChevronRight size={14} className="ml-1" />
                    </Button>
                  </div>

                  {course.isActive === false && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 h-8 w-8 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCourse(course.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // View 3: Term Selection (Initial View)
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <h1 className="text-5xl font-black tracking-tighter flex items-center gap-4">
            <Calculator className="text-primary h-12 w-12" />
            Grades
          </h1>
          <p className="text-muted-foreground font-medium text-lg italic">Organized by academic term.</p>
        </div>
        <Button onClick={handleSync} className="gap-2 h-12 px-6 shadow-xl shadow-primary/20 font-black rounded-xl">
          <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          Sync Calendar
        </Button>
      </div>

      {isLoading && courseSummaries.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-56 animate-pulse bg-muted/20 rounded-2xl border-2" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {groupedTerms.map(([term, courses]) => (
            <motion.div
              key={term}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ y: -6 }}
              onClick={() => setSelectedTerm(term)}
            >
              <Card className="cursor-pointer border-2 border-transparent hover:border-primary/50 transition-all bg-card shadow-lg hover:shadow-xl overflow-hidden relative rounded-2xl group">
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                  <Calendar size={120} />
                </div>
                <CardHeader className="pb-4 pt-8 text-center">
                  <CardTitle className="text-2xl font-black tracking-tight">{term}</CardTitle>
                  <CardDescription className="font-bold text-primary">{courses.length} Active Courses</CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-8">
                  <Button variant="secondary" className="w-full justify-between font-black group-hover:bg-primary group-hover:text-primary-foreground transition-colors h-11">
                    Open Term <ChevronRight size={16} />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          
          {courseSummaries.length === 0 && !isLoading && (
            <Card className="col-span-full py-32 border-4 border-dashed bg-muted/5 rounded-3xl flex flex-col items-center justify-center text-center">
              <Target size={100} className="text-muted-foreground/10 mb-6" />
              <div className="space-y-2 mb-8">
                <h3 className="text-3xl font-black tracking-tight">Fresh Start?</h3>
                <p className="text-muted-foreground font-medium max-w-sm mx-auto">
                  Pull your current courses from the calendar to start tracking your grades and predicting outcomes.
                </p>
              </div>
              <Button onClick={handleSync} size="lg" className="gap-3 h-14 px-8 rounded-2xl font-black text-lg shadow-lg">
                <RefreshCw size={20} /> Sync Now
              </Button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

interface ComponentRowProps {
  component: GradeComponent;
  allComponents: GradeComponent[];
  onUpdate: (comp: GradeComponent) => void;
  onDelete: (id: number) => void;
  onAddChild: (parentId: number, isLeaf: boolean) => void;
  depth?: number;
}

const ComponentRow: React.FC<ComponentRowProps> = ({ 
  component, 
  allComponents, 
  onUpdate, 
  onDelete, 
  onAddChild,
  depth = 0 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const children = allComponents.filter(c => c.parentId === component.id);
  
  const [localName, setLocalName] = useState(component.name);
  const [localWeight, setLocalWeight] = useState((component.weight || 0).toString());
  const [localScore, setLocalScore] = useState((component.score || 0).toString());

  // Instead of useEffects, we use the component ID/updatedAt as a key from the parent 
  // to force a fresh component state when properties change significantly.

  const commitName = () => {
    if (localName.trim() !== "" && localName !== component.name) {
      onUpdate({ ...component, name: localName });
    } else {
      setLocalName(component.name);
    }
  };

  const commitWeight = () => {
    const w = parseFloat(localWeight);
    if (!isNaN(w) && w !== component.weight) {
      onUpdate({ ...component, weight: w });
    } else {
      setLocalWeight((component.weight || 0).toString());
    }
  };

  const commitScore = () => {
    const s = parseFloat(localScore);
    if (!isNaN(s) && s !== component.score) {
      onUpdate({ ...component, score: s });
    } else {
      setLocalScore((component.score || 0).toString());
    }
  };

  const handleAddChildClick = (isLeaf: boolean) => {
    setIsExpanded(true);
    onAddChild(component.id, isLeaf);
  };

  const categoryTotal = useMemo(() => {
    if (component.isLeaf) return 0;
    
    const calculateSum = (nodes: GradeComponent[], parentId: number, currentDepth: number): number => {
      if (currentDepth > 10) return 0; // Safety break
      let sum = 0;
      const childs = nodes.filter(n => n.parentId === parentId);
      for (const c of childs) {
        if (c.isLeaf) sum += (c.score || 0) * (c.weight / 100);
        else sum += calculateSum(nodes, c.id, currentDepth + 1) * (c.weight / 100);
      }
      return sum;
    };
    
    try {
      return calculateSum(allComponents, component.id, 0);
    } catch (e) {
      console.error("Recursive calculation error:", e);
      return 0;
    }
  }, [component.id, component.isLeaf, allComponents]);

  return (
    <div className="w-full">
      <div 
        className={`grid grid-cols-[1fr_auto] items-center group transition-all duration-200 ${
          depth === 0 ? "py-5 px-8 bg-background" : "py-4 px-8 border-l-4 border-muted hover:bg-muted/10 ml-8"
        }`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2">
            {!component.isLeaf && (
              <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                className="text-muted-foreground hover:text-primary transition-colors p-1"
              >
                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
            )}
            <GripVertical className="text-muted-foreground/20 cursor-grab" size={16} />
          </div>
          <Input 
            className={`h-9 text-base font-bold bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary/20 p-2 hover:bg-muted/50 transition-all ${
              component.isLeaf ? "text-foreground" : "text-primary uppercase tracking-wide"
            } w-full max-w-[320px]`}
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && commitName()}
          />
        </div>

        <div className="flex items-center gap-12">
          {/* Weight Section */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">Weight</span>
            <div className="relative group/input">
              <Input 
                type="number"
                className="h-9 w-24 text-right pr-7 font-mono text-xs font-bold border-2 focus-visible:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={localWeight}
                onChange={(e) => setLocalWeight(e.target.value)}
                onBlur={commitWeight}
                onKeyDown={(e) => e.key === 'Enter' && commitWeight()}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground opacity-40">%</span>
            </div>
          </div>

          {/* Score/Sum Section */}
          <div className="flex items-center gap-3 w-40 justify-end">
            <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
              {component.isLeaf ? "Score" : "Contribution"}
            </span>
            {component.isLeaf ? (
              <div className="relative">
                <Input 
                  type="number"
                  className="h-9 w-24 text-right pr-7 font-mono text-sm font-black text-indigo-500 border-2 focus-visible:ring-indigo-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={localScore}
                  onChange={(e) => setLocalScore(e.target.value)}
                  onBlur={commitScore}
                  onKeyDown={(e) => e.key === 'Enter' && commitScore()}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-400 opacity-40">%</span>
              </div>
            ) : (
              <div className="text-lg font-black text-primary w-24 text-right px-2">
                {categoryTotal.toFixed(1)}
              </div>
            )}
          </div>

          {/* Action Menu */}
          <div className="flex items-center gap-1">
            {component.isLeaf ? (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onDelete(component.id)}
                className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={16} />
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                    <MoreVertical size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 p-1">
                  <DropdownMenuItem onClick={() => handleAddChildClick(false)} className="gap-3 font-bold py-2 px-3">
                    <FolderPlus size={16} className="text-primary" /> Add Category
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddChildClick(true)} className="gap-3 font-bold py-2 px-3">
                    <FilePlus size={16} className="text-primary" /> Add Item
                  </DropdownMenuItem>
                  <Separator className="my-1" />
                  <DropdownMenuItem onClick={() => onDelete(component.id)} className="gap-3 font-bold py-2 px-3 text-rose-500 focus:text-rose-500 focus:bg-rose-50">
                    <Trash2 size={16} /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && children.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {children.map((child) => (
              <ComponentRow 
                key={`${child.id}-${child.updatedAt || ''}`} 
                component={child} 
                allComponents={allComponents}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onAddChild={onAddChild}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
