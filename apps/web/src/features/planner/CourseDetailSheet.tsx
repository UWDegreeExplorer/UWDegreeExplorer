import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BookOpen, History, Info, AlertTriangle, Sparkles, Heart, ThumbsUp, Brain, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
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
}

const RatingBadge = ({ label, value, icon: Icon, color }: { label: string, value: number | null, icon: any, color: string }) => {
  if (value === null) return null;
  return (
    <div className="flex-1 p-3 rounded-2xl bg-muted/50 border border-border/50 space-y-2">
      <div className="flex items-center justify-between">
        <div className={`p-1.5 rounded-lg ${color} bg-opacity-10`}>
          <Icon size={16} className={color.replace('bg-', 'text-')} />
        </div>
        <span className="text-lg font-bold">{value}%</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>{label}</span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            className={`h-full ${color}`}
          />
        </div>
      </div>
    </div>
  );
};

export const CourseDetailSheet: React.FC<CourseDetailSheetProps> = ({
  courseId,
  open,
  onOpenChange,
}) => {
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
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-primary border-primary/20 font-mono">
                    {course.subjectCode} {course.catalogNumber}
                  </Badge>
                  <Badge variant="secondary">{course.units} Units</Badge>
                </div>
                <SheetTitle className="text-3xl font-bold leading-tight">
                  {course.title}
                </SheetTitle>
              </SheetHeader>

              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    <h2>UWFlow Insights</h2>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-primary hover:text-primary hover:bg-primary/5 gap-1.5 h-8"
                    onClick={() => window.open(`https://uwflow.com/course/${(course.subjectCode + course.catalogNumber).toLowerCase()}`, '_blank')}
                  >
                    <span className="text-xs font-bold">View on UWFlow</span>
                    <ExternalLink size={12} />
                  </Button>
                </div>

                {course.uwflowRating && (course.uwflowRating.liked !== null || course.uwflowRating.useful !== null || course.uwflowRating.easy !== null) ? (
                  <div className="flex gap-3">
                    <RatingBadge 
                      label="Liked" 
                      value={course.uwflowRating.liked} 
                      icon={Heart} 
                      color="bg-rose-500" 
                    />
                    <RatingBadge 
                      label="Useful" 
                      value={course.uwflowRating.useful} 
                      icon={ThumbsUp} 
                      color="bg-blue-500" 
                    />
                    <RatingBadge 
                      label="Easy" 
                      value={course.uwflowRating.easy} 
                      icon={Brain} 
                      color="bg-emerald-500" 
                    />
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-muted/30 border border-dashed text-center">
                    <p className="text-sm text-muted-foreground italic">No ratings available yet for this course.</p>
                  </div>
                )}
              </section>

              <div className="space-y-6">
                <section>
                  <div className="flex items-center gap-2 mb-3 text-lg font-semibold">
                    <Info className="h-5 w-5 text-primary" />
                    <h2>Description</h2>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {course.description || "No description available."}
                  </p>
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
                        <p className="text-sm mt-1">{course.prereqRaw}</p>
                      </div>
                    )}
                    
                    {course.coreqRaw && (
                      <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-500">Corequisites</span>
                        <p className="text-sm mt-1">{course.coreqRaw}</p>
                      </div>
                    )}

                    {course.antireqRaw && (
                      <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/10">
                        <span className="text-xs font-bold uppercase tracking-wider text-destructive">Antirequisites</span>
                        <p className="text-sm mt-1">{course.antireqRaw}</p>
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
