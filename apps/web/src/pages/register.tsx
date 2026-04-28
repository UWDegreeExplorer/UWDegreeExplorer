import { useState } from "react";
import { useLocation } from "wouter";
import { useGoogleLogin as useGoogleOAuth } from "@react-oauth/google";
import { 
  useRegisterUser, 
  getGetCurrentUserQueryKey, 
  customFetch,
  useGoogleLogin as useBackendGoogleLogin,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import ReCAPTCHA from "react-google-recaptcha";

const googleSetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30, "Username must be at most 30 characters"),
  displayName: z.string().min(1, "Display name is required").max(60, "Display name must be at most 60 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(200, "Password is too long"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export default function Register() {
  const [, setLocation] = useLocation();
  const registerMutation = useRegisterUser();
  const googleMutation = useBackendGoogleLogin();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"details" | "verify">("details");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const { toast } = useToast();

  const [googleTempToken, setGoogleTempToken] = useState<string | null>(null);
  const [showGooglePassword, setShowGooglePassword] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);

  const googleForm = useForm<z.infer<typeof googleSetPasswordSchema>>({
    resolver: zodResolver(googleSetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

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
            // High Security: Explicitly send undefined for password on first attempt
            { data: { accessToken: tokenResponse.access_token, password: undefined } as any },
            {
              onSuccess: (data: any) => {
                if (data.needsPassword) {
                  setGoogleTempToken(tokenResponse.access_token);
                  setShowGooglePassword(true);
                  return;
                }
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
                  title: "Registration Failed",
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

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  
  const onSubmit = async (values: z.infer<typeof registerSchema>) => {
    setIsVerifying(true);
    const { confirmPassword, ...apiValues } = values;
    if (!recaptchaToken) {
      toast({
        variant: "destructive",
        title: "Security Check Required",
        description: "Please complete the reCAPTCHA verification.",
      });
      setIsVerifying(false);
      return;
    }
    try {
      await customFetch("/api/auth/register/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...apiValues, recaptchaToken }),
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

  const onGooglePasswordSubmit = (values: z.infer<typeof googleSetPasswordSchema>) => {
    if (!googleTempToken) return;
    googleMutation.mutate(
      { data: { accessToken: googleTempToken, password: values.password } as any },
      {
        onSuccess: (data: any) => {
          queryClient.setQueryData(getGetCurrentUserQueryKey(), { user: data });
          toast({ title: "Welcome!", description: `Logged in as ${data.displayName}` });
          
          // Clean up state
          setShowGooglePassword(false);
          setGoogleTempToken(null);
          googleForm.reset();
          
          setLocation("/");
        },
        onError: (error: any) => {
          toast({ variant: "destructive", title: "Registration Failed", description: error.message });
        }
      }
    );
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

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Confirm your password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />



                  <div className="flex justify-center py-2">
                    <ReCAPTCHA
                      sitekey="6Lcghc0sAAAAALWZH-ysPzYkOdnftidO-cn2_H4Q"
                      onChange={(token) => setRecaptchaToken(token)}
                    />
                  </div>

                  <Button type="submit" className="w-full mt-2" disabled={isVerifying || !recaptchaToken}>
                    {isVerifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Send Verification Code
                  </Button>
                </form>
              </Form>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Verification Code</Label>
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

            {step === "details" && (
              <>
                <div className="mt-6 flex items-center justify-center">
                  <div className="h-px bg-border flex-1"></div>
                  <span className="px-4 text-xs text-muted-foreground uppercase tracking-wider">or</span>
                  <div className="h-px bg-border flex-1"></div>
                </div>

                <Button 
                  type="button"
                  variant="outline" 
                  className="w-full gap-2 mt-6" 
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
              </>
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

      <Dialog 
        open={showGooglePassword} 
        onOpenChange={(open) => {
          setShowGooglePassword(open);
          if (!open) {
            // High Security: Reset form and token when dialog is dismissed
            googleForm.reset();
            setGoogleTempToken(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Your Registration</DialogTitle>
            <DialogDescription>
              Since this is your first time logging in with Google, please set a password for your account. 
              This will serve as a backup login method.
            </DialogDescription>
          </DialogHeader>
          <Form {...googleForm}>
            <form onSubmit={googleForm.handleSubmit(onGooglePasswordSubmit)} className="space-y-4 py-4">
              <FormField
                control={googleForm.control}
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
              <FormField
                control={googleForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm your password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={googleMutation.isPending}>
                {googleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Finish Registration
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
