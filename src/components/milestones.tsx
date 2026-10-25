import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CircleCheck, CircleDot, CircleDashed, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { canSubmitMilestone, canReviewMilestone, type Actor } from "@/lib/workflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export type MilestoneRow = {
  id: string; seq: number; title: string; description: string; status: string;
  student_note: string | null; supervisor_remarks: string | null; completed_at: string | null;
};

const badgeVariant: Record<string, "default" | "secondary" | "outline"> = { approved: "default", submitted: "secondary", pending: "outline" };
const badgeText: Record<string, string> = { approved: "Approved", submitted: "Awaiting review", pending: "Pending" };

/** Semester progress tracker for one allocated project application. */
export function MilestoneList({ applicationId, studentId, guideId, actor }: { applicationId: string; studentId: string; guideId: string | undefined; actor: Actor }) {
  const qc = useQueryClient();
  const { data: milestones = [], isPending } = useQuery({
    queryKey: ["milestones", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("*").eq("application_id", applicationId).order("seq");
      if (error) throw error;
      return data as MilestoneRow[];
    },
  });

  if (isPending) return <div className="space-y-2 pt-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>;
  if (!milestones.length) return null;

  return (
    <div className="space-y-2 pt-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Semester milestones</p>
      <ol className="space-y-2">
        {milestones.map((m) => {
          const icon = m.status === "approved"
            ? <CircleCheck className="h-5 w-5 text-success" />
            : m.status === "submitted" ? <CircleDot className="h-5 w-5 text-primary" /> : <CircleDashed className="h-5 w-5 text-muted-foreground" />;
          return (
            <li key={m.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {icon}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={badgeVariant[m.status] ?? "outline"}>{badgeText[m.status] ?? m.status}</Badge>
                  {canSubmitMilestone(m, studentId, actor) && <SubmitMilestone milestoneId={m.id} title={m.title} />}
                  {canReviewMilestone(m, guideId, actor) && <ReviewMilestone milestoneId={m.id} studentName="" title={m.title} />}
                </div>
              </div>
              {(m.student_note || m.supervisor_remarks) && (
                <div className="mt-2 space-y-1 border-t pt-2 text-xs">
                  {m.student_note && <p className="text-muted-foreground"><span className="font-medium text-foreground">Student:</span> {m.student_note}</p>}
                  {m.supervisor_remarks && <p className="text-muted-foreground"><span className="font-medium text-foreground">Supervisor:</span> {m.supervisor_remarks}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SubmitMilestone({ milestoneId, title }: { milestoneId: string; title: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const ok = note.trim().length > 0;
  const m = useMutation({
    mutationFn: async () => {
      if (!ok) throw new Error("Add a short progress note");
      const { error } = await supabase.rpc("submit_milestone", { _id: milestoneId, _note: note.trim() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Milestone submitted", { description: "Your supervisor will review it." }); setOpen(false); setNote(""); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Send className="mr-1 h-3.5 w-3.5" />Submit</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Submit “{title}”</DialogTitle><DialogDescription>Describe what you completed. Your supervisor will review and sign off.</DialogDescription></DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="mnote">Progress note</Label>
          <Textarea id="mnote" rows={4} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was completed, evidence, links…" />
        </div>
        <DialogFooter><Button disabled={!ok || m.isPending} onClick={() => m.mutate()}>{m.isPending ? "Submitting…" : "Submit milestone"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewMilestone({ milestoneId, title }: { milestoneId: string; title: string; studentName?: string }) {
  const qc = useQueryClient();
  const [remarks, setRemarks] = useState("");
  const m = useMutation({
    mutationFn: async (approve: boolean) => {
      if (!approve && !remarks.trim()) throw new Error("Give feedback when sending a milestone back");
      const { error } = await supabase.rpc("act_on_milestone", { _id: milestoneId, _approve: approve, _remarks: remarks.trim() });
      if (error) throw error;
      return approve;
    },
    onSuccess: (approve) => {
      toast.success(approve ? "Milestone approved" : "Sent back with feedback");
      setRemarks(""); qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm">Review</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Review “{title}”</DialogTitle><DialogDescription>Approve to sign it off, or send it back with feedback for another attempt.</DialogDescription></DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="mremarks">Feedback <span className="text-muted-foreground">(required to send back)</span></Label>
          <Textarea id="mremarks" rows={3} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={m.isPending || !remarks.trim()} onClick={() => m.mutate(false)}>Send back</Button>
          <Button disabled={m.isPending} onClick={() => m.mutate(true)}>{m.isPending ? "Saving…" : "Approve"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
