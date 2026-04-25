import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle } from "lucide-react";
import { useReportPost, useReportComment } from "@workspace/api-client-react";

const REPORT_REASONS = [
  "Spam",
  "Harassment",
  "Inappropriate Content",
  "Hate Speech",
  "Misinformation",
  "Other"
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetId: number;
  targetType: "post" | "comment";
}

export function ReportDialog({ open, onOpenChange, targetId, targetType }: ReportDialogProps) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const { toast } = useToast();

  // Reset state when dialog is closed or target changes
  useEffect(() => {
    if (!open) {
      setReason("");
      setDetails("");
    }
  }, [open, targetId, targetType]);
  
  const reportPost = useReportPost();
  const reportComment = useReportComment();
  
  const mutation = targetType === "post" ? reportPost : reportComment;

  const handleSubmit = () => {
    if (!reason) {
      toast({
        variant: "destructive",
        title: "Reason required",
        description: "Please select a reason for reporting."
      });
      return;
    }

    mutation.mutate(
      { 
        id: targetId, 
        data: { reason, details: details || undefined } 
      },
      {
        onSuccess: () => {
          toast({
            title: "Report submitted",
            description: "Thank you for your feedback. Our moderators will review this content."
          });
          onOpenChange(false);
          setReason("");
          setDetails("");
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Report failed",
            description: err.message || "An error occurred while submitting your report."
          });
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Report {targetType}
          </DialogTitle>
          <DialogDescription>
            Help us understand what's wrong with this {targetType}. Your report will be reviewed by our moderation team.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Reason</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <label className="text-sm font-medium">Details (optional)</label>
            <Textarea 
              placeholder="Provide more information..." 
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
