import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  Heart, 
  ThumbsUp, 
  Zap, 
  Clock, 
  MapPin, 
  AlertTriangle, 
  Trash2, 
  History as HistoryIcon,
  Plus,
  Loader2,
  TrendingUp,
  Activity,
  User,
  Coffee,
  Calendar as CalendarIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface Rating {
  liked: number | null;
  easy: number | null;
  useful: number | null;
  clear?: number | null;
  engaging?: number | null;
}

interface Commute {
  to: string;
  walk: number;
  gap: number;
  stress: "low" | "high" | "impossible";
  day: string;
}

interface CourseResult {
  courseCode: string;
  type: string;
  time: string;
  room: string;
  instructor: string | null;
  isOnline: boolean;
  courseRatings: Rating;
  profRatings: Rating;
  individualWorkload: number;
  commute?: Commute[];
}

interface AnalysisResult {
  term: string;
  courses: CourseResult[];
  score: number;
}

const RatingBar = ({ label, value, icon: Icon, color }: { label: string, value: number | null, icon: any, color: string }) => {
  if (value === null) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1">
          <Icon size={12} className={color.replace('bg-', 'text-')} />
          {label}
        </span>
        <span>{Math.round(value)}%</span>
      </div>
      <Progress value={value} className={`h-1.5 ${color.replace('bg-', 'bg-opacity-20 bg-')}`} indicatorClassName={color} />
    </div>
  );
};

export const WorkloadCalculator: React.FC = () => {
  const [inputText, setInputText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [workloadHistory, setWorkloadHistory] = useState<{ term: string; score: number; updatedAt: string }[]>([]);
  const [scheduleHistory, setScheduleHistory] = useState<{ term: string; updatedAt: string }[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const [wData, sData] = await Promise.all([
        customFetch<{ term: string; score: number; updatedAt: string }[]>("/api/planner/workload"),
        customFetch<{ term: string; updatedAt: string }[]>("/api/planner/schedules")
      ]);
      setWorkloadHistory(wData);
      setScheduleHistory(sData.filter(s => !wData.some(w => w.term === s.term)));
    } catch (err) {
      console.error(err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    setIsAnalyzing(true);
    try {
      const data = await customFetch<AnalysisResult>("/api/planner/workload/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });
      setResult(data);
      // Auto-save
      await customFetch<{ success: boolean }>("/api/planner/workload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: data.term, courses: data.courses, score: data.score }),
      });
      fetchHistory();
      toast({ title: "Analysis Complete", description: "Your schedule has been analyzed and saved." });
    } catch (err) {
      toast({ title: "Analysis Failed", description: "Failed to analyze schedule. Check your format.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadFromHistory = async (term: string) => {
    setIsAnalyzing(true);
    try {
      const data = await customFetch<{ term: string; data: CourseResult[]; score: number }>(`/api/planner/workload/${term}`);
      setResult({ term: data.term, courses: data.data, score: data.score });
    } catch (err) {
      toast({ title: "Load Failed", description: "Failed to load history.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteHistory = async (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    if (!confirm(`Delete history for ${term}?`)) return;
    try {
      await customFetch(`/api/planner/workload/${term}`, { method: "DELETE" });
      setWorkloadHistory(workloadHistory.filter(h => h.term !== term));
      if (result?.term === term) setResult(null);
      fetchHistory(); // Refresh to move back to schedules if applicable
      toast({ title: "Deleted", description: "History record removed successfully." });
    } catch (err) {
      toast({ title: "Delete Failed", description: "Failed to delete record.", variant: "destructive" });
    }
  };

  const analyzeSchedule = async (term: string) => {
    setIsAnalyzing(true);
    try {
      // 1. Get raw schedule
      const schedule = await customFetch<{ term: string; data: any[] }>(`/api/planner/schedules/${term}`);
      
      // 2. Trigger analysis
      const data = await customFetch<AnalysisResult>("/api/planner/workload/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courses: schedule.data, term: schedule.term }), 
      });
      
      setResult(data);
      // Auto-save
      await customFetch<{ success: boolean }>("/api/planner/workload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: data.term, courses: data.courses, score: data.score }),
      });
      fetchHistory();
      toast({ title: "Import Successful", description: `Analyzed ${term} from your Calendar.` });
    } catch (err) {
      toast({ title: "Analysis Failed", description: "Failed to analyze saved schedule.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 250) return "text-emerald-500";
    if (score < 400) return "text-amber-500";
    return "text-rose-500";
  };

  const getScoreLevel = (score: number) => {
    if (score < 250) return { label: "CHILL", icon: Coffee, desc: "Easy term. Plenty of time for side projects." };
    if (score < 400) return { label: "BALANCED", icon: Activity, desc: "Standard workload. Manageable with good focus." };
    return { label: "BRUTAL", icon: Zap, desc: "High stress. Prepare for long nights and tight sprints." };
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Sidebar: History */}
      <div className="w-72 border-r bg-muted/20 flex flex-col">
        <div className="p-4 border-b bg-background/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2 font-bold text-sm text-muted-foreground uppercase tracking-widest">
            <HistoryIcon size={16} />
            Analysis History
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isHistoryLoading ? (
            <div className="flex flex-col items-center justify-center h-32 space-y-2 opacity-50">
              <Loader2 className="animate-spin" size={20} />
              <span className="text-xs">Loading records...</span>
            </div>
          ) : (
            <>
              {/* Merged History List */}
              {[...workloadHistory, ...scheduleHistory].sort((a, b) => b.term.localeCompare(a.term)).map((item) => {
                const isAnalyzed = 'score' in item;
                return (
                  <button
                    key={item.term}
                    onClick={() => isAnalyzed ? loadFromHistory(item.term) : analyzeSchedule(item.term)}
                    className={`w-full group text-left p-3 rounded-xl border transition-all ${
                      result?.term === item.term 
                        ? "bg-primary/5 border-primary/20 ring-1 ring-primary/20" 
                        : "bg-background hover:border-primary/20"
                    } ${!isAnalyzed ? "border-dashed opacity-70 hover:opacity-100" : ""}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-sm">{item.term}</div>
                        {isAnalyzed ? (
                          <div className={`text-xs font-mono mt-1 ${getScoreColor((item as any).score)}`}>
                            Score: {Math.round((item as any).score)}
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">
                            Click to analyze
                          </div>
                        )}
                      </div>
                      {isAnalyzed && (
                        <button 
                          onClick={(e) => deleteHistory(e, item.term)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-500/10 hover:text-rose-600 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </button>
                );
              })}

              {workloadHistory.length === 0 && scheduleHistory.length === 0 && (
                <div className="text-center py-10 opacity-40">
                  <HistoryIcon className="mx-auto mb-2" size={32} />
                  <p className="text-xs">No records yet</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-background p-8">
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
          {!result ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 text-center py-20"
            >
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight">Workload Calculator</h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  Analyze your term difficulty based on UWFlow data, professor ratings, and campus commute stress.
                </p>
              </div>
              
              <Card className="max-w-2xl mx-auto border-2 border-dashed border-muted-foreground/20 bg-muted/5">
                <CardContent className="p-8 space-y-4">
                  <Textarea 
                    placeholder="Paste your Quest 'My Class Schedule' text here..."
                    className="min-h-[300px] text-sm font-mono bg-background/50 resize-none focus-visible:ring-primary/20"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
                    <p>Tip: Copy everything from Quest's 'List View' (Ctrl+A, Ctrl+C)</p>
                    <Button 
                      disabled={!inputText.trim() || isAnalyzing} 
                      onClick={handleAnalyze}
                      className="gap-2 px-8"
                    >
                      {isAnalyzing ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                      {isAnalyzing ? "Analyzing..." : "Calculate Misery Index"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-700">
              {/* Header Analysis Dashboard */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 bg-card/40 backdrop-blur-sm overflow-hidden relative border-primary/10">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <TrendingUp size={120} />
                  </div>
                  <CardContent className="p-8">
                    <div className="flex items-center gap-4 mb-6">
                      <div className={`p-4 rounded-3xl bg-background border shadow-sm ${getScoreColor(result.score)}`}>
                        {React.createElement(getScoreLevel(result.score).icon, { size: 32 })}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Term Analysis</div>
                        <h2 className="text-3xl font-black">{result.term}</h2>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Misery Index</div>
                        <div className={`text-5xl font-black ${getScoreColor(result.score)} flex items-baseline gap-1`}>
                          {Math.round(result.score)}
                          <span className="text-sm opacity-40">pts</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Status</div>
                        <Badge className={`text-lg px-4 py-1 rounded-full ${getScoreColor(result.score).replace('text-', 'bg-').replace('-500', '-500/10')} ${getScoreColor(result.score)} border-current shadow-none`}>
                          {getScoreLevel(result.score).label}
                        </Badge>
                        <p className="text-xs text-muted-foreground leading-snug mt-2">
                          {getScoreLevel(result.score).desc}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Button 
                    variant="outline" 
                    className="w-full h-auto py-6 border-dashed flex-col gap-2 hover:bg-primary/5 transition-all"
                    onClick={() => {setResult(null); setInputText("");}}
                  >
                    <Plus size={20} />
                    <div className="text-xs font-bold uppercase tracking-widest">Analyze New Term</div>
                  </Button>
                  
                  <Card className="bg-muted/10 border-dashed">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Components</span>
                        <span className="font-bold">{result.courses.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">In-Person</span>
                        <span className="font-bold">{result.courses.filter(c => !c.isOnline).length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Early Morning</span>
                        <span className="font-bold">{result.courses.filter(c => c.time.includes("08:30")).length}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Course Detail Cards */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2 px-1">
                  <Activity size={16} className="text-primary" />
                  Course Breakdown
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.courses.map((course, idx) => (
                    <Card key={idx} className="group hover:border-primary/30 transition-all overflow-hidden bg-card/50 backdrop-blur-sm">
                      <CardHeader className="p-5 pb-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-primary bg-primary/5">
                                {course.courseCode}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">{course.type}</Badge>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin size={10} /> {course.room}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-bold uppercase text-muted-foreground">Stress</div>
                            <div className={`text-xl font-black ${getScoreColor(course.individualWorkload * 5)}`}>
                              {Math.round(course.individualWorkload)}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="p-5 pt-0 space-y-6">
                        {/* Instructor Info */}
                        <div className="flex items-center gap-3 p-2 rounded-xl bg-muted/30">
                          <div className="p-2 bg-background rounded-lg border">
                            <User size={16} className="text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Instructor</div>
                            <div className="text-xs font-bold truncate">{course.instructor || "To be Announced"}</div>
                          </div>
                          {course.profRatings.liked !== null && (
                            <div className="text-right px-2 border-l">
                              <div className="text-[10px] font-bold text-rose-500 uppercase tracking-tighter">Liked</div>
                              <div className="text-xs font-bold">{Math.round(course.profRatings.liked)}%</div>
                            </div>
                          )}
                        </div>

                        {/* Ratings Grid */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                          <div className="space-y-3">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b pb-1">Course</div>
                            <RatingBar label="Liked" value={course.courseRatings?.liked ?? null} icon={Heart} color="bg-rose-500" />
                            <RatingBar label="Easy" value={course.courseRatings?.easy ?? null} icon={Brain} color="bg-emerald-500" />
                            <RatingBar label="Useful" value={course.courseRatings?.useful ?? null} icon={ThumbsUp} color="bg-blue-500" />
                          </div>
                          <div className="space-y-3">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b pb-1">Instructor</div>
                            <RatingBar label="Clear" value={course.profRatings?.clear ?? null} icon={Zap} color="bg-amber-500" />
                            <RatingBar label="Engaging" value={course.profRatings?.engaging ?? null} icon={Activity} color="bg-indigo-500" />
                            <RatingBar label="Liked" value={course.profRatings?.liked ?? null} icon={Heart} color="bg-rose-500" />
                          </div>
                        </div>

                        {/* Commute Alerts */}
                        {course.commute && course.commute.some(c => c.stress !== 'low') && (
                          <div className="space-y-2 pt-2">
                            {course.commute.filter(c => c.stress !== 'low').map((com, cIdx) => (
                              <div 
                                key={cIdx} 
                                className={`flex items-start gap-3 p-3 rounded-xl border ${
                                  com.stress === 'impossible' 
                                    ? "bg-rose-500/5 border-rose-500/20 text-rose-600" 
                                    : "bg-amber-500/5 border-amber-500/20 text-amber-600"
                                }`}
                              >
                                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                <div className="text-xs leading-tight">
                                  <span className="font-bold">{com.stress.toUpperCase()} SPRINT</span>: {com.day} to {com.to} is only {com.gap}m gap, but walk takes {Math.round(com.walk)}m.
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/20 p-2 rounded-lg">
                          <Clock size={10} /> {course.time}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
