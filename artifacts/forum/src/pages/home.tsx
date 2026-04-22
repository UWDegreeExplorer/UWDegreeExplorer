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
  Search,
  Send,
  Shield,
  Trash2,
  User as UserIcon,
  UserCircle2,
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

const SECTION_LABELS: Record<Section, string> = {
  carpool: "Carpool",
  academic: "Academic",
  roommate: "Find Roommate",
  other: "Other",
};

const SECTION_ORDER: Section[] = ["carpool", "academic", "roommate", "other"];

const SECTION_ICONS: Record<Section, typeof Car> = {
  carpool: Car,
  academic: GraduationCap,
  roommate: HomeIcon,
  other: Layers,
};

type SectionFilter = Section | "all";

function relTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

function Header() {
  const [, setLocation] = useLocation();
  const { data: currentUserData } = useGetCurrentUser();
  const currentUser = currentUserData?.user;
  const logoutMutation = useLogoutUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        toast({ title: "Signed out", description: "You are now browsing anonymously." });
      },
    });
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
      <button
        onClick={() => setLocation("/")}
        className="flex items-center gap-3 -ml-1 text-foreground hover:opacity-80 transition-opacity"
      >
        <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-serif font-bold text-base shadow-sm">
          C
        </div>
        <span className="font-serif text-lg font-medium tracking-tight">
          Campus Forum
        </span>
      </button>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => setLocation("/new")}
          className="gap-2"
        >
          <PencilLine className="w-4 h-4" />
          New Post
        </Button>

        {currentUser ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 pl-2 pr-2">
                <div className="w-7 h-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-medium">
                  {currentUser.displayName.slice(0, 1).toUpperCase()}
                </div>
                <span className="hidden sm:inline font-medium text-sm">
                  {currentUser.displayName}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{currentUser.displayName}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    @{currentUser.username}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 hidden sm:flex">
              <UserCircle2 className="w-3 h-3" />
              Anonymous
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/login")}
            >
              Sign in
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
  const totalPosts = useMemo(
    () => (stats ?? []).reduce((sum, s) => sum + s.postCount, 0),
    [stats],
  );

  const items: Array<{
    key: SectionFilter;
    label: string;
    icon: typeof Car;
    count: number;
  }> = [
    {
      key: "all",
      label: "All Discussions",
      icon: Layers,
      count: totalPosts,
    },
    ...SECTION_ORDER.map((s) => {
      const stat = stats?.find((x) => x.section === s);
      return {
        key: s as SectionFilter,
        label: SECTION_LABELS[s],
        icon: SECTION_ICONS[s],
        count: stat?.postCount ?? 0,
      };
    }),
  ];

  return (
    <aside className="w-64 border-r border-border bg-card/40 flex flex-col shrink-0">
      <div className="px-5 pt-6 pb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sections
        </h2>
      </div>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {items.map(({ key, label, icon: Icon, count }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={[
                "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/80 hover:bg-accent hover:text-foreground",
              ].join(" ")}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{label}</span>
              </span>
              <span
                className={[
                  "text-xs tabular-nums",
                  isActive ? "text-primary" : "text-muted-foreground",
                ].join(" ")}
              >
                {count}
              </span>
            </button>
          );
        })}
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
  const params = {
    section: section === "all" ? undefined : section,
    search: search.trim() || undefined,
  };
  const { data: posts, isLoading } = useListPosts(params);

  return (
    <div className="w-[420px] border-r border-border flex flex-col shrink-0 bg-background">
      <div className="px-6 py-5 border-b border-border bg-card/30 shrink-0">
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          {section === "all" ? "All Discussions" : SECTION_LABELS[section]}
        </h1>
        <div className="flex items-center justify-between mt-1 gap-4">
          <p className="text-sm text-muted-foreground shrink-0">
            {posts?.length ?? 0} {posts?.length === 1 ? "post" : "posts"}
          </p>
          <div className="relative flex-1 max-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-background/50 border border-border rounded-md pl-8 pr-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
            />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : !posts || posts.length === 0 ? (
          <EmptyPostList section={section} />
        ) : (
          <ul className="divide-y divide-border">
            {posts.map((p) => {
              const isActive = p.id === selectedId;
              return (
                <li key={p.id}>
                  <button
                    onClick={() => onSelect(p.id)}
                    className={[
                      "w-full text-left px-6 py-4 transition-colors",
                      isActive
                        ? "bg-primary/5 border-l-2 border-l-primary -ml-px"
                        : "hover:bg-accent/50 border-l-2 border-l-transparent -ml-px",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0"
                      >
                        {SECTION_LABELS[p.section]}
                      </Badge>
                      {p.isAnonymous && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 gap-1"
                        >
                          <UserCircle2 className="w-2.5 h-2.5" />
                          Anonymous
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-serif font-medium text-base leading-snug text-foreground">
                      {p.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                      {p.excerpt}
                    </p>
                    <div className="flex items-center gap-3 mt-2.5 text-xs text-muted-foreground">
                      <span className="truncate">{p.authorName}</span>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                      <span>{relTime(p.lastActivityAt)}</span>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {p.commentCount}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

function EmptyPostList({ section }: { section: SectionFilter }) {
  const [, setLocation] = useLocation();
  const label =
    section === "all" ? "anywhere" : `in ${SECTION_LABELS[section]}`;
  return (
    <div className="px-8 py-16 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
        <PencilLine className="w-5 h-5 text-muted-foreground" />
      </div>
      <h3 className="font-serif text-lg font-medium">No posts {label} yet</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
        Start the conversation. Share something with the community.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-5"
        onClick={() => setLocation("/new")}
      >
        Write the first post
      </Button>
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
        Loading post…
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
              {SECTION_LABELS[post.section]}
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
                  {currentUser?.isAdmin &&
                    post.authorId !== currentUser.id && (
                      <Badge
                        variant="outline"
                        className="ml-1 text-[10px] gap-1 px-1.5 py-0"
                      >
                        <Shield className="w-2.5 h-2.5" />
                        admin
                      </Badge>
                    )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the post and all{" "}
                    {data.comments.length}{" "}
                    {data.comments.length === 1 ? "reply" : "replies"} on it.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deletePost.isPending}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deletePost.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletePost.isPending ? "Deleting…" : "Delete post"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
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
                        {SECTION_LABELS[a.section]}
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
