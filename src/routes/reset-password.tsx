import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Reset password — DeptDesk" },
    { name: "description", content: "Set a new password for your DeptDesk account." },
    { property: "og:title", content: "Reset password — DeptDesk" },
    { property: "og:description", content: "Recover access to your department account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const recovery = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    if (!recovery) { setMessage("Open the password reset link from your email."); return; }
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) setMessage("This reset link has expired. Request a new one.");
      else setReady(true);
    });
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || password !== confirm) { setMessage("Passwords must match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage(error.message);
    else navigate({ to: "/dashboard" });
  }
  return <main className="flex min-h-screen items-center justify-center bg-background p-4">
    <Card className="w-full max-w-md">
      <CardHeader><CardTitle>Reset password</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}
        {ready && <form onSubmit={save} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={6} required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          <Button disabled={busy}>{busy ? "Saving…" : "Save password"}</Button>
        </form>}
        <Button asChild variant="outline"><Link to="/auth">Back to sign in</Link></Button>
      </CardContent>
    </Card>
  </main>;
}