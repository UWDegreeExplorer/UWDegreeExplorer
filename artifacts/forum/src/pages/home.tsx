import { useState, useMemo } from "react";
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
  getGetCurrentUserQueryKey,
  getGetPostQueryKey,
  getListPostsQueryKey,
  getGetSectionStatsQueryKey,
  getGetRecentActivityQueryKey,
  useCustomFetch,
  useCustomMutation,
  type Section,
  type Comment,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";

type SectionFilter = Section | "all" | "my-posts" | "inbox" | "bookmarks";

const SECTION_LABELS: Record<Section, string> = {
  carpool: "Carpool",
  academic: "Academic",
  "find-roommate": "Find Roommate",
  other: "Other",
};

const SECTION_ICONS: Record<Section, any> = {
  carpool: Car,
  academic: GraduationCap,
  "find-roommate": HomeIcon,
  other: Layers,
};

function relTime(date: string | Date) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "some time ago";
  }
}

function excerpt(text: string, len: number) {
  if (text.length <= len) return text;
  return text.slice(0, len) + "…";
}

function Header() {
  const [, setLocation] = useLocation();
  const { data: userData } = useGetCurrentUser();
  const logout = useLogoutUser();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        setLocation("/");
      },
    });
  };

  const user = userData?.user;

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10">
      <div
        className="flex items-center gap-2.5 cursor-pointer group"
        onClick={() => setLocation("/")}
      >
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
          C
        </div>
        <span className="font-serif text-xl font-semibold tracking-tight">
          Campus Forum
        </span>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="gap-2.5 px-2 hover:bg-accent/50 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold border border-primary/20">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold leading-none">
                    {user.displayName}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {user.isAdmin ? "Administrator" : "Student Member"}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation("/new")}>
                <PencilLine className="w-4 h-4 mr-2" />
                New Post
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/login")}
            >
              Sign In
            </Button>
            <Button size="sm" onClick={() => setLocation("/register")}>
              Join Community
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

function SectionRail({
  active,
  onSelect,
}: {
  active: SectionFilter;
  onSelect: (s: SectionFilter) => void;
}) {
  const { data: stats } = useGetSectionStats();
  const { data: unreadData } = useCustomFetch<any>("/notifications/unread-count");
  const unreadCount = unreadData?.count ?? 0;

  return (
    <aside className="w-64 border-r border-border bg-card/20 flex flex-col shrink-0">
      <div className="p-4">
        <Button
          className="w-full justify-start gap-2.5 shadow-sm"
          onClick={() => (window.location.href = "/new")}
        >
          <PencilLine className="w-4 h-4" />
          Create New Post
        </Button>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Browse
        </div>
        <button
          onClick={() => onSelect("all")}
          className={[
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            active === "all"
              ? "bg-primary/10 text-primary"
              : "text-foreground/80 hover:bg-accent hover:text-foreground",
          ].join(" ")}
        >
          <HomeIcon className="w-4 h-4 shrink-0" />
          <span>All Discussions</span>
        </button>

        <div className="mt-4 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Sections
        </div>
        {(Object.keys(SECTION_LABELS) as Section[]).map((s) => {
          const Icon = SECTION_ICONS[s];
          const count = stats?.[s] ?? 0;
          return (
            <button
              key={s}
              onClick={() => onSelect(s)}
              className={[
                "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
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

        <div className="mt-4 px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Personal
        </div>
        <button
          onClick={() => onSelect("my-posts")}
          className={[
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
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
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            active === "bookmarks"
              ? "bg-primary/10 text-primary"
              : "text-foreground/80 hover:bg-accent hover:text-foreground",
          ].join(" ")}
        >
          <Bookmark className="w-4 h-4 shrink-0" />
          <span>Bookmarks</span>
        </button>

        <button
          onClick={() => onSelect("inbox")}
          className={[
            "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
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
      </nav>
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground leading-relaxed">
          A quiet community board for students and alumni. Browse anonymously or
          sign in to post under your name.
        </p>
      </div>
    </aside>
  );
}

function PostList({
  section,
  selectedId,
  onSelect,
  search,
  onSearchChange,
}: {
  section: SectionFilter;
  selectedId: number | null;
  onSelect: (id: number) => void;
  search: string;
  onSearchChange: (val: string) => void;
}) {
  const { data: currentUserData } = useGetCurrentUser();
  const currentUser = currentUserData?.user;
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState<Section | "all">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "post" | "comment">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const { data: posts, isLoading: postsLoading } = useListPosts({
    section: (section === "all" || section === "my-posts" || section === "inbox" || section === "bookmarks") ? undefined : section,
    search: search.trim() || undefined,
    authorId: section === "my-posts" ? currentUser?.id : undefined,
  }, {
    enabled: section !== "inbox" && section !== "my-posts" && section !== "bookmarks"
  });

  const { data: notifications, isLoading: notifyLoading, refetch: refetchNotify } = useCustomFetch<any[]>("/notifications", {
    enabled: section === "inbox" && !!currentUser,
  });

  const { data: activity, isLoading: activityLoading } = useCustomFetch<any[]>("/posts/activity", {
    enabled: section === "my-posts" && !!currentUser,
  });

  const { data: bookmarks, isLoading: bookmarkLoading } = useCustomFetch<any[]>("/posts/bookmarks", {
    enabled: section === "bookmarks" && !!currentUser,
  });

  const { mutate: markAllRead } = useCustomMutation<any, any>("/notifications/read-all", {
    method: "POST",
    onSuccess: () => {
      refetchNotify();
      queryClient.invalidateQueries({ queryKey: ["/notifications/unread-count"] });
    }
  });

  const isLoading = 
    (section === "inbox" ? notifyLoading : 
     section === "my-posts" ? activityLoading : 
     section === "bookmarks" ? bookmarkLoading :
     postsLoading);

  const filteredItems = useMemo(() => {
    let items = [];
    if (section === "my-posts") items = [...(activity ?? [])];
    else if (section === "bookmarks") items = [...(bookmarks ?? [])];
    else items = [...(posts ?? [])];

    if (categoryFilter !== "all" && section !== "inbox") {
      items = items.filter(i => i.section === categoryFilter);
    }

    if (typeFilter !== "all") {
      items = items.filter(i => i.type === typeFilter || (i.type === undefined && typeFilter === "post"));
    }

    if (search.trim() && (section === "my-posts" || section === "bookmarks")) {
      const s = search.toLowerCase();
      items = items.filter(i => 
        (i.title?.toLowerCase().includes(s)) || 
        (i.content?.toLowerCase().includes(s))
      );
    }

    items.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });

    return items;
  }, [posts, activity, bookmarks, section, categoryFilter, typeFilter, sortOrder, search]);

  return (
    <div className="w-[420px] border-r border-border flex flex-col shrink-0 bg-background">
      <div className="px-6 py-5 border-b border-border bg-card/30 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-serif text-2xl font-medium tracking-tight">
            {section === "all" ? "All Discussions" : 
             section === "my-posts" ? "My Activity" :
             section === "inbox" ? "Notifications" :
             section === "bookmarks" ? "Bookmarks" :
             SECTION_LABELS[section as Section]}
          </h1>
          {section === "inbox" && notifications && notifications.length > 0 && (
            <Button variant="ghost" size="xs" onClick={() => markAllRead({})} className="text-xs text-muted-foreground hover:text-primary">
              Mark all read
            </Button>
          )}
        </div>
        
        <div className="flex flex-col gap-3 mt-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search in this view..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-muted/50 border border-transparent rounded-md focus:border-primary/30 focus:ring-0 outline-none transition-all"
            />
          </div>
          
          {(section === "all" || section === "my-posts" || section === "bookmarks" || (section as string) in SECTION_LABELS) && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="xs" className="h-7 text-[10px] gap-1 px-2 border-dashed">
                    <Filter className="w-3 h-3" />
                    {categoryFilter === "all" ? "All Categories" : SECTION_LABELS[categoryFilter]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="text-xs">
                  <DropdownMenuItem onClick={() => setCategoryFilter("all")}>All Categories</DropdownMenuItem>
                  {Object.entries(SECTION_LABELS).map(([val, label]) => (
                    <DropdownMenuItem key={val} onClick={() => setCategoryFilter(val as Section)}>{label}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {(section === "my-posts") && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="xs" className="h-7 text-[10px] gap-1 px-2 border-dashed">
                      <Layers className="w-3 h-3" />
                      {typeFilter === "all" ? "All Types" : typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1) + "s"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="text-xs">
                    <DropdownMenuItem onClick={() => setTypeFilter("all")}>All Types</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTypeFilter("post")}>Posts</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTypeFilter("comment")}>Comments</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="xs" className="h-7 text-[10px] gap-1 px-2 border-dashed ml-auto">
                    <ArrowUpDown className="w-3 h-3" />
                    {sortOrder === "newest" ? "Newest" : "Oldest"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuItem onClick={() => setSortOrder("newest")}>Date (Newest to Oldest)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortOrder("oldest")}>Date (Oldest to Newest)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-8 flex flex-col items-center justify-center text-muted-foreground text-center">
            <Loader2 className="w-6 h-6 animate-spin mb-2 opacity-20" />
            <span className="text-xs font-medium">Loading items...</span>
          </div>
        ) : section === "inbox" ? (
          <ul className="divide-y divide-border">
            {notifications?.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => onSelect(n.postId)}
                  className={[
                    "w-full text-left px-6 py-4 transition-colors hover:bg-accent/50",
                    !n.isRead && "bg-primary/[0.03] relative after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1 after:bg-primary"
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={n.isRead ? "outline" : "secondary"} className="text-[10px] py-0">
                      {n.type === "reply_to_post" ? "Post Reply" : "Comment Reply"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{relTime(n.createdAt)}</span>
                  </div>
                  <p className="text-sm leading-snug">
                    <span className="font-bold text-foreground">{n.actorName}</span>
                    <span className="text-muted-foreground"> replied to: </span>
                    <span className="font-medium">"{n.postTitle}"</span>
                  </p>
                </button>
              </li>
            ))}
            {notifications?.length === 0 && <EmptyState message="No notifications yet" />}
          </ul>
        ) : (
          <ul className="divide-y divide-border">
            {filteredItems.map((p) => {
              const isActive = p.id === selectedId;
              const isPost = p.type === "post" || p.type === undefined;
              return (
                <li key={`${p.type || 'post'}-${p.id}`}>
                  <button
                    onClick={() => onSelect(isPost ? p.id : p.postId)}
                    className={[
                      "w-full text-left px-6 py-4 transition-colors",
                      isActive
                        ? "bg-primary/5 border-l-2 border-l-primary -ml-px"
                        : "hover:bg-accent/50 border-l-2 border-l-transparent -ml-px",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tight">
                        {p.type ? p.type : SECTION_LABELS[p.section as Section]}
                      </Badge>
                      {p.isAnonymous && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Anonymous</Badge>}
                      <span className="text-[11px] text-muted-foreground ml-auto">{relTime(isPost ? p.lastActivityAt : p.createdAt)}</span>
                    </div>
                    <h3 className="font-serif text-[15px] font-semibold leading-tight text-foreground group-hover:text-primary transition-colors mb-1.5">
                      {p.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                      {p.excerpt || excerpt(p.content || "", 120)}
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">{p.commentCount ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Bookmark className={["w-3.5 h-3.5", p.isBookmarked ? "fill-primary text-primary" : ""].join(" ")} />
                          <span className="text-xs font-medium">{p.bookmarkCount ?? 0}</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground/70 text-right truncate max-w-[120px]">
                        by {p.authorName}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
            {filteredItems.length === 0 && <EmptyState message="No matching results found" />}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-12 flex flex-col items-center justify-center text-center opacity-40">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Layers className="w-6 h-6" />
      </div>
      <p className="text-xs font-medium uppercase tracking-widest">{message}</p>
    </div>
  );
}

function CommentNode({
  comment,
  childrenByParent,
  postId,
  depth,
  isAnonymousMode,
}: {
  comment: Comment;
  childrenByParent: Map<number | null, Comment[]>;
  postId: number;
  depth: number;
  isAnonymousMode: boolean;
}) {
  const [showReply, setShowReply] = useState(false);
  const children = childrenByParent.get(comment.id) ?? [];
  const indent = Math.min(depth, 3);

  return (
    <div
      className="relative"
      style={{ marginLeft: indent === 0 ? 0 : `${indent * 20}px` }}
    >
      <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-6 h-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-[10px] font-medium">
            {comment.isAnonymous ? (
              <UserCircle2 className="w-3.5 h-3.5" />
            ) : (
              comment.authorName.slice(0, 1).toUpperCase()
            )}
          </div>
          <span className="font-medium">{comment.authorName}</span>
          {comment.isAnonymous && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Anonymous
            </Badge>
          )}
          <span className="text-muted-foreground text-xs">
            · {relTime(comment.createdAt)}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
          {comment.body}
        </p>
        <div className="mt-2 -ml-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            onClick={() => setShowReply((v) => !v)}
          >
            <Reply className="w-3 h-3" />
            Reply
          </Button>
        </div>
        {showReply && (
          <div className="mt-3">
            <ReplyComposer
              postId={postId}
              parentId={comment.id}
              isAnonymousMode={isAnonymousMode}
              onDone={() => setShowReply(false)}
              compact
            />
          </div>
        )}
      </div>

      {children.length > 0 && (
        <div className="mt-3 space-y-3">
          {children.map((c) => (
            <CommentNode
              key={c.id}
              comment={c}
              childrenByParent={childrenByParent}
              postId={postId}
              depth={depth + 1}
              isAnonymousMode={isAnonymousMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReplyComposer({
  postId,
  parentId,
  isAnonymousMode,
  onDone,
  compact,
}: {
  postId: number;
  parentId: number | null;
  isAnonymousMode: boolean;
  onDone?: () => void;
  compact?: boolean;
}) {
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const createComment = useCreateComment();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const submit = () => {
    if (!body.trim()) return;
    createComment.mutate(
      {
        id: postId,
        data: {
          body: body.trim(),
          anonymous: isAnonymousMode || anonymous,
          parentId: parentId ?? undefined,
        },
      },
      {
        onSuccess: () => {
          setBody("");
          setAnonymous(false);
          queryClient.invalidateQueries({
            queryKey: getGetPostQueryKey(postId),
          });
          queryClient.invalidateQueries({
            queryKey: getGetRecentActivityQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetSectionStatsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getListPostsQueryKey(),
          });
          if (onDone) onDone();
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't post reply",
            description: err?.message || "Please try again.",
          });
        },
      },
    );
  };

  return (
    <div className={compact ? "" : "rounded-xl border border-border bg-card p-4 shadow-sm"}>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? "Write a reply…" : "Add to the discussion…"}
        className={compact ? "min-h-[80px] resize-y bg-background" : "min-h-[110px] resize-y bg-background text-base leading-relaxed"}
      />
      <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
        {isAnonymousMode ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <UserCircle2 className="w-3.5 h-3.5" />
            Posting as Anonymous (you are not signed in)
          </p>
        ) : (
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <Switch checked={anonymous} onCheckedChange={setAnonymous} />
            Post anonymously
          </label>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {onDone && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDone}
              disabled={createComment.isPending}
            >
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={submit}
            disabled={!body.trim() || createComment.isPending}
            className="gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            {parentId ? "Reply" : "Post reply"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PostDetailPane({ postId }: { postId: number }) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGetPost(postId);
  const { data: currentUserData } = useGetCurrentUser();
  const currentUser = currentUserData?.user;
  const isAnonymousMode = !currentUser;
  const deletePost = useDeletePost();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { mutate: toggleBookmark, isPending: bookmarkPending } = useCustomMutation<any, any>(`/posts/${postId}/bookmark`, {
    method: "POST",
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
      queryClient.invalidateQueries({ queryKey: ["/posts/bookmarks"] });
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    }
  });

  const handleDelete = () => {
    deletePost.mutate(
      { id: postId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
          queryClient.invalidateQueries({
            queryKey: getGetSectionStatsQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getGetRecentActivityQueryKey(),
          });
          toast({
            title: "Post deleted",
            description: "The post and all its replies have been removed.",
          });
          setLocation("/");
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't delete post",
            description: err?.message || "Please try again.",
          });
        },
      },
    );
  };

  const childrenByParent = useMemo(() => {
    const map = new Map<number | null, Comment[]>();
    if (data?.comments) {
      for (const c of data.comments) {
        const key = c.parentId ?? null;
        const list = map.get(key) ?? [];
        list.push(c);
        map.set(key, list);
      }
    }
    return map;
  }, [data?.comments]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading post…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Post not found.
      </div>
    );
  }

  const { post } = data;
  const topLevel = childrenByParent.get(null) ?? [];

  return (
    <ScrollArea className="flex-1">
      <article className="max-w-3xl mx-auto px-10 py-10">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5"
            >
              {SECTION_LABELS[post.section as Section]}
            </Badge>
            {post.isAnonymous && (
              <Badge
                variant="secondary"
                className="text-[10px] gap-1 px-2 py-0.5"
              >
                <UserCircle2 className="w-3 h-3" />
                Anonymous
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant={post.isBookmarked ? "default" : "outline"}
              size="sm"
              disabled={!currentUser || bookmarkPending}
              onClick={() => toggleBookmark({})}
              className={["h-8 gap-1.5", post.isBookmarked ? "" : "text-muted-foreground"].join(" ")}
            >
              <Bookmark className={["w-3.5 h-3.5", post.isBookmarked ? "fill-current" : ""].join(" ")} />
              <span>{post.isBookmarked ? "Bookmarked" : "Bookmark"}</span>
              {post.bookmarkCount > 0 && (
                <Badge variant={post.isBookmarked ? "secondary" : "outline"} className="ml-0.5 h-4 px-1 text-[9px]">
                  {post.bookmarkCount}
                </Badge>
              )}
            </Button>

            {post.canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive gap-1.5 h-8"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove the post and all replies on it.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deletePost.isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deletePost.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete post
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <h1 className="font-serif text-3xl font-medium leading-tight tracking-tight">
          {post.title}
        </h1>

        <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
          <div className="w-7 h-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-medium">
            {post.isAnonymous ? (
              <UserCircle2 className="w-4 h-4" />
            ) : (
              post.authorName.slice(0, 1).toUpperCase()
            )}
          </div>
          <span className="font-medium text-foreground/80">{post.authorName}</span>
          <span>· {relTime(post.createdAt)}</span>
        </div>

        <Separator className="my-6" />

        <div className="prose prose-stone max-w-none">
          <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
            {post.body}
          </p>
        </div>

        <div className="mt-12">
          <div className="flex items-center gap-2 mb-5">
            <MessageCircle className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-serif text-lg font-medium">
              {data.comments.length}{" "}
              {data.comments.length === 1 ? "Reply" : "Replies"}
            </h2>
          </div>

          {topLevel.length === 0 ? (
            <p className="text-sm text-muted-foreground italic mb-6">
              Be the first to reply.
            </p>
          ) : (
            <div className="space-y-3 mb-8">
              {topLevel.map((c) => (
                <CommentNode
                  key={c.id}
                  comment={c}
                  childrenByParent={childrenByParent}
                  postId={post.id}
                  depth={0}
                  isAnonymousMode={isAnonymousMode}
                />
              ))}
            </div>
          )}

          <div className="mt-8">
            <ReplyComposer
              postId={post.id}
              parentId={null}
              isAnonymousMode={isAnonymousMode}
            />
          </div>
        </div>
      </article>
    </ScrollArea>
  );
}

function WelcomePane() {
  const [, setLocation] = useLocation();
  const { data: activity } = useGetRecentActivity();
  const { data: currentUserData } = useGetCurrentUser();
  const currentUser = currentUserData?.user;

  return (
    <ScrollArea className="flex-1">
      <div className="max-w-2xl mx-auto px-10 py-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground font-serif font-bold text-2xl shadow-sm mb-5">
            C
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight">
            Welcome to Campus Forum
          </h1>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
            A quiet place for students and alumni to swap notes, find rides, find
            roommates, and stay connected. {currentUser ? "Pick a section on the left to start." : "Browse anonymously or sign in to post under your name."}
          </p>

          <div className="flex items-center justify-center gap-2 mt-6">
            <Button onClick={() => setLocation("/new")} className="gap-2">
              <PencilLine className="w-4 h-4" />
              Write a post
            </Button>
            {!currentUser && (
              <Button variant="outline" onClick={() => setLocation("/login")}>
                Sign in
              </Button>
            )}
          </div>
        </div>

        <div className="mt-12">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-serif text-lg font-medium">Recent activity</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          {!activity || activity.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No activity yet — be the first to start a conversation.
            </p>
          ) : (
            <ul className="space-y-2">
              {activity.map((a, i) => (
                <li key={`${a.kind}-${i}`}>
                  <button
                    onClick={() => setLocation(`/post/${a.postId}`)}
                    className="w-full text-left rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wider px-1.5 py-0"
                      >
                        {SECTION_LABELS[a.section as Section]}
                      </Badge>
                      <span className="text-foreground/70 font-medium">
                        {a.authorName}
                      </span>
                      <span>
                        {a.kind === "post" ? "started" : "replied to"}
                      </span>
                      <span>· {relTime(a.createdAt)}</span>
                    </div>
                    <h3 className="font-serif font-medium mt-1 leading-snug">
                      {a.postTitle}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {a.snippet}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [matchPost, params] = useRoute<{ id: string }>("/post/:id");
  const selectedId = matchPost && params?.id ? Number(params.id) : null;
  const [activeSection, setActiveSection] = useState<SectionFilter>("all");
  const [search, setSearch] = useState("");

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <SectionRail
          active={activeSection}
          onSelect={(s) => {
            setActiveSection(s);
            setSearch("");
            if (matchPost) setLocation("/");
          }}
        />
        <PostList
          section={activeSection}
          selectedId={selectedId}
          search={search}
          onSearchChange={setSearch}
          onSelect={(id) => setLocation(`/post/${id}`)}
        />
        <main className="flex-1 flex flex-col bg-background min-w-0">
          {selectedId ? (
            <PostDetailPane postId={selectedId} />
          ) : (
            <WelcomePane />
          )}
        </main>
      </div>
    </div>
  );
}
