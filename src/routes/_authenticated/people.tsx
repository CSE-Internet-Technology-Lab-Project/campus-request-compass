import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, usePeople, type Role } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/people")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "People & roles — DeptDesk" }, { name: "description", content: "HOD role management." }, { property: "og:title", content: "People & roles — DeptDesk" }, { property: "og:description", content: "Assign student, faculty and HOD roles." }] }),
  component: PeoplePage,
});

const ROLES: Role[] = ["student", "faculty", "hod"];

function PeoplePage() {
  const { data: me } = useMe();
  const { data: people = [] } = usePeople();
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  if (!me?.isHod) return <p className="text-muted-foreground">Only the HOD can manage roles.</p>;

  async function toggle(userId: string, role: Role, on: boolean) {
    if (!me?.isHod || pending) return;
    if (userId === me.id && role === "hod" && !on) { toast.error("You cannot remove your own HOD role."); return; }
    setPending(true);
    const { error } = on
      ? await supabase.from("user_roles").insert({ user_id: userId, role })
      : await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    setPending(false);
    if (error) toast.error(error.message);
    else qc.invalidateQueries();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">People & roles</h1>
        <p className="text-muted-foreground">Promote members to faculty or HOD.</p>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Program</TableHead><TableHead>Roll no.</TableHead>{ROLES.map((r) => <TableHead key={r} className="uppercase">{r}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {people.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name}</TableCell>
                <TableCell>{p.email}</TableCell>
                <TableCell>{p.program ?? "—"}</TableCell>
                <TableCell>{p.roll_no ?? "—"}</TableCell>
                {ROLES.map((r) => (
                  <TableCell key={r}><Checkbox aria-label={`${r} role for ${p.full_name}`} disabled={pending || (p.id === me.id && r === "hod")} checked={p.roles.includes(r)} onCheckedChange={(v) => toggle(p.id, r, !!v)} /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
