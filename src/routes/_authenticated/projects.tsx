import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FolderKanban, Inbox, Plus, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, usePeople, statusLabel, statusVariant, timeAgo } from "@/lib/auth";
import { canReviewApplication, validProjectCapacity, applicationSteps } from "@/lib/workflow";
import { WorkflowSteps, APPLICATION_STEP_LABELS } from "@/components/workflow-steps";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

type Search = { tab?: "browse" | "mine" | "review" };

export const Route = createFileRoute("/_authenticated/projects")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: s.tab === "browse" || s.tab === "mine" || s.tab === "review" ? s.tab : undefined,
  }),
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Project allocation — DeptDesk" }, { name: "description", content: "Publish, apply for and allocate student projects." }, { property: "og:title", content: "Project allocation — DeptDesk" }, { property: "og:description", content: "Project allocation management for UG/PG." }] }),
  component: ProjectsPage,
});

const MIN_STATEMENT = 30;

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="col-span-full flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function ProjectsPage() {
  const { data: me } = useMe();
  const { data: people = [] } = usePeople();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/projects" });
  const [query, setQuery] = useState("");
  const [program, setProgram] = useState("any");
  const [onlyOpen, setOnlyOpen] = useState("open");
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const [{ data: projects, error: projectsError }, { data: apps, error: appsError }] = await Promise.all([
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("project_applications").select("*").order("created_at"),
      ]);
      if (projectsError) throw projectsError;
      if (appsError) throw appsError;
      return { projects: projects ?? [], apps: apps ?? [] };
    },
  });
  const act = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean; stage: string }) => {
      const { error } = await supabase.rpc("act_on_application", { _id: id, _approve: approve });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(!v.approve ? "Application rejected" : v.stage === "applied" ? "Accepted — sent to HOD for allocation" : "Project allocated");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, is_open }: { id: string; is_open: boolean }) => {
      const { error } = await supabase.from("projects").update({ is_open }).eq("id", id);
      if (error) throw error;
      return is_open;
    },
    onSuccess: (o) => { toast.success(o ? "Project reopened" : "Project closed to new applications"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || !me) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}</div></div>;
  if (error) return <Alert variant="destructive"><AlertTitle>Projects could not load</AlertTitle><AlertDescription className="mt-2"><Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button></AlertDescription></Alert>;
  if (!data) return null;

  const name = (id: string) => people.find((p) => p.id === id)?.full_name ?? "—";
  const canPublish = me.isFaculty || me.isHod;
  const guideOf = (projectId: string) => data.projects.find((x) => x.id === projectId)?.faculty_id;
  const reviewable = data.apps.filter((a) => me.isHod || guideOf(a.project_id) === me.id);
  const toReview = reviewable.filter((a) => canReviewApplication(a, guideOf(a.project_id), me));
  const myApps = data.apps.filter((a) => a.student_id === me.id);
  const myAllocation = myApps.find((a) => a.status === "allocated");
  const tab = search.tab ?? (canPublish && toReview.length ? "review" : "browse");
  const q = query.trim().toLowerCase();
  const projects = data.projects.filter((p) =>
    (program === "any" || p.program === program) &&
    (onlyOpen === "all" || p.is_open) &&
    (!q || [p.title, p.description ?? "", name(p.faculty_id)].some((v) => v.toLowerCase().includes(q))),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Project allocation</h1>
          <p className="text-muted-foreground">Student applies → Guide accepts → HOD allocates.</p>
        </div>
        {canPublish && <NewProject meId={me.id} />}
      </div>

      {myAllocation && (
        <Alert className="border-success/50">
          <FolderKanban className="h-4 w-4" />
          <AlertTitle>You've been allocated a project</AlertTitle>
          <AlertDescription>{data.projects.find((p) => p.id === myAllocation.project_id)?.title} · Guide: {name(guideOf(myAllocation.project_id) ?? "")}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as Search["tab"] }, replace: true })}>
        <TabsList>
          <TabsTrigger value="browse">Projects</TabsTrigger>
          {me.isStudent && <TabsTrigger value="mine">My applications ({myApps.length})</TabsTrigger>}
          {canPublish && <TabsTrigger value="review" className="gap-2">To review {toReview.length > 0 && <Badge className="h-5 px-1.5">{toReview.length}</Badge>}</TabsTrigger>}
        </TabsList>

        <TabsContent value="browse" className="space-y-4 pt-2">
          <div className="flex flex-wrap gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search projects or guides…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search projects" />
            </div>
            <Select value={program} onValueChange={setProgram}>
              <SelectTrigger className="w-full sm:w-36" aria-label="Program"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="any">UG & PG</SelectItem><SelectItem value="UG">UG only</SelectItem><SelectItem value="PG">PG only</SelectItem></SelectContent>
            </Select>
            <Select value={onlyOpen} onValueChange={setOnlyOpen}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Availability"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="open">Open only</SelectItem><SelectItem value="all">Open & closed</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => {
              const allocated = data.apps.filter((a) => a.project_id === p.id && a.status === "allocated").length;
              const pending = data.apps.filter((a) => a.project_id === p.id && (a.status === "applied" || a.status === "faculty_accepted")).length;
              const mine = myApps.find((a) => a.project_id === p.id);
              const owner = p.faculty_id === me.id || me.isHod;
              const full = allocated >= p.max_students;
              return (
                <Card key={p.id} className="flex flex-col transition-shadow hover:shadow-md">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{p.program}</Badge>
                      <Badge variant={p.is_open ? "default" : "secondary"}>{full ? "Full" : p.is_open ? "Open" : "Closed"}</Badge>
                      {p.faculty_id === me.id && <Badge variant="secondary">You guide this</Badge>}
                    </div>
                    <CardTitle className="font-display text-xl leading-snug">{p.title}</CardTitle>
                    <CardDescription>Guide: {name(p.faculty_id)}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <p className="line-clamp-4 text-sm text-muted-foreground">{p.description || "No description."}</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground"><span>{allocated}/{p.max_students} seats filled</span>{owner && pending > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{pending} pending</span>}</div>
                      <Progress value={(allocated / p.max_students) * 100} className="h-1.5" />
                    </div>
                  </CardContent>
                  <CardFooter className="gap-2">
                    {me.isStudent && (mine
                      ? <Badge variant={statusVariant(mine.status)}>{statusLabel[mine.status]}</Badge>
                      : p.is_open && !myAllocation && <Apply projectId={p.id} projectTitle={p.title} meId={me.id} />)}
                    {owner && (
                      <Button size="sm" variant="ghost" className="ml-auto" disabled={toggle.isPending || (!p.is_open && full)} onClick={() => toggle.mutate({ id: p.id, is_open: !p.is_open })}>
                        {p.is_open ? "Close applications" : "Reopen"}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
            {projects.length === 0 && <Empty title={data.projects.length ? "No projects match your filters" : "No projects published yet"} text={canPublish ? "Use “Publish project” to list a project for students." : "Projects published by faculty will appear here."} />}
          </div>
        </TabsContent>

        <TabsContent value="mine" className="grid gap-4 pt-2 md:grid-cols-2">
          {myApps.map((a) => {
            const p = data.projects.find((x) => x.id === a.project_id);
            return (
              <Card key={a.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div><CardTitle className="text-lg">{p?.title}</CardTitle><CardDescription>Guide: {name(p?.faculty_id ?? "")} · applied {timeAgo(a.created_at)}</CardDescription></div>
                    <Badge variant={statusVariant(a.status)}>{statusLabel[a.status]}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {a.status !== "rejected" && <WorkflowSteps labels={APPLICATION_STEP_LABELS} states={applicationSteps(a.status, false)} />}
                  <p className="line-clamp-3 text-sm text-muted-foreground">“{a.statement}”</p>
                </CardContent>
                {a.status === "applied" && <CardFooter><Withdraw applicationId={a.id} /></CardFooter>}
              </Card>
            );
          })}
          {myApps.length === 0 && <Empty title="No applications yet" text="Browse the Projects tab and apply to the ones that interest you." />}
        </TabsContent>

        <TabsContent value="review" className="grid gap-4 pt-2 md:grid-cols-2">
          {[...toReview, ...reviewable.filter((a) => !toReview.includes(a))].map((a) => {
            const p = data.projects.find((x) => x.id === a.project_id);
            const can = toReview.includes(a);
            const allocated = data.apps.filter((x) => x.project_id === a.project_id && x.status === "allocated").length;
            return (
              <Card key={a.id} className={can ? "border-primary/40" : "opacity-80"}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div><CardTitle className="text-lg">{name(a.student_id)}</CardTitle><CardDescription>for {p?.title} · {timeAgo(a.created_at)}</CardDescription></div>
                    <Badge variant={statusVariant(a.status)}>{statusLabel[a.status]}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {a.status !== "rejected" && <WorkflowSteps labels={APPLICATION_STEP_LABELS} states={applicationSteps(a.status, false)} compact />}
                  <p className="whitespace-pre-wrap text-sm">{a.statement}</p>
                  {p && <p className="text-xs text-muted-foreground">{allocated}/{p.max_students} seats filled</p>}
                </CardContent>
                {can && (
                  <CardFooter className="gap-2">
                    <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ id: a.id, approve: true, stage: a.status })}>{a.status === "applied" ? "Accept as guide" : "Allocate project"}</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="sm" variant="outline" disabled={act.isPending}>Reject</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Reject {name(a.student_id)}'s application?</AlertDialogTitle><AlertDialogDescription>The student won't be able to apply to this project again.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => act.mutate({ id: a.id, approve: false, stage: a.status })}>Reject</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                )}
              </Card>
            );
          })}
          {reviewable.length === 0 && <Empty title="No applications yet" text="Applications to your projects will appear here." />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Apply({ projectId, projectTitle, meId }: { projectId: string; projectTitle: string; meId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState("");
  const ok = statement.trim().length >= MIN_STATEMENT;
  const m = useMutation({
    mutationFn: async () => {
      if (!ok) throw new Error(`Write at least ${MIN_STATEMENT} characters`);
      const { error } = await supabase.from("project_applications").insert({ project_id: projectId, student_id: meId, statement: statement.trim() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Application sent", { description: "The guide will review it first." }); setOpen(false); setStatement(""); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Apply</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Apply for “{projectTitle}”</DialogTitle><DialogDescription>Tell the guide about your interest and relevant skills.</DialogDescription></DialogHeader>
        <div className="space-y-1.5">
          <Textarea rows={6} maxLength={1500} value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Why this project, relevant coursework or experience…" />
          <p className="text-xs text-muted-foreground">{ok ? `${statement.length}/1500` : `${Math.max(0, MIN_STATEMENT - statement.trim().length)} more characters needed`}</p>
        </div>
        <DialogFooter><Button disabled={!ok || m.isPending} onClick={() => m.mutate()}>{m.isPending ? "Sending…" : "Send application"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewProject({ meId }: { meId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const blank = { title: "", description: "", program: "UG" as "UG" | "PG", max_students: 1 };
  const [f, setF] = useState(blank);
  const valid = !!f.title.trim() && validProjectCapacity(f.max_students);
  const m = useMutation({
    mutationFn: async () => {
      if (!valid) throw new Error("Enter a title and a positive whole-number capacity");
      const { error } = await supabase.from("projects").insert({ ...f, title: f.title.trim(), description: f.description.trim(), faculty_id: meId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Project published", { description: "Students can now apply." }); setOpen(false); setF(blank); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Publish project</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Publish a project</DialogTitle><DialogDescription>You'll be listed as the guide and review applications first.</DialogDescription></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="space-y-1.5"><Label htmlFor="ptitle">Title</Label><Input id="ptitle" maxLength={150} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="pdesc">Description</Label><Textarea id="pdesc" rows={4} maxLength={2000} placeholder="Scope, expected outcomes, prerequisites…" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Program</Label>
              <Select value={f.program} onValueChange={(v) => setF({ ...f, program: v as "UG" | "PG" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="UG">UG</SelectItem><SelectItem value="PG">PG</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="pmax">Seats</Label><Input id="pmax" type="number" min={1} max={20} value={f.max_students} onChange={(e) => setF({ ...f, max_students: Number(e.target.value) })} aria-invalid={!validProjectCapacity(f.max_students)} /></div>
          </div>
          <DialogFooter><Button type="submit" disabled={!valid || m.isPending}>{m.isPending ? "Publishing…" : "Publish"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Withdraw({ applicationId }: { applicationId: string }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("project_applications").delete().eq("id", applicationId).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("This application can no longer be withdrawn");
    },
    onSuccess: () => { toast.success("Application withdrawn"); qc.invalidateQueries(); },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button size="sm" variant="outline" disabled={mutation.isPending}>Withdraw</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Withdraw this application?</AlertDialogTitle><AlertDialogDescription>You can apply again while the project is open.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Keep it</AlertDialogCancel><AlertDialogAction onClick={() => mutation.mutate()}>Withdraw</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
