import { useLocation } from "wouter";
import { useGoogleLogin as useGoogleOAuth } from "@react-oauth/google";
import { useState } from "react";
import { 
  useLoginUser, 
  getGetCurrentUserQueryKey,
  useGoogleLogin as useBackendGoogleLogin,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const loginMutation = useLoginUser();
  const googleMutation = useBackendGoogleLogin();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Only call hook if clientId is available to avoid crash if provider is missing
  let googleLogin = () => {
    toast({
      variant: "destructive",
      title: "Google Login Unavailable",
      description: "Google OAuth is not configured on this server.",
    });
  };

  try {
    if (clientId) {
      const loginHook = useGoogleOAuth({
        onSuccess: async (tokenResponse) => {
          googleMutation.mutate(
            { data: { accessToken: tokenResponse.access_token } },
            {
              onSuccess: (data) => {
                queryClient.setQueryData(getGetCurrentUserQueryKey(), {
                  user: data
                });
                toast({
                  title: "Welcome!",
                  description: `Logged in as ${data.displayName}`,
                });
                setLocation("/");
              },
              onError: (error: any) => {
                toast({
                  variant: "destructive",
                  title: "Login Failed",
                  description: error.message || "Backend authentication failed.",
                });
              }
            }
          );
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Login Failed",
            description: "Google login cancelled.",
          });
        }
      });
      googleLogin = loginHook;
    }
  } catch (e) {
    console.error("Google OAuth hook failed:", e);
  }

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
          setLocation("/");
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "Login failed",
            description: error.message || "Please check your credentials and try again.",
          });
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b border-border bg-card flex items-center px-6 shrink-0 z-10 shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Forum
        </Button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-serif font-bold text-2xl mx-auto shadow-sm mb-6">
              C
            </div>
            <h1 className="font-serif text-3xl font-medium tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground">Sign in to your Campus Forum account</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    <div className="flex justify-end">
                      <Button variant="link" size="sm" className="px-0 h-auto text-xs text-muted-foreground" onClick={() => setLocation("/forgot-password")} type="button">Forgot password?</Button>
                    </div>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter your password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    <div className="flex justify-end">
                      <Button variant="link" size="sm" className="px-0 h-auto text-xs text-muted-foreground" onClick={() => setLocation("/forgot-password")} type="button">Forgot password?</Button>
                    </div>
                  )}
                />

                <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Sign in
                </Button>
              </form>
            </Form>

            <Button 
              type="button"
              variant="outline" 
              className="w-full gap-2 mt-4" 
              onClick={() => googleLogin()}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
            
            <div className="mt-6 flex items-center justify-center">
              <div className="h-px bg-border flex-1"></div>
              <span className="px-4 text-xs text-muted-foreground uppercase tracking-wider">or</span>
              <div className="h-px bg-border flex-1"></div>
            </div>
            
            <div className="mt-6 space-y-3">
              <Button variant="ghost" className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => setLocation("/")}>
                Continue as anonymous
              </Button>
              <p className="text-center mt-3 text-xs text-muted-foreground">
                You can browse and post as a guest, but signing in unlocks bookmarks and drafts.
              </p>
            </div>
          </div>
          
          <div className="text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <button onClick={() => setLocation("/register")} className="text-primary font-medium hover:underline">
              Register now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
