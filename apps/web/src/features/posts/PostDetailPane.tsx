import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useGetPost, useDeletePost, useGetCurrentUser, useCreateComment, useCustomMutation, customFetch, getGetPostQueryKey, getGetRecentActivityQueryKey, getGetSectionStatsQueryKey, getListPostsQueryKey, type Comment, type Section } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { relTime } from "@/lib/utils";
import { SECTION_LABELS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserCircle2, Loader2, Bookmark, Trash2, MessageCircle, Reply, Send } from "lucide-react";

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

export function ReplyComposer({
  postId,
  parentId,
  isAnonymousMode,
  onDone,
  compact,
  initialBody = "",
  initialAnonymous = false,
  draftId: initialDraftId = null,
}: {
  postId: number;
  parentId: number | null;
  isAnonymousMode: boolean;
  onDone?: () => void;
  compact?: boolean;
  initialBody?: string;
  initialAnonymous?: boolean;
  draftId?: number | null;
}) {
  const [body, setBody] = useState(initialBody);
  const [anonymous, setAnonymous] = useState(initialAnonymous);
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(initialDraftId);
  const createComment = useCreateComment();
  const { mutate: saveDraft, isPending: isSavingDraft } = useCustomMutation<any, any>("/drafts", {
    fetchOptions: { method: "POST" },
    onSuccess: (saved) => {
      setCurrentDraftId(saved.id);
      toast({ title: "Comment draft saved" });
      queryClient.invalidateQueries({ queryKey: ["/drafts"] });
    }
  });
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
        onSuccess: async () => {
          if (currentDraftId) {
            await customFetch(`/api/drafts/${currentDraftId}`, { method: "DELETE" });
            queryClient.invalidateQueries({ queryKey: ["/drafts"] });
          }
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

  if (isAnonymousMode) {
    return (
      <div className={compact ? "p-3 border rounded-lg bg-muted/30" : "rounded-xl border border-dashed border-border bg-card/50 p-6 shadow-sm flex flex-col items-center justify-center gap-3"}>
        <p className="text-sm text-muted-foreground text-center">
          Sign in to join the discussion and share your thoughts.
        </p>
        <Button size="sm" variant="outline" onClick={() => window.location.href = "/login"} className="gap-2">
          <UserCircle2 className="w-4 h-4" />
          Sign In / Sign Up
        </Button>
      </div>
    );
  }

  return (
    <div className={compact ? "" : "rounded-xl border border-border bg-card p-4 shadow-sm"}>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? "Write a reply…" : "Add to the discussion…"}
        className={compact ? "min-h-[80px] resize-y bg-background" : "min-h-[110px] resize-y bg-background text-base leading-relaxed"}
      />
      <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <Switch checked={anonymous} onCheckedChange={setAnonymous} />
          Post anonymously
        </label>
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

export function PostDetailPane({ postId }: { postId: number }) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGetPost(postId);
  const { data: currentUserData } = useGetCurrentUser();
  const currentUser = currentUserData?.user;
  const isAnonymousMode = !currentUser;
  const deletePost = useDeletePost();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { mutate: toggleBookmark, isPending: bookmarkPending } = useCustomMutation<any, any>(`/posts/${postId}/bookmark`, {
    fetchOptions: { method: "POST" },
    onSuccess: (res: { bookmarked: boolean }) => {
      queryClient.setQueryData(getGetPostQueryKey(postId), (old: any) => {
        if (!old || !old.post) return old;
        return {
          ...old,
          post: {
            ...old.post,
            isBookmarked: res.bookmarked,
            bookmarkCount: res.bookmarked ? (old.post.bookmarkCount + 1) : Math.max(0, old.post.bookmarkCount - 1)
          }
        };
      });

      queryClient.invalidateQueries({ queryKey: ["/posts/bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["/posts/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      
      toast({
        title: res.bookmarked ? "Bookmarked" : "Removed bookmark",
        description: res.bookmarked ? "Post added to your bookmarks." : "Post removed from your bookmarks.",
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Bookmark failed",
        description: err.message || "Could not update bookmark status.",
      });
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
              {bookmarkPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bookmark className={["w-3.5 h-3.5", post.isBookmarked ? "fill-current" : ""].join(" ")} />
              )}
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
