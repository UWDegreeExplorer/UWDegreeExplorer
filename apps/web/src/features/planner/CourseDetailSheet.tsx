import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BookOpen, History, Info, AlertTriangle, FileText, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTermCode } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CourseDetail {
  courseId: string;
  subjectCode: string;
  catalogNumber: string;
  units: string;
  title: string;
  description: string;
  requirementsRaw: string;
  prereqRaw: string;
  coreqRaw: string;
  antireqRaw: string;
  offeringHistory: string[];
  uwflowRating?: {
    liked: number | null;
    easy: number | null;
    useful: number | null;
  } | null;
}

interface CourseDetailSheetProps {
  courseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (id: string) => void;
}

export const CourseDetailSheet: React.FC<CourseDetailSheetProps> = ({
  courseId,
  open,
  onOpenChange,
  onNavigate,
}) => {
  const renderLinkedText = (text: string | null) => {
    if (!text) return null;

    // Pattern: Subjects (e.g. CS or BU/MATH) followed by Catalog Numbers (e.g. 135 or 117/118 or 106, 114, 115)
    // The number part now allows commas and slashes.
    const regex = /([A-Z]{2,}(?:\s*\/\s*[A-Z]{2,})*)\s+([0-9]{1,3}[A-Z]*(?:\s*[,/]\s*[0-9]{1,3}[A-Z]*)*)/g;
    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const subjectsText = match[1];
      const numbersText = match[2];
      const matchIndex = match.index;

      // Split subjects by slash, but keep the slashes for rendering
      const subjects = subjectsText.split(/(\s*\/\s*)/);
      // Split numbers by comma or slash, keeping them for rendering
      const numbers = numbersText.split(/(\s*[,/]\s*)/);

      // We need to associate every numeric code with ALL subjects in the prefix
      // For simplicity in display, we keep the original structure

      // 1. Process Subjects
      const resolvedSubjects = subjects.filter(s => /[A-Z]{2,}/.test(s));

      subjects.forEach((sPart, sIdx) => {
        if (/[A-Z]{2,}/.test(sPart)) {
          // It is a subject link? No, subjects usually need a number.
          // In BU/MATH 117, we want BU to link to BU 117.
          // We will render it as a link that uses the FIRST number of the list as a fallback,
          // but that might be complex. Let's stick to the user's specific request:
          // Clicking BU in BU/MATH 117 goes to BU 117.

          const firstNumber = numbers.find(n => /[0-9]/.test(n)) || "";
          parts.push(
            <span
              key={`${matchIndex}-sub-${sIdx}`}
              className="text-primary hover:underline cursor-pointer font-bold decoration-primary/30"
              onClick={() => onNavigate?.(`${sPart}${firstNumber}`)}
            >
              {sPart}
            </span>
          );
        } else {
          parts.push(sPart);
        }
      });

      parts.push(" "); // Space between subjects and numbers

      // 2. Process Numbers
      numbers.forEach((nPart, nIdx) => {
        if (/[0-9]/.test(nPart)) {
          // For each number, it links to [First Subject] + [This Number]
          // Usually in MATH 106, 114, it is always the same subject.
          const mainSubject = resolvedSubjects[0] || "";
          parts.push(
            <span
              key={`${matchIndex}-num-${nIdx}`}
              className="text-primary hover:underline cursor-pointer font-bold decoration-primary/30"
              onClick={() => onNavigate?.(`${mainSubject}${nPart}`)}
            >
              {nPart}
            </span>
          );
        } else {
          parts.push(nPart);
        }
      });

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };
  const { data: course, isLoading, error } = useQuery<CourseDetail>({
    queryKey: ["course-detail", courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const baseUrl = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${baseUrl}/api/planner/courses/${courseId}`);
      if (!res.ok) throw new Error("Failed to fetch course details");
      return res.json();
    },
    enabled: !!courseId && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col h-full bg-background/95 backdrop-blur-xl">
        {isLoading ? (
          <div className="p-8 space-y-6">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/4" />
            <Separator />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error || !course ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-xl font-bold">Error loading details</h3>
            <p className="text-muted-foreground">Please try again later.</p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-8 space-y-8 pb-12">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-primary border-primary/20 font-mono">
                    {course.subjectCode} {course.catalogNumber}
                  </Badge>
                  <Badge variant="secondary">{course.units} Units</Badge>
                </div>
                <SheetTitle className="text-3xl font-bold leading-tight">
                  {course.title}
                </SheetTitle>
              </SheetHeader>


              <div className="space-y-6">
                <section>
                  <div className="flex items-center gap-2 mb-3 text-lg font-semibold">
                    <Info className="h-5 w-5 text-primary" />
                    <h2>Description</h2>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {course.description || "No description available."}
                  </p>
                  <div className="mt-4 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-xl px-4"
                      onClick={() => window.open(`https://outline.uwaterloo.ca/viewer/?q=${course.subjectCode}%20${course.catalogNumber}`, '_blank')}
                    >
                      <FileText size={16} />
                      <span className="text-sm font-bold">Official Course Outline</span>
                      <ExternalLink size={14} className="opacity-50" />
                    </Button>
                  </div>
                </section>

                <Separator />

                <section>
                  <div className="flex items-center gap-2 mb-4 text-lg font-semibold">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <h2>Academic Requirements</h2>
                  </div>

                  <div className="space-y-4">
                    {course.prereqRaw && (
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary">Prerequisites</span>
                        <p className="text-sm mt-1">{renderLinkedText(course.prereqRaw)}</p>
                      </div>
                    )}

                    {course.coreqRaw && (
                      <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-500">Corequisites</span>
                        <p className="text-sm mt-1">{renderLinkedText(course.coreqRaw)}</p>
                      </div>
                    )}

                    {course.antireqRaw && (
                      <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/10">
                        <span className="text-xs font-bold uppercase tracking-wider text-destructive">Antirequisites</span>
                        <p className="text-sm mt-1">{renderLinkedText(course.antireqRaw)}</p>
                      </div>
                    )}

                    {!course.prereqRaw && !course.coreqRaw && !course.antireqRaw && (
                      <p className="text-sm text-muted-foreground italic">None</p>
                    )}
                  </div>
                </section>

                <Separator />

                <section>
                  <div className="flex items-center gap-2 mb-4 text-lg font-semibold">
                    <History className="h-5 w-5 text-primary" />
                    <h2>Offering History</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {course.offeringHistory.length > 0 ? (
                      course.offeringHistory.map((term) => (
                        <Badge key={term} variant="outline" className="font-mono">
                          {formatTermCode(term)}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No historical data found.</p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
};
