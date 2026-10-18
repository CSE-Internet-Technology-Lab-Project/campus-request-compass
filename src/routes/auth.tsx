import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, 
      { title: "Sign in — DeptDesk" },
      { name: "description", content: "Sign in or create your DeptDesk account." },
      { property: "og:title", content: "Sign in — DeptDesk" },
      { property: "og:description", content: "Access your department workflow portal." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/dashboard" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: name } },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data.session) navigate({ to: "/dashboard" });
    else toast.success("Check your email to confirm your account.");
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) { toast.error(String(r.error.message ?? r.error)); return; }
    if (r.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="font-display text-3xl font-bold text-primary">DeptDesk</Link>
          <CardTitle className="pt-2">Welcome</CardTitle>
          <CardDescription>New accounts start as students. The HOD assigns faculty roles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
          <Separator />
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-3 pt-2">
                <div className="space-y-1"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1"><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button className="w-full" disabled={loading}>Sign in</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-3 pt-2">
                <div className="space-y-1"><Label>Full name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1"><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1"><Label>Password</Label><Input type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button className="w-full" disabled={loading}>Create account</Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
