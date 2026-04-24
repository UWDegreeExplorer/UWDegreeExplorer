import { Switch, Route, Router as WouterRouter } from "wouter";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import Register from "@/pages/register";
import NewPost from "@/pages/new-post";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // Keep data fresh for 60 seconds by default
      gcTime: 5 * 60 * 1000, // Cache data for 5 minutes
      retry: 1,
      refetchOnWindowFocus: false, // Prevent unnecessary refetching when switching tabs
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/post/:id" component={Home} />
      <Route path="/new" component={NewPost} />
      <Route path="/settings" component={Home} />
      <Route path="/bookmarks" component={Home} />
      <Route path="/activity" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const content = (
    <TooltipProvider>
      <WouterRouter base={(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );

  return (
    <QueryClientProvider client={queryClient}>
      {clientId ? (
        <GoogleOAuthProvider clientId={clientId}>
          {content}
        </GoogleOAuthProvider>
      ) : (
        content
      )}
    </QueryClientProvider>
  );
}

export default App;
