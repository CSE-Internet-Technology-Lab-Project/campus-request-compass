import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, usePeople, statusLabel, statusVariant } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({ meta: [{ title: "Project allocation — DeptDesk" }, { name: "description", content: "Publish, apply for and allocate student projects." }, { property: "og:title", content: "Project allocation — DeptDesk" }, { property: "og:description", content: "Project allocation management for UG/PG." }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data: me } = useMe();
  const { data: people = [] } = usePeople();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const [{ data: projects }, { data: apps }] = await Promise.all([
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("project_applications").select("*").order("created_at"),
      ]);
      return { projects: projects ?? [], apps: apps ?? [] };
    },
  });
  const act = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("act_on_application", { _id: id, _approve: approve });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!me || !data) return null;
  const name = (id: string) => people.find((p) => p.id === id)?.full_name ?? "—";
  const canPublish = me.isFaculty || me.isHod;
  const visibleApps = data.apps.filter((a) => {
    const p = data.projects.find((x) => x.id === a.project_id);
    return me.isHod || p?.faculty_id === me.id;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Project allocation</h1>
          <p className="text-muted-foreground">Student applies → Guide accepts → HOD allocates</p>
        </div>
        {canPublish && <NewProject meId={me.id} />}
      </div>
      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">Projects</TabsTrigger>
          {me.isStudent && <TabsTrigger value="mine">My applications</TabsTrigger>}
          {canPublish && <TabsTrigger value="review">Applications to review</TabsTrigger>}
        </TabsList>
        <TabsContent value="browse" className="grid gap-4 pt-2 md:grid-cols-2 xl:grid-cols-3">
          {data.projects.map((p) => {
            const allocated = data.apps.filter((a) => a.project_id === p.id && a.status === "allocated").length;
            const applied = data.apps.some((a) => a.project_id === p.id && a.student_id === me.id);
            return (
              <Card key={p.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex gap-2"><Badge variant="outline">{p.program}</Badge><Badge variant={p.is_open ? "default" : "secondary"}>{p.is_open ? "Open" : "Closed"}</Badge></div>
                  <CardTitle className="pt-2">{p.title}</CardTitle>
                  <CardDescription>Guide: {name(p.faculty_id)} · {allocated}/{p.max_students} allocated</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 text-sm text-muted-foreground">{p.description}</CardContent>
                <CardFooter className="gap-2">
                  {me.isStudent && p.is_open && (applied ? <Badge variant="secondary">Applied</Badge> : <Apply projectId={p.id} meId={me.id} />)}
                  {(p.faculty_id === me.id || me.isHod) && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      const { error } = await supabase.from("projects").update({ is_open: !p.is_open }).eq("id", p.id);
                      if (error) toast.error(error.message); else qc.invalidateQueries();
                    }}>{p.is_open ? "Close" : "Reopen"}</Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
          {data.projects.length === 0 && <p className="text-muted-foreground">No projects published yet.</p>}
        </TabsContent>
        <TabsContent value="mine">
          <AppTable rows={data.apps.filter((a) => a.student_id === me.id)} projects={data.projects} name={name} />
        </TabsContent>
        <TabsContent value="review">
          <AppTable
            rows={visibleApps}
            projects={data.projects}
            name={name}
            actions={(a) => {
              const p = data.projects.find((x) => x.id === a.project_id);
              const can = (a.status === "applied" && p?.faculty_id === me.id) || (a.status === "faculty_accepted" && me.isHod);
              if (!can) return null;
              return (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => act.mutate({ id: a.id, approve: true })}>{a.status === "applied" ? "Accept" : "Allocate"}</Button>
                  <Button size="sm" variant="destructive" onClick={() => act.mutate({ id: a.id, approve: false })}>Reject</Button>
                </div>
              );
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type App = { id: string; project_id: string; student_id: string; status: string; statement: string };
function AppTable({ rows, projects, name, actions }: { rows: App[]; projects: { id: string; title: string }[]; name: (id: string) => string; actions?: (a: App) => React.ReactNode }) {
  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Student</TableHead><TableHead>Statement</TableHead><TableHead>Status</TableHead>{actions && <TableHead />}</TableRow></TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{projects.find((p) => p.id === a.project_id)?.title}</TableCell>
              <TableCell>{name(a.student_id)}</TableCell>
              <TableCell className="max-w-xs truncate">{a.statement}</TableCell>
              <TableCell><Badge variant={statusVariant(a.status)}>{statusLabel[a.status]}</Badge></TableCell>
              {actions && <TableCell>{actions(a)}</TableCell>}
            </TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Nothing here.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

function Apply({ projectId, meId }: { projectId: string; meId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_applications").insert({ project_id: projectId, student_id: meId, statement });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Application sent"); setOpen(false); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Apply</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Apply for project</DialogTitle><DialogDescription>Tell the guide why you're a good fit.</DialogDescription></DialogHeader>
        <Textarea rows={5} value={statement} onChange={(e) => setStatement(e.target.value)} />
        <DialogFooter><Button disabled={m.isPending} onClick={() => m.mutate()}>Send application</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewProject({ meId }: { meId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", description: "", program: "UG" as "UG" | "PG", max_students: 1 });
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").insert({ ...f, faculty_id: meId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Project published"); setOpen(false); qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Publish project</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Publish a project</DialogTitle><DialogDescription>You'll be listed as the guide.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="space-y-1"><Label>Description</Label><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Program</Label>
              <Select value={f.program} onValueChange={(v) => setF({ ...f, program: v as "UG" | "PG" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="UG">UG</SelectItem><SelectItem value="PG">PG</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Max students</Label><Input type="number" min={1} value={f.max_students} onChange={(e) => setF({ ...f, max_students: Math.max(1, Number(e.target.value)) })} /></div>
          </div>
        </div>
        <DialogFooter><Button disabled={!f.title || m.isPending} onClick={() => m.mutate()}>Publish</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
