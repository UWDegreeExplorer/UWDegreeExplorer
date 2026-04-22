import { useState, useCallback, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetCurrentUser,
  useGetSectionStats,
  useGetRecentActivity,
  useListPosts,
  useGetPost,
  useCreateComment,
  getGetCurrentUserQueryKey,
  getListPostsQueryKey,
  getGetPostQueryKey,
  getGetSectionStatsQueryKey,
  getGetRecentActivityQueryKey,
  Section,
  useLogoutUser
} from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Clock, ArrowLeft, LogOut, Plus, ChevronRight, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const SECTION_LABELS: Record<string, string> = {
  carpool: "Carpool",
  academic: "Academic",
  roommate: "Find Roommate",
  other: "Other"
};

export default function Home() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const postId = params.id ? parseInt(params.id, 10) : null;
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  
  const { data: currentUserData } = useGetCurrentUser();
  const currentUser = currentUserData?.user;
  
  const { data: sectionStats } = useGetSectionStats();
  const { data: recentActivity } = useGetRecentActivity();
  const { data: posts, isLoading: isLoadingPosts } = useListPosts(
    activeSection ? { section: activeSection } : undefined
  );

  const handleSelectPost = (id: number) => {
    setLocation(`/post/${id}`);
  };

  const handleClosePost = () => {
    setLocation("/");
  };

  const logoutMutation = useLogoutUser();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      }
    });
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-serif font-bold text-lg">
            C
          </div>
          <span className="font-serif font-semibold text-lg tracking-tight">Campus Forum</span>
        </div>
        
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setLocation("/new")}>
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </Button>
          
          {currentUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary">{currentUser.displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{currentUser.displayName}</p>
                    <p className="w-[200px] truncate text-sm text-muted-foreground">
                      @{currentUser.username}
                    </p>
                  </div>
                </div>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/login")}>Sign in</Button>
              <Button size="sm" onClick={() => setLocation("/register")}>Register</Button>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Rail */}
        <div className="w-64 border-r border-border bg-sidebar flex-shrink-0 flex flex-col hidden md:flex">
          <div className="p-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sections</h2>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveSection(null)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                  activeSection === null 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <span>Home</span>
              </button>
              
              {Object.entries(SECTION_LABELS).map(([key, label]) => {
                const section = key as Section;
                const stat = sectionStats?.find(s => s.section === section);
                
                return (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                      activeSection === section 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    }`}
                  >
                    <span>{label}</span>
                    {stat && stat.postCount > 0 && (
                      <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-medium">
                        {stat.postCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Middle Column - Post List */}
        <div className={`w-full md:w-[400px] lg:w-[450px] border-r border-border flex-shrink-0 flex flex-col bg-background ${postId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10 flex items-center justify-between">
            <h2 className="font-serif font-medium text-lg">
              {activeSection ? SECTION_LABELS[activeSection] : "All Posts"}
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {isLoadingPosts ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : posts && posts.length > 0 ? (
              <div className="divide-y divide-border">
                {posts.map(post => (
                  <button
                    key={post.id}
                    onClick={() => handleSelectPost(post.id)}
                    className={`w-full text-left p-4 transition-colors hover:bg-muted/50 ${postId === post.id ? 'bg-muted' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-medium text-primary uppercase tracking-wider">{SECTION_LABELS[post.section]}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <h3 className="font-serif font-medium text-base mb-1 line-clamp-2">{post.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5" />
                        <span className={post.isAnonymous ? "italic" : "font-medium"}>
                          {post.authorName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{post.commentCount}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                <p className="mb-2">No posts found in {activeSection ? SECTION_LABELS[activeSection] : "any section"}.</p>
                <Button variant="outline" size="sm" onClick={() => setLocation("/new")} className="mt-4">
                  Be the first to post
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane - Detail / Welcome */}
        <div className={`flex-1 flex flex-col bg-background min-w-0 ${!postId ? 'hidden md:flex' : 'flex'}`}>
          {postId ? (
            <PostDetailView postId={postId} onClose={handleClosePost} />
          ) : (
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-2xl mx-auto mt-8">
                <div className="mb-10 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-serif font-bold text-4xl mx-auto shadow-sm">
                    C
                  </div>
                  <h1 className="font-serif text-3xl font-medium">Welcome to Campus Forum</h1>
                  <p className="text-muted-foreground text-lg max-w-lg mx-auto">
                    A quiet, focused space for university students to share, discuss, and connect.
                  </p>
                </div>
                
                {recentActivity && recentActivity.length > 0 && (
                  <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-border bg-muted/30">
                      <h2 className="font-medium flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        Recent Activity
                      </h2>
                    </div>
                    <div className="divide-y divide-border">
                      {recentActivity.map((activity, i) => (
                        <div key={i} className="p-4 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => handleSelectPost(activity.postId)}>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-primary uppercase tracking-wider">{SECTION_LABELS[activity.section]}</span>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                              <h3 className="font-serif text-base font-medium mb-1">
                                {activity.kind === 'comment' ? 'Reply to: ' : ''}{activity.postTitle}
                              </h3>
                              <p className="text-sm text-muted-foreground line-clamp-1 italic">
                                "{activity.snippet}"
                              </p>
                            </div>
                            <div className="text-xs whitespace-nowrap text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded">
                              <UserIcon className="w-3 h-3" />
                              {activity.authorName}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PostDetailView({ postId, onClose }: { postId: number, onClose: () => void }) {
  const { data, isLoading } = useGetPost(postId);
  
  if (isLoading) {
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div className="space-y-4">
          <div className="h-6 w-24 bg-muted rounded"></div>
          <div className="h-10 w-3/4 bg-muted rounded"></div>
          <div className="h-4 w-48 bg-muted rounded"></div>
        </div>
        <div className="space-y-4 pt-8">
          <div className="h-4 w-full bg-muted rounded"></div>
          <div className="h-4 w-full bg-muted rounded"></div>
          <div className="h-4 w-2/3 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <h3 className="font-serif text-xl font-medium mb-2">Post not found</h3>
          <Button variant="outline" onClick={onClose}>Return to list</Button>
        </div>
      </div>
    );
  }

  const { post, comments } = data;
  
  // Organize comments into a tree
  const rootComments = comments.filter(c => !c.parentId);
  const childComments = comments.filter(c => c.parentId);

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
      <div className="p-4 border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10 flex items-center md:hidden">
        <Button variant="ghost" size="sm" onClick={onClose} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Post Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4 text-sm">
              <span className="px-2.5 py-0.5 bg-primary/10 text-primary font-medium rounded text-xs uppercase tracking-wider">
                {SECTION_LABELS[post.section]}
              </span>
              <span className="text-muted-foreground">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </span>
            </div>
            
            <h1 className="font-serif text-3xl font-medium leading-tight mb-6 text-foreground">
              {post.title}
            </h1>
            
            <div className="flex items-center gap-3 text-sm pb-6 border-b border-border/50">
              <Avatar className="h-10 w-10 border border-border">
                <AvatarFallback className={post.isAnonymous ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}>
                  {post.isAnonymous ? "?" : post.authorName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className={`font-medium ${post.isAnonymous ? 'italic text-muted-foreground' : 'text-foreground'}`}>
                  {post.authorName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {post.isAnonymous ? 'Anonymous Poster' : 'Verified Student'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Post Body */}
          <div className="prose prose-stone dark:prose-invert max-w-none mb-12">
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">{post.body}</p>
          </div>
          
          <div className="h-px bg-border w-full my-8"></div>
          
          {/* Comments Section */}
          <div className="space-y-8">
            <h3 className="font-serif text-xl font-medium flex items-center gap-2">
              Discussion <span className="text-muted-foreground text-sm font-sans bg-muted px-2 py-0.5 rounded-full">{comments.length}</span>
            </h3>
            
            <CommentComposer postId={postId} />
            
            <div className="space-y-6 mt-8">
              {rootComments.map(comment => (
                <CommentThread 
                  key={comment.id} 
                  comment={comment} 
                  allComments={childComments} 
                  postId={postId} 
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentThread({ comment, allComments, postId, depth = 0 }: { comment: any, allComments: any[], postId: number, depth?: number }) {
  const [isReplying, setIsReplying] = useState(false);
  const replies = allComments.filter(c => c.parentId === comment.id);
  
  return (
    <div className={`pt-4 ${depth > 0 ? 'pl-4 md:pl-6 border-l-2 border-border/40 mt-4' : ''}`}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 mt-1 border border-border shrink-0">
          <AvatarFallback className={`text-xs ${comment.isAnonymous ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
            {comment.isAnonymous ? "?" : comment.authorName.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className={`text-sm font-medium ${comment.isAnonymous ? 'italic text-muted-foreground' : ''}`}>
              {comment.authorName}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{comment.body}</p>
          
          <div className="pt-1">
            <button 
              onClick={() => setIsReplying(!isReplying)}
              className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              Reply
            </button>
          </div>
          
          {isReplying && (
            <div className="mt-3 pt-3 pb-2">
              <CommentComposer 
                postId={postId} 
                parentId={comment.id} 
                onSuccess={() => setIsReplying(false)} 
                onCancel={() => setIsReplying(false)}
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
      
      {replies.length > 0 && (
        <div className="mt-2">
          {replies.map(reply => (
            <CommentThread 
              key={reply.id} 
              comment={reply} 
              allComments={allComments} 
              postId={postId} 
              depth={Math.min(depth + 1, 3)} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

const commentSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty"),
  anonymous: z.boolean().default(false)
});

function CommentComposer({ postId, parentId = null, onSuccess, onCancel, autoFocus = false }: { postId: number, parentId?: number | null, onSuccess?: () => void, onCancel?: () => void, autoFocus?: boolean }) {
  const { data: currentUserData } = useGetCurrentUser();
  const currentUser = currentUserData?.user;
  const isAnonymousMode = !currentUser;
  
  const queryClient = useQueryClient();
  const createComment = useCreateComment();
  
  const form = useForm<z.infer<typeof commentSchema>>({
    resolver: zodResolver(commentSchema),
    defaultValues: {
      body: "",
      anonymous: isAnonymousMode
    }
  });

  const onSubmit = (values: z.infer<typeof commentSchema>) => {
    createComment.mutate(
      { 
        id: postId, 
        data: { 
          body: values.body, 
          anonymous: isAnonymousMode || values.anonymous,
          parentId
        } 
      },
      {
        onSuccess: () => {
          form.reset();
          queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
          queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSectionStatsQueryKey() });
          if (onSuccess) onSuccess();
        }
      }
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="bg-card border border-border rounded-lg p-3 shadow-sm focus-within:ring-1 focus-within:ring-ring/50 transition-all">
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea 
                  placeholder="Add to the discussion..." 
                  className="min-h-[80px] resize-none border-0 focus-visible:ring-0 p-0 text-sm bg-transparent"
                  autoFocus={autoFocus}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-4">
            {isAnonymousMode ? (
              <span className="text-xs text-muted-foreground italic flex items-center gap-1.5 bg-muted px-2 py-1 rounded">
                Posting as Anonymous (not logged in)
              </span>
            ) : (
              <FormField
                control={form.control}
                name="anonymous"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="scale-75"
                      />
                    </FormControl>
                    <FormLabel className="text-xs font-normal text-muted-foreground cursor-pointer m-0">
                      Post anonymously
                    </FormLabel>
                  </FormItem>
                )}
              />
            )}
          </div>
          
          <div className="flex gap-2">
            {onCancel && (
              <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-xs h-8">
                Cancel
              </Button>
            )}
            <Button 
              type="submit" 
              size="sm" 
              className="text-xs h-8 px-4"
              disabled={createComment.isPending || !form.formState.isValid}
            >
              {createComment.isPending ? "Posting..." : "Reply"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
