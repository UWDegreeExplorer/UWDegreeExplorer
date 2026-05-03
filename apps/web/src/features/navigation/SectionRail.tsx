import { motion, AnimatePresence } from "framer-motion";
import { useGetCurrentUser, useGetSectionStats, useCustomFetch, type Section } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  PencilLine, 
  Home as HomeIcon, 
  Layers, 
  User as UserIcon, 
  FileText, 
  Bookmark, 
  FileEdit, 
  Inbox as InboxIcon, 
  Heart, 
  MessageSquare, 
  GraduationCap,
  BookOpen,
  Calendar,
  Activity,
  Calculator
} from "lucide-react";
import { type SectionFilter, SECTION_LABELS, SECTION_ICONS } from "@/lib/constants";

export function SectionRail({
  active,
  onSelect,
  isCollapsed,
  onToggle,
  hideToggle = false,
}: {
  active: SectionFilter;
  onSelect: (s: SectionFilter) => void;
  isCollapsed?: boolean;
  onToggle?: () => void;
  hideToggle?: boolean;
}) {
  const { data: userData } = useGetCurrentUser();
  const currentUser = userData?.user;
  const { data: stats } = useGetSectionStats();
  const { data: unreadData } = useCustomFetch<any>("/notifications/unread-count");
  const unreadCount = unreadData?.count ?? 0;
  const { data: dmUnreadData } = useCustomFetch<any>("/dm/unread-count");
  const dmUnreadCount = dmUnreadData?.count ?? 0;

  return (
    <motion.aside 
      layout
      className={["border-r border-sidebar-border bg-sidebar flex flex-col h-full overflow-hidden"].join(" ")}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className={["flex items-center p-4 h-16", isCollapsed ? "justify-center" : "justify-between"].join(" ")}>
        {!isCollapsed && (
          <Button
            size="sm"
            className="flex-1 mr-2 justify-start gap-2.5 shadow-sm overflow-hidden whitespace-nowrap"
            onClick={() => {
              if (currentUser) {
                window.location.href = "/new";
              } else {
                window.location.href = "/login";
              }
            }}
          >
            <PencilLine className="w-4 h-4 shrink-0" />
            <span>New Post</span>
          </Button>
        )}

        {!hideToggle && onToggle && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary transition-colors"
            onClick={() => onToggle?.()}
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </Button>
        )}
      </div>

      <nav className="flex-1 px-3 space-y-2 overflow-y-auto pt-2 scrollbar-hide">
        {/* Group 1: Browse */}
        <button
          onClick={() => isCollapsed ? onToggle?.() : onSelect("all")}
          title={isCollapsed ? "Browse All" : ""}
          className={[
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all relative group",
            isCollapsed ? "justify-center h-10 w-10 mx-auto px-0" : "",
            active === "all"
              ? "bg-primary/10 text-primary"
              : "text-foreground/80 hover:bg-accent hover:text-foreground",
          ].join(" ")}
        >
          <HomeIcon className={["w-5 h-5 shrink-0 transition-transform duration-200", !isCollapsed ? "group-hover:scale-110" : ""].join(" ")} />
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              className="truncate"
            >
              All Discussions
            </motion.span>
          )}
        </button>

        {/* Group 2: Sections */}
        {isCollapsed ? (
          <button
            onClick={() => onToggle?.()}
            title="Sections"
            className={[
              "w-full flex items-center justify-center h-10 w-10 mx-auto rounded-md text-sm font-medium transition-all relative",
              (active === "carpool" || active === "academic" || active === "roommate" || active === "other")
                ? "bg-primary/10 text-primary"
                : "text-foreground/80 hover:bg-accent hover:text-foreground",
            ].join(" ")}
          >
            <Layers className="w-5 h-5 shrink-0" />
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-1"
          >
            <div className="mt-4 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest overflow-hidden whitespace-nowrap">
              Sections
            </div>
            {(Object.keys(SECTION_LABELS) as Section[]).map((s) => {
              const Icon = SECTION_ICONS[s];
              const sectionStat = Array.isArray(stats) ? stats.find((st: any) => st.section === s) : null;
              const count = sectionStat?.postCount ?? 0;
              return (
                <button
                  key={s}
                  onClick={() => onSelect(s)}
                  className={[
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                    active === s
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{SECTION_LABELS[s]}</span>
                  </div>
                  {count > 0 && (
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-bold text-muted-foreground">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
        
        {/* Group 2.5: Academic Planner */}
        <div className="space-y-1">
          <div className={["mt-4 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest overflow-hidden whitespace-nowrap", isCollapsed ? "text-center px-0 opacity-0" : ""].join(" ")}>
            Academic
          </div>
          <button
            onClick={() => isCollapsed ? onToggle?.() : onSelect("courses")}
            title={isCollapsed ? "Course Explorer" : ""}
            className={[
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all relative group",
              isCollapsed ? "justify-center h-10 w-10 mx-auto px-0" : "",
              active === "courses"
                ? "bg-primary/10 text-primary"
                : "text-foreground/80 hover:bg-accent hover:text-foreground",
            ].join(" ")}
          >
            <GraduationCap className={["w-5 h-5 shrink-0 transition-transform duration-200", !isCollapsed ? "group-hover:scale-110" : ""].join(" ")} />
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="truncate"
              >
                Course Explorer
              </motion.span>
            )}
          </button>
          <button
            onClick={() => isCollapsed ? onToggle?.() : onSelect("calendar")}
            title={isCollapsed ? "Make Calendar" : ""}
            className={[
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all relative group",
              isCollapsed ? "justify-center h-10 w-10 mx-auto px-0" : "",
              active === "calendar"
                ? "bg-primary/10 text-primary"
                : "text-foreground/80 hover:bg-accent hover:text-foreground",
            ].join(" ")}
          >
            <Calendar className={["w-5 h-5 shrink-0 transition-transform duration-200", !isCollapsed ? "group-hover:scale-110" : ""].join(" ")} />
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="truncate"
              >
                Make Calendar
              </motion.span>
            )}
          </button>
          <button
            onClick={() => isCollapsed ? onToggle?.() : onSelect("workload")}
            title={isCollapsed ? "Workload Calculator" : ""}
            className={[
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all relative group",
              isCollapsed ? "justify-center h-10 w-10 mx-auto px-0" : "",
              active === "workload"
                ? "bg-primary/10 text-primary"
                : "text-foreground/80 hover:bg-accent hover:text-foreground",
            ].join(" ")}
          >
            <Activity className={["w-5 h-5 shrink-0 transition-transform duration-200", !isCollapsed ? "group-hover:scale-110" : ""].join(" ")} />
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="truncate"
              >
                Workload Calculator
              </motion.span>
            )}
          </button>
          <button
            onClick={() => isCollapsed ? onToggle?.() : onSelect("grades")}
            title={isCollapsed ? "Grade Calculator" : ""}
            className={[
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all relative group",
              isCollapsed ? "justify-center h-10 w-10 mx-auto px-0" : "",
              active === "grades"
                ? "bg-primary/10 text-primary"
                : "text-foreground/80 hover:bg-accent hover:text-foreground",
            ].join(" ")}
          >
            <Calculator className={["w-5 h-5 shrink-0 transition-transform duration-200", !isCollapsed ? "group-hover:scale-110" : ""].join(" ")} />
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="truncate"
              >
                Grade Calculator
              </motion.span>
            )}
          </button>
        </div>

        {/* Group 3: Personal */}
        {currentUser && (
          isCollapsed ? (
            <button
              onClick={() => onToggle?.()}
              title="Personal"
              className={[
                "w-full flex items-center justify-center h-10 w-10 mx-auto rounded-md text-sm font-medium transition-all relative",
                (active === "my-posts" || active === "messages" || active === "bookmarks" || active === "likes" || active === "drafts" || active === "inbox")
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/80 hover:bg-accent hover:text-foreground",
              ].join(" ")}
            >
              <UserIcon className="w-5 h-5 shrink-0" />
              {(unreadCount > 0 || dmUnreadCount > 0) && (
                <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background shadow-sm animate-pulse" />
              )}
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-1"
            >
              <div className="mt-4 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest overflow-hidden whitespace-nowrap">
                Personal
              </div>
              <button
                onClick={() => onSelect("messages")}
                className={[
                  "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                  active === "messages"
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-accent hover:text-foreground",
                ].join(" ")}
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span>Messages</span>
                </div>
                {dmUnreadCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                    {dmUnreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => onSelect("my-posts")}
                className={[
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                  active === "my-posts"
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-accent hover:text-foreground",
                ].join(" ")}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>My Activity</span>
              </button>

              <button
                onClick={() => onSelect("bookmarks")}
                className={[
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                  active === "bookmarks"
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-accent hover:text-foreground",
                ].join(" ")}
              >
                <Bookmark className="w-4 h-4 shrink-0" />
                <span>Bookmarks</span>
              </button>

              <button
                onClick={() => onSelect("likes")}
                className={[
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                  active === "likes"
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-accent hover:text-foreground",
                ].join(" ")}
              >
                <Heart className="w-4 h-4 shrink-0" />
                <span>Likes</span>
              </button>

              <button
                onClick={() => onSelect("drafts")}
                className={[
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                  active === "drafts"
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-accent hover:text-foreground",
                ].join(" ")}
              >
                <FileEdit className="w-4 h-4 shrink-0" />
                <span>Drafts</span>
              </button>

              <button
                onClick={() => onSelect("inbox")}
                className={[
                  "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                  active === "inbox"
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-accent hover:text-foreground",
                ].join(" ")}
              >
                <div className="flex items-center gap-2.5">
                  <InboxIcon className="w-4 h-4 shrink-0" />
                  <span>Inbox</span>
                </div>
                {unreadCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
            </motion.div>
          )
        )}
      </nav>

      {!isCollapsed && (
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            A quiet community board for students and alumni. Sign in to unlock
            bookmarks, drafts, and notifications.
          </p>
        </div>
      )}
    </motion.aside>
  );
}

