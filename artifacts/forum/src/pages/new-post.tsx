import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  useGetCurrentUser, 
  useCreatePost, 
  getListPostsQueryKey, 
  getGetSectionStatsQueryKey,
  getGetRecentActivityQueryKey,
  useCustomFetch,
  useCustomMutation,
  customFetch,
  Section 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Info, FileEdit } from "lucide-react";
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
  
  const createPostMutation = useCreatePost();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Handle draft loading
  const searchParams = new URLSearchParams(window.location.search);
  const draftIdParam = searchParams.get("draftId");
  const draftId = draftIdParam ? Number(draftIdParam) : null;

  const { data: draft, isLoading: isLoadingDraft } = useCustomFetch<any>(`/drafts`, {
    enabled: !!draftId,
  });

  const { mutate: saveDraft, isPending: isSavingDraft } = useCustomMutation<any, any>("/drafts", {
    fetchOptions: { method: "POST" },
    onSuccess: (saved) => {
      toast({ title: "Draft saved" });
      if (!draftId) {
         // If it's a new draft, we should update the URL to include the ID so further saves update it
         setLocation(`/new?draftId=${saved.id}`);
      }
      queryClient.invalidateQueries({ queryKey: ["/drafts"] });
    }
  });

  const form = useForm<z.infer<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      section: undefined,
      title: "",
      body: "",
      anonymous: false,
    },
  });

  // Populate draft data
  useEffect(() => {
    if (draftId && draft) {
      // Find the draft by ID in the list (or if the endpoint returns a single item)
      // Actually /api/drafts returns an array. Let's assume we find it.
      const d = Array.isArray(draft) ? draft.find((x: any) => x.id === draftId) : draft;
      if (d) {
        form.reset({
          section: d.section as any,
          title: d.title || "",
          body: d.body || "",
          anonymous: d.isAnonymous || false,
        });
      }
    }
  }, [draft, draftId, form]);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoadingUser && !currentUser) {
      setLocation("/login");
    }
  }, [isLoadingUser, currentUser, setLocation]);

  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) return null;

  const onSaveDraft = () => {
    const values = form.getValues();
    saveDraft({
      id: draftId || undefined,
      title: values.title,
      body: values.body,
      section: values.section,
      isAnonymous: values.anonymous
    });
  };

  const onSubmit = (values: z.infer<typeof postSchema>) => {
    createPostMutation.mutate(
      { 
        data: values
      },
      {
        onSuccess: async (post) => {
          // If we published a draft, delete it
          if (draftId) {
            await customFetch(`/api/drafts/${draftId}`, { method: "DELETE" });
            queryClient.invalidateQueries({ queryKey: ["/drafts"] });
          }
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
        <div className="w-20"></div>
      </header>

      <div className="flex-1 flex flex-col items-center p-6 py-12 overflow-y-auto">
        <div className="w-full max-w-2xl">
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
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <Button type="button" variant="outline" onClick={() => setLocation("/")} className="flex-1 sm:flex-none">
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={onSaveDraft} 
                    disabled={isSavingDraft}
                    className="flex-1 sm:flex-none"
                  >
                    {isSavingDraft ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileEdit className="w-4 h-4 mr-2" />}
                    Save as Draft
                  </Button>
                  <Button type="submit" className="flex-1 sm:flex-none bg-primary hover:bg-primary/90" disabled={createPostMutation.isPending}>
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
