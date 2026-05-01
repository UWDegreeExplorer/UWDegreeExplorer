import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Calendar as CalendarIcon, 
  Download, 
  Info, 
  CheckCircle2, 
  Loader2, 
  History, 
  Trash2, 
  Clock, 
  MapPin, 
  User, 
  Plus, 
  ChevronRight,
  CloudUpload,
  CalendarCheck
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
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);
  const { toast } = useToast();

  const fetchSavedSchedules = async () => {
    setIsSidebarLoading(true);
    try {
      const data = await customFetch<SavedTerm[]>("/api/planner/schedules");
      setSavedTerms(data);
    } catch (error) {
      console.error("Failed to fetch saved schedules", error);
    } finally {
      setIsSidebarLoading(false);
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
      setScheduleText(""); // Clear text after successful parse
      
      // Automatic Silent Save
      try {
        await customFetch("/api/planner/schedules", {
          method: "POST",
          body: JSON.stringify({ term: data.term, courses: data.courses }),
        });
        fetchSavedSchedules();
      } catch (saveError) {
        console.error("Silent save failed", saveError);
      }

      toast({
        title: "Schedule Saved",
        description: `${data.term} has been added to your account.`,
      });
    } catch (error) {
      toast({
        title: "Parsing Failed",
        description: "Format not recognized. Ensure you copied the entire Quest page.",
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
        title: `Loaded ${term}`,
        description: "Viewing your saved schedule.",
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
    if (!confirm(`Permanently delete ${term}?`)) return;

    try {
      await customFetch(`/api/planner/schedules/${encodeURIComponent(term)}`, {
        method: "DELETE",
      });
      setSavedTerms(prev => prev.filter(t => t.term !== term));
      if (result?.term === term) setResult(null);
      toast({
        title: "Deleted",
        description: `${term} removed.`,
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Could not remove the schedule.",
        variant: "destructive",
      });
    }
  };

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
        title: "Success",
        description: ".ics file downloaded.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate file.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-gray-100 font-sans selection:bg-emerald-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]" />
      </div>

      <div className="relative flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-80 border-r border-white/5 bg-white/5 backdrop-blur-xl hidden lg:flex flex-col p-6 space-y-8">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CalendarCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg tracking-tight">Quest Planner</h2>
              <p className="text-xs text-emerald-500/70 font-semibold tracking-wider uppercase">Beta Experience</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em]">Saved Terms</h3>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                {savedTerms.length}
              </Badge>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
              {isSidebarLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-2xl bg-white/5 animate-pulse" />
                ))
              ) : savedTerms.length > 0 ? (
                savedTerms.map((st) => (
                  <motion.div
                    key={st.term}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => loadSavedSchedule(st.term)}
                    className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border ${
                      result?.term === st.term
                        ? "bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/5"
                        : "bg-white/5 border-transparent hover:bg-white/10"
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm">{st.term}</span>
                      <span className="text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors">
                        Updated {new Date(st.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => deleteSchedule(st.term, e)}
                        className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <ChevronRight className={`w-4 h-4 transition-transform ${result?.term === st.term ? "text-emerald-500" : "text-gray-600 group-hover:translate-x-1"}`} />
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="px-4 py-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                    <History className="w-6 h-6 text-gray-600" />
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">No saved schedules found. Paste one to get started.</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
            <h4 className="text-xs font-bold text-emerald-500 mb-2 flex items-center gap-2">
              <Info className="w-3 h-3" />
              Pro Tip
            </h4>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Copy the <strong>entire</strong> Quest page (Ctrl+A) for the best parsing results.
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-12 space-y-12">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl font-serif font-medium tracking-tight text-white">
                Make <span className="text-emerald-500 underline decoration-emerald-500/30 underline-offset-8">Calendar</span>
              </h1>
              <p className="text-gray-400 text-lg max-w-xl leading-relaxed">
                Seamlessly convert your Quest course schedule into a universal .ics format with a single paste.
              </p>
            </div>
            {result && (
              <Button
                onClick={downloadICS}
                disabled={isGenerating}
                className="h-14 px-8 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex gap-3"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                Export to .ics
              </Button>
            )}
          </header>

          <div className="grid grid-cols-1 gap-12">
            {/* Input Section - Only show if no result or explicitly requested */}
            <AnimatePresence>
              {(!result || isParsing) && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-6"
                >
                  <Card className="border-none bg-white/5 backdrop-blur-2xl shadow-3xl rounded-[2.5rem] overflow-hidden group">
                    <div className="h-1 w-full bg-emerald-500/20">
                      <motion.div
                        className="h-full bg-emerald-500"
                        initial={{ width: 0 }}
                        animate={{ width: isParsing ? "70%" : "0%" }}
                        transition={{ duration: 1 }}
                      />
                    </div>
                    <CardHeader className="p-8 pb-4">
                      <CardTitle className="text-2xl flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                          <CloudUpload className="w-6 h-6" />
                        </div>
                        Drop your schedule here
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-6">
                      <Textarea
                        placeholder="Paste Quest text here..."
                        className="min-h-[250px] bg-black/40 border-white/5 focus:border-emerald-500/30 rounded-3xl p-6 font-mono text-sm leading-relaxed custom-scrollbar transition-all"
                        value={scheduleText}
                        onChange={(e) => setScheduleText(e.target.value)}
                      />
                      <Button
                        onClick={handleParse}
                        disabled={isParsing || !scheduleText.trim()}
                        className="w-full h-16 text-lg font-bold bg-white text-black hover:bg-gray-200 rounded-3xl flex gap-3 shadow-2xl"
                      >
                        {isParsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                        Generate My Calendar
                      </Button>
                    </CardContent>
                  </Card>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Results Section */}
            <AnimatePresence mode="wait">
              {result && !isParsing && (
                <motion.section
                  key="results"
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                      <h2 className="text-3xl font-serif font-medium text-white">{result.term}</h2>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 py-1.5 px-4 font-bold text-sm">
                        {result.courses.length} Components
                      </Badge>
                    </div>
                    <Button 
                      variant="ghost" 
                      onClick={() => setResult(null)} 
                      className="text-gray-500 hover:text-emerald-500 flex gap-2 rounded-xl"
                    >
                      <Plus className="w-4 h-4" /> Import Another
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {result.courses.map((course, idx) => (
                      <motion.div
                        key={`${course.courseCode}-${course.section}-${idx}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group relative p-6 rounded-[2rem] bg-white/5 border border-white/5 hover:border-emerald-500/20 hover:bg-white/10 transition-all"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="space-y-1">
                            <h4 className="text-2xl font-serif font-bold text-white tracking-tight">{course.courseCode}</h4>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-white/5 border-none text-[10px] font-black uppercase px-2 py-0.5 rounded-md text-emerald-500">
                                {course.type}
                              </Badge>
                              <span className="text-[10px] text-gray-500 font-bold">Section {course.section}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-2xl border border-emerald-500/20">
                              <Clock className="w-4 h-4 text-emerald-500" />
                              <span className="text-lg font-mono font-bold text-emerald-400">
                                {course.startTime} – {course.endTime}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="flex items-center gap-3 text-gray-300">
                            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                              <User className="w-4 h-4 text-emerald-500/70" />
                            </div>
                            <span className="text-sm font-medium truncate">{course.instructor || "TBA"}</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-300">
                            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                              <MapPin className="w-4 h-4 text-emerald-500/70" />
                            </div>
                            <span className="text-sm font-medium truncate">{course.room}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t border-white/5">
                          <div className="flex gap-1.5">
                            {["MO", "TU", "WE", "TH", "FR"].map(dayKey => {
                              const isActive = course.days.includes(dayKey);
                              return (
                                <div 
                                  key={dayKey}
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black transition-all ${
                                    isActive 
                                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 scale-110" 
                                      : "bg-white/5 text-gray-700"
                                  }`}
                                >
                                  {dayMap[dayKey]}
                                </div>
                              );
                            })}
                          </div>
                          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                            {course.isOnline ? "Online" : "In Person"}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
            
            {/* Empty State when no result */}
            {!result && !isParsing && (
               <div className="h-[400px] flex flex-col items-center justify-center text-center opacity-20 hover:opacity-40 transition-opacity">
                  <div className="w-32 h-32 rounded-[3rem] border-2 border-dashed border-gray-600 flex items-center justify-center mb-6 rotate-12">
                     <CalendarIcon className="w-16 h-16" />
                  </div>
                  <p className="text-xl font-serif">Workspace Empty</p>
               </div>
            )}
          </div>
        </main>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.2);
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.4);
        }
      `}</style>
    </div>
  );
}
