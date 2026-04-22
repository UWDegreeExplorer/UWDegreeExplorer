import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  useGetCurrentUser, 
  useCreatePost, 
  getListPostsQueryKey, 
  getGetSectionStatsQueryKey,
  getGetRecentActivityQueryKey,
  Section 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const SECTION_LABELS: Record<string, string> = {
  carpool: "Carpool",
  academic: "Academic",
  roommate: "Find Roommate",
  other: "Other"
};

const postSchema = z.object({
  section: z.enum(["carpool", "academic", "roommate", "other"] as const, {
    required_error: "Please select a section",
  }),
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  body: z.string().min(1, "Post body is required").max(10000, "Post is too long"),
  anonymous: z.boolean().default(false),
});

export default function NewPost() {
  const [, setLocation] = useLocation();
  const { data: currentUserData, isLoading: isLoadingUser } = useGetCurrentUser();
  const currentUser = currentUserData?.user;
  const isAnonymousMode = !isLoadingUser && !currentUser;
  
  const createPostMutation = useCreatePost();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      section: undefined,
      title: "",
      body: "",
      anonymous: isAnonymousMode,
    },
  });

  // Update anonymous value when user data loads
  useEffect(() => {
    if (!isLoadingUser && !currentUser) {
      form.setValue("anonymous", true);
    }
  }, [isLoadingUser, currentUser, form]);

  const onSubmit = (values: z.infer<typeof postSchema>) => {
    createPostMutation.mutate(
      { 
        data: {
          ...values,
          anonymous: isAnonymousMode || values.anonymous
        } 
      },
      {
        onSuccess: (post) => {
          queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSectionStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
          setLocation(`/post/${post.id}`);
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "Failed to create post",
            description: error.message || "An error occurred. Please try again.",
          });
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Forum
        </Button>
        <div className="font-serif font-medium text-lg">New Post</div>
        <div className="w-20"></div> {/* Spacer for balance */}
      </header>

      <div className="flex-1 flex flex-col items-center p-6 py-12 overflow-y-auto">
        <div className="w-full max-w-2xl">
          {isAnonymousMode && (
            <div className="bg-muted/50 border border-border rounded-lg p-4 mb-8 flex items-start gap-3">
              <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-sm">You are posting anonymously</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  You are not logged in, so this post will be completely anonymous. If you'd like to post under your real name, please{" "}
                  <button onClick={() => setLocation("/login")} className="text-primary font-medium hover:underline">sign in</button>.
                </p>
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  <FormField
                    control={form.control}
                    name="section"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-serif text-base">Section</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-card">
                              <SelectValue placeholder="Select a section" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(SECTION_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-serif text-base">Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Be specific and concise..." className="bg-card" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-serif text-base">Details</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Share the details of your post..." 
                        className="min-h-[300px] resize-y bg-card text-base leading-relaxed" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-border">
                <div className="w-full sm:w-auto">
                  {!isAnonymousMode && (
                    <FormField
                      control={form.control}
                      name="anonymous"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-3 space-y-0 bg-card border border-border px-4 py-3 rounded-lg shadow-sm">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1">
                            <FormLabel className="text-sm font-medium cursor-pointer m-0">
                              Post anonymously
                            </FormLabel>
                            <p className="text-xs text-muted-foreground leading-none">
                              Hide your name from other users
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Button type="button" variant="outline" onClick={() => setLocation("/")} className="flex-1 sm:flex-none">
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 sm:flex-none" disabled={createPostMutation.isPending}>
                    {createPostMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Post to Forum
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
