import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { canReviewRequest } from "@/lib/workflow";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, statusLabel, statusVariant } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Dashboard — DeptDesk" }, { name: "description", content: "Your department workflow overview." }, { property: "og:title", content: "Dashboard — DeptDesk" }, { property: "og:description", content: "Your department workflow overview." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: me } = useMe();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [{ data: reqs, error: reqError }, { data: apps, error: appError }, { data: projects, error: projectError }] = await Promise.all([
        supabase.from("requests").select("id,title,status,student_id,faculty_id,created_at").order("created_at", { ascending: false }),
        supabase.from("project_applications").select("id,status,student_id,project_id"),
        supabase.from("projects").select("id,is_open,faculty_id"),
      ]);
      if (reqError) throw reqError;
      if (appError) throw appError;
      if (projectError) throw projectError;
      return { reqs: reqs ?? [], apps: apps ?? [], projects: projects ?? [] };
    },
  });
  if (isPending || !me) return <Skeleton className="h-64 w-full" />;
  if (error) return <Alert variant="destructive"><AlertTitle>Overview unavailable</AlertTitle><AlertDescription><Button variant="outline" onClick={() => refetch()}>Try again</Button></AlertDescription></Alert>;
  if (!data) return null;

  const awaitingMe = data.reqs.filter(
    (r) => canReviewRequest(r, me),
  );
  const mine = data.reqs.filter((r) => r.student_id === me.id);
  const stats = [
    { label: "Awaiting my action", value: awaitingMe.length },
    { label: "My submitted requests", value: mine.length },
    { label: "Open projects", value: data.projects.filter((p) => p.is_open).length },
    { label: "Projects allocated", value: data.apps.filter((a) => a.status === "allocated").length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Hello, {me.profile?.full_name || "there"}</h1>
        <p className="text-muted-foreground">Here is what's happening in your department.</p>
      </div>
      {me.isStudent && !me.profile?.program && (
        <Alert>
          <AlertTitle>Complete your profile</AlertTitle>
          <AlertDescription>
            Set your program (UG/PG) and roll number. <Link to="/profile" className="underline">Go to profile</Link>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2"><CardDescription>{s.label}</CardDescription></CardHeader>
            <CardContent><div className="font-display text-4xl font-bold">{s.value}</div></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent requests</CardTitle>
          <Button variant="outline" size="sm" asChild><Link to="/requests">View all</Link></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.reqs.slice(0, 6).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-3">
              <span className="font-medium">{r.title}</span>
              <Badge variant={statusVariant(r.status)}>{statusLabel[r.status]}</Badge>
            </div>
          ))}
          {data.reqs.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
