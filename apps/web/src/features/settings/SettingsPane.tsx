import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  useGetCurrentUser,
  useUpdateCurrentUser,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { Settings, Sun, Moon, Monitor, Loader2, ShieldCheck } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { relTime } from "@/lib/utils";

export function SettingsPane() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: userData } = useGetCurrentUser();
  const updateMutation = useUpdateCurrentUser();
  const user = userData?.user;

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyStep, setVerifyStep] = useState<"email" | "code">("email");
  const [isVerifying, setIsVerifying] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("app-theme") as any) || "system";
    }
    return "system";
  });

  const applyTheme = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("app-theme", newTheme);

    const isDark =
      newTheme === "dark" ||
      (newTheme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (mediaQuery.matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center">
          <Settings className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground font-serif italic">
            Please sign in to view settings.
          </p>
        </div>
      </div>
    );
  }

  const startEditing = (field: string, value: string) => {
    setEditingField(field);
    setEditValue(value);
  };

  
  const handleSendCode = async () => {
    if (false && !verifyEmail.endsWith("@uwaterloo.ca")) { // Temporarily disabled
      toast({ variant: "destructive", title: "Invalid email", description: "Only @uwaterloo.ca emails are allowed." });
      return;
    }
    setIsVerifying(true);
    try {
      await customFetch("/api/auth/student-verification/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifyEmail })
      });
      setVerifyStep("code");
      toast({ title: "Code sent", description: "Check your email for the verification code." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verifyCode.length !== 6) {
      toast({ variant: "destructive", title: "Invalid code", description: "Code must be 6 digits." });
      return;
    }
    setIsVerifying(true);
    try {
      await customFetch("/api/auth/student-verification/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode })
      });
      
      toast({ title: "Verification successful", description: "Your student email has been bound." });
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsVerifying(false);
    }
  };

    const handleDeleteAccount = async () => {
    try {
      await customFetch("/api/auth/me", {
        method: "DELETE",
      });
      toast({
        title: "Account deleted",
        description: "Your account has been permanently removed.",
      });
      setLocation("/login");
      window.location.reload(); // Ensure everything is cleared
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to delete account.",
      });
    }
  };

  const handleSave = () => {
    if (!editingField) return;

    updateMutation.mutate(
      { data: { [editingField]: editValue } },
      {
        onSuccess: (updatedUser: any) => {
          queryClient.setQueryData(getGetCurrentUserQueryKey(), {
            user: updatedUser,
          });
          toast({
            title: "Profile updated",
            description: `Your ${editingField} has been updated.`,
          });
          setEditingField(null);
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "Update failed",
            description: error.message || "Could not update profile.",
          });
        },
      },
    );
  };

  return (
    <ScrollArea className="flex-1 bg-card/5">
      <div className="max-w-2xl mx-auto px-8 py-12">
        <header className="mb-10">
          <h1 className="font-serif text-3xl font-medium tracking-tight mb-2">
            Settings
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Manage your account preferences and personal information.
          </p>
        </header>

        <div className="space-y-8">
          <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Profile Information
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid gap-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Username
                </label>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="font-medium">{user.username}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    Public
                  </Badge>
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Display Name
                </label>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  {editingField === "displayName" ? (
                    <div className="flex items-center gap-2 w-full py-1">
                      <Input
                        value={editValue}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setEditValue(e.target.value)
                        }
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={handleSave}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => setEditingField(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium">{user.displayName}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/5"
                        onClick={() =>
                          startEditing("displayName", user.displayName)
                        }
                      >
                        Edit
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Email Address
                </label>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="font-medium">{user.email}</span>
                </div>
              </div>
            </div>
          </section>

          
          <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Student Verification
              </h2>
            </div>
            <div className="p-6 space-y-6">
              {user.isStudentVerified ? (
                <div className="flex flex-col gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 text-primary">
                    <VerifiedBadge className="w-5 h-5" />
                    <span className="font-semibold">Verified Student Status</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-foreground/80">
                      You have already bound your student email address.
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      Bound Email: <span className="text-primary">{user.studentEmail}</span>
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground italic">
                    Verification badge is now active on your non-anonymous posts.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Verify University Email
                  </label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Bind your @uwaterloo.ca email to display a verified badge on your posts.
                  </p>
                  {verifyStep === "email" ? (
                    <div className="flex items-center gap-2 max-w-sm">
                      <Input 
                        placeholder="username@uwaterloo.ca" 
                        value={verifyEmail} 
                        onChange={(e) => setVerifyEmail(e.target.value)} 
                        disabled={isVerifying}
                      />
                      <Button onClick={handleSendCode} disabled={isVerifying}>
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Code"}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 max-w-sm">
                      <Input 
                        placeholder="6-digit code" 
                        value={verifyCode} 
                        onChange={(e) => setVerifyCode(e.target.value)} 
                        maxLength={6}
                        disabled={isVerifying}
                      />
                      <Button onClick={handleVerifyCode} disabled={isVerifying}>
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                      </Button>
                      <Button variant="ghost" onClick={() => setVerifyStep("email")} disabled={isVerifying}>Cancel</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Appearance
              </h2>
            </div>
            <div className="p-6">
              <div className="grid gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Theme Preference
                  </label>
                  <p className="text-xs text-muted-foreground/70">
                    Choose how Campus Forum looks to you.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {(["light", "dark", "system"] as const).map((t) => {
                    const Icon =
                      t === "light" ? Sun : t === "dark" ? Moon : Monitor;
                    const isActive = theme === t;
                    return (
                      <button
                        key={t}
                        onClick={() => applyTheme(t)}
                        className={[
                          "flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 group relative overflow-hidden",
                          isActive
                            ? "border-primary bg-primary/[0.03] shadow-sm"
                            : "border-border bg-card hover:border-border/80 hover:bg-muted/30",
                        ].join(" ")}
                      >
                        <div
                          className={[
                            "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground group-hover:bg-muted/80",
                          ].join(" ")}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <span
                          className={[
                            "text-xs font-semibold capitalize",
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground",
                          ].join(" ")}
                        >
                          {t}
                        </span>
                        {isActive && (
                          <div className="absolute top-2 right-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <div className="pt-4 flex items-center justify-between text-xs text-muted-foreground px-2">
            <span>Member since {relTime(new Date().toISOString())}</span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-destructive hover:text-destructive hover:bg-destructive/5"
                >
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account
                    and remove your personal data from our servers. Your posts and comments
                    将会被标记为 "Deleted User".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
