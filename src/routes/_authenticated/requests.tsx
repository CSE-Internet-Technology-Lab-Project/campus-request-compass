import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, usePeople, REQUEST_TYPES, statusLabel, statusVariant } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({ meta: [{ title: "Requests & approvals — DeptDesk" }, { name: "description", content: "Submit and approve departmental requests." }, { property: "og:title", content: "Requests & approvals — DeptDesk" }, { property: "og:description", content: "Workflow-based approvals for UG/PG activities." }] }),
  component: RequestsPage,
});

type Req = {
  id: string; title: string; details: string; request_type: string; program: "UG" | "PG"; status: string;
  student_id: string; faculty_id: string; faculty_remarks: string | null; hod_remarks: string | null; created_at: string;
};

function RequestsPage() {
  const { data: me } = useMe();
  const { data: people = [] } = usePeople();
  const [filter, setFilter] = useState("action");
  const [open, setOpen] = useState<Req | null>(null);
  const { data: reqs = [] } = useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Req[];
    },
  });
  if (!me) return null;
  const name = (id: string) => people.find((p) => p.id === id)?.full_name ?? "—";
  const needsMe = (r: Req) => (r.status === "pending_faculty" && r.faculty_id === me.id) || (r.status === "pending_hod" && me.isHod);
  const shown = reqs.filter((r) =>
    filter === "action" ? needsMe(r) : filter === "mine" ? r.student_id === me.id : true,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Requests & approvals</h1>
          <p className="text-muted-foreground">Student → Faculty → HOD</p>
        </div>
        {me.isStudent && <NewRequest faculty={people.filter((p) => p.roles.includes("faculty"))} me={me} />}
      </div>
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="action">Needs my action</TabsTrigger>
          <TabsTrigger value="mine">My requests</TabsTrigger>
          <TabsTrigger value="all">All visible</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Program</TableHead>
                <TableHead>Student</TableHead><TableHead>Faculty</TableHead><TableHead>Status</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell>{r.request_type}</TableCell>
                  <TableCell>{r.program}</TableCell>
                  <TableCell>{name(r.student_id)}</TableCell>
                  <TableCell>{name(r.faculty_id)}</TableCell>
                  <TableCell><Badge variant={statusVariant(r.status)}>{statusLabel[r.status]}</Badge></TableCell>
                  <TableCell><Button size="sm" variant={needsMe(r) ? "default" : "outline"} onClick={() => setOpen(r)}>{needsMe(r) ? "Review" : "View"}</Button></TableCell>
                </TableRow>
              ))}
              {shown.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Nothing here.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <RequestSheet req={open} onClose={() => setOpen(null)} canAct={open ? needsMe(open) : false} name={name} />
    </div>
  );
}

function NewRequest({ faculty, me }: { faculty: { id: string; full_name: string }[]; me: NonNullable<ReturnType<typeof useMe>["data"]> }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", details: "", request_type: REQUEST_TYPES[0] as string, program: me.profile?.program ?? "UG", faculty_id: "" });
  const m = useMutation({
    mutationFn: async () => {
      if (!form.faculty_id) throw new Error("Choose a faculty member");
      const { error } = await supabase.from("requests").insert({ ...form, program: form.program as "UG" | "PG", student_id: me.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Request submitted"); setOpen(false); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>New request</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New request</DialogTitle><DialogDescription>It goes to the chosen faculty first, then to the HOD.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Type</Label>
              <Select value={form.request_type} onValueChange={(v) => setForm({ ...form, request_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REQUEST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Program</Label>
              <Select value={form.program} onValueChange={(v) => setForm({ ...form, program: v as "UG" | "PG" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="UG">UG</SelectItem><SelectItem value="PG">PG</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Faculty / advisor</Label>
            <Select value={form.faculty_id} onValueChange={(v) => setForm({ ...form, faculty_id: v })}>
              <SelectTrigger><SelectValue placeholder={faculty.length ? "Select faculty" : "No faculty yet — ask HOD"} /></SelectTrigger>
              <SelectContent>{faculty.map((f) => <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-1"><Label>Details</Label><Textarea rows={4} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} /></div>
        </div>
        <DialogFooter><Button disabled={!form.title || m.isPending} onClick={() => m.mutate()}>Submit</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestSheet({ req, onClose, canAct, name }: { req: Req | null; onClose: () => void; canAct: boolean; name: (id: string) => string }) {
  const qc = useQueryClient();
  const [remarks, setRemarks] = useState("");
  const { data: history = [] } = useQuery({
    queryKey: ["history", req?.id],
    enabled: !!req,
    queryFn: async () => (await supabase.from("request_history").select("*").eq("request_id", req!.id).order("created_at")).data ?? [],
  });
  const act = useMutation({
    mutationFn: async (approve: boolean) => {
      const { error } = await supabase.rpc("act_on_request", { _id: req!.id, _approve: approve, _remarks: remarks });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Decision recorded"); setRemarks(""); onClose(); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Sheet open={!!req} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {req && (
          <>
            <SheetHeader>
              <SheetTitle>{req.title}</SheetTitle>
              <SheetDescription>{req.request_type} · {req.program} · by {name(req.student_id)}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-6">
              <Badge variant={statusVariant(req.status)}>{statusLabel[req.status]}</Badge>
              <p className="whitespace-pre-wrap text-sm">{req.details || "No details."}</p>
              {req.faculty_remarks && <p className="text-sm"><b>Faculty remarks:</b> {req.faculty_remarks}</p>}
              {req.hod_remarks && <p className="text-sm"><b>HOD remarks:</b> {req.hod_remarks}</p>}
              <Separator />
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Workflow history</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {history.map((h) => (
                    <div key={h.id} className="border-l-2 border-primary pl-3">
                      <div className="font-medium">{h.action.replace("_", " ")} — {name(h.actor_id)}</div>
                      <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</div>
                      {h.remarks && <div>{h.remarks}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>
              {canAct && (
                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                  <div className="flex gap-2">
                    <Button disabled={act.isPending} onClick={() => act.mutate(true)}>Approve</Button>
                    <Button variant="destructive" disabled={act.isPending} onClick={() => act.mutate(false)}>Reject</Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
