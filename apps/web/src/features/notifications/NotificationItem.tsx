import { relTime, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCustomMutation } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, UserPlus, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NotificationItemProps {
  notification: any;
  onSelectConversation: (id: string) => void;
  onSelectPost: (id: number) => void;
}

export function NotificationItem({
  notification: n,
  onSelectConversation,
  onSelectPost,
}: NotificationItemProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { mutate: acceptRequest, isPending: isAccepting } = useCustomMutation<any, any>(
    `/dm/connect-requests/${n.connectRequestId}/accept`,
    {
      fetchOptions: { method: "POST" },
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["/notifications"] });
        if (data.conversationId) {
          onSelectConversation(data.conversationId);
        }
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Accept failed",
          description: err.message || "Something went wrong.",
        });
      },
    }
  );

  const { mutate: declineRequest, isPending: isDeclining } = useCustomMutation<any, any>(
    `/dm/connect-requests/${n.connectRequestId}/decline`,
    {
      fetchOptions: { method: "POST" },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/notifications"] });
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Decline failed",
          description: err.message || "Something went wrong.",
        });
      },
    }
  );

  const { mutate: markRead } = useCustomMutation<any, any>(
    `/notifications/${n.id}/read`,
    {
      fetchOptions: { method: "POST" },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/notifications"] });
        queryClient.invalidateQueries({ queryKey: ["/notifications/unread-count"] });
      },
    }
  );

  const onAccept = (e: React.MouseEvent) => {
    e.stopPropagation();
    acceptRequest({});
    if (!n.isRead) markRead({});
  };

  const onDecline = (e: React.MouseEvent) => {
    e.stopPropagation();
    declineRequest({});
    if (!n.isRead) markRead({});
  };

  const isHandling = isAccepting || isDeclining;

  const handleClick = () => {
    if (!n.isRead) markRead({});
    
    if (n.type === "dm_message" || n.type === "connect_accepted") {
      if (n.conversationId) onSelectConversation(n.conversationId);
    } else {
      if (n.postId) onSelectPost(n.postId);
    }
  };

  const renderContent = () => {
    switch (n.type) {
      case "connect_request":
        return (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-snug">
              <span className="font-bold text-foreground">Someone</span>
              <span className="text-muted-foreground"> wants to connect from your anonymous </span>
              <span className="font-medium">"{n.postTitle}"</span>
            </p>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                onClick={onAccept} 
                disabled={isHandling}
                className="h-8 gap-1.5 px-3"
              >
                {isHandling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Accept
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onDecline} 
                disabled={isHandling}
                className="h-8 gap-1.5 px-3"
              >
                <X className="w-3.5 h-3.5" />
                Decline
              </Button>
            </div>
          </div>
        );
      case "connect_accepted":
        return (
          <p className="text-sm leading-snug">
            <span className="font-bold text-foreground">Connect request accepted!</span>
            <span className="text-muted-foreground"> You can now chat in </span>
            <span className="font-medium">Messages</span>
          </p>
        );
      case "dm_message":
        return (
          <p className="text-sm leading-snug">
            <span className="font-bold text-foreground">New message</span>
            <span className="text-muted-foreground"> in your conversation.</span>
            {n.metadata?.excerpt && (
              <span className="block mt-1 text-xs text-muted-foreground italic truncate">
                "{n.metadata.excerpt}"
              </span>
            )}
          </p>
        );
      case "reply_to_post":
      case "reply_to_comment":
      default:
        return (
          <p className="text-sm leading-snug">
            <span className="font-bold text-foreground">{n.actorName}</span>
            <span className="text-muted-foreground"> replied to: </span>
            <span className="font-medium">"{n.postTitle}"</span>
          </p>
        );
    }
  };

  const getBadge = () => {
    switch (n.type) {
      case "connect_request": return { label: "Connect Request", variant: "secondary" as const, icon: UserPlus };
      case "connect_accepted": return { label: "Connect Success", variant: "default" as const, icon: Check };
      case "dm_message": return { label: "Direct Message", variant: "outline" as const, icon: MessageSquare };
      default: return { label: n.type === "reply_to_post" ? "Post Reply" : "Comment Reply", variant: n.isRead ? "outline" as const : "secondary" as const, icon: null };
    }
  };

  const badge = getBadge();

  return (
    <li>
      <div
        role="button"
        onClick={handleClick}
        className={cn(
          "w-full text-left px-6 py-4 transition-colors hover:bg-accent/50 cursor-pointer",
          !n.isRead && "bg-primary/[0.03] relative after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1 after:bg-primary"
        )}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <Badge variant={badge.variant} className="text-[10px] py-0 gap-1 px-1.5">
            {badge.icon && <badge.icon className="w-2.5 h-2.5" />}
            {badge.label}
          </Badge>
          {n.postDeleted && <Badge variant="destructive" className="text-[10px] py-0">Deleted</Badge>}
          <span className="text-[10px] text-muted-foreground ml-auto">{relTime(n.createdAt)}</span>
        </div>
        {renderContent()}
      </div>
    </li>
  );
}
