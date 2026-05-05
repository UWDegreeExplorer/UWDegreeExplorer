import React, { useState, useEffect, useRef } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Info, Maximize2, Minimize2, ZoomIn, ZoomOut, Filter, Layers } from "lucide-react";
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
  source: any;
  target: any;
  type?: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const CATEGORY_COLORS: Record<string, string> = {
  "Humanities": "#2563eb", // Darker Blue
  "Social Sciences": "#db2777", // Darker Pink
  "Pure Sciences": "#059669", // Darker Green
  "Applied Sciences": "#d97706", // Darker Yellow
  "Other": "#475569", // Slate
};

export const BreadthConstellation: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [hoverNode, setHoverNode] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Measure container size
  useEffect(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      setDimensions({ width: clientWidth, height: clientHeight });
    }
  }, []);

  const { data: graphData, isLoading } = useQuery<GraphData>({
    queryKey: ["breadth-graph", selectedCategory],
    queryFn: async () => {
      const url = new URL("/api/planner/breadth/graph", window.location.origin);
      if (selectedCategory) url.searchParams.append("category", selectedCategory);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch graph data");
      const data = await res.json();
      return data;
    }
  });

  // Calculate node values (size) based on degree (number of connections)
  const processedData = React.useMemo(() => {
    console.log("[GraphData Debug] Raw nodes:", graphData?.nodes?.length, "Raw links:", graphData?.links?.length);
    if (!graphData || !graphData.nodes.length) return { nodes: [], links: [] };
    
    const nodes = graphData.nodes.map(n => ({
      ...n,
      val: 3 + (graphData.links.filter(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        return sourceId === n.id || targetId === n.id;
      }).length * 0.8)
    }));
    
    console.log("[GraphData Debug] Processed nodes:", nodes.length);
    return { nodes, links: graphData.links };
  }, [graphData]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 bg-white">
        <Loader2 className="h-12 w-12 text-primary animate-spin opacity-50" />
        <p className="text-muted-foreground font-medium animate-pulse">Mapping the Constellation...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-white overflow-hidden border-l border-border">
      {/* UI Overlay */}
      <div className="absolute top-6 left-6 z-10 space-y-4 pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
            </div>
            Breadth Constellation
          </h1>
          <p className="text-slate-500 mt-1 max-w-sm">
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
              className="rounded-full h-8 text-[10px] font-bold uppercase tracking-wider gap-2 border-slate-200"
              style={{ 
                backgroundColor: selectedCategory === cat ? color : 'transparent',
                borderColor: selectedCategory === cat ? 'transparent' : `${color}30`,
                color: selectedCategory === cat ? '#fff' : color
              }}
              onClick={() => setSelectedCategory(cat)}
            >
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: selectedCategory === cat ? '#fff' : color }} />
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2 pointer-events-auto">
        <Button variant="outline" size="icon" className="rounded-xl bg-white/80 backdrop-blur-xl border-slate-200 hover:bg-slate-100 shadow-sm" onClick={() => fgRef.current?.zoomToFit(400)}>
          <Maximize2 size={18} className="text-slate-600" />
        </Button>
        <Button variant="outline" size="icon" className="rounded-xl bg-white/80 backdrop-blur-xl border-slate-200 hover:bg-slate-100 shadow-sm" onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.5)}>
          <ZoomIn size={18} className="text-slate-600" />
        </Button>
        <Button variant="outline" size="icon" className="rounded-xl bg-white/80 backdrop-blur-xl border-slate-200 hover:bg-slate-100 shadow-sm" onClick={() => fgRef.current?.zoom(fgRef.current.zoom() / 1.5)}>
          <ZoomOut size={18} className="text-slate-600" />
        </Button>
      </div>

      {/* Course Detail Preview (Hover) */}
      {hoverNode && (
        <div className="absolute top-6 right-6 z-10 w-72 pointer-events-none animate-in fade-in slide-in-from-right-4 duration-300">
          <Card className="bg-white/90 backdrop-blur-2xl border-slate-200 p-5 space-y-3 shadow-xl shadow-slate-200/50">
            <div className="flex items-start justify-between">
              <Badge variant="outline" className="font-mono text-primary border-primary/30 bg-primary/5">
                {hoverNode.code}
              </Badge>
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[hoverNode.category] || CATEGORY_COLORS.Other }} />
            </div>
            <h3 className="font-bold text-lg text-slate-900 leading-tight">{hoverNode.title}</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Filter size={12} />
              {hoverNode.category}
            </div>
            <p className="text-[10px] text-slate-400 italic">Click to view prerequisites and details</p>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && processedData.nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 pointer-events-none">
          <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
            <Layers size={40} />
          </div>
          <p className="text-slate-400 font-medium">No connections found in this category.</p>
        </div>
      )}

      {/* The Graph */}
      <ForceGraph2D
        ref={fgRef}
        graphData={processedData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#ffffff"
        nodeLabel={(n: any) => ""} 
        nodeColor={(n: any) => CATEGORY_COLORS[n.category] || CATEGORY_COLORS.Other}
        nodeRelSize={6}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const label = node.code;
          const fontSize = 11 / globalScale;
          ctx.font = `${fontSize}px Inter, sans-serif`;
          
          const color = CATEGORY_COLORS[node.category] || CATEGORY_COLORS.Other;
          
          // Draw node
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.val || 3, 0, 2 * Math.PI, false);
          ctx.fillStyle = color;
          ctx.fill();

          // Subtle border for clarity on white
          ctx.strokeStyle = "rgba(0,0,0,0.05)";
          ctx.lineWidth = 1 / globalScale;
          ctx.stroke();
          
          // Draw label if zoomed in enough or hovered
          if (globalScale > 2 || hoverNode?.id === node.id) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#334155'; // Slate 700
            ctx.fillText(label, node.x, node.y + (node.val || 3) + fontSize + 2);
          }
        }}
        linkColor={() => "rgba(0, 0, 0, 0.08)"}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={1}
        linkDirectionalParticleColor={() => "rgba(0, 0, 0, 0.2)"}
        onNodeHover={(node) => setHoverNode(node)}
        onNodeClick={(node: any) => {
          setSelectedCourseId(node.id);
          setIsSheetOpen(true);
        }}
        cooldownTicks={100}
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
