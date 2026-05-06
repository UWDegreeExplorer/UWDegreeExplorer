import React, { useState, useEffect, useRef, useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Info, Maximize2, ZoomIn, ZoomOut, Filter, BookOpen } from "lucide-react";
import * as d3 from "d3-force";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const CATEGORY_COLORS: Record<string, string> = {
  "Humanities": "#2563eb", 
  "Pure Sciences": "#059669", 
  "Pure and Applied Sciences": "#d97706", 
  "Social Sciences": "#db2777",
};

export const BreadthConstellation: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isStable, setIsStable] = useState(false);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setDimensions({ width: clientWidth, height: clientHeight });
        }
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(() => updateDimensions());
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  const { data: categories } = useQuery<string[]>({
    queryKey: ["breadth-categories"],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_URL || "";
      const fullUrl = baseUrl 
        ? (baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl) + "/api/planner/breadth/categories"
        : "/api/planner/breadth/categories";
      
      console.log(`[Breadth] Fetching categories from: ${fullUrl}`);
      const res = await fetch(fullUrl);
      if (!res.ok) throw new Error("Failed to fetch categories");
      return (await res.json()).sort();
    }
  });

  const { data: graphData, isLoading } = useQuery<GraphData>({
    queryKey: ["breadth-graph", selectedCategory],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_URL || "";
      // Robust URL construction
      const fullUrl = baseUrl 
        ? (baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl) + "/api/planner/breadth/graph"
        : "/api/planner/breadth/graph";
        
      const url = new URL(fullUrl, window.location.origin);
      if (selectedCategory) url.searchParams.append("category", selectedCategory);
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch graph data");
      return await res.json();
    }
  });

  useEffect(() => {
    if (!graphData || !fgRef.current) return;
    
    setIsStable(false);
    const fg = fgRef.current;
    fg.d3Force("charge").strength(-150);
    fg.d3Force("link").distance(100);
    fg.d3Force("radial", d3.forceRadial(0, 0, 0).strength(0.02));
    fg.d3ReheatSimulation();

    const timer = setTimeout(() => {
      if (!isStable) {
        fg.zoomToFit(1000, 30);
        // Immediately zoom in a bit more to make it clearer
        setTimeout(() => fg.zoom(2.2, 800), 1100);
        setIsStable(true);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [graphData]);

  const processedData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    return {
      nodes: graphData.nodes.map(n => ({ ...n, val: 2 })),
      links: graphData.links
    };
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
    <div className="flex flex-col w-full h-full bg-[#f8fafc] overflow-hidden">
      <div className="p-8 pb-4 space-y-6 bg-white/50 backdrop-blur-md border-b border-slate-200/60 z-20">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-4">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm">
              <BookOpen size={24} className="text-primary" />
            </div>
            Breadth Constellation
          </h1>
          <p className="text-slate-500 mt-2 max-w-2xl text-sm leading-relaxed">
            Discover interconnected academic pathways through Waterloo's breadth requirements. 
            Scroll to zoom, drag to explore, and click any star for details.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button 
            variant={selectedCategory === null ? "default" : "secondary"} 
            size="sm" 
            className="rounded-full px-5 h-9 text-xs font-semibold shadow-sm"
            onClick={() => setSelectedCategory(null)}
          >
            All Courses
          </Button>
          {!categories && !isLoading && (
            <p className="text-xs text-red-400 self-center ml-2">Categories unavailable (check VITE_API_URL)</p>
          )}
          {(categories || []).map((cat) => {
            const color = CATEGORY_COLORS[cat] || "#475569";
            return (
              <Button
                key={cat}
                variant="outline"
                size="sm"
                className="rounded-full px-5 h-9 text-xs font-semibold gap-2 border-slate-200 bg-white shadow-sm transition-all hover:bg-slate-50"
                style={{ 
                  borderColor: selectedCategory === cat ? color : 'transparent',
                  backgroundColor: selectedCategory === cat ? `${color}10` : '',
                  color: selectedCategory === cat ? color : '#64748b'
                }}
                onClick={() => setSelectedCategory(cat)}
              >
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                {cat}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 relative min-h-0 w-full m-0 p-0 overflow-hidden">
        <div ref={containerRef} className="absolute inset-0 m-0 p-0 overflow-hidden">
          {dimensions.width > 0 && dimensions.height > 0 && (
            <ForceGraph2D
              ref={fgRef}
              graphData={processedData}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="#f8fafc"
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
              cooldownTicks={100}
            nodeLabel={() => ""} 
            nodeColor={(n: any) => CATEGORY_COLORS[n.category] || "#475569"}
            nodeRelSize={6}
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const label = node.code;
              const fontSize = 11 / globalScale;
              ctx.font = `600 ${fontSize}px "Outfit", sans-serif`;
              const color = CATEGORY_COLORS[node.category] || "#475569";
              ctx.beginPath();
              ctx.arc(node.x, node.y, node.val || 2, 0, 2 * Math.PI, false);
              ctx.fillStyle = color;
              ctx.fill();
              
              if (globalScale > 2.5) {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const textWidth = ctx.measureText(label).width;
                const bgPadding = 4 / globalScale;
                const bgHeight = fontSize + bgPadding * 2;
                const bgWidth = textWidth + bgPadding * 4;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.beginPath();
                const rectX = node.x - bgWidth / 2;
                const rectY = node.y + (node.val || 2) + fontSize / 2;
                ctx.roundRect(rectX, rectY, bgWidth, bgHeight, 4 / globalScale);
                ctx.fill();
                ctx.fillStyle = '#334155';
                ctx.fillText(label, node.x, rectY + bgHeight / 2);
              }
            }}
            linkColor={() => "rgba(71, 85, 105, 0.15)"}
            onNodeHover={() => {}}
            onNodeClick={(node: any) => {
              setSelectedCourseId(node.id);
              setIsSheetOpen(true);
            }}
            onEngineStop={() => {
              if (!isStable) {
                fgRef.current.zoomToFit(1000, 30);
                // Zoom in more for better initial legibility
                setTimeout(() => fgRef.current?.zoom(2.2, 800), 1100);
                setIsStable(true);
              }
            }}
            d3AlphaDecay={0.015}
            d3VelocityDecay={0.35}
            />
          )}
        </div>

        <div className="absolute bottom-8 right-8 z-10 flex flex-col gap-3 pointer-events-auto">
          <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl bg-white/90 backdrop-blur-xl border-slate-200 shadow-lg hover:bg-slate-50 text-slate-600 transition-all active:scale-95" onClick={() => fgRef.current?.zoomToFit(400, 30)}>
            <Maximize2 size={20} />
          </Button>
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-xl shadow-lg overflow-hidden">
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-none border-b border-slate-100 hover:bg-slate-50 text-slate-600" onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.5)}>
              <ZoomIn size={20} />
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-none hover:bg-slate-50 text-slate-600" onClick={() => fgRef.current?.zoom(fgRef.current.zoom() / 1.5)}>
              <ZoomOut size={20} />
            </Button>
          </div>
        </div>


        <CourseDetailSheet
          courseId={selectedCourseId}
          open={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          onNavigate={(id) => setSelectedCourseId(id)}
        />
      </div>
    </div>
  );
};
