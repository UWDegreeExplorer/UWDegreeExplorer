import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, GraduationCap, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Course {
  courseId: string;
  subjectCode: string;
  catalogNumber: string;
  title: string;
  description: string;
  requirements: string;
}

const SUBJECTS = ["All", "CS", "MATH", "STAT", "CO", "AFM", "ECON", "PHYS"];
const LEVELS = ["All", "100", "200", "300", "400"];

export const CourseExplorer: React.FC = () => {
  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedLevel, setSelectedLevel] = useState("All");

  const { data: courses, isLoading } = useQuery<Course[]>({
    queryKey: ["courses", search, selectedSubject, selectedLevel],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("q", search);
      if (selectedSubject !== "All") params.append("subject", selectedSubject);
      if (selectedLevel !== "All") params.append("level", selectedLevel);
      
      const res = await fetch(`/api/planner/courses?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch courses");
      return res.json();
    },
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Course Discovery</h1>
        <p className="text-muted-foreground text-lg">
          Explore University of Waterloo's academic catalog and plan your degree path.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-card/50 backdrop-blur-md border rounded-2xl p-6 shadow-sm space-y-6">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
          <Input
            placeholder="Search by course code, title or keywords..."
            className="pl-12 h-14 text-lg bg-background/50 border-2 border-transparent focus-visible:border-primary/20 transition-all rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-8">
          <div className="space-y-3">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Subjects</span>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubject(sub)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedSubject === sub
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "bg-background border hover:border-primary/30 text-muted-foreground"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Academic Level</span>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevel(lvl)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedLevel === lvl
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "bg-background border hover:border-primary/30 text-muted-foreground"
                  }`}
                >
                  {lvl === "All" ? "All Levels" : `${lvl}-Level`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[280px] rounded-2xl bg-muted animate-pulse" />
          ))
        ) : (
          <AnimatePresence mode="popLayout">
            {courses?.map((course) => (
              <motion.div
                key={course.courseId}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="h-full group hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 cursor-pointer relative overflow-hidden bg-card/40 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <CardHeader className="relative">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className="px-3 py-1 font-mono text-sm border-primary/20 text-primary">
                        {course.subjectCode} {course.catalogNumber}
                      </Badge>
                      <div className="text-xs text-muted-foreground font-medium">0.5 Units</div>
                    </div>
                    <CardTitle className="text-xl line-clamp-1 group-hover:text-primary transition-colors">
                      {course.title}
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="space-y-4 relative">
                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                      {course.description || "No description available."}
                    </p>
                    
                    <div className="pt-4 border-t border-primary/5 flex items-center justify-between group/btn">
                      <div className="flex -space-x-2">
                        <Badge variant="secondary" className="bg-primary/5 text-[10px] text-primary hover:bg-primary/10">Intro</Badge>
                        <Badge variant="secondary" className="bg-primary/5 text-[10px] text-primary hover:bg-primary/10 ml-2">Core</Badge>
                      </div>
                      <span className="flex items-center text-xs font-bold text-primary opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                        View Details <ArrowRight size={14} className="ml-1" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {!isLoading && courses?.length === 0 && (
        <div className="text-center py-20 bg-card/30 rounded-3xl border border-dashed">
          <BookOpen className="mx-auto text-muted-foreground mb-4" size={48} />
          <h3 className="text-xl font-semibold">No courses found</h3>
          <p className="text-muted-foreground">Try adjusting your filters or search query.</p>
        </div>
      )}
    </div>
  );
};
