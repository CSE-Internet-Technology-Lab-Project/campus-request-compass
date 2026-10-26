import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, ClipboardList, Inbox, Plus, Search, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, usePeople, REQUEST_TYPES, statusLabel, statusVariant, actionLabel, timeAgo, initials } from "@/lib/auth";
import { canReviewRequest, canSubmitDecision, canWithdrawRequest, canRequestChanges, canReviseRequest, requestSteps } from "@/lib/workflow";
import { WorkflowSteps, REQUEST_STEP_LABELS } from "@/components/workflow-steps";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Search = { review?: string; tab?: "action" | "mine" | "all" };

export const Route = createFileRoute("/_authenticated/requests")({
  validateSearch: (s: Record<string, unknown>) => {
    const review = s["review"];
    const tab = s["tab"];
    return {
      ...(typeof review === "string" ? { review } : {}),
      ...(tab === "action" || tab === "mine" || tab === "all" ? { tab } : {}),
    };
  },
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Requests & approvals — DeptDesk" }, { name: "description", content: "Submit and approve departmental requests." }, { property: "og:title", content: "Requests & approvals — DeptDesk" }, { property: "og:description", content: "Workflow-based approvals for UG/PG activities." }] }),
  component: RequestsPage,
});

type Req = {
  id: string; title: string; details: string; request_type: string; program: "UG" | "PG"; status: string;
  student_id: string; faculty_id: string; faculty_remarks: string | null; hod_remarks: string | null; created_at: string; needed_by: string | null;
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function RequestsPage() {
  const { data: me } = useMe();
  const { data: people = [] } = usePeople();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/requests" });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("any");
  const { data: reqs = [], isPending, error, refetch } = useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Req[];
    },
  });

  const needsMe = (r: Req) => (me ? canReviewRequest(r, me) : false);
  const counts = useMemo(() => ({
    action: me ? reqs.filter((r) => canReviewRequest(r, me)).length : 0,
    mine: me ? reqs.filter((r) => r.student_id === me.id).length : 0,
    all: reqs.length,
  }), [reqs, me]);

  if (isPending || !me) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-10 w-96" /><Skeleton className="h-64 w-full" /></div>;
  if (error) return <Alert variant="destructive"><AlertTitle>Requests could not load</AlertTitle><AlertDescription className="mt-2"><Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button></AlertDescription></Alert>;

  const defaultTab = me.isStudent && !me.isFaculty && !me.isHod ? "mine" : "action";
  const tab = search.tab ?? defaultTab;
  const name = (id: string) => people.find((p) => p.id === id)?.full_name ?? "—";
  const q = query.trim().toLowerCase();
  const shown = reqs.filter((r) =>
    (tab === "action" ? needsMe(r) : tab === "mine" ? r.student_id === me.id : true) &&
    (status === "any" || r.status === status) &&
    (!q || [r.title, r.request_type, name(r.student_id), name(r.faculty_id)].some((v) => v.toLowerCase().includes(q))),
  );
  const open = reqs.find((r) => r.id === search.review) ?? null;
  const setOpen = (id?: string) => navigate({ search: (s) => ({ ...s, ...(id !== undefined ? { review: id } : {}) }), replace: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Requests & approvals</h1>
          <p className="text-muted-foreground">Every request moves through Student → Faculty → HOD.</p>
        </div>
        {me.isStudent && <NewRequest faculty={people.filter((p) => p.roles.includes("faculty"))} me={me} onCreated={(id) => setOpen(id)} />}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => navigate({ search: (s) => ({ ...s, ...(v === "action" || v === "mine" || v === "all" ? { tab: v } : {}) }), replace: true })}>
          <TabsList>
            {(me.isFaculty || me.isHod) && <TabsTrigger value="action" className="gap-2">Needs my action {counts.action > 0 && <Badge className="h-5 px-1.5">{counts.action}</Badge>}</TabsTrigger>}
            {me.isStudent && <TabsTrigger value="mine">My requests ({counts.mine})</TabsTrigger>}
            <TabsTrigger value="all">All visible ({counts.all})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search title, type, person…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search requests" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any status</SelectItem>
            {["pending_faculty", "pending_hod", "needs_revision", "approved", "rejected", "withdrawn"].map((s) => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">{tab === "action" ? "You're all caught up" : q || status !== "any" ? "No requests match your filters" : "No requests yet"}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {tab === "action" ? "Requests that need your decision will appear here." : me.isStudent ? "Use “New request” to send a leave, certificate or other request for approval." : "Requests you can see will appear here."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead><TableHead>Student</TableHead><TableHead>Faculty</TableHead>
                  <TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpen(r.id)}>
                    <TableCell>
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.request_type} · {r.program}{r.needed_by && <> · needed by {fmtDate(r.needed_by)}</>}</div>
                    </TableCell>
                    <TableCell>{name(r.student_id)}</TableCell>
                    <TableCell>{name(r.faculty_id)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{timeAgo(r.created_at)}</TableCell>
                    <TableCell><Badge variant={statusVariant(r.status)}>{statusLabel[r.status]}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant={needsMe(r) ? "default" : "ghost"} onClick={(e) => { e.stopPropagation(); setOpen(r.id); }}>{needsMe(r) ? "Review" : "View"}</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <RequestSheet req={open} onClose={() => setOpen(undefined)} key={open?.id ?? "closed"} meId={me.id} canAct={open ? needsMe(open) : false} name={name} />
    </div>
  );
}

function NewRequest({ faculty, me, onCreated }: { faculty: { id: string; full_name: string }[]; me: NonNullable<ReturnType<typeof useMe>["data"]>; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const blank = { title: "", details: "", request_type: REQUEST_TYPES[0] as string, program: (me.profile?.program ?? "UG") as "UG" | "PG", faculty_id: "", needed_by: "" };
  const [form, setForm] = useState(blank);
  const today = new Date().toISOString().slice(0, 10);
  const dateOk = !form.needed_by || form.needed_by >= today;
  const valid = form.title.trim().length > 0 && !!form.faculty_id && dateOk;
  const m = useMutation({
    mutationFn: async () => {
      if (!valid) throw new Error("Fill in the title, faculty and a future date");
      const { data, error } = await supabase.from("requests").insert({
        title: form.title.trim(), details: form.details.trim(), request_type: form.request_type, program: form.program,
        faculty_id: form.faculty_id, student_id: me.id, needed_by: form.needed_by || null,
      }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      const fac = faculty.find((f) => f.id === form.faculty_id)?.full_name;
      toast.success("Request submitted", { description: fac ? `Sent to ${fac} for review.` : undefined });
      setOpen(false); setForm(blank); qc.invalidateQueries(); onCreated(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New request</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>New request</DialogTitle><DialogDescription>It goes to the faculty member you choose, then to the HOD for final approval.</DialogDescription></DialogHeader>
        {faculty.length === 0 && <Alert><AlertDescription>No faculty members yet. Ask the HOD to add faculty on the People page.</AlertDescription></Alert>}
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Type</Label>
              <Select value={form.request_type} onValueChange={(v) => setForm({ ...form, request_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REQUEST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Program</Label>
              <Select value={form.program} onValueChange={(v) => setForm({ ...form, program: v as "UG" | "PG" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="UG">UG</SelectItem><SelectItem value="PG">PG</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Faculty / advisor</Label>
              <Select value={form.faculty_id} onValueChange={(v) => setForm({ ...form, faculty_id: v })} disabled={!faculty.length}>
                <SelectTrigger><SelectValue placeholder="Select faculty" /></SelectTrigger>
                <SelectContent>{faculty.map((f) => <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="needed_by">Needed by <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="needed_by" type="date" min={today} value={form.needed_by} onChange={(e) => setForm({ ...form, needed_by: e.target.value })} aria-invalid={!dateOk} />
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="title">Title</Label><Input id="title" maxLength={120} placeholder="e.g. Medical leave, 3–5 March" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-1.5">
            <div className="flex justify-between"><Label htmlFor="details">Details</Label><span className="text-xs text-muted-foreground">{form.details.length}/1000</span></div>
            <Textarea id="details" rows={4} maxLength={1000} placeholder="Reason, dates, supporting information…" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
          </div>
          <DialogFooter><Button type="submit" disabled={!valid || m.isPending}>{m.isPending ? "Submitting…" : "Submit request"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RequestSheet({ req, onClose, canAct, meId, name }: { req: Req | null; onClose: () => void; canAct: boolean; meId: string; name: (id: string) => string }) {
  const qc = useQueryClient();
  const [remarks, setRemarks] = useState("");
  const { data: history = [], isPending: historyPending } = useQuery({
    queryKey: ["history", req?.id],
    enabled: !!req,
    queryFn: async () => {
      if (!req) return [];
      const { data, error } = await supabase.from("request_history").select("*").eq("request_id", req.id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const act = useMutation({
    mutationFn: async (approve: boolean) => {
      if (!req) throw new Error("Choose a request");
      if (!canSubmitDecision(approve, remarks)) throw new Error("Give a reason when rejecting");
      const { error } = await supabase.rpc("act_on_request", { _id: req.id, _approve: approve, _remarks: remarks.trim() });
      if (error) throw error;
      return approve;
    },
    onSuccess: (approve) => {
      const next = req?.status === "pending_faculty" && approve ? "Forwarded to the HOD." : undefined;
      toast.success(approve ? "Approved" : "Rejected", { description: next });
      setRemarks(""); onClose(); qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const withdraw = useMutation({
    mutationFn: async () => {
      if (!req) throw new Error("Choose a request");
      const { error } = await supabase.rpc("withdraw_request", { _id: req.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Request withdrawn"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const requestChanges = useMutation({
    mutationFn: async () => {
      if (!req) throw new Error("Choose a request");
      if (!remarks.trim()) throw new Error("Tell the student what to change");
      const { error } = await supabase.rpc("request_changes", { _id: req.id, _remarks: remarks.trim() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Sent back for changes", { description: "The student can revise and resubmit." }); setRemarks(""); onClose(); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reachedHod = !!req && (req.status === "pending_hod" || req.status === "approved" || history.some((h) => h.action === "faculty_approved"));
  const stageLabel = req?.status === "pending_faculty" ? "faculty" : "HOD";

  return (
    <Sheet open={!!req} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {req && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-muted-foreground" /><span className="text-xs uppercase tracking-wide text-muted-foreground">{req.request_type} · {req.program}</span></div>
              <SheetTitle className="font-display text-2xl">{req.title}</SheetTitle>
              <SheetDescription>Submitted by {name(req.student_id)} · {fmtDate(req.created_at)}</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-6">
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="mb-3 flex items-center justify-between"><span className="text-sm font-medium">Progress</span><Badge variant={statusVariant(req.status)}>{statusLabel[req.status]}</Badge></div>
                <WorkflowSteps labels={REQUEST_STEP_LABELS} states={requestSteps(req.status, reachedHod)} />
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">Faculty</dt><dd className="font-medium">{name(req.faculty_id)}</dd></div>
                <div><dt className="text-muted-foreground">Needed by</dt><dd className="flex items-center gap-1 font-medium">{req.needed_by ? <><CalendarClock className="h-3.5 w-3.5" />{fmtDate(req.needed_by)}</> : "—"}</dd></div>
              </dl>

              <div>
                <h3 className="mb-1 text-sm font-medium">Details</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{req.details || "No details provided."}</p>
              </div>

              {(req.faculty_remarks || req.hod_remarks) && (
                <div className="space-y-2">
                  {req.faculty_remarks && <Alert><AlertTitle>Faculty remarks</AlertTitle><AlertDescription>{req.faculty_remarks}</AlertDescription></Alert>}
                  {req.hod_remarks && <Alert><AlertTitle>HOD remarks</AlertTitle><AlertDescription>{req.hod_remarks}</AlertDescription></Alert>}
                </div>
              )}

              {req.status === "approved" && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/verify/$requestId" params={{ requestId: req.id }} target="_blank">View approval certificate</Link>
                </Button>
              )}

              {canReviseRequest(req, meId) && <ReviseRequest req={req} onClose={onClose} />}

              {canAct && (
                <Card className="border-primary/40">
                  <CardHeader className="pb-2"><CardTitle className="text-base">Your decision as {stageLabel}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="remarks">Remarks <span className="text-muted-foreground">(required to reject)</span></Label>
                      <Textarea id="remarks" rows={3} maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={req.status === "pending_faculty" ? "Notes for the HOD or student…" : "Final remarks…"} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={act.isPending} onClick={() => act.mutate(true)}>{req.status === "pending_faculty" ? "Approve & forward to HOD" : "Give final approval"}</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="outline" disabled={act.isPending || !canSubmitDecision(false, remarks)}>Reject</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Reject this request?</AlertDialogTitle><AlertDialogDescription>The student will see your reason. This closes the request.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => act.mutate(false)}>Reject request</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {req.status === "pending_faculty" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="secondary" disabled={requestChanges.isPending || !remarks.trim()}>Request changes</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Send this back to the student?</AlertDialogTitle><AlertDialogDescription>They will see your remarks, revise the details, and resubmit for review.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => requestChanges.mutate()}>Request changes</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                    {!canSubmitDecision(false, remarks) && <p className="text-xs text-muted-foreground">Add remarks to enable rejection.</p>}
                  </CardContent>
                </Card>
              )}

              {canWithdrawRequest(req, meId) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="outline" size="sm" disabled={withdraw.isPending}><Undo2 className="mr-1 h-4 w-4" />Withdraw request</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Withdraw this request?</AlertDialogTitle><AlertDialogDescription>Reviewers will no longer be able to act on it. You can submit a new request later.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction onClick={() => withdraw.mutate()}>Withdraw</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <Separator />
              <div>
                <h3 className="mb-3 text-sm font-medium">Activity</h3>
                {historyPending ? <Skeleton className="h-16 w-full" /> : (
                  <ol className="space-y-4">
                    {history.map((h) => (
                      <li key={h.id} className="flex gap-3">
                        <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{initials(name(h.actor_id))}</AvatarFallback></Avatar>
                        <div className="text-sm">
                          <div><span className="font-medium">{name(h.actor_id)}</span> <span className="text-muted-foreground">— {actionLabel[h.action] ?? h.action}</span></div>
                          <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
                          {h.remarks && <p className="mt-1 rounded-md bg-muted px-2 py-1">“{h.remarks}”</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ReviseRequest({ req, onClose }: { req: Req; onClose: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      if (!details.trim()) throw new Error("Add the updated details before resubmitting");
      const { error } = await supabase.rpc("revise_request", { _id: req.id, _details: details.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resubmitted", { description: "Back with your faculty advisor for review." });
      setOpen(false); onClose(); qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <Alert>
        <AlertTitle>Faculty requested changes</AlertTitle>
        <AlertDescription>{req.faculty_remarks || "Update the details below and resubmit."}</AlertDescription>
      </Alert>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button>Update details &amp; resubmit</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Revise “{req.title}”</DialogTitle><DialogDescription>Address your faculty's remarks and resubmit. It returns to them for review.</DialogDescription></DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="revdetails">Updated details</Label>
            <Textarea id="revdetails" rows={5} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={req.details || "Updated reason, dates, supporting information…"} />
          </div>
          <DialogFooter><Button disabled={!details.trim() || m.isPending} onClick={() => m.mutate()}>{m.isPending ? "Resubmitting…" : "Resubmit request"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
