import React from "react";
import { CourseExplorer } from "@/features/planner/CourseExplorer";

const CoursesPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <CourseExplorer />
    </div>
  );
};

export default CoursesPage;
