import { useCustomFetch } from "@workspace/api-client-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Search } from "lucide-react";
import { relTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function ConversationList({ 
  selectedId, 
  onSelect 
}: { 
  selectedId: string | null; 
  onSelect: (id: string) => void;
}) {
  const { data: conversations, isLoading } = useCustomFetch<any[]>("/dm/conversations");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-background">
      <div className="px-6 py-5 border-b border-border bg-card/30 shrink-0">
        <h1 className="font-serif text-2xl font-medium tracking-tight mb-4">Messages</h1>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            disabled
            placeholder="Search messages (coming soon)..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-muted/50 border border-transparent rounded-md focus:border-primary/30 outline-none transition-all cursor-not-allowed"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {conversations && conversations.length > 0 ? (
          <ul className="divide-y divide-border">
            {conversations.map((conv: any) => (
              <li key={conv.id}>
                <button
                  onClick={() => onSelect(conv.id)}
                  className={[
                    "w-full text-left px-6 py-4 transition-colors flex items-center gap-3",
                    selectedId === conv.id
                      ? "bg-primary/5 border-l-2 border-l-primary -ml-px"
                      : "hover:bg-accent/50 border-l-2 border-l-transparent -ml-px",
                  ].join(" ")}
                >
                  <div className="relative shrink-0">
                    {conv.otherUser.avatarUrl ? (
                      <img
                        src={conv.otherUser.avatarUrl}
                        alt={conv.otherUser.displayName}
                        className="w-10 h-10 rounded-full object-cover border border-primary/10"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {conv.otherUser.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-background">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-semibold truncate text-foreground">
                        {conv.otherUser.displayName}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                        {conv.lastMessage?.createdAt ? relTime(conv.lastMessage.createdAt) : relTime(conv.updatedAt)}
                      </span>
                    </div>
                    <p className={[
                      "text-xs truncate leading-relaxed",
                      conv.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                    ].join(" ")}>
                      {conv.lastMessage?.body || "No messages yet"}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-12 flex flex-col items-center justify-center text-center opacity-40">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium uppercase tracking-widest">No conversations yet</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
