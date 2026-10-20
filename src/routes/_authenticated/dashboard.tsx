import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ClipboardList, FolderKanban, Hourglass, Inbox, Plus, Users } from "lucide-react";
import { useWorkQueue } from "@/lib/queue";
import { usePeople, statusLabel, statusVariant, actionLabel, timeAgo, initials } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Dashboard — DeptDesk" }, { name: "description", content: "Your department workflow overview." }, { property: "og:title", content: "Dashboard — DeptDesk" }, { property: "og:description", content: "Your department workflow overview." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { me, data, isPending, error, refetch, reqQueue, appQueue } = useWorkQueue();
  const { data: people = [] } = usePeople();
  if (isPending || !me) return <div className="space-y-4"><Skeleton className="h-10 w-80" /><div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-64" /></div>;
  if (error) return <Alert variant="destructive"><AlertTitle>Overview unavailable</AlertTitle><AlertDescription className="mt-2"><Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button></AlertDescription></Alert>;
  if (!data) return null;

  const name = (id: string) => people.find((p) => p.id === id)?.full_name ?? "Someone";
  const project = (id: string) => data.projects.find((p) => p.id === id);
  const mine = data.reqs.filter((r) => r.student_id === me.id);
  const reviewer = me.isFaculty || me.isHod;
  const queueTotal = reqQueue.length + appQueue.length;
  const role = me.isHod ? "Head of Department" : me.isFaculty ? "Faculty" : "Student";

  const stats = reviewer
    ? [
        { label: "Waiting on you", value: queueTotal, icon: Hourglass },
        { label: "Requests in progress", value: data.reqs.filter((r) => r.status.startsWith("pending")).length, icon: ClipboardList },
        { label: "Open projects", value: data.projects.filter((p) => p.is_open).length, icon: FolderKanban },
        { label: "Students allocated", value: data.apps.filter((a) => a.status === "allocated").length, icon: Users },
      ]
    : [
        { label: "My requests in progress", value: mine.filter((r) => r.status.startsWith("pending")).length, icon: Hourglass },
        { label: "Approved requests", value: mine.filter((r) => r.status === "approved").length, icon: CheckCircle2 },
        { label: "My project applications", value: data.apps.filter((a) => a.student_id === me.id).length, icon: FolderKanban },
        { label: "Open projects", value: data.projects.filter((p) => p.is_open).length, icon: ClipboardList },
      ];

  const recent = (reviewer ? data.reqs : mine).slice(0, 5);
  const myApp = data.apps.find((a) => a.student_id === me.id && a.status === "allocated");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent-foreground">{role}</p>
          <h1 className="font-display text-3xl font-bold">Hello, {me.profile?.full_name || "there"}</h1>
          <p className="text-muted-foreground">{reviewer ? (queueTotal ? `You have ${queueTotal} item${queueTotal > 1 ? "s" : ""} waiting for your decision.` : "Nothing is waiting on you right now.") : "Track your requests and project applications here."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {me.isStudent && <Button asChild><Link to="/requests" search={{ tab: "mine" }}><Plus className="mr-1 h-4 w-4" />New request</Link></Button>}
          {me.isStudent && <Button variant="outline" asChild><Link to="/projects" search={{ tab: "browse" }}>Browse projects</Link></Button>}
          {reviewer && <Button variant="outline" asChild><Link to="/projects" search={{ tab: "browse" }}><Plus className="mr-1 h-4 w-4" />Publish project</Link></Button>}
          {me.isHod && <Button variant="outline" asChild><Link to="/people">Manage roles</Link></Button>}
        </div>
      </div>

      {me.isStudent && (!me.profile?.program || !me.profile?.roll_no) && (
        <Alert>
          <AlertTitle>Complete your profile</AlertTitle>
          <AlertDescription>Add your program (UG/PG) and roll number so faculty can identify you. <Link to="/profile" className="font-medium underline">Go to profile</Link></AlertDescription>
        </Alert>
      )}
      {myApp && (
        <Alert className="border-success/50">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Project allocated</AlertTitle>
          <AlertDescription>{project(myApp.project_id)?.title}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardDescription>{s.label}</CardDescription><s.icon className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="font-display text-4xl font-bold">{s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {reviewer && (
            <Card>
              <CardHeader><CardTitle>Your queue</CardTitle><CardDescription>Oldest first — decide to keep things moving.</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {queueTotal === 0 && <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground"><Inbox className="h-8 w-8" />All caught up.</div>}
                {[...reqQueue].reverse().map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.request_type} · {name(r.student_id)} · {timeAgo(r.created_at)}</div>
                    </div>
                    <Button size="sm" asChild><Link to="/requests" search={{ review: r.id, tab: "action" }}>Review<ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
                  </div>
                ))}
                {appQueue.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{name(a.student_id)} → {project(a.project_id)?.title}</div>
                      <div className="text-xs text-muted-foreground">Project application · {a.status === "applied" ? "needs guide decision" : "ready to allocate"}</div>
                    </div>
                    <Button size="sm" variant="secondary" asChild><Link to="/projects" search={{ tab: "review" }}>Open<ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>{reviewer ? "Latest requests" : "My recent requests"}</CardTitle></div>
              <Button variant="ghost" size="sm" asChild><Link to="/requests" search={{ tab: reviewer ? "all" : "mine" }}>View all</Link></Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {recent.map((r) => (
                <Link key={r.id} to="/requests" search={{ review: r.id, tab: reviewer ? "all" : "mine" }} className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-2.5 hover:bg-muted">
                  <div className="min-w-0"><div className="truncate font-medium">{r.title}</div><div className="text-xs text-muted-foreground">{r.request_type} · {timeAgo(r.created_at)}</div></div>
                  <Badge variant={statusVariant(r.status)}>{statusLabel[r.status]}</Badge>
                </Link>
              ))}
              {recent.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No requests yet.</p>}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent activity</CardTitle><CardDescription>Latest decisions on requests you can see.</CardDescription></CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {data.history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{initials(name(h.actor_id))}</AvatarFallback></Avatar>
                  <div className="min-w-0 text-sm">
                    <div><span className="font-medium">{name(h.actor_id)}</span> <span className="text-muted-foreground">{(actionLabel[h.action] ?? h.action).toLowerCase()}</span></div>
                    <Link to="/requests" search={{ review: h.request_id }} className="block truncate text-xs text-muted-foreground hover:underline">
                      {data.reqs.find((r) => r.id === h.request_id)?.title ?? "Request"} · {timeAgo(h.created_at)}
                    </Link>
                  </div>
                </li>
              ))}
              {data.history.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
