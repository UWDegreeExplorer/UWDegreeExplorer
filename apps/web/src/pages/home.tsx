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
import { LoginRequired } from "@/components/shared/LoginRequired";
import { ConversationList } from "../features/messages/ConversationList";
import { MessagePanel } from "../features/messages/MessagePanel";
import { CourseExplorer } from "../features/planner/CourseExplorer";
import { DegreeRequirements } from "../features/planner/DegreeRequirements";
import { DegreeAuditor } from "../features/planner/DegreeAuditor";
import { MakeCalendar } from "../features/planner/MakeCalendar";
import { WorkloadCalculator } from "../features/planner/WorkloadCalculator";
import { GradeCalculator } from "../features/planner/GradeCalculator";
import { BreadthConstellation } from "../features/planner/BreadthConstellation";

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
  Heart,
  Plus,
  Activity,
  Calculator
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
  const { data: userData } = useGetCurrentUser();
  const currentUser = userData?.user;
  const [, setLocation] = useLocation();
  const [matchPost, params] = useRoute<{ id: string }>("/post/:id");
  const selectedId = matchPost && params?.id ? Number(params.id) : null;
  const [activeSection, setActiveSection] = useState<SectionFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  
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
  const isPersonalSection = ["messages", "my-posts", "bookmarks", "likes", "drafts", "inbox"].includes(activeSection);

  const sectionTitleMap: Record<string, string> = {
    "my-posts": "My Activity",
    "bookmarks": "Bookmarks",
    "likes": "Likes",
    "messages": "Messages",
    "drafts": "Drafts",
    "inbox": "Inbox",
    "calendar": "Calendar Importer",
    "degree": "Checklist Rules",
    "degree-audit": "Major Check Sheet",
    "workload": "Workload Analysis",
    "grades": "Grade Calculator",
    "breadth": "Breadth Constellation"
  };

  const onSelectSection = (s: SectionFilter, commentId?: number) => {
    setActiveSection(s);
    setSearch("");
    setSidebarOpen(false);
    
    if (s === "settings") {
      setLocation("/settings");
    } else if (s === "bookmarks") {
      setLocation("/bookmarks");
    } else if (s === "my-posts") {
      setLocation("/activity");
    } else if (s === "messages") {
      // Stay on home but show messages section
    } else if (s === "likes") {
      setLocation("/likes");
    } else if (s === "courses") {
      setLocation("/courses");
    } else if (s === "degree") {
      setLocation("/degree");
    } else if (s === "degree-audit") {
      setLocation("/degree-audit");
    } else if (s === "calendar") {
      setLocation("/calendar");
    } else if (s === "workload") {
      setLocation("/workload");
    } else if (s === "grades") {
      setLocation("/grades");
    } else if (s === "breadth") {
      setLocation("/breadth");
    } else if (matchPost || matchSettings || matchBookmarks || matchActivity || matchLikes || matchCourses || matchDegree || matchCalendar || matchWorkload || matchGrades || matchBreadth) {
      setLocation(commentId ? `/post/${selectedId}?commentId=${commentId}` : "/");
    }
  };

  const openConversation = (id: string) => {
    setActiveSection("messages");
    setSelectedConversationId(id);
  };

  const handleSelectPost = (id: number, commentId?: number) => {
    const url = commentId ? `/post/${id}?commentId=${commentId}` : `/post/${id}`;
    setLocation(url);
  };

  const [matchSettings] = useRoute("/settings");
  const [matchBookmarks] = useRoute("/bookmarks");
  const [matchActivity] = useRoute("/activity");
  const [matchLikes] = useRoute("/likes");
  const [matchCourses] = useRoute("/courses");
  const [matchDegree] = useRoute("/degree");
  const [matchDegreeAudit] = useRoute("/degree-audit");
  const [matchCalendar] = useRoute("/calendar");
  const [matchWorkload] = useRoute("/workload");
  const [matchGrades] = useRoute("/grades");
  const [matchBreadth] = useRoute("/breadth");

  useEffect(() => {
    if (matchSettings) {
      setActiveSection("settings");
    } else if (matchBookmarks) {
      setActiveSection("bookmarks");
    } else if (matchActivity) {
      setActiveSection("my-posts");
    } else if (matchLikes) {
      setActiveSection("likes");
    } else if (matchCourses) {
      setActiveSection("courses");
    } else if (matchDegree) {
      setActiveSection("degree");
    } else if (matchDegreeAudit) {
      setActiveSection("degree-audit");
    } else if (matchCalendar) {
      setActiveSection("calendar");
    } else if (matchWorkload) {
      setActiveSection("workload");
    } else if (matchGrades) {
      setActiveSection("grades");
    } else if (matchBreadth) {
      setActiveSection("breadth");
    }
  }, [matchSettings, matchBookmarks, matchActivity, matchLikes, matchCourses, matchDegree, matchCalendar, matchWorkload, matchGrades, matchBreadth]);

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

            {!currentUser && isPersonalSection ? (
              <Panel defaultSize={80} minSize={60}>
                <main className="flex-1 flex flex-col bg-background h-full min-w-0 items-center justify-center">
                   <LoginRequired 
                      title={sectionTitleMap[activeSection] || activeSection} 
                      description={`Access your ${activeSection.replace("-", " ")} and keep track of your contributions. Sign in to see your personalized content.`}
                      icon={
                        activeSection === "messages" ? <MessageSquare size={48} className="text-primary/20" /> :
                        activeSection === "bookmarks" ? <Bookmark size={48} className="text-primary/20" /> :
                        activeSection === "likes" ? <Heart size={48} className="text-primary/20" /> :
                        activeSection === "drafts" ? <FileEdit size={48} className="text-primary/20" /> :
                        activeSection === "inbox" ? <InboxIcon size={48} className="text-primary/20" /> :
                        activeSection === "my-posts" ? <FileText size={48} className="text-primary/20" /> :
                        <UserIcon size={48} className="text-primary/20" />
                      }
                   />
                </main>
              </Panel>
            ) : activeSection === "settings" ? (
              <Panel defaultSize={80} minSize={60}>
                <main className="flex-1 flex flex-col bg-background h-full min-w-0">
                  <SettingsPane />
                </main>
              </Panel>
            ) : activeSection === "courses" ? (
              <Panel defaultSize={80} minSize={60}>
                <main className="flex-1 flex flex-col bg-background h-full min-w-0 overflow-y-auto">
                  <CourseExplorer />
                </main>
              </Panel>
            ) : activeSection === "degree" ? (
              <Panel defaultSize={80} minSize={60}>
                <main className="flex-1 flex flex-col bg-background h-full min-w-0 overflow-y-auto">
                  <DegreeRequirements />
                </main>
              </Panel>
            ) : activeSection === "degree-audit" ? (
              <Panel defaultSize={80} minSize={60}>
                <main className="flex-1 flex flex-col bg-background h-full min-w-0 overflow-y-auto">
                  <DegreeAuditor />
                </main>
              </Panel>
            ) : activeSection === "calendar" ? (
              <Panel defaultSize={80} minSize={60}>
                <main className="flex-1 flex flex-col bg-background h-full min-w-0 overflow-y-auto">
                  <MakeCalendar />
                </main>
              </Panel>
            ) : activeSection === "workload" ? (
              <Panel defaultSize={80} minSize={60}>
                <main className="flex-1 flex flex-col bg-background h-full min-w-0 overflow-y-auto">
                  <WorkloadCalculator />
                </main>
              </Panel>
            ) : activeSection === "grades" ? (
              <Panel defaultSize={80} minSize={60}>
                <main className="flex-1 flex flex-col bg-background h-full min-w-0 overflow-y-auto">
                  <GradeCalculator />
                </main>
              </Panel>
            ) : activeSection === "breadth" ? (
              <Panel defaultSize={80} minSize={60}>
                <main className="flex-1 flex flex-col bg-background h-full min-w-0 overflow-hidden">
                  <BreadthConstellation />
                </main>
              </Panel>
            ) : activeSection === "messages" ? (
              <>
                <Panel defaultSize={35} minSize={(320 / viewportWidth) * 100}>
                  <ConversationList 
                    selectedId={selectedConversationId} 
                    onSelect={setSelectedConversationId} 
                  />
                </Panel>
                <PanelResizeHandle className="w-1.5 flex items-center justify-center group bg-border hover:bg-primary/50 data-[active]:bg-primary/80 transition-colors">
                  <div className="w-0.5 h-8 bg-muted-foreground/30 group-hover:bg-white data-[active]:bg-white rounded-full" />
                </PanelResizeHandle>
                <Panel defaultSize={45} minSize={(360 / viewportWidth) * 100}>
                  <main className="flex-1 flex flex-col bg-background h-full min-w-0">
                    {selectedConversationId ? (
                      <MessagePanel conversationId={selectedConversationId} />
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
                        <MessageSquare className="w-12 h-12 mb-4" />
                        <h3 className="font-serif text-xl font-medium">Select a conversation</h3>
                        <p className="text-sm max-w-xs mt-2">Pick a conversation from the list to start messaging with other community members.</p>
                      </div>
                    )}
                  </main>
                </Panel>
              </>
            ) : (
              <>
                {/* List: min 320px */}
                <Panel defaultSize={35} minSize={(320 / viewportWidth) * 100}>
                  <PostList
                    section={activeSection}
                    selectedId={selectedId}
                    search={search}
                    onSearchChange={setSearch}
                    onSelect={handleSelectPost}
                    onSelectConversation={openConversation}
                  />
                </Panel>

                <PanelResizeHandle className="w-1.5 flex items-center justify-center group bg-border hover:bg-primary/50 data-[active]:bg-primary/80 transition-colors">
                  <div className="w-0.5 h-8 bg-muted-foreground/30 group-hover:bg-white data-[active]:bg-white rounded-full" />
                </PanelResizeHandle>

                {/* Detail: min 360px */}
                <Panel defaultSize={45} minSize={(360 / viewportWidth) * 100}>
                  <main className="flex-1 flex flex-col bg-background h-full min-w-0">
                    {selectedId ? (
                      <PostDetailPane 
                        postId={selectedId} 
                        onOpenConversation={openConversation}
                      />
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
            {!currentUser && isPersonalSection ? (
              <main className="flex-1 min-w-0 bg-background h-full overflow-hidden">
                 <LoginRequired 
                    title={sectionTitleMap[activeSection] || activeSection} 
                    description={`Access your ${activeSection.replace("-", " ")} and keep track of your contributions. Sign in to see your personalized content.`}
                    icon={
                      activeSection === "messages" ? <MessageSquare size={48} className="text-primary/20" /> :
                      activeSection === "bookmarks" ? <Bookmark size={48} className="text-primary/20" /> :
                      activeSection === "likes" ? <Heart size={48} className="text-primary/20" /> :
                      activeSection === "drafts" ? <FileEdit size={48} className="text-primary/20" /> :
                      activeSection === "inbox" ? <InboxIcon size={48} className="text-primary/20" /> :
                      activeSection === "my-posts" ? <FileText size={48} className="text-primary/20" /> :
                      <UserIcon size={48} className="text-primary/20" />
                    }
                 />
              </main>
            ) : activeSection === "settings" ? (
              <main className="flex-1 min-w-0 bg-background h-full overflow-hidden">
                <SettingsPane />
              </main>
            ) : activeSection === "courses" ? (
              <main className="flex-1 min-w-0 bg-background h-full overflow-y-auto">
                <CourseExplorer />
              </main>
            ) : activeSection === "degree" ? (
              <main className="flex-1 min-w-0 bg-background h-full overflow-y-auto">
                <DegreeRequirements />
              </main>
            ) : activeSection === "degree-audit" ? (
              <main className="flex-1 min-w-0 bg-background h-full overflow-y-auto">
                <DegreeAuditor />
              </main>
            ) : activeSection === "calendar" ? (
              <main className="flex-1 min-w-0 bg-background h-full overflow-y-auto">
                <MakeCalendar />
              </main>
            ) : activeSection === "workload" ? (
              <main className="flex-1 min-w-0 bg-background h-full overflow-y-auto">
                <WorkloadCalculator />
              </main>
            ) : activeSection === "grades" ? (
              <main className="flex-1 min-w-0 bg-background h-full overflow-y-auto">
                <GradeCalculator />
              </main>
            ) : activeSection === "breadth" ? (
              <main className="flex-1 min-w-0 bg-background h-full overflow-hidden">
                <BreadthConstellation />
              </main>
            ) : activeSection === "messages" ? (
              <>
                <div className="basis-[38%] max-w-[360px] min-w-[300px] shrink-0 h-full border-r border-border">
                  <ConversationList 
                    selectedId={selectedConversationId} 
                    onSelect={setSelectedConversationId} 
                  />
                </div>
                <main className="flex-1 min-w-0 bg-background h-full overflow-hidden">
                  {selectedConversationId ? (
                    <MessagePanel conversationId={selectedConversationId} />
                  ) : (
                    <div className="flex-1 flex items-center justify-center opacity-30">
                      <p>Select a message</p>
                    </div>
                  )}
                </main>
              </>
            ) : (
              <>
                <div className="basis-[38%] max-w-[360px] min-w-[300px] shrink-0 h-full border-r border-border">
                  <PostList
                    section={activeSection}
                    selectedId={selectedId}
                    search={search}
                    onSearchChange={setSearch}
                    onSelect={handleSelectPost}
                    onSelectConversation={openConversation}
                  />
                </div>
                <main className="flex-1 min-w-0 bg-background h-full overflow-hidden">
                  {selectedId ? (
                    <PostDetailPane 
                      postId={selectedId} 
                      onOpenConversation={openConversation}
                    />
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
            {!currentUser && isPersonalSection ? (
               <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border flex items-center bg-card/10 backdrop-blur-sm sticky top-0 z-10">
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-1 gap-1.5 h-8 text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-xs font-medium">Home</span>
                  </Button>
                </div>
                <LoginRequired 
                    title={sectionTitleMap[activeSection] || activeSection} 
                    description={`Access your ${activeSection.replace("-", " ")} and keep track of your contributions. Sign in to see your personalized content.`}
                    icon={
                      activeSection === "messages" ? <MessageSquare size={48} className="text-primary/20" /> :
                      activeSection === "bookmarks" ? <Bookmark size={48} className="text-primary/20" /> :
                      activeSection === "likes" ? <Heart size={48} className="text-primary/20" /> :
                      activeSection === "drafts" ? <FileEdit size={48} className="text-primary/20" /> :
                      activeSection === "inbox" ? <InboxIcon size={48} className="text-primary/20" /> :
                      activeSection === "my-posts" ? <FileText size={48} className="text-primary/20" /> :
                      <UserIcon size={48} className="text-primary/20" />
                    }
                 />
              </div>
            ) : activeSection === "settings" ? (
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
            ) : activeSection === "courses" ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border flex items-center bg-card/10 backdrop-blur-sm sticky top-0 z-10">
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-1 gap-1.5 h-8 text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-xs font-medium">Home</span>
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <CourseExplorer />
                </div>
              </div>
            ) : activeSection === "degree" ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border flex items-center bg-card/10 backdrop-blur-sm sticky top-0 z-10">
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-1 gap-1.5 h-8 text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-xs font-medium">Home</span>
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <DegreeRequirements />
                </div>
              </div>
            ) : activeSection === "degree-audit" ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border flex items-center bg-card/10 backdrop-blur-sm sticky top-0 z-10">
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-1 gap-1.5 h-8 text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-xs font-medium">Home</span>
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <DegreeAuditor />
                </div>
              </div>
            ) : activeSection === "calendar" ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border flex items-center bg-card/10 backdrop-blur-sm sticky top-0 z-10">
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-1 gap-1.5 h-8 text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-xs font-medium">Home</span>
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <MakeCalendar />
                </div>
              </div>
            ) : activeSection === "workload" ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border flex items-center bg-card/10 backdrop-blur-sm sticky top-0 z-10">
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-1 gap-1.5 h-8 text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-xs font-medium">Home</span>
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <WorkloadCalculator />
                </div>
              </div>
            ) : activeSection === "grades" ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border flex items-center bg-card/10 backdrop-blur-sm sticky top-0 z-10">
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-1 gap-1.5 h-8 text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-xs font-medium">Home</span>
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <GradeCalculator />
                </div>
              </div>
            ) : activeSection === "breadth" ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="px-3 py-1.5 border-b border-border flex items-center bg-card/10 backdrop-blur-sm sticky top-0 z-10">
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-1 gap-1.5 h-8 text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-xs font-medium">Home</span>
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden flex flex-col">
                  <BreadthConstellation />
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
                  <PostDetailPane 
                    postId={selectedId} 
                    onOpenConversation={openConversation}
                  />
                </div>
              </div>
            ) : activeSection === "messages" ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {selectedConversationId ? (
                  <MessagePanel 
                    conversationId={selectedConversationId} 
                    onBack={() => setSelectedConversationId(null)} 
                  />
                ) : (
                  <ConversationList 
                    selectedId={selectedConversationId} 
                    onSelect={setSelectedConversationId} 
                  />
                )}
              </div>
            ) : (
              <PostList
                section={activeSection}
                selectedId={selectedId}
                search={search}
                onSearchChange={setSearch}
                onSelect={handleSelectPost}
                onSelectConversation={openConversation}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
