import { useState } from "react";
import { useLocation } from "wouter";
import { useLoginUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
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
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
                  )}
                />

                <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Sign in
                </Button>
              </form>
            </Form>
            
            <div className="mt-6 flex items-center justify-center">
              <div className="h-px bg-border flex-1"></div>
              <span className="px-4 text-xs text-muted-foreground uppercase tracking-wider">or</span>
              <div className="h-px bg-border flex-1"></div>
            </div>
            
            <div className="mt-6">
              <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>
                Continue as anonymous
              </Button>
              <p className="text-center mt-3 text-xs text-muted-foreground">
                You can browse and post anonymously without an account.
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
