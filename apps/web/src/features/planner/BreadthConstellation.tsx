import React, { useState, useEffect, useRef, useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Maximize2, ZoomIn, ZoomOut, BookOpen, Search, X } from "lucide-react";
import * as d3 from "d3-force";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CourseDetailSheet } from "./CourseDetailSheet";

interface GraphNode {
  id: string;
  code: string;
  title: string;
  category: string;
  val?: number;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: any;
  target: any;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// Vibrant neon colors suitable for dark background
const CATEGORY_COLORS: Record<string, string> = {
  "Humanities": "#60a5fa", 
  "Pure Sciences": "#34d399", 
  "Pure and Applied Sciences": "#fbbf24", 
  "Social Sciences": "#f472b6", 
};

export const BreadthConstellation: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isStable, setIsStable] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
      
      const res = await fetch(fullUrl);
      if (!res.ok) throw new Error("Failed to fetch categories");
      return (await res.json()).sort();
    }
  });

  const { data: graphData, isLoading } = useQuery<GraphData>({
    queryKey: ["breadth-graph", selectedCategory],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_URL || "";
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
    
    // Web-like Constellation Physics
    // Weaker charge and longer distances to create a sparse, interconnected web instead of a tight ball
    fg.d3Force("charge").strength(-40);
    fg.d3Force("link").distance(120);
    fg.d3Force("center", d3.forceCenter());
    // Remove radial force to allow natural clustering rather than a perfect circle
    fg.d3Force("radial", null);
    
    // Alive / Drifting feeling
    fg.d3AlphaTarget(0.005); 
    fg.d3VelocityDecay(0.15); // Very low decay for continuous slow drifting
    
    fg.d3ReheatSimulation();

    const timer = setTimeout(() => {
      if (!isStable) {
        // Full view of the constellation
        fg.zoomToFit(1200, 50);
        
        setTimeout(() => {
          if (!graphData.nodes.length) return;
          // Zoom in slightly to the center of mass
          const avgX = graphData.nodes.reduce((sum, n) => sum + (n.x || 0), 0) / graphData.nodes.length;
          const avgY = graphData.nodes.reduce((sum, n) => sum + (n.y || 0), 0) / graphData.nodes.length;
          
          fg.centerAt(avgX, avgY, 2000);
          fg.zoom(1.8, 2000);
          setIsStable(true);
        }, 1300);
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [graphData]);

  const processedData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    return {
      nodes: graphData.nodes.map(n => ({ ...n, val: 1.5 })), // Smaller base nodes
      links: graphData.links
    };
  }, [graphData]);

  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q || !processedData.nodes) return [];
    return processedData.nodes.filter(n => 
      n.code.toLowerCase().includes(q) || 
      n.title.toLowerCase().includes(q) ||
      n.category.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [searchQuery, processedData.nodes]);

  const handleJumpToNode = (node: GraphNode) => {
    if (fgRef.current && node.x !== undefined && node.y !== undefined) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(5, 1000);
      setSelectedCourseId(node.id);
      setIsSheetOpen(true);
      setSearchQuery("");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 bg-[#050505]">
        <Loader2 className="h-12 w-12 text-blue-400 animate-spin opacity-50" />
        <p className="text-slate-400 font-medium animate-pulse tracking-widest uppercase text-xs">Initializing Starfield...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-[#050505] overflow-hidden text-slate-200">
      <div className="p-8 pb-4 space-y-6 bg-black/40 backdrop-blur-xl border-b border-white/5 z-20 relative">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <BookOpen size={24} className="text-white" />
              </div>
              Breadth Constellation
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl text-sm leading-relaxed font-light">
              Discover interconnected academic pathways through Waterloo's breadth requirements. 
              Scroll to zoom, drag to explore, and click any star for details.
            </p>
          </div>

          <div className="w-80 relative group">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input 
                placeholder="Search code, name or category..." 
                className="pl-10 pr-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500 rounded-2xl focus:ring-white/20 focus:border-white/30 transition-all shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full text-slate-400 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {searchResults.length > 0 && (
              <Card className="absolute top-full mt-2 w-full z-50 border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl bg-[#0a0a0a]/95">
                <div className="py-2">
                  {searchResults.map(node => (
                    <button
                      key={node.id}
                      className="w-full px-4 py-2 text-left hover:bg-white/5 transition-colors group flex flex-col"
                      onClick={() => handleJumpToNode(node)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-200 group-hover:text-white transition-colors">{node.code}</span>
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter h-4 px-1 border-white/20 text-slate-400 group-hover:text-slate-300">
                          {node.category}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-slate-500 truncate">{node.title}</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button 
            variant={selectedCategory === null ? "secondary" : "ghost"} 
            size="sm" 
            className={`rounded-full px-5 h-9 text-xs font-semibold shadow-sm border ${selectedCategory === null ? 'bg-white text-black border-transparent hover:bg-slate-200' : 'text-slate-400 border-white/10 hover:bg-white/10'}`}
            onClick={() => setSelectedCategory(null)}
          >
            All Courses
          </Button>
          {(categories || []).map((cat) => {
            const color = CATEGORY_COLORS[cat] || "#94a3b8";
            const isSelected = selectedCategory === cat;
            return (
              <Button
                key={cat}
                variant="outline"
                size="sm"
                className="rounded-full px-5 h-9 text-xs font-semibold gap-2 border transition-all"
                style={{ 
                  borderColor: isSelected ? color : 'rgba(255,255,255,0.1)',
                  backgroundColor: isSelected ? `${color}20` : 'transparent',
                  color: isSelected ? color : '#94a3b8',
                  boxShadow: isSelected ? `0 0 10px ${color}40` : 'none'
                }}
                onClick={() => setSelectedCategory(cat)}
              >
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}` }} />
                {cat}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 relative min-h-0 w-full m-0 p-0 overflow-hidden bg-[#020202]">
        <div ref={containerRef} className="absolute inset-0 m-0 p-0 overflow-hidden">
          {dimensions.width > 0 && dimensions.height > 0 && (
            <ForceGraph2D
              ref={fgRef}
              graphData={processedData}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="#020202"
              d3AlphaDecay={0.01}
              d3VelocityDecay={0.15}
              cooldownTicks={0}
              nodeLabel={() => ""} 
              nodeRelSize={4}
              nodeCanvasObject={(node: any, ctx, globalScale) => {
                const label = node.code;
                const q = searchQuery.toLowerCase().trim();
                const isSearching = q !== "";
                const isMatch = isSearching && (
                  node.code.toLowerCase().includes(q) || 
                  node.title.toLowerCase().includes(q) ||
                  node.category.toLowerCase().includes(q)
                );
                
                const color = CATEGORY_COLORS[node.category] || "#ffffff";
                const alpha = isSearching ? (isMatch ? 1 : 0.05) : 0.8;
                const nodeSize = node.val || 1.5;

                // Draw glowing star
                ctx.beginPath();
                ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI, false);
                ctx.fillStyle = `rgba(${parseInt(color.slice(1,3), 16)}, ${parseInt(color.slice(3,5), 16)}, ${parseInt(color.slice(5,7), 16)}, ${alpha})`;
                
                // Glow effect
                if (alpha > 0.1) {
                  ctx.shadowBlur = isMatch ? 20 / globalScale : 8 / globalScale;
                  ctx.shadowColor = color;
                } else {
                  ctx.shadowBlur = 0;
                }
                
                ctx.fill();
                ctx.shadowBlur = 0; // Reset for performance

                // Draw labels only when zoomed in or matched
                if (globalScale > 3.5 || isMatch) {
                  const fontSize = (isMatch ? 14 : 10) / globalScale;
                  ctx.font = `${isMatch ? '800' : '500'} ${fontSize}px "Outfit", sans-serif`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  
                  const textWidth = ctx.measureText(label).width;
                  const bgPadding = 4 / globalScale;
                  const bgHeight = fontSize + bgPadding * 2;
                  const bgWidth = textWidth + bgPadding * 4;
                  
                  // Label background
                  ctx.fillStyle = isMatch ? `rgba(${parseInt(color.slice(1,3), 16)}, ${parseInt(color.slice(3,5), 16)}, ${parseInt(color.slice(5,7), 16)}, 0.2)` : 'rgba(0, 0, 0, 0.6)';
                  ctx.beginPath();
                  const rectX = node.x - bgWidth / 2;
                  const rectY = node.y + nodeSize + fontSize / 2 + 2/globalScale;
                  ctx.roundRect(rectX, rectY, bgWidth, bgHeight, 4 / globalScale);
                  ctx.fill();
                  
                  if (isMatch) {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1 / globalScale;
                    ctx.stroke();
                  }
                  
                  // Label text
                  ctx.fillStyle = isMatch ? '#ffffff' : 'rgba(255, 255, 255, 0.8)';
                  ctx.globalAlpha = alpha;
                  ctx.fillText(label, node.x, rectY + bgHeight / 2);
                  ctx.globalAlpha = 1;
                }
              }}
              linkColor={(link: any) => {
                const q = searchQuery.toLowerCase().trim();
                if (q) return "rgba(255, 255, 255, 0.02)"; // Almost invisible during search
                return "rgba(255, 255, 255, 0.08)"; // Faint white lines like a constellation
              }}
              linkWidth={1 / dimensions.width} // Very thin lines
              onNodeClick={(node: any) => {
                setSelectedCourseId(node.id);
                setIsSheetOpen(true);
              }}
            />
          )}
        </div>

        <div className="absolute bottom-8 right-8 z-10 flex flex-col gap-3 pointer-events-auto">
          <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl bg-black/60 backdrop-blur-xl border-white/10 hover:bg-white/10 hover:text-white text-slate-300 transition-all active:scale-95" onClick={() => fgRef.current?.zoomToFit(400, 50)}>
            <Maximize2 size={20} />
          </Button>
          <div className="flex flex-col rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl overflow-hidden">
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-none border-b border-white/10 hover:bg-white/10 text-slate-300 hover:text-white" onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.5)}>
              <ZoomIn size={20} />
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-none hover:bg-white/10 text-slate-300 hover:text-white" onClick={() => fgRef.current?.zoom(fgRef.current.zoom() / 1.5)}>
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
