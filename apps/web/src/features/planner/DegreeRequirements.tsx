import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  BookMarked,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Filter,
  ListChecks,
  Loader2,
  Search,
} from "lucide-react";

type DegreeRule = {
  id: string;
  name: string;
  group: string;
  type: string;
  unitsRequired: number;
  options?: string[];
  pattern?: string;
  categories?: string[];
  isConstraint?: boolean;
  requirement?: string;
  notes?: string;
  choiceCount?: number;
  choiceGroups?: string[][];
  mutuallyExclusiveOptions?: string[][];
  unitsPerChoice?: number;
};

type ProgramSummary = {
  slug: string;
  label: string;
};

type RulesResponse = {
  program: ProgramSummary & {
    checklistFile: string;
    creditUnits: number;
    constraintCount: number;
  };
  rules: DegreeRule[];
};

const DEFAULT_PROGRAM = "2025-2026-bcs";

const typeLabels: Record<string, string> = {
  exact: "Required",
  one_of_exact: "Choose one",
  regex: "Course range",
  categories: "Breadth category",
  list1: "Comm List I",
  list2: "Comm List II",
  list1_or_2: "Comm List I/II",
  free_non_math: "Non-math elective",
  free: "Free elective",
  manual: "Checklist note",
};

const fetchJson = async <T,>(path: string): Promise<T> => {
  const baseUrl = import.meta.env.VITE_API_URL || "";
  const res = await fetch(`${baseUrl}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to fetch degree requirements");
  }
  return res.json();
};

const formatUnits = (units: number) => Number.isInteger(units) ? units.toFixed(1) : String(units);

const groupRules = (rules: DegreeRule[]) => {
  const grouped = new Map<string, DegreeRule[]>();
  for (const rule of rules) {
    const key = rule.group || "Other";
    grouped.set(key, [...(grouped.get(key) || []), rule]);
  }
  return Array.from(grouped.entries());
};

const getRuleDetail = (rule: DegreeRule) => {
  if (rule.requirement) return rule.requirement;
  if (rule.choiceGroups?.length) return `Choose ${rule.choiceCount ?? 1} from the listed entries.`;
  if (rule.options?.length) return rule.options.join(", ");
  if (rule.categories?.length) return rule.categories.join(" or ");
  if (rule.pattern) return rule.pattern;
  if (rule.notes) return rule.notes;
  return "";
};

function CoursePills({ courses }: { courses: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {courses.map((course) => (
        <span key={course} className="rounded border bg-background px-2 py-1 font-mono text-[11px] text-foreground">
          {course}
        </span>
      ))}
    </div>
  );
}

function ChoiceGroups({ groups }: { groups: string[][] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((group, index) => (
        <div key={`${group.join("-")}-${index}`} className="rounded-md border bg-muted/20 px-2.5 py-2">
          <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Entry {index + 1}</div>
          <CoursePills courses={group} />
        </div>
      ))}
    </div>
  );
}

function RuleRow({ rule }: { rule: DegreeRule }) {
  const isManual = rule.type === "manual" || !!rule.isConstraint;
  const detail = getRuleDetail(rule);

  return (
    <div className="grid gap-3 border-b px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(220px,1.1fr)_120px_100px_minmax(300px,2fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{rule.name}</span>
          {rule.isConstraint && <Badge variant="outline" className="text-[10px]">constraint</Badge>}
        </div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">{rule.id}</div>
      </div>
      <div>
        <Badge variant={isManual ? "outline" : "secondary"} className="text-[11px]">
          {typeLabels[rule.type] || rule.type}
        </Badge>
      </div>
      <div className="text-sm text-muted-foreground">
        {rule.isConstraint ? "-" : `${formatUnits(rule.unitsRequired)} units`}
      </div>
      <div className="min-w-0 space-y-2 text-sm text-muted-foreground">
        {rule.choiceGroups?.length ? (
          <>
            <div className="text-foreground">
              Choose {rule.choiceCount ?? 1} entr{(rule.choiceCount ?? 1) === 1 ? "y" : "ies"}
              {rule.unitsPerChoice ? ` at ${formatUnits(rule.unitsPerChoice)} units each` : ""}.
            </div>
            <ChoiceGroups groups={rule.choiceGroups} />
          </>
        ) : rule.options?.length && rule.options.length <= 24 ? (
          <CoursePills courses={rule.options} />
        ) : detail ? (
          <div className="leading-relaxed">{detail}</div>
        ) : null}
        {rule.options?.length && rule.options.length > 24 && !rule.choiceGroups?.length && (
          <CoursePills courses={rule.options} />
        )}
        {rule.pattern && (
          <div className="rounded-md bg-muted/30 px-2 py-1 font-mono text-[11px] text-muted-foreground break-all">
            {rule.pattern}
          </div>
        )}
        {rule.mutuallyExclusiveOptions?.length ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            Mutually exclusive: {rule.mutuallyExclusiveOptions.map((set) => set.join(" / ")).join("; ")}
          </div>
        ) : null}
        {rule.notes && <div className="text-xs text-muted-foreground">{rule.notes}</div>}
      </div>
    </div>
  );
}

export const DegreeRequirements: React.FC = () => {
  const [selectedProgram, setSelectedProgram] = useState(DEFAULT_PROGRAM);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"all" | "credit" | "constraints">("all");

  const { data: programData, isLoading: programsLoading } = useQuery<{ programs: ProgramSummary[] }>({
    queryKey: ["degree-programs"],
    queryFn: () => fetchJson("/api/planner/degree-rules"),
  });

  const { data, isLoading, error } = useQuery<RulesResponse>({
    queryKey: ["degree-rules", selectedProgram],
    queryFn: () => fetchJson(`/api/planner/degree-rules/${selectedProgram}`),
  });

  const filteredRules = useMemo(() => {
    const rules = data?.rules || [];
    const normalized = query.trim().toLowerCase();
    return rules.filter((rule) => {
      if (mode === "credit" && rule.isConstraint) return false;
      if (mode === "constraints" && !rule.isConstraint) return false;
      if (!normalized) return true;
      const haystack = JSON.stringify(rule).toLowerCase();
      return haystack.includes(normalized);
    });
  }, [data?.rules, mode, query]);

  const grouped = useMemo(() => groupRules(filteredRules), [filteredRules]);
  const creditRules = data?.rules.filter((rule) => !rule.isConstraint) || [];
  const constraintRules = data?.rules.filter((rule) => rule.isConstraint) || [];
  const displayUnits = data?.program.creditUnits ?? 0;
  const progressValue = Math.min(100, (displayUnits / Math.max(displayUnits, 1)) * 100);

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <ClipboardCheck className="h-4 w-4" />
            2025-2026 checklist rules
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Degree Requirements</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Displays the same course, elective, constraint, and footnote requirements encoded from the PDF checklist files.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(260px,360px)_220px]">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Checklist</span>
            <select
              value={selectedProgram}
              disabled={programsLoading}
              onChange={(event) => setSelectedProgram(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground shadow-sm outline-none focus:border-primary"
            >
              {(programData?.programs || []).map((program) => (
                <option key={program.slug} value={program.slug}>{program.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Search rules</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="CS 486, depth, BUS..."
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-md border bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border bg-card p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <BookMarked className="h-4 w-4" /> Program
              </div>
              <div className="text-lg font-semibold leading-snug">{data.program.label}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{data.program.checklistFile}</div>
            </div>
            <div className="rounded-md border bg-card p-4">
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Credit rules</div>
              <div className="text-2xl font-semibold">{creditRules.length}</div>
              <div className="mt-2 text-xs text-muted-foreground">Courses, electives, breadth, and unit-bearing requirements.</div>
            </div>
            <div className="rounded-md border bg-card p-4">
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Total units</div>
              <div className="text-2xl font-semibold">{formatUnits(displayUnits)}</div>
              <Progress value={progressValue} className="mt-3 h-1.5" />
            </div>
            <div className="rounded-md border bg-card p-4">
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Constraints</div>
              <div className="text-2xl font-semibold">{constraintRules.length}</div>
              <div className="mt-2 text-xs text-muted-foreground">Manual checklist constraints, notes, and footnotes.</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b pb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(["all", "credit", "constraints"] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={mode === value ? "default" : "outline"}
                onClick={() => setMode(value)}
                className="h-8"
              >
                {value === "all" ? "All" : value === "credit" ? "Credit rules" : "Constraints"}
              </Button>
            ))}
            <Badge variant="outline" className="ml-auto text-[11px]">
              {filteredRules.length} shown
            </Badge>
          </div>

          <div className="space-y-4">
            {grouped.map(([groupName, rules]) => {
              const creditTotal = rules
                .filter((rule) => !rule.isConstraint)
                .reduce((sum, rule) => sum + Number(rule.unitsRequired || 0), 0);
              const isConstraintGroup = rules.every((rule) => rule.isConstraint);
              return (
                <section key={groupName} className="overflow-hidden rounded-md border bg-card">
                  <div className="flex flex-col gap-2 border-b bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      {isConstraintGroup ? <AlertCircle className="h-4 w-4 text-amber-600" /> : <ListChecks className="h-4 w-4 text-primary" />}
                      <h2 className="text-base font-semibold text-foreground">{groupName}</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isConstraintGroup && <Badge variant="secondary">{formatUnits(creditTotal)} units</Badge>}
                      <Badge variant="outline">{rules.length} rules</Badge>
                    </div>
                  </div>
                  <div className="hidden border-b bg-background px-4 py-2 text-[11px] font-semibold uppercase text-muted-foreground lg:grid lg:grid-cols-[minmax(220px,1.1fr)_120px_100px_minmax(300px,2fr)]">
                    <div>Requirement</div>
                    <div>Type</div>
                    <div>Units</div>
                    <div>PDF detail</div>
                  </div>
                  {rules.map((rule) => <RuleRow key={rule.id} rule={rule} />)}
                </section>
              );
            })}
          </div>

          {filteredRules.length === 0 && (
            <div className="rounded-md border bg-card p-8 text-center text-muted-foreground">
              <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
              No matching requirements.
            </div>
          )}

          <div className="rounded-md border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Verification status
            </div>
            These entries are rendered from the same JSON rule files that were checked against the PDF checklist text. Manual entries are preserved for PDF requirements that cannot be safely evaluated by simple course matching.
          </div>
        </div>
      ) : null}
    </div>
  );
};
