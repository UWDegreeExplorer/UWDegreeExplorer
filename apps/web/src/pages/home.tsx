import { useState, useMemo } from "react"; // HMR force reload
import { useLocation, useRoute } from "wouter";
import {
  useGetCurrentUser,
  useLogoutUser,
  useListPosts,
  useGetPost,
  useCreateComment,
  useDeletePost,
  useGetSectionStats,
  useGetRecentActivity,
  useUpdateCurrentUser,
  getGetCurrentUserQueryKey,
  getGetPostQueryKey,
  getListPostsQueryKey,
  getGetSectionStatsQueryKey,
  getGetRecentActivityQueryKey,
  useCustomFetch,
  useCustomMutation,
  customFetch,
  type Section,
  type Comment,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { SettingsPane } from "../features/settings/SettingsPane";
import { WelcomePane } from "../features/activity/WelcomePane";
import { PostDetailPane, ReplyComposer } from "../features/posts/PostDetailPane";
import { Header } from "../features/navigation/Header";
import { SectionRail } from "../features/navigation/SectionRail";
import { PostList } from "../features/posts/PostList";

import { relTime, excerpt } from "@/lib/utils";
import {
  Car,
  GraduationCap,
  Home as HomeIcon,
  Layers,
  LogOut,
  MessageCircle,
  PencilLine,
  Reply,
  Loader2,
  Search,
  Send,
  Shield,
  Trash2,
  User as UserIcon,
  UserCircle2,
  Bell,
  Inbox as InboxIcon,
  FileText,
  MessageSquare,
  Bookmark,
  ChevronDown,
  ArrowUpDown,
  Filter,
  FileEdit,
  Sun,
  Moon,
  Monitor,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  GripVertical,
  Menu,
  ArrowLeft,
} from "lucide-react";
import { 
  PanelGroup, 
  Panel, 
  PanelResizeHandle,
  type ImperativePanelHandle 
} from "react-resizable-panels";
import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

import { type SectionFilter, SECTION_LABELS, SECTION_ICONS } from "@/lib/constants";



export default function Home() {
  const [, setLocation] = useLocation();
  const [matchPost, params] = useRoute<{ id: string }>("/post/:id");
  const selectedId = matchPost && params?.id ? Number(params.id) : null;
  const [activeSection, setActiveSection] = useState<SectionFilter>("all");
  const [search, setSearch] = useState("");
  
  const sidebarRef = useRef<ImperativePanelHandle>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isDesktop, setIsDesktop] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const desktopMql = window.matchMedia("(min-width: 1024px)");
    const tabletMql = window.matchMedia("(min-width: 640px) and (max-width: 1023px)");
    
    const handler = () => {
      setIsDesktop(desktopMql.matches);
      setIsTablet(tabletMql.matches);
    };

    handler();
    desktopMql.addEventListener("change", handler);
    tabletMql.addEventListener("change", handler);
    return () => {
      desktopMql.removeEventListener("change", handler);
      tabletMql.removeEventListener("change", handler);
    };
  }, []);

  const isMobile = !isDesktop && !isTablet;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;

  const onSelectSection = (s: SectionFilter) => {
    setActiveSection(s);
    setSearch("");
    setSidebarOpen(false);
    
    if (s === "settings") {
      setLocation("/settings");
    } else if (s === "bookmarks") {
      setLocation("/bookmarks");
    } else if (s === "my-posts") {
      setLocation("/activity");
    } else if (s === "likes") {
      setLocation("/likes");
    } else if (matchPost || matchSettings || matchBookmarks || matchActivity || matchLikes) {
      setLocation("/");
    }
  };

  const [matchSettings] = useRoute("/settings");
  const [matchBookmarks] = useRoute("/bookmarks");
  const [matchActivity] = useRoute("/activity");
  const [matchLikes] = useRoute("/likes");

  useEffect(() => {
    if (matchSettings) {
      setActiveSection("settings");
    } else if (matchBookmarks) {
      setActiveSection("bookmarks");
    } else if (matchActivity) {
      setActiveSection("my-posts");
    } else if (matchLikes) {
      setActiveSection("likes");
    }
  }, [matchSettings, matchBookmarks, matchActivity]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header 
        showMenuButton={!isDesktop} 
        onMenuClick={() => setSidebarOpen(true)} 
        onSelectSection={onSelectSection}
      />
      
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-72 border-none">
          <SectionRail
            active={activeSection}
            hideToggle
            onSelect={onSelectSection}
          />
        </SheetContent>
      </Sheet>

      <div className="flex-1 overflow-hidden relative">
        {isDesktop ? (
          <PanelGroup direction="horizontal">
            {/* Sidebar: min 220px */}
            <Panel 
              ref={sidebarRef}
              defaultSize={20} 
              minSize={(220 / viewportWidth) * 100} 
              maxSize={30} 
              collapsible
              collapsedSize={4}
              onCollapse={() => setIsSidebarCollapsed(true)}
              onExpand={() => setIsSidebarCollapsed(false)}
            >
              <SectionRail
                active={activeSection}
                isCollapsed={isSidebarCollapsed}
                onToggle={() => {
                  const sidebar = sidebarRef.current;
                  if (sidebar) {
                    if (isSidebarCollapsed) sidebar.expand();
                    else sidebar.collapse();
                  }
                }}
                onSelect={onSelectSection}
              />
            </Panel>
            
            <PanelResizeHandle className="w-1.5 flex items-center justify-center group bg-border hover:bg-primary/50 data-[active]:bg-primary/80 transition-colors">
              <div className="w-0.5 h-8 bg-muted-foreground/30 group-hover:bg-white data-[active]:bg-white rounded-full" />
            </PanelResizeHandle>

            {activeSection === "settings" ? (
              <Panel defaultSize={80} minSize={60}>
                <main className="flex-1 flex flex-col bg-background h-full min-w-0">
                  <SettingsPane />
                </main>
              </Panel>
            ) : (
              <>
                {/* List: min 320px */}
                <Panel defaultSize={35} minSize={(320 / viewportWidth) * 100}>
                  <PostList
                    section={activeSection}
                    selectedId={selectedId}
                    search={search}
                    onSearchChange={setSearch}
                    onSelect={(id) => setLocation(`/post/${id}`)}
                  />
                </Panel>

                <PanelResizeHandle className="w-1.5 flex items-center justify-center group bg-border hover:bg-primary/50 data-[active]:bg-primary/80 transition-colors">
                  <div className="w-0.5 h-8 bg-muted-foreground/30 group-hover:bg-white data-[active]:bg-white rounded-full" />
                </PanelResizeHandle>

                {/* Detail: min 360px */}
                <Panel defaultSize={45} minSize={(360 / viewportWidth) * 100}>
                  <main className="flex-1 flex flex-col bg-background h-full min-w-0">
                    {selectedId ? (
                      <PostDetailPane postId={selectedId} />
                    ) : (
                      <WelcomePane />
                    )}
                  </main>
                </Panel>
              </>
            )}
          </PanelGroup>
        ) : isTablet ? (
          <div className="flex h-full w-full">
            {activeSection === "settings" ? (
              <main className="flex-1 min-w-0 bg-background h-full overflow-hidden">
                <SettingsPane />
              </main>
            ) : (
              <>
                <div className="basis-[38%] max-w-[360px] min-w-[300px] shrink-0 h-full border-r border-border">
                  <PostList
                    section={activeSection}
                    selectedId={selectedId}
                    search={search}
                    onSearchChange={setSearch}
                    onSelect={(id) => setLocation(`/post/${id}`)}
                  />
                </div>
                <main className="flex-1 min-w-0 bg-background h-full overflow-hidden">
                  {selectedId ? (
                    <PostDetailPane postId={selectedId} />
                  ) : (
                    <WelcomePane />
                  )}
                </main>
              </>
            )}
          </div>
        ) : (
          /* Mobile: Single column with back navigation */
          <div className="h-full w-full flex flex-col bg-background">
            {activeSection === "settings" ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border flex items-center bg-card/10 backdrop-blur-sm sticky top-0 z-10">
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-1 gap-1.5 h-8 text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-xs font-medium">Home</span>
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col">
                  <SettingsPane />
                </div>
              </div>
            ) : selectedId ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border flex items-center bg-card/10 backdrop-blur-sm sticky top-0 z-10">
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-1 gap-1.5 h-8 text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-xs font-medium">Feed</span>
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col">
                  <PostDetailPane postId={selectedId} />
                </div>
              </div>
            ) : (
              <PostList
                section={activeSection}
                selectedId={selectedId}
                search={search}
                onSearchChange={setSearch}
                onSelect={(id) => setLocation(`/post/${id}`)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
