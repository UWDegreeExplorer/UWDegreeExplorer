import { useLocation } from "wouter";
import { useGetRecentActivity, useGetCurrentUser, type Section } from "@workspace/api-client-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PencilLine } from "lucide-react";
import { relTime } from "@/lib/utils";
import { SECTION_LABELS } from "@/lib/constants";

export function WelcomePane() {
  const [, setLocation] = useLocation();
  const { data: activity } = useGetRecentActivity();
  const { data: currentUserData } = useGetCurrentUser();
  const currentUser = currentUserData?.user;

  return (
    <ScrollArea className="flex-1">
      <div className="max-w-2xl mx-auto px-10 py-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground font-serif font-bold text-2xl shadow-sm mb-5">
            U
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight">
            Welcome to UW Degree Explorer
          </h1>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
            Your ultimate platform to plan courses, visualize degree requirements, and connect with peers. {currentUser ? "Pick a section on the left to start." : "Sign in to unlock personalized features like course tracking and planners."}
          </p>

          <div className="flex items-center justify-center gap-2 mt-6">
            <Button onClick={() => setLocation("/new")} className="gap-2">
              <PencilLine className="w-4 h-4" />
              Write a post
            </Button>
            {!currentUser && (
              <div className="flex flex-col gap-3">
                <Button variant="outline" className="w-full" onClick={() => setLocation("/login")}>
                  Sign in
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="gap-2 text-muted-foreground hover:text-foreground h-9" 
                  onClick={() => setLocation("/login")}
                >
                  <svg className="w-4 h-4 opacity-70" viewBox="0 0 24 24">
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
                  Sign in with Google
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-serif text-lg font-medium">Recent activity</h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          {!Array.isArray(activity) || activity.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No recent posts.
            </p>
          ) : (
            <ul className="space-y-2">
              {activity.map((a, i) => (
                <li key={`${a.kind}-${i}`}>
                  <button
                    onClick={() => setLocation(`/post/${a.postId}`)}
                    className="w-full text-left rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wider px-1.5 py-0"
                      >
                        {SECTION_LABELS[a.section as Section]}
                      </Badge>
                      <span className="text-foreground/70 font-medium">
                        {a.authorName}
                      </span>
                      <span>
                        {a.kind === "post" ? "started" : "replied to"}
                      </span>
                      <span>· {relTime(a.createdAt)}</span>
                    </div>
                    <h3 className="font-serif font-medium mt-1 leading-snug">
                      {a.postTitle}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {a.snippet}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
