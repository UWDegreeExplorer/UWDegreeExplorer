import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Download, Info, CheckCircle2, AlertCircle, Loader2, History, Trash2, Clock, MapPin, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

import { customFetch } from "@workspace/api-client-react";

interface ParsedCourse {
  courseCode: string;
  type: string;
  section: string;
  days: string[];
  startTime: string;
  endTime: string;
  room: string;
  instructor: string | null;
  startDate: string;
  endDate: string;
  isOnline: boolean;
}

interface ParseResult {
  term: string;
  courses: ParsedCourse[];
}

interface SavedTerm {
  term: string;
  updatedAt: string;
}

const dayMap: Record<string, string> = {
  MO: "M",
  TU: "T",
  WE: "W",
  TH: "Th",
  FR: "F",
};

export function MakeCalendar() {
  const [scheduleText, setScheduleText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [savedTerms, setSavedTerms] = useState<SavedTerm[]>([]);
  const { toast } = useToast();

  const fetchSavedSchedules = async () => {
    try {
      const data = await customFetch<SavedTerm[]>("/api/planner/schedules");
      setSavedTerms(data);
    } catch (error) {
      console.error("Failed to fetch saved schedules", error);
    }
  };

  useEffect(() => {
    fetchSavedSchedules();
  }, []);

  const handleParse = async () => {
    if (!scheduleText.trim()) return;
    
    setIsParsing(true);
    try {
      const data = await customFetch<ParseResult>("/api/planner/parse-schedule", {
        method: "POST",
        body: JSON.stringify({ text: scheduleText }),
      });
      
      setResult(data);
      
      // Automatic Silent Save
      try {
        await customFetch("/api/planner/schedules", {
          method: "POST",
          body: JSON.stringify({ term: data.term, courses: data.courses }),
        });
        fetchSavedSchedules(); // Refresh list
      } catch (saveError) {
        console.error("Silent save failed", saveError);
      }

      toast({
        title: "Schedule Parsed!",
        description: `Found ${data.courses.length} course components for ${data.term}. Saved to your account.`,
      });
    } catch (error) {
      toast({
        title: "Parsing Failed",
        description: "Could not recognize the schedule format. Please make sure you copied the entire Quest page.",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  const loadSavedSchedule = async (term: string) => {
    try {
      const data = await customFetch<any>(`/api/planner/schedules/${encodeURIComponent(term)}`);
      setResult({ term: data.term, courses: data.data });
      toast({
        title: "Loaded Schedule",
        description: `Now viewing ${term}.`,
      });
    } catch (error) {
      toast({
        title: "Load Failed",
        description: "Could not retrieve the saved schedule.",
        variant: "destructive",
      });
    }
  };

  const deleteSchedule = async (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete the schedule for ${term}?`)) return;

    try {
      await customFetch(`/api/planner/schedules/${encodeURIComponent(term)}`, {
        method: "DELETE",
      });
      setSavedTerms(prev => prev.filter(t => t.term !== term));
      if (result?.term === term) setResult(null);
      toast({
        title: "Deleted",
        description: `${term} has been removed from your account.`,
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Could not remove the schedule.",
        variant: "destructive",
      });
    }
  };

  // Redoing handleDownload with correct blob handling
  const downloadICS = async () => {
    if (!result || result.courses.length === 0) return;
    
    setIsGenerating(true);
    try {
      const blob = await customFetch<Blob>("/api/planner/generate-ics", {
        method: "POST",
        body: JSON.stringify({ courses: result.courses }),
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `uw_schedule_${result.term.replace(/\s+/g, '_').toLowerCase()}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Calendar Generated!",
        description: "Your .ics file is ready. Import it into your favorite calendar app.",
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "An error occurred while creating the calendar file.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 pb-20 space-y-8 animate-in fade-in duration-700">
      <div className="space-y-2">
        <h1 className="text-4xl font-serif font-medium tracking-tight">Make Calendar</h1>
        <p className="text-muted-foreground text-lg">Transform your Quest schedule into a digital calendar file (.ics)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-none shadow-2xl bg-card/40 backdrop-blur-md overflow-hidden">
            <div className="h-1.5 w-full bg-primary/20">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: isParsing ? "70%" : result ? "100%" : "0%" }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                Step 1: Paste Quest Schedule
              </CardTitle>
              <CardDescription className="text-base">
                Select all text (Ctrl+A) on the Quest "My Class Schedule" page and paste it below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="Paste your schedule here..."
                className="min-h-[300px] font-mono text-sm bg-background/30 border-primary/5 focus:border-primary/20 transition-all resize-none rounded-2xl p-4 leading-relaxed"
                value={scheduleText}
                onChange={(e) => {
                  setScheduleText(e.target.value);
                  if (result) setResult(null);
                }}
              />
              <div className="flex gap-3">
                <Button 
                  onClick={handleParse}
                  disabled={isParsing || !scheduleText.trim()}
                  className="flex-1 h-12 text-sm font-bold gap-2 rounded-xl shadow-xl shadow-primary/10"
                >
                  {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {result ? "Re-parse Schedule" : "Parse Schedule"}
                </Button>
                
                {result && (
                  <Button 
                    onClick={downloadICS}
                    disabled={isGenerating}
                    variant="outline"
                    className="flex-1 h-12 text-sm font-bold gap-2 rounded-xl border-primary/20 text-primary hover:bg-primary/5"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Download .ics
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {savedTerms.length > 0 && (
            <Card className="border-none shadow-xl bg-card/20 backdrop-blur-sm rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 font-bold uppercase tracking-wider text-muted-foreground">
                  <History className="w-4 h-4" />
                  Your Saved Schedules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {savedTerms.map((st) => (
                  <div 
                    key={st.term}
                    onClick={() => loadSavedSchedule(st.term)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group ${
                      result?.term === st.term 
                        ? "bg-primary/10 border-primary/20" 
                        : "bg-background/50 border-transparent hover:border-primary/20"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{st.term}</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        Updated {new Date(st.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => deleteSchedule(st.term, e)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          <Card className="border-none shadow-lg bg-primary/5 border-l-4 border-l-primary rounded-2xl">
            <CardHeader className="py-4">
              <CardTitle className="text-sm flex items-center gap-2 font-bold uppercase tracking-wider text-primary">
                <Info className="w-4 h-4" />
                Quick Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2 pb-4">
              <p>1. Go to <strong>Quest &gt; Enroll &gt; My Class Schedule</strong>.</p>
              <p>2. Select term and copy the <strong>entire page</strong> (Ctrl+A / Cmd+A).</p>
              <p>3. Paste it here and it will be <strong>saved automatically</strong>.</p>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-serif text-3xl font-medium">{result.term}</h3>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none py-1.5 px-4 font-bold rounded-full">
                    {result.courses.length} Components
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {result.courses.map((course, idx) => (
                    <motion.div
                      key={`${course.courseCode}-${course.section}-${idx}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-5 rounded-3xl bg-card border border-border/50 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all group relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/10 group-hover:bg-primary transition-colors" />
                      
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="font-serif text-2xl font-bold tracking-tight">{course.courseCode}</span>
                            <Badge variant="outline" className="bg-muted/50 border-none font-bold px-2 py-0.5 rounded-lg text-[10px]">
                              {course.type} {course.section}
                            </Badge>
                          </div>
                          
                          <div className="flex flex-wrap gap-y-1 gap-x-4">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                              <User className="w-3.5 h-3.5 text-primary/60" />
                              {course.instructor || "To be Announced"}
                            </div>
                            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                              <MapPin className="w-3.5 h-3.5 text-primary/60" />
                              {course.room}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-2xl border border-primary/10">
                            <Clock className="w-4 h-4 text-primary" />
                            <span className="text-lg font-mono font-bold text-primary">
                              {course.startTime} – {course.endTime}
                            </span>
                          </div>
                          
                          <div className="flex gap-1.5">
                            {["MO", "TU", "WE", "TH", "FR"].map(dayKey => {
                              const isActive = course.days.includes(dayKey);
                              return (
                                <div 
                                  key={dayKey}
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black transition-all ${
                                    isActive 
                                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110" 
                                      : "bg-muted text-muted-foreground/30"
                                  }`}
                                >
                                  {dayMap[dayKey]}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                className="h-[700px] rounded-[3rem] border-2 border-dashed border-border flex flex-col items-center justify-center text-center p-12 space-y-6 bg-muted/5"
              >
                <div className="w-24 h-24 rounded-[2rem] bg-muted flex items-center justify-center rotate-3 shadow-inner">
                  <CalendarIcon className="w-12 h-12 text-muted-foreground/40" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-serif font-medium">Schedule Preview</h3>
                  <p className="text-base text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    Paste your schedule or select a saved term from the sidebar to visualize your academic term.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
