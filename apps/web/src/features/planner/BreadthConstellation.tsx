import React, { useState, useEffect, useRef } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Info, Maximize2, Minimize2, ZoomIn, ZoomOut, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseDetailSheet } from "./CourseDetailSheet";

interface GraphNode {
  id: string;
  code: string;
  title: string;
  category: string;
  val?: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const CATEGORY_COLORS: Record<string, string> = {
  "Humanities": "#60a5fa", // Blue
  "Social Sciences": "#f472b6", // Pink
  "Pure Sciences": "#34d399", // Green
  "Applied Sciences": "#fbbf24", // Yellow
  "Other": "#94a3b8", // Gray
};

export const BreadthConstellation: React.FC = () => {
  const fgRef = useRef<any>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [hoverNode, setHoverNode] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: graphData, isLoading } = useQuery<GraphData>({
    queryKey: ["breadth-graph", selectedCategory],
    queryFn: async () => {
      const url = new URL("/api/planner/breadth/graph", window.location.origin);
      if (selectedCategory) url.searchParams.append("category", selectedCategory);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch graph data");
      return res.json();
    }
  });

  // Calculate node values (size) based on degree (number of connections)
  const processedData = React.useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    
    const nodes = graphData.nodes.map(n => ({
      ...n,
      val: 2 + (graphData.links.filter(l => l.source === n.id || l.target === n.id).length * 0.5)
    }));
    
    return { nodes, links: graphData.links };
  }, [graphData]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 bg-[#0a0a0a]">
        <Loader2 className="h-12 w-12 text-primary animate-spin opacity-50" />
        <p className="text-muted-foreground font-medium animate-pulse">Mapping the Constellation...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-[#0a0a0a] overflow-hidden">
      {/* UI Overlay */}
      <div className="absolute top-6 left-6 z-10 space-y-4 pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
            </div>
            Breadth Constellation
          </h1>
          <p className="text-muted-foreground mt-1 max-w-sm">
            Explore the interconnected pathways of University of Waterloo's breadth requirement courses.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pointer-events-auto">
          <Button 
            variant={selectedCategory === null ? "default" : "outline"} 
            size="sm" 
            className="rounded-full h-8 text-[10px] font-bold uppercase tracking-wider"
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Button>
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              className="rounded-full h-8 text-[10px] font-bold uppercase tracking-wider gap-2 border-white/10"
              style={{ 
                backgroundColor: selectedCategory === cat ? color : 'transparent',
                borderColor: selectedCategory === cat ? 'transparent' : `${color}40`,
                color: selectedCategory === cat ? '#000' : color
              }}
              onClick={() => setSelectedCategory(cat)}
            >
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: selectedCategory === cat ? '#000' : color }} />
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2 pointer-events-auto">
        <Button variant="outline" size="icon" className="rounded-xl bg-black/40 backdrop-blur-xl border-white/10 hover:bg-white/10" onClick={() => fgRef.current?.zoomToFit(400)}>
          <Maximize2 size={18} />
        </Button>
        <Button variant="outline" size="icon" className="rounded-xl bg-black/40 backdrop-blur-xl border-white/10 hover:bg-white/10" onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.5)}>
          <ZoomIn size={18} />
        </Button>
        <Button variant="outline" size="icon" className="rounded-xl bg-black/40 backdrop-blur-xl border-white/10 hover:bg-white/10" onClick={() => fgRef.current?.zoom(fgRef.current.zoom() / 1.5)}>
          <ZoomOut size={18} />
        </Button>
      </div>

      {/* Course Detail Preview (Hover) */}
      {hoverNode && (
        <div className="absolute top-6 right-6 z-10 w-72 pointer-events-none animate-in fade-in slide-in-from-right-4 duration-300">
          <Card className="bg-black/60 backdrop-blur-2xl border-white/10 p-5 space-y-3 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between">
              <Badge variant="outline" className="font-mono text-primary border-primary/30 bg-primary/5">
                {hoverNode.code}
              </Badge>
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[hoverNode.category] || CATEGORY_COLORS.Other }} />
            </div>
            <h3 className="font-bold text-lg text-white leading-tight">{hoverNode.title}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter size={12} />
              {hoverNode.category}
            </div>
            <p className="text-xs text-muted-foreground/60 italic">Click to view prerequisites and details</p>
          </Card>
        </div>
      )}

      {/* The Graph */}
      <ForceGraph2D
        ref={fgRef}
        graphData={processedData}
        backgroundColor="#0a0a0a"
        nodeLabel={(n: any) => ""} // We use our own UI for label
        nodeColor={(n: any) => CATEGORY_COLORS[n.category] || CATEGORY_COLORS.Other}
        nodeRelSize={6}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const label = node.code;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Inter, sans-serif`;
          
          // Glow effect
          const color = CATEGORY_COLORS[node.category] || CATEGORY_COLORS.Other;
          ctx.shadowColor = color;
          ctx.shadowBlur = 15;
          
          // Draw node
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.val || 3, 0, 2 * Math.PI, false);
          ctx.fillStyle = color;
          ctx.fill();
          
          // Draw label if zoomed in enough or hovered
          if (globalScale > 2.5 || hoverNode?.id === node.id) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowBlur = 0; // No glow for text
            ctx.fillText(label, node.x, node.y + (node.val || 3) + fontSize + 2);
          }
          
          ctx.shadowBlur = 0;
        }}
        linkColor={() => "rgba(255, 255, 255, 0.15)"}
        linkDirectionalParticles={1}
        linkDirectionalParticleSpeed={0.01}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleColor={() => "rgba(255, 255, 255, 0.4)"}
        onNodeHover={(node) => setHoverNode(node)}
        onNodeClick={(node: any) => {
          setSelectedCourseId(node.id);
          setIsSheetOpen(true);
        }}
        cooldownTicks={100}
        onEngineStop={() => fgRef.current?.zoomToFit(400)}
      />

      {/* Detailed Course Sheet */}
      <CourseDetailSheet
        courseId={selectedCourseId}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onNavigate={(id) => setSelectedCourseId(id)}
      />
    </div>
  );
};
