import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useGetCurrentUser, useListPosts, useCustomFetch, useCustomMutation, customFetch, type Section, getGetSectionStatsQueryKey, getGetRecentActivityQueryKey, getListPostsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Filter, ArrowUpDown, Loader2, FileEdit, Trash2, MessageSquare, Bookmark, Layers, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type SectionFilter, SECTION_LABELS } from "@/lib/constants";
import { relTime, excerpt } from "@/lib/utils";
import { ReplyComposer } from "./PostDetailPane";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export function PostList({
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
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [categoryFilter, setCategoryFilter] = useState<Section | "all">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "post" | "comment">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const { data: posts, isLoading: postsLoading, isFetching: isFetchingPosts } = useListPosts({
    section: (section === "all" || section === "my-posts" || section === "inbox" || section === "bookmarks") ? undefined : section,
    search: search.trim() || undefined,
    authorId: section === "my-posts" ? currentUser?.id : undefined,
  } as any, {
    query: {
      enabled: section !== "inbox" && section !== "my-posts" && section !== "bookmarks"
    }
  } as any);

  const { data: notifications, isLoading: notifyLoading, isFetching: isFetchingNotify, refetch: refetchNotify } = useCustomFetch<any[]>("/notifications", {
    enabled: section === "inbox",
  });

  const { data: activity, isLoading: activityLoading, isFetching: isFetchingActivity } = useCustomFetch<any[]>("/posts/activity", {
    enabled: section === "my-posts",
  });

  const { data: bookmarks, isLoading: bookmarkLoading, isFetching: isFetchingBookmark } = useCustomFetch<any[]>("/posts/bookmarks", {
    enabled: section === "bookmarks",
  });

  const { data: drafts, isLoading: draftsLoading, isFetching: isFetchingDrafts } = useCustomFetch<any[]>("/drafts", {
    enabled: section === "drafts",
  });

  const { data: likedData, isLoading: likesLoading, isFetching: isFetchingLikes } = useCustomFetch<any>("/likes/me", {
    enabled: section === "likes",
  });

  const { mutate: markAllRead } = useCustomMutation<any, any>("/notifications/read-all", {
    fetchOptions: { method: "POST" },
    onSuccess: () => {
      refetchNotify();
      queryClient.invalidateQueries({ queryKey: ["/notifications/unread-count"] });
    }
  });

  const isLoading = 
    (section === "inbox" ? notifyLoading : 
     section === "my-posts" ? activityLoading : 
     section === "bookmarks" ? bookmarkLoading :
     section === "drafts" ? draftsLoading :
     section === "likes" ? likesLoading :
     postsLoading);

  const isFetching = 
    (section === "inbox" ? isFetchingNotify : 
     section === "my-posts" ? isFetchingActivity : 
     section === "bookmarks" ? isFetchingBookmark :
     section === "drafts" ? isFetchingDrafts :
     section === "likes" ? isFetchingLikes :
     isFetchingPosts);

  const filteredItems = useMemo(() => {
    let items = [];
    if (section === "my-posts") items = [...(activity ?? [])];
    else if (section === "bookmarks") items = [...(bookmarks ?? [])];
    else if (section === "drafts") items = [...(drafts ?? [])];
    else if (section === "likes") {
      const posts = (likedData?.posts || []).map((p: any) => ({ ...p, type: "post" }));
      const comments = (likedData?.comments || []).map((c: any) => ({ 
        ...c, 
        type: "comment", 
        title: `Reply: ${excerpt(c.body, 40)}`,
        content: c.body // Map body to content for consistent rendering
      }));
      items = [...posts, ...comments];
    }
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
      const timeA = section === "likes" ? new Date(a.likedAt).getTime() : new Date(a.createdAt).getTime();
      const timeB = section === "likes" ? new Date(b.likedAt).getTime() : new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });

    return items;
  }, [posts, activity, bookmarks, drafts, likedData, section, categoryFilter, typeFilter, sortOrder, search]);

  const handleLike = async (e: React.MouseEvent, id: number, type: "post" | "comment" = "post") => {
    e.stopPropagation();
    if (!currentUser) {
      toast({ title: "Please sign in", description: "You need to be logged in to like items." });
      return;
    }

    try {
      const url = type === "post" ? `/api/likes/posts/${id}/toggle` : `/api/likes/comments/${id}/toggle`;
      await customFetch(url, { method: "POST" });
      
      // Broad invalidation to catch all lists
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["/posts/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/posts/bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["/likes/me"] });
      queryClient.invalidateQueries({ queryKey: ["posts", id] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleBookmark = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!currentUser) {
      toast({ title: "Please sign in", description: "You need to be logged in to bookmark items." });
      return;
    }
    try {
      await customFetch(`/api/posts/${id}/bookmark`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["/posts/bookmarks"] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  return (
    <div className="w-full h-full border-r border-border flex flex-col min-w-0 bg-background">
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
            <Button variant="ghost" size="sm" onClick={() => markAllRead({})} className="text-xs text-muted-foreground hover:text-primary">
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
              {(section === "my-posts" || section === "bookmarks") && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2 border-dashed">
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
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2 border-dashed ml-auto">
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

      <ScrollArea className="flex-1 relative">
        {/* Subtle background fetching indicator */}
        {isFetching && filteredItems.length > 0 && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/20 animate-pulse z-20" />
        )}
        {isLoading && filteredItems.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
          </div>
        ) : (
          <div className={isFetching && filteredItems.length > 0 ? "opacity-60 transition-opacity duration-300 pointer-events-auto" : "transition-opacity duration-300"}>
            {section === "drafts" ? (
              <ul className="divide-y divide-border">
                {Array.isArray(drafts) && drafts.map((d: any) => {
                  const isCommentDraft = !!d.postId;
                  return (
                    <li key={d.id} className="px-6 py-5 hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={isCommentDraft ? "secondary" : "outline"} className="text-[10px] uppercase font-bold tracking-tight">
                          {isCommentDraft ? "Comment Draft" : (d.section ? SECTION_LABELS[d.section as Section] : "No Section")}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground ml-auto">Saved {relTime(d.updatedAt)}</span>
                      </div>
                      
                      {isCommentDraft && (
                        <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-bold">
                          Draft for: <span className="text-primary underline cursor-pointer" onClick={() => onSelect(d.postId)}>{d.postTitle}</span>
                        </div>
                      )}

                      <h3 className="font-serif text-[17px] font-semibold leading-tight text-foreground mb-2">
                        {d.title || (isCommentDraft ? "Comment Reply" : "(Untitled Draft)")}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed mb-4 italic">
                        {d.body ? excerpt(d.body, 150) : "No content yet..."}
                      </p>
                      <div className="flex items-center gap-3">
                        {isCommentDraft ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="default" className="h-8 gap-1.5">
                                <FileEdit className="w-3.5 h-3.5" />
                                Edit & Post
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-xl">
                              <DialogHeader>
                                <DialogTitle>Edit Comment Draft</DialogTitle>
                                <DialogDescription>
                                  Continuing your reply to: {d.postTitle}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="py-4">
                                <ReplyComposer 
                                  postId={d.postId}
                                  parentId={d.parentId}
                                  isAnonymousMode={currentUser?.isAdmin ? false : d.isAnonymous}
                                  initialBody={d.body}
                                  draftId={d.id}
                                  onDone={() => {
                                    queryClient.invalidateQueries({ queryKey: ["/drafts"] });
                                  }}
                                />
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="default" 
                            className="h-8 gap-1.5"
                            onClick={() => setLocation(`/new?draftId=${d.id}`)}
                          >
                            <FileEdit className="w-3.5 h-3.5" />
                            Edit
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="w-3.5 h-3.5" />
                              Discard
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Discard Draft?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this draft. You cannot undo this action.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Draft</AlertDialogCancel>
                              <AlertDialogAction 
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={async () => {
                                  await customFetch(`/api/drafts/${d.id}`, { method: "DELETE" });
                                  queryClient.invalidateQueries({ queryKey: ["/drafts"] });
                                  toast({ title: "Draft discarded" });
                                }}
                              >
                                Discard
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </li>
                  );
                })}
                {drafts?.length === 0 && <EmptyState message="No drafts saved" />}
              </ul>
            ) : section === "inbox" ? (
              <ul className="divide-y divide-border">
                {Array.isArray(notifications) && notifications.map((n) => (
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
                {Array.isArray(filteredItems) && filteredItems.map((p) => {
                  const isActive = p.id === selectedId;
                  const isPost = p.type === "post" || p.type === undefined;
                  const postId = isPost ? p.id : p.postId;

                  return (
                    <li key={`${p.type || 'post'}-${p.id}`}>
                      <button
                        onClick={() => onSelect(postId)}
                        className={[
                          "w-full text-left px-6 py-4 transition-colors",
                          isActive
                            ? "bg-primary/5 border-l-2 border-l-primary -ml-px"
                            : "hover:bg-accent/50 border-l-2 border-l-transparent -ml-px",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tight">
                            {p.type && p.type !== "post" ? p.type : SECTION_LABELS[p.section as Section]}
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
                            
                            <motion.button 
                              whileTap={{ scale: 0.8 }}
                              onClick={(e) => handleLike(e, p.id, p.type === "comment" ? "comment" : "post")}
                              className={["flex items-center gap-1.5 transition-colors", p.isLiked ? "text-red-500" : "hover:text-red-500"].join(" ")}
                            >
                              <motion.div
                                animate={p.isLiked ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                                transition={{ duration: 0.3 }}
                              >
                                <Heart className={["w-3.5 h-3.5", p.isLiked ? "fill-current" : ""].join(" ")} />
                              </motion.div>
                              <span className="text-xs font-medium">{p.likeCount ?? 0}</span>
                            </motion.button>

                            <motion.button 
                              whileTap={{ scale: 0.8 }}
                              onClick={(e) => handleBookmark(e, p.id)}
                              className={["flex items-center gap-1.5 transition-colors", p.isBookmarked ? "text-primary" : "hover:text-primary"].join(" ")}
                            >
                              <motion.div
                                animate={p.isBookmarked ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                                transition={{ duration: 0.3 }}
                              >
                                <Bookmark className={["w-3.5 h-3.5", p.isBookmarked ? "fill-current" : ""].join(" ")} />
                              </motion.div>
                              <span className="text-xs font-medium">{p.bookmarkCount ?? 0}</span>
                            </motion.button>
                          </div>
                          <span className="text-[11px] font-medium text-muted-foreground/70 text-right flex items-center gap-1 justify-end truncate max-w-[150px]">
                            by {p.isAnonymous && section === "my-posts" ? "Anonymous (Me)" : p.authorName}
                            {p.isStudentVerified && !p.isAnonymous && <VerifiedBadge className="w-3 h-3" />}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
            {filteredItems.length === 0 && <EmptyState message="No matching results found" />}
          </ul>
        )}
      </div>
    )}
  </ScrollArea>
</div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-12 flex flex-col items-center justify-center text-center opacity-40">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Layers className="w-6 h-6" />
      </div>
      <p className="text-xs font-medium uppercase tracking-widest">{message}</p>
    </div>
  );
}
