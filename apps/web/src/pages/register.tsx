import { useState } from "react";
import { useLocation } from "wouter";
import { useRegisterUser, getGetCurrentUserQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30, "Username must be at most 30 characters"),
  displayName: z.string().min(1, "Display name is required").max(60, "Display name must be at most 60 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(200, "Password is too long"),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const registerMutation = useRegisterUser();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"details" | "verify">("details");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const { toast } = useToast();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      displayName: "",
      email: "",
      password: "",
    },
  });

  
  const onSubmit = async (values: z.infer<typeof registerSchema>) => {
    setIsVerifying(true);
    try {
      await customFetch("/api/auth/register/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      setStep("verify");
      toast({
        title: "Code sent",
        description: "Please check your email for the verification code.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send verification code.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const onVerify = async () => {
    if (verificationCode.length !== 6) {
      toast({ variant: "destructive", title: "Invalid code", description: "Please enter a 6-digit code." });
      return;
    }
    setIsVerifying(true);
    try {
      await customFetch("/api/auth/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: form.getValues().email,
          code: verificationCode 
        }),
      });
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      toast({
        title: "Registration successful",
        description: "Welcome to Campus Forum!",
      });
      setLocation("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: error.message || "Invalid or expired code.",
      });
    } finally {
      setIsVerifying(false);
    }
  };


  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b border-border bg-card flex items-center px-6 shrink-0 z-10 shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="-ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Forum
        </Button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <h1 className="font-serif text-3xl font-medium tracking-tight">Join Campus Forum</h1>
            <p className="text-muted-foreground">Create an account to verify your identity</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            {step === "details" ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. jsmith24" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. John Smith" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="e.g. john@university.edu" {...field} />
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
                          <Input type="password" placeholder="Create a password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full mt-2" disabled={isVerifying}>
                    {isVerifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Send Verification Code
                  </Button>
                </form>
              </Form>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <FormLabel>Verification Code</FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Sent to <strong>{form.getValues().email}</strong>. Expires in 5 minutes.
                  </p>
                  <Input 
                    placeholder="Enter 6-digit code" 
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    maxLength={6}
                    className="text-center text-lg tracking-widest font-mono"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep("details")} disabled={isVerifying}>
                    Back
                  </Button>
                  <Button className="flex-2 grow" onClick={onVerify} disabled={isVerifying}>
                    {isVerifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Confirm & Register
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          <div className="text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <button onClick={() => setLocation("/login")} className="text-primary font-medium hover:underline">
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
