import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  ClipboardCheck, 
  Loader2, 
  Search, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  GraduationCap,
  History,
  FileText,
  Settings,
  AlertTriangle,
  PlusCircle,
  LayoutGrid,
  Printer,
  RotateCcw,
  Save,
  Upload,
  ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Rule = {
  id: string;
  name: string;
  group: string;
  type: string;
  unitsRequired: number;
  options?: string[];
  isConstraint?: boolean;
  requirement?: string;
  inputType?: string;
  step?: string;
  defaultValue?: string;
};

type AuditResultItem = {
  programSlug: string;
  programLabel: string;
  report: {
    totalUnitsRequired: number;
    totalUnitsSatisfied: number;
    isComplete: boolean;
    groups: Array<{
      name: string;
      rules: Array<{
        name: string;
        unitsRequired: number;
        satisfiedUnits: number;
        isSatisfied: boolean;
        consumedCourses: string[];
      }>;
    }>;
  };
  constraintsReport: Array<{
    name: string;
    isMet: boolean;
    message: string;
  }>;
};

type AuditResponse = {
  results: AuditResultItem[];
};

const fetchJson = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const baseUrl = import.meta.env.VITE_API_URL || "";
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: "include"
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Request failed");
  }
  return res.json();
};

export const DegreeAuditor: React.FC = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [transcriptText, setTranscriptText] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [constraintOptions, setConstraintOptions] = useState<Record<string, any>>({
    is_coop: false
  });

  // Fetch programs
  const { data: programData } = useQuery<{ programs: Array<{ slug: string; label: string }> }>({
    queryKey: ["degree-programs"],
    queryFn: () => fetchJson("/api/planner/degree-rules"),
  });

  // Fetch program details for all selected programs (for assignments)
  const { data: allRulesData, isLoading: rulesLoading } = useQuery<{ rules: Rule[] }[]>({
    queryKey: ["degree-rules-multi", selectedPrograms],
    queryFn: async () => {
      return Promise.all(selectedPrograms.map(p => fetchJson<{ rules: Rule[] }>(`/api/planner/degree-rules/${p}`)));
    },
    enabled: selectedPrograms.length > 0,
  });

  // Fetch saved state
  const { data: savedState, isLoading: stateLoading } = useQuery<{ state: any }>({
    queryKey: ["audit-state"],
    queryFn: () => fetchJson("/api/planner/audit/state"),
  });

  // Initialize from saved state
  useEffect(() => {
    if (savedState?.state) {
      const s = savedState.state;
      if (s.programSlugs?.length) setSelectedPrograms(s.programSlugs);
      if (s.transcriptText) setTranscriptText(s.transcriptText);
      if (s.assignments) setAssignments(s.assignments);
      if (s.options) setConstraintOptions(s.options);
    } else if (programData?.programs.length && selectedPrograms.length === 0) {
      const bcs = programData.programs.find(p => p.slug === '2025-2026-bcs');
      if (bcs) setSelectedPrograms([bcs.slug]);
      else setSelectedPrograms([programData.programs[0].slug]);
    }
  }, [savedState, programData]);

  // Save State Mutation
  const saveStateMutation = useMutation({
    mutationFn: (body: any) => fetchJson("/api/planner/audit/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }),
    onSuccess: () => {
      toast({ title: "Progress Saved", description: "Your selections and assignments have been saved." });
    }
  });

  // Upload PDF Mutation
  const uploadPdfMutation = useMutation<{ transcriptText: string }, Error, FormData>({
    mutationFn: async (formData) => {
      const baseUrl = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${baseUrl}/api/planner/audit/parse-transcript`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Server responded with ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      setTranscriptText(data.transcriptText);
      toast({ title: "Transcript Parsed", description: "Courses successfully extracted from PDF." });
    },
    onError: (err) => {
      toast({ title: "Parsing Failed", description: err.message || "Could not parse the uploaded PDF.", variant: "destructive" });
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type !== "application/pdf") {
      toast({ title: "Invalid File", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }
    
    const formData = new FormData();
    formData.append("transcript", file);
    uploadPdfMutation.mutate(formData);
    
    // Reset input
    e.target.value = '';
  };

  // Audit Mutation
  const auditMutation = useMutation<AuditResponse, Error, any>({
    mutationFn: (body) => fetchJson("/api/planner/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }),
    onSuccess: () => {
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // Consolidate rules for UI editing
  const consolidatedRules = useMemo(() => {
    const rulesMap = new Map<string, Rule>();
    (allRulesData || []).forEach(set => {
      set.rules.forEach(r => {
        if (!rulesMap.has(r.id)) rulesMap.set(r.id, r);
      });
    });
    return Array.from(rulesMap.values());
  }, [allRulesData]);

  const exactRules = useMemo(() => 
    consolidatedRules.filter(r => (r.type === 'exact' || r.type === 'one_of_exact' || (r.options?.length ?? 0) > 0) && !r.isConstraint)
  , [consolidatedRules]);

  const dynRules = useMemo(() => 
    consolidatedRules.filter(r => !(r.type === 'exact' || r.type === 'one_of_exact' || (r.options?.length ?? 0) > 0) && !r.isConstraint)
  , [consolidatedRules]);

  const constraintRules = useMemo(() => 
    consolidatedRules.filter(r => r.isConstraint)
  , [consolidatedRules]);

  const handleAddRow = (ruleId: string) => {
    setAssignments(prev => ({
      ...prev,
      [ruleId]: [...(prev[ruleId] || []), ""]
    }));
  };

  const handleUpdateRow = (ruleId: string, index: number, value: string) => {
    setAssignments(prev => {
      const rows = [...(prev[ruleId] || [])];
      rows[index] = value;
      return { ...prev, [ruleId]: rows };
    });
  };

  const handleRemoveRow = (ruleId: string, index: number) => {
    setAssignments(prev => {
      const rows = (prev[ruleId] || []).filter((_, i) => i !== index);
      return { ...prev, [ruleId]: rows };
    });
  };

  const handleToggleExact = (ruleId: string, course: string, checked: boolean) => {
    setAssignments(prev => {
      const current = prev[ruleId] || [];
      if (checked) return { ...prev, [ruleId]: [...current, course] };
      return { ...prev, [ruleId]: current.filter(c => c !== course) };
    });
  };

  const handleToggleProgram = (slug: string) => {
    setSelectedPrograms(prev => 
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const handleReset = () => {
    setTranscriptText("");
    setAssignments({});
    setSelectedPrograms([]);
    toast({ title: "Reset Complete", description: "All fields have been cleared." });
  };

  const handleSaveProgress = () => {
    saveStateMutation.mutate({
      programSlugs: selectedPrograms,
      transcriptText,
      assignments,
      options: constraintOptions
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAudit = () => {
    if (!transcriptText.trim()) {
      toast({ title: "Transcript Required", description: "Please paste your Quest transcript first.", variant: "destructive" });
      return;
    }
    auditMutation.mutate({
      programSlugs: selectedPrograms,
      transcriptText,
      assignments,
      options: constraintOptions
    });
  };

  if (step === 2 && auditMutation.data) {
    const { results } = auditMutation.data;
    const isFullyComplete = results.every(res => res.report.isComplete && res.constraintsReport.every(c => c.isMet));

    return (
      <div className="mx-auto w-full max-w-6xl space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
            <History className="h-4 w-4" /> Back to Editor
          </Button>
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" /> Print Report
            </Button>
            {results.map(res => (
                <Badge key={res.programSlug} variant={res.report.isComplete ? "default" : "outline"} className="text-xs">
                    {res.programLabel}: {res.report.isComplete ? "COMPLETE" : "PENDING"}
                </Badge>
            ))}
          </div>
        </div>

        {/* Aggregate Progress Card */}
        <Card className={cn("border-l-8", isFullyComplete ? "border-l-green-500" : "border-l-blue-500")}>
          <CardHeader>
            <div className="flex justify-between items-end">
              <div>
                <CardTitle className="text-3xl font-extrabold tracking-tight">Check Sheet Results</CardTitle>
                <CardDescription className="text-lg mt-1">Validated Combination Audit</CardDescription>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-muted-foreground uppercase mb-1">Global Status</div>
                <div className={cn("text-2xl font-black", isFullyComplete ? "text-green-600" : "text-blue-600")}>
                    {isFullyComplete ? "ALL PLANS SATISFIED" : "REMAINING TASKS FOUND"}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Detailed Program Breakdowns */}
        <div className="space-y-12">
            {results.map((result, idx) => (
                <div key={result.programSlug} className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-border" />
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="px-4 py-1 text-sm font-bold uppercase tracking-wider">Plan {idx + 1}: {result.programLabel}</Badge>
                        </div>
                        <div className="h-px flex-1 bg-border" />
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                        <Card className="md:col-span-1">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Settings className="h-5 w-5 text-orange-500" /> Constraints
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {result.constraintsReport.map((c, i) => (
                                    <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30">
                                        {c.isMet ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
                                        <div className="min-w-0">
                                            <div className="font-semibold text-xs truncate">{c.name}</div>
                                            <div className="text-[10px] text-muted-foreground leading-tight">{c.message}</div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card className="md:col-span-2">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-lg">Requirement Breakdown</CardTitle>
                                    <div className="text-sm font-bold">{result.report.totalUnitsSatisfied.toFixed(2)} / {result.report.totalUnitsRequired.toFixed(2)} Units</div>
                                </div>
                                <Progress value={(result.report.totalUnitsSatisfied / result.report.totalUnitsRequired) * 100} className="h-2 mt-2" />
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {result.report.groups.map((group, gi) => (
                                        <div key={gi} className="space-y-2">
                                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{group.name}</div>
                                            <div className="space-y-2">
                                                {group.rules.map((rule, ri) => (
                                                    <div key={ri} className={cn("p-3 rounded-xl border flex items-start justify-between gap-4 transition-colors", rule.isSatisfied ? "bg-green-50/20 border-green-100" : "bg-background border-border")}>
                                                        <div className="min-w-0">
                                                            <div className="text-[11px] font-bold leading-none mb-1">{rule.name}</div>
                                                            {rule.consumedCourses.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {rule.consumedCourses.slice(0, 3).map(c => <span key={c} className="text-[8px] font-mono text-muted-foreground">{c}</span>)}
                                                                    {rule.consumedCourses.length > 3 && <span className="text-[8px] text-muted-foreground">+{rule.consumedCourses.length - 3}</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className={cn("text-[10px] font-bold shrink-0", rule.isSatisfied ? "text-green-600" : "text-muted-foreground")}>
                                                            {rule.isSatisfied ? <CheckCircle2 className="h-3 w-3" /> : `${rule.satisfiedUnits.toFixed(1)}/${rule.unitsRequired}`}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ))}
        </div>

        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 print:hidden">
            <Button size="lg" variant="default" onClick={() => setStep(1)} className="rounded-full shadow-2xl px-12 h-14 text-lg font-bold">
                Edit Plan Assignments
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary font-bold tracking-wider uppercase text-xs">
             <GraduationCap className="h-4 w-4" /> Major Check Sheet
          </div>
          <h1 className="text-4xl font-black tracking-tighter">Plan Combinator</h1>
          <p className="text-muted-foreground text-sm max-w-xl">
            Select multiple programs (Minors, Specializations) to see how your courses satisfy combined requirements.
          </p>
        </div>

        <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleSaveProgress} title="Save Progress" disabled={saveStateMutation.isPending} className="h-14 w-14 rounded-2xl text-muted-foreground hover:text-primary">
                {saveStateMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleReset} title="Reset All" className="h-14 w-14 rounded-2xl text-muted-foreground hover:text-destructive">
                <RotateCcw className="h-5 w-5" />
            </Button>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="lg" className="h-14 rounded-2xl gap-3 px-6 border-2 border-primary/20 hover:border-primary transition-all">
                        <LayoutGrid className="h-5 w-5 text-primary" />
                        <div className="text-left">
                            <div className="text-[10px] font-bold uppercase text-muted-foreground leading-none">Your Combination</div>
                            <div className="text-sm font-bold truncate max-w-[120px]">{selectedPrograms.length} Programs Selected</div>
                        </div>
                        <PlusCircle className="h-4 w-4 ml-2" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 rounded-2xl overflow-hidden shadow-2xl border-none" align="end">
                    <div className="bg-primary p-4 text-primary-foreground">
                        <div className="text-xs font-bold uppercase opacity-80 mb-1">Add to Plan</div>
                        <h4 className="font-bold text-lg">Degree Components</h4>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto p-2 space-y-1">
                        {programData?.programs.map((p) => (
                            <div 
                                key={p.slug} 
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-muted/50",
                                    selectedPrograms.includes(p.slug) ? "bg-primary/5" : ""
                                )}
                                onClick={() => handleToggleProgram(p.slug)}
                            >
                                <Checkbox 
                                    id={`prog-${p.slug}`} 
                                    checked={selectedPrograms.includes(p.slug)}
                                    className="h-4 w-4 pointer-events-none"
                                />
                                <label htmlFor={`prog-${p.slug}`} className="text-sm font-medium leading-tight cursor-pointer flex-1">
                                    {p.label}
                                </label>
                            </div>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>

            <Button 
                size="lg" 
                className="h-14 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-xl gap-2"
                onClick={handleAudit}
                disabled={auditMutation.isPending || selectedPrograms.length === 0}
            >
                {auditMutation.isPending ? <Loader2 className="animate-spin h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
                Generate Check Sheet
            </Button>
        </div>
      </div>

      <div className="flex flex-col gap-12">
          {/* Transcript Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-2">
               <div className="flex items-center gap-3">
                   <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">1</div>
                   <h2 className="text-xl font-bold tracking-tight">Source Transcript</h2>
               </div>
               <div>
                 <input 
                   type="file" 
                   accept="application/pdf" 
                   className="hidden" 
                   id="transcript-upload" 
                   onChange={handleFileUpload} 
                 />
                 <Button variant="secondary" size="default" asChild disabled={uploadPdfMutation.isPending} className="gap-2 text-sm font-bold rounded-lg shadow-sm hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                     <label htmlFor="transcript-upload">
                       {uploadPdfMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                       Upload Unofficial Transcript PDF
                     </label>
                 </Button>
               </div>
            </div>
          </section>

          {/* Assignments Section */}
          {rulesLoading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="animate-spin h-10 w-10 text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Aggregating plan requirements...</p>
             </div>
          ) : consolidatedRules.length > 0 && (
            <section className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                   <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">2</div>
                   <h2 className="text-xl font-bold tracking-tight">Requirement Logic Mapping</h2>
                </div>
                
                <div className="space-y-8">
                    {/* Fixed Options */}
                    {exactRules.length > 0 && (
                        <div className="space-y-4">
                            <div className="text-xs font-black uppercase text-muted-foreground tracking-widest px-1">Prescribed Lists</div>
                            <div className="grid gap-4">
                                {exactRules.map(rule => (
                                    <Card key={rule.id} className="rounded-2xl border-none shadow-sm bg-card">
                                        <CardContent className="p-5">
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="text-base font-black">{rule.name}</div>
                                                <Badge variant="secondary" className="bg-muted/50 text-green-700 dark:text-green-400 border-none font-black text-xs px-2.5 py-0.5">{rule.unitsRequired} Units</Badge>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                                {rule.options?.map(course => (
                                                    <div 
                                                        key={course} 
                                                        className={cn(
                                                            "flex items-center space-x-2 p-2 rounded-xl border transition-all cursor-pointer",
                                                            assignments[rule.id]?.includes(course) ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-transparent"
                                                        )}
                                                        onClick={() => handleToggleExact(rule.id, course, !assignments[rule.id]?.includes(course))}
                                                    >
                                                        <Checkbox 
                                                            id={`cb-${rule.id}-${course}`} 
                                                            checked={assignments[rule.id]?.includes(course)}
                                                            onCheckedChange={(checked) => handleToggleExact(rule.id, course, !!checked)}
                                                            className="h-4 w-4"
                                                        />
                                                        <label className="text-xs font-mono font-bold cursor-pointer select-none flex-1">{course}</label>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Dynamic Rows */}
                    <div className="space-y-4">
                         <div className="text-xs font-black uppercase text-muted-foreground tracking-widest px-1">Flexible Assignments</div>
                         <div className="grid gap-4">
                            {dynRules.map(rule => (
                                <Card key={rule.id} className="rounded-3xl overflow-hidden border-none shadow-lg shadow-primary/5 bg-gradient-to-br from-card to-muted/20">
                                    <CardContent className="p-6 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="min-w-0 pr-4">
                                                <h3 className="font-black text-lg tracking-tight truncate">{rule.name}</h3>
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">{rule.requirement || `Assign any matching courses for ${rule.unitsRequired} units`}</p>
                                            </div>
                                            <Badge variant="secondary" className="bg-muted/50 text-green-700 dark:text-green-400 border-none font-black text-xs px-2.5 py-0.5 whitespace-nowrap">{rule.unitsRequired} Units</Badge>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            {(assignments[rule.id] || [""]).map((val, idx) => (
                                                <div key={idx} className="flex gap-2 group animate-in slide-in-from-left-2 duration-300">
                                                    <Input 
                                                        placeholder="e.g. CS 341" 
                                                        className="h-10 rounded-xl font-mono text-sm bg-background border-none shadow-sm focus:ring-1"
                                                        value={val}
                                                        onChange={(e) => handleUpdateRow(rule.id, idx, e.target.value)}
                                                    />
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="opacity-0 group-hover:opacity-100 transition-all text-red-500 rounded-xl hover:bg-red-50"
                                                        onClick={() => handleRemoveRow(rule.id, idx)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="w-full h-10 rounded-xl border-dashed border-2 gap-2 text-primary hover:bg-primary/5 transition-all" 
                                                onClick={() => handleAddRow(rule.id)}
                                            >
                                                <Plus className="h-3 w-3" /> <span className="text-xs font-bold">Add Entry</span>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                         </div>
                    </div>
                </div>
            </section>
          )}
          {/* Global Parameters */}
          <section className="space-y-6">
              <div className="flex items-center gap-3 px-2">
                 <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">3</div>
                 <h2 className="text-xl font-bold tracking-tight">Environment Config</h2>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  <Card className="rounded-2xl border-none shadow-sm bg-card">
                      <CardContent className="p-5 flex flex-col justify-center h-full gap-4">
                          <div className="flex items-center justify-between">
                              <label htmlFor="coop" className="text-sm font-black cursor-pointer">Co-op Program</label>
                              <Checkbox 
                                  id="coop" 
                                  checked={constraintOptions.is_coop}
                                  onCheckedChange={(c) => setConstraintOptions(prev => ({ ...prev, is_coop: !!c }))}
                                  className="h-4 w-4"
                              />
                          </div>
                      </CardContent>
                  </Card>
                  
                  {constraintRules.map(rule => (
                      <Card key={rule.id} className="rounded-2xl border-none shadow-sm bg-card">
                          <CardContent className="p-5 space-y-3">
                              <label className="text-sm font-black truncate block" title={rule.name}>{rule.name}</label>
                              {rule.inputType === 'none' ? (
                                  <div className="px-3 py-2 rounded-xl bg-muted/30 text-[10px] font-medium text-muted-foreground italic h-10 flex items-center">
                                      Calculated based on transcript.
                                  </div>
                              ) : (
                                  <Input 
                                      type={rule.inputType || 'text'}
                                      step={rule.step}
                                      value={constraintOptions[rule.id] ?? rule.defaultValue}
                                      onChange={(e) => setConstraintOptions(prev => ({ ...prev, [rule.id]: e.target.value }))}
                                      className="h-10 rounded-xl bg-background shadow-sm focus:ring-1 text-sm font-mono"
                                  />
                              )}
                          </CardContent>
                      </Card>
                  ))}
              </div>
              <p className="text-[10px] text-muted-foreground px-2">
                  Results are based on 2025-2026 Academic Calendar rules. Final verification requires academic advisor approval.
              </p>
          </section>
      </div>
    </div>
  );
};

