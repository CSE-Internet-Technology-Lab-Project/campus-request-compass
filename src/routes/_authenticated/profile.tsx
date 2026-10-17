import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My profile — DeptDesk" }, { name: "description", content: "Update your profile." }, { property: "og:title", content: "My profile — DeptDesk" }, { property: "og:description", content: "Update your profile." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: "", roll_no: "", program: "" });
  useEffect(() => {
    if (me?.profile) setF({ full_name: me.profile.full_name, roll_no: me.profile.roll_no ?? "", program: me.profile.program ?? "" });
  }, [me?.profile]);
  if (!me) return null;

  async function save() {
    const { error } = await supabase.from("profiles").update({
      full_name: f.full_name, roll_no: f.roll_no || null, program: (f.program || null) as "UG" | "PG" | null,
    }).eq("id", me!.id);
    if (error) toast.error(error.message);
    else { toast.success("Profile saved"); qc.invalidateQueries(); }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle>My profile</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1"><Label>Full name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div className="space-y-1"><Label>Program</Label>
          <Select value={f.program} onValueChange={(v) => setF({ ...f, program: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent><SelectItem value="UG">UG</SelectItem><SelectItem value="PG">PG</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Roll / employee no.</Label><Input value={f.roll_no} onChange={(e) => setF({ ...f, roll_no: e.target.value })} /></div>
        <Button onClick={save}>Save</Button>
      </CardContent>
    </Card>
  );
}
