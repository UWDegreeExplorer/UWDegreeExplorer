import { useState, useEffect, useRef } from "react";
import { useCustomFetch, useCustomMutation, customFetch, useGetCurrentUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, MessageSquare, ArrowLeft } from "lucide-react";
import { relTime } from "@/lib/utils";

export function MessagePanel({ 
  conversationId, 
  onBack 
}: { 
  conversationId: string; 
  onBack?: () => void;
}) {
  const { data: userData } = useGetCurrentUser();
  const currentUser = userData?.user;
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const { data: convData } = useCustomFetch<any>(`/dm/conversations/${conversationId}`, {
    enabled: !!conversationId,
  });

  const { data: messageData, isLoading } = useCustomFetch<any>(`/dm/conversations/${conversationId}/messages`, {
    enabled: !!conversationId,
    // Add polling for MVP
    refetchInterval: 5000,
  });

  const { mutate: sendMessage, isPending: isSending } = useCustomMutation<any, any>(`/dm/conversations/${conversationId}/messages`, {
    fetchOptions: { method: "POST" },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: [`/dm/conversations/${conversationId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ["/dm/conversations"] });
    },
  });

  const { mutate: markRead } = useCustomMutation<any, any>(`/dm/conversations/${conversationId}/read`, {
    fetchOptions: { method: "POST" },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/dm/unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["/dm/conversations"] });
    },
  });

  // Mark as read when entering or receiving messages
  useEffect(() => {
    if (conversationId) {
      markRead({});
    }
  }, [conversationId, messageData?.messages?.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messageData?.messages]);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    sendMessage({ body: input });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
      </div>
    );
  }

  const messages = messageData?.messages || [];
  const otherUser = convData?.otherUser;

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border bg-card/30 flex items-center gap-3 shrink-0 h-16">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden -ml-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        
        {otherUser ? (
          <>
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/10 shrink-0">
              {otherUser.avatarUrl ? (
                <img src={otherUser.avatarUrl} alt={otherUser.displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary font-bold text-sm">{otherUser.displayName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-serif text-base font-semibold truncate leading-tight">
                {otherUser.displayName}
              </h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                @{otherUser.username}
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 animate-pulse flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-3 bg-muted rounded w-1/3" />
              <div className="h-2 bg-muted rounded w-1/4" />
            </div>
          </div>
        )}
      </div>

      {/* Messages area */}
      <ScrollArea ref={scrollRef} className="flex-1 px-6">
        <div className="py-6 space-y-6">
          {messages.length > 0 ? (
            messages.map((msg: any) => {
              const isMe = msg.senderId === currentUser?.id;
              return (
                <div key={msg.id} className={["flex flex-col", isMe ? "items-end" : "items-start"].join(" ")}>
                  <div className={[
                    "max-w-[85%] px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                    isMe 
                      ? "bg-primary text-primary-foreground rounded-br-none" 
                      : "bg-muted text-foreground rounded-bl-none"
                  ].join(" ")}>
                    {msg.body}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1.5 px-1">
                    {relTime(msg.createdAt)}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-64 opacity-30">
              <MessageSquare className="w-12 h-12 mb-4" />
              <p className="text-sm">No messages yet. Say hello!</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-4 border-t border-border bg-card/10 backdrop-blur-sm">
        <div className="relative flex items-end gap-2 max-w-4xl mx-auto">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Write a message..."
            className="min-h-[44px] max-h-32 py-3 px-4 resize-none bg-background/50 border-primary/20 focus-visible:ring-primary/30"
          />
          <Button 
            size="icon" 
            onClick={handleSend} 
            disabled={!input.trim() || isSending}
            className="h-[44px] w-[44px] shrink-0 rounded-full shadow-lg"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-center text-muted-foreground mt-2">
          Press Enter to send, Shift + Enter for new line
        </p>
      </div>
    </div>
  );
}
