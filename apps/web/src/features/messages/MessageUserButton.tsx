import { useState } from "react";
import { useCustomMutation, useGetCurrentUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface MessageUserButtonProps {
  targetUserId: number | null | undefined;
  isAnonymous?: boolean;
  sourcePostId: number;
  sourceCommentId?: number;
  onOpenConversation: (id: string) => void;
  variant?: "ghost" | "outline" | "default";
  size?: "sm" | "icon" | "default";
  className?: string;
}

export function MessageUserButton({
  targetUserId,
  isAnonymous,
  sourcePostId,
  sourceCommentId,
  onOpenConversation,
  variant = "ghost",
  size = "sm",
  className = "",
}: MessageUserButtonProps) {
  const { data: userData } = useGetCurrentUser();
  const currentUser = userData?.user;
  const { toast } = useToast();
  const [hasRequested, setHasRequested] = useState(false);

  const { mutate: createConversation, isPending: isStartingDM } = useCustomMutation<any, any>("/dm/conversations", {
    fetchOptions: { method: "POST" },
    onSuccess: (data) => {
      onOpenConversation(data.id);
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Could not start conversation",
        description: err.message || "Something went wrong.",
      });
    },
  });

  const { mutate: createConnectRequest, isPending: isRequesting } = useCustomMutation<any, any>("/dm/connect-requests", {
    fetchOptions: { method: "POST" },
    onSuccess: () => {
      setHasRequested(true);
      toast({
        title: "Connect request sent",
        description: "The author has been notified. You can chat if they accept.",
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Request failed",
        description: err.message || "Something went wrong.",
      });
    },
  });

  // Rules for showing the button
  if (!currentUser) return null; // Not logged in
  if (targetUserId === currentUser.id) return null; // Self

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAnonymous) {
      createConnectRequest({ sourcePostId, sourceCommentId });
    } else {
      if (!targetUserId) return;
      createConversation({ targetUserId });
    }
  };

  const isPending = isStartingDM || isRequesting;

  return (
    <motion.div whileTap={{ scale: 0.9 }}>
      <Button
        variant={variant}
        size={size}
        className={["h-7 px-2 text-xs gap-1.5 transition-colors text-muted-foreground hover:text-primary", className].join(" ")}
        onClick={handleClick}
        disabled={isPending || hasRequested}
        title={isAnonymous ? "Send connect request to anonymous author" : "Send private message"}
      >
        {isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <MessageSquare className="w-3 h-3" />
        )}
        <span className="hidden sm:inline">
          {hasRequested ? "Requested" : isAnonymous ? "Connect" : "Message"}
        </span>
      </Button>
    </motion.div>
  );
}
