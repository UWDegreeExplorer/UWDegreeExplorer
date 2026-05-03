import React, { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  Calculator, 
  ChevronRight, 
  ChevronDown, 
  Target, 
  TrendingUp, 
  AlertCircle,
  GraduationCap,
  Save,
  RefreshCw,
  FolderPlus,
  FilePlus,
  MoreVertical,
  ArrowLeft
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

interface GradeComponent {
  id: number;
  courseGradeId: number;
  parentId: number | null;
  name: string;
  weight: number;
  score: number | null;
  isLeaf: boolean;
}

interface CourseGrade {
  id: number;
  term: string;
  courseCode: string;
  targetGrade: number;
  components: GradeComponent[];
}

export const GradeCalculator: React.FC = () => {
  const [courseSummaries, setCourseSummaries] = useState<CourseGrade[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseGrade | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSummaries();
  }, []);

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

  // --- Calculation Logic ---
  const totals = useMemo(() => {
    if (!selectedCourse) return { current: 0, weighted: 0, totalWeight: 0 };
    
    const calculateNode = (nodes: GradeComponent[], parentId: number | null): number => {
      let contribution = 0;
      const children = nodes.filter(n => n.parentId === parentId);
      for (const child of children) {
        if (child.isLeaf) {
          contribution += (child.score || 0) * (child.weight / 100);
        } else {
          contribution += calculateNode(nodes, child.id);
        }
      }
      return contribution;
    };

    const totalWeight = selectedCourse.components.reduce((acc, curr) => acc + (curr.parentId === null ? curr.weight : 0), 0);
    const currentScore = calculateNode(selectedCourse.components, null);
    
    return { 
      current: currentScore,
      totalWeight: selectedCourse.components.reduce((acc, curr) => curr.isLeaf ? acc + curr.weight : acc, 0)
    };
  }, [selectedCourse]);

  if (!selectedCourse) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
              <Calculator className="text-primary" size={36} />
              Grade Calculator
            </h1>
            <p className="text-muted-foreground">Track your academic progress and forecast final grades.</p>
          </div>
          <Button onClick={handleSync} className="gap-2 shadow-lg shadow-primary/10">
            <RefreshCw size={16} />
            Sync from Calendar
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="h-48 animate-pulse bg-muted/20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {courseSummaries.map((course) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -4 }}
                  onClick={() => loadCourseDetail(course.term, course.courseCode)}
                >
                  <Card className="cursor-pointer group hover:border-primary/50 transition-all border-2 bg-card/50 backdrop-blur-sm overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                      <GraduationCap size={80} />
                    </div>
                    <CardHeader>
                      <Badge variant="outline" className="w-fit mb-2 font-mono">{course.term}</Badge>
                      <CardTitle className="text-2xl font-black">{course.courseCode}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold uppercase text-muted-foreground">Target</div>
                          <div className="text-lg font-bold">{course.targetGrade}%</div>
                        </div>
                        <Button size="sm" variant="ghost" className="group-hover:bg-primary group-hover:text-primary-foreground">
                          Open <ChevronRight size={14} className="ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {courseSummaries.length === 0 && (
              <Card className="col-span-full py-20 border-dashed bg-muted/5 flex flex-col items-center justify-center text-center">
                <Target size={48} className="text-muted-foreground/20 mb-4" />
                <h3 className="text-lg font-bold">No courses tracked yet</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6">
                  Sync with your calendar to automatically pull your courses for this term.
                </p>
                <Button onClick={handleSync} variant="outline" className="gap-2">
                  <RefreshCw size={16} /> Sync Courses
                </Button>
              </Card>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setSelectedCourse(null)}>
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="font-mono">{selectedCourse.term}</Badge>
            <h1 className="text-3xl font-black tracking-tight">{selectedCourse.courseCode}</h1>
          </div>
          <p className="text-muted-foreground text-sm">Detailed grade breakdown and contribution analysis.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => loadCourseDetail(selectedCourse.term, selectedCourse.courseCode)}>
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stats Cards */}
        <Card className="bg-primary/5 border-primary/20 relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 opacity-5">
            <TrendingUp size={100} />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Current Total</CardDescription>
            <CardTitle className="text-4xl font-black">{totals.current.toFixed(1)}<span className="text-sm opacity-50 ml-1">/ 100</span></CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={totals.current} className="h-1 bg-primary/10" />
            <p className="text-[10px] mt-2 text-muted-foreground">Weighted contribution from graded items.</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-dashed">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Weight Logged</CardDescription>
            <CardTitle className="text-4xl font-black">{totals.totalWeight.toFixed(0)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={totals.totalWeight} className="h-1" />
            <p className="text-[10px] mt-2 text-muted-foreground">Percentage of total course weight defined.</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-2 flex flex-col justify-center p-6 space-y-2">
           <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-muted-foreground uppercase">Target Grade</span>
              <span className="text-xl font-black">{selectedCourse.targetGrade}%</span>
           </div>
           <div className="pt-2">
              <div className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Required to hit target</div>
              <div className="text-lg font-bold">
                {totals.totalWeight < 100 
                  ? `${((selectedCourse.targetGrade - totals.current) / (100 - totals.totalWeight) * 100).toFixed(1)}% avg.`
                  : "N/A"}
              </div>
           </div>
        </Card>
      </div>

      {/* Breakdown Editor */}
      <Card className="border-2">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div>
            <CardTitle className="text-lg">Grading Components</CardTitle>
            <CardDescription>Add categories and items as per your syllabus.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => handleAddComponent(null, false)}>
              <FolderPlus size={14} /> Category
            </Button>
            <Button size="sm" className="gap-2 shadow-lg shadow-primary/20" onClick={() => handleAddComponent(null, true)}>
              <FilePlus size={14} /> Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
           <div className="divide-y divide-border">
              {selectedCourse.components.filter(c => c.parentId === null).map((comp) => (
                <ComponentRow 
                  key={comp.id} 
                  component={comp} 
                  allComponents={selectedCourse.components}
                  onUpdate={handleUpdateComponent}
                  onDelete={handleDeleteComponent}
                  onAddChild={handleAddComponent}
                />
              ))}
              {selectedCourse.components.filter(c => c.parentId === null).length === 0 && (
                <div className="py-20 text-center text-muted-foreground space-y-4">
                  <div className="flex justify-center"><AlertCircle className="opacity-20" size={40} /></div>
                  <p className="text-sm">No components yet. Start by adding a category (e.g. Assignments) or a direct item.</p>
                </div>
              )}
           </div>
        </CardContent>
      </Card>
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
  
  const categoryTotal = useMemo(() => {
    if (component.isLeaf) return 0;
    const calculateSum = (nodes: GradeComponent[], parentId: number): number => {
      let sum = 0;
      const childs = nodes.filter(n => n.parentId === parentId);
      for (const c of childs) {
        if (c.isLeaf) sum += (c.score || 0) * (c.weight / 100);
        else sum += calculateSum(nodes, c.id);
      }
      return sum;
    };
    return calculateSum(allComponents, component.id);
  }, [component, allComponents]);

  return (
    <div className="w-full">
      <div 
        className={`flex items-center group hover:bg-muted/30 transition-colors ${depth === 0 ? "py-4 px-6" : "py-3 px-6 border-l-2 ml-4 border-muted"}`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {!component.isLeaf && (
            <button onClick={() => setIsExpanded(!isExpanded)} className="text-muted-foreground hover:text-primary">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          <Input 
            className="h-8 text-sm font-bold bg-transparent border-none focus-visible:ring-0 p-0 hover:bg-muted/50 transition-colors w-48"
            value={component.name}
            onChange={(e) => onUpdate({ ...component, name: e.target.value })}
            onBlur={() => onUpdate(component)}
          />
        </div>

        <div className="flex items-center gap-8 pr-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Weight</span>
            <div className="relative">
              <Input 
                type="number"
                className="h-8 w-20 text-right pr-6 font-mono text-xs"
                value={component.weight}
                onChange={(e) => onUpdate({ ...component, weight: parseFloat(e.target.value) || 0 })}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-40">%</span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-32 justify-end">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              {component.isLeaf ? "Score" : "Sum"}
            </span>
            {component.isLeaf ? (
              <div className="relative">
                <Input 
                  type="number"
                  className="h-8 w-20 text-right pr-6 font-mono text-xs font-bold text-primary"
                  value={component.score || 0}
                  onChange={(e) => onUpdate({ ...component, score: parseFloat(e.target.value) || 0 })}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-40">%</span>
              </div>
            ) : (
              <div className="text-sm font-black text-indigo-500 w-20 text-right">
                {categoryTotal.toFixed(1)}
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!component.isLeaf && (
                <>
                  <DropdownMenuItem onClick={() => onAddChild(component.id, false)} className="gap-2 text-xs">
                    <FolderPlus size={14} /> Add Sub-category
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAddChild(component.id, true)} className="gap-2 text-xs">
                    <FilePlus size={14} /> Add Sub-item
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => onDelete(component.id)} className="gap-2 text-xs text-rose-500 focus:text-rose-500">
                <Trash2 size={14} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && children.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {children.map((child) => (
              <ComponentRow 
                key={child.id} 
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
