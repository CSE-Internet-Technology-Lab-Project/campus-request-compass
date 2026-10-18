import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, ClipboardCheck, FolderKanban, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, 
      { title: "DeptDesk — UG/PG Departmental Workflow Portal" },
      { name: "description", content: "Submit requests, route approvals through faculty and HOD, and allocate student projects." },
      { property: "og:title", content: "DeptDesk — Departmental Workflow Portal" },
      { property: "og:description", content: "Workflow-based approvals and project allocation for UG/PG departments." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: ClipboardCheck, title: "Approval workflow", text: "Student → Faculty → HOD, with remarks and a full audit trail at every step." },
  { icon: FolderKanban, title: "Project allocation", text: "Faculty publish projects, students apply, guides shortlist, HOD allocates." },
  { icon: GraduationCap, title: "UG & PG programs", text: "Every request and project is tagged by program level for clean reporting." },
  { icon: ShieldCheck, title: "Role-based access", text: "Students, faculty and HOD each see exactly what they're allowed to act on." },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-display text-2xl font-bold text-primary">DeptDesk</span>
        <Button asChild><Link to="/auth">Sign in</Link></Button>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground">Department workflow portal</p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl font-bold leading-tight text-foreground md:text-6xl">
          Every request, approval and project — in one place.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          DeptDesk replaces paper forms and email chains with a clear, trackable workflow for UG and PG activities.
        </p>
        <div className="mt-8 flex gap-3">
          <Button size="lg" asChild><Link to="/auth">Get started</Link></Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 md:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <f.icon className="h-6 w-6 text-primary" />
              <CardTitle className="mt-2">{f.title}</CardTitle>
              <CardDescription>{f.text}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </section>
    </div>
  );
}
