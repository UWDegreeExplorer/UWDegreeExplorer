import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Calendar as CalendarIcon, 
  Download, 
  CheckCircle2, 
  Loader2, 
  History, 
  Trash2, 
  Clock, 
  MapPin, 
  User, 
  Plus,
  Trash
} from "lucide-react";
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
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const { toast } = useToast();

  const fetchSavedSchedules = async () => {
    setIsLoadingSchedules(true);
    try {
      const data = await customFetch<SavedTerm[]>("/api/planner/schedules");
      setSavedTerms(data);
    } catch (error) {
      console.error("Failed to fetch saved schedules", error);
    } finally {
      setIsLoadingSchedules(false);
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
      setScheduleText("");
      
      try {
        await customFetch("/api/planner/schedules", {
          method: "POST",
          body: JSON.stringify({ term: data.term, courses: data.courses }),
        });
        fetchSavedSchedules();
      } catch (e) {}

      toast({
        title: "Success",
        description: `Schedule for ${data.term} parsed and saved.`,
      });
    } catch (error) {
      toast({
        title: "Parsing Error",
        description: "Failed to parse schedule text.",
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
    } catch (error) {
      toast({ title: "Error", description: "Failed to load schedule.", variant: "destructive" });
    }
  };

  const deleteSchedule = async (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete ${term}?`)) return;

    try {
      await customFetch(`/api/planner/schedules/${encodeURIComponent(term)}`, {
        method: "DELETE",
      });
      setSavedTerms(prev => prev.filter(t => t.term !== term));
      if (result?.term === term) setResult(null);
    } catch (error) {
      toast({ title: "Error", description: "Delete failed.", variant: "destructive" });
    }
  };

  const downloadICS = async () => {
    if (!result) return;
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
      a.download = `schedule_${result.term.replace(/\s+/g, '_').toLowerCase()}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({ title: "Error", description: "Download failed.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar - Term List */}
      <div className="w-64 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <History className="w-4 h-4" />
            Saved Terms
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {setResult(null); setScheduleText("");}}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoadingSchedules ? (
             <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : savedTerms.length > 0 ? (
            savedTerms.map((st) => (
              <div
                key={st.term}
                onClick={() => loadSavedSchedule(st.term)}
                className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                  result?.term === st.term ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                }`}
              >
                <span className="truncate">{st.term}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive"
                  onClick={(e) => deleteSchedule(st.term, e)}
                >
                  <Trash className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          ) : (
            <p className="p-4 text-xs text-muted-foreground text-center">No saved terms.</p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">Make Calendar</h1>
              <p className="text-muted-foreground">Import your Quest schedule and export to .ics</p>
            </div>
            {result && (
              <Button onClick={downloadICS} disabled={isGenerating} className="gap-2">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download .ics
              </Button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {!result || isParsing ? (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <Card className="shadow-sm border-muted">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Paste New Schedule
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Paste Quest schedule text here..."
                      className="min-h-[300px] font-mono text-sm resize-none bg-muted/10"
                      value={scheduleText}
                      onChange={(e) => setScheduleText(e.target.value)}
                    />
                    <Button onClick={handleParse} disabled={isParsing || !scheduleText.trim()} className="w-full gap-2">
                      {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Parse Schedule
                    </Button>
                  </CardContent>
                </Card>
                <div className="p-4 rounded-lg bg-muted/50 border text-sm text-muted-foreground space-y-2">
                   <p className="font-medium text-foreground flex items-center gap-2"><Plus className="w-4 h-4"/> How to use:</p>
                   <p>1. Open Quest &gt; My Class Schedule</p>
                   <p>2. Press <strong>Ctrl+A</strong> (Cmd+A) to select everything, then copy.</p>
                   <p>3. Paste it here and it will be saved to your history.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">{result.term}</h2>
                  <Badge variant="secondary">{result.courses.length} components</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.courses.map((course, idx) => (
                    <Card key={idx} className="shadow-sm hover:border-primary/50 transition-colors">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h3 className="font-bold text-lg leading-none">{course.courseCode}</h3>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] font-bold h-4 px-1.5">{course.type}</Badge>
                              <span className="text-[10px] text-muted-foreground font-medium">Sec {course.section}</span>
                            </div>
                          </div>
                          <div className="text-right">
                             <div className="text-sm font-semibold text-primary">{course.startTime} - {course.endTime}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-1 text-[13px] text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5" />
                            <span className="truncate">{course.instructor || "TBA"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="truncate">{course.room}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex gap-1">
                            {["MO", "TU", "WE", "TH", "FR"].map(dayKey => {
                              const active = course.days.includes(dayKey);
                              return (
                                <div
                                  key={dayKey}
                                  className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${
                                    active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground/30"
                                  }`}
                                >
                                  {dayMap[dayKey]}
                                </div>
                              );
                            })}
                          </div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{course.isOnline ? "Online" : "In Person"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
