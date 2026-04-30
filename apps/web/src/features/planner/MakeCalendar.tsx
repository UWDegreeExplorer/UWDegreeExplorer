import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Download, Info, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

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

export function MakeCalendar() {
  const [scheduleText, setScheduleText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const { toast } = useToast();

  const handleParse = async () => {
    if (!scheduleText.trim()) return;
    
    setIsParsing(true);
    try {
      const response = await fetch("/api/planner/parse-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: scheduleText }),
      });
      
      if (!response.ok) throw new Error("Failed to parse");
      
      const data = await response.json();
      setResult(data);
      toast({
        title: "Schedule Parsed!",
        description: `Found ${data.courses.length} course components for ${data.term}.`,
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

  // Redoing handleDownload with correct blob handling
  const downloadICS = async () => {
    if (!result || result.courses.length === 0) return;
    
    setIsGenerating(true);
    try {
      const response = await fetch("/api/planner/generate-ics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courses: result.courses }),
      });
      
      const blob = await response.blob();
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
    <div className="max-w-5xl mx-auto p-6 pb-20 space-y-8 animate-in fade-in duration-700">
      <div className="space-y-2">
        <h1 className="text-4xl font-serif font-medium tracking-tight">Make Calendar</h1>
        <p className="text-muted-foreground text-lg">Transform your Quest schedule into a digital calendar file (.ics)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
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
                className="min-h-[350px] font-mono text-sm bg-background/30 border-primary/5 focus:border-primary/20 transition-all resize-none rounded-2xl p-4 leading-relaxed"
                value={scheduleText}
                onChange={(e) => {
                  setScheduleText(e.target.value);
                  if (result) setResult(null); // Reset result if text changes
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
              <p>3. Paste it here and download your <strong>.ics</strong> file.</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
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
                  <h3 className="font-serif text-2xl font-medium">{result.term}</h3>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none py-1 px-3">
                    {result.courses.length} Components
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {result.courses.map((course, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-4 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">{course.courseCode}</span>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-4">
                              {course.type} {course.section}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                            <Info className="w-3 h-3" />
                            {course.instructor || "TBA"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-mono font-medium text-primary bg-primary/5 px-2 py-1 rounded-lg">
                            {course.startTime} - {course.endTime}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                        <div className="flex gap-1">
                          {course.days.map(day => (
                            <span key={day} className="text-[10px] font-bold w-6 h-6 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                              {day.charAt(0)}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">
                          {course.room}
                        </span>
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
                className="h-[600px] rounded-[2.5rem] border-2 border-dashed border-border flex flex-col items-center justify-center text-center p-12 space-y-6"
              >
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <CalendarIcon className="w-10 h-10 text-muted-foreground/40" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-medium">Schedule Preview</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Once you parse your schedule, a preview of all your classes and components will appear here.
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
