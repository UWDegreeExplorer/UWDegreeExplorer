import { ShieldCheck } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center text-blue-600 dark:text-blue-400 ${className || ""}`}>
            <ShieldCheck className="w-[1em] h-[1em]" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>Verified Student</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
