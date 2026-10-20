import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, ClipboardList, FolderKanban, Users, LogOut, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarInset,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Layout,
});

function Layout() {
  const { data: me } = useMe();
  const { reqQueue, appQueue } = useWorkQueue();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const items = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, count: 0 },
    { to: "/requests", label: "Requests & approvals", icon: ClipboardList, count: reqQueue.length },
    { to: "/projects", label: "Projects", icon: FolderKanban, count: appQueue.length },
    { to: "/profile", label: "My profile", icon: UserCircle, count: 0 },
    ...(me?.isHod ? [{ to: "/people", label: "People & roles", icon: Users, count: 0 }] : []),
  ] as const;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <span className="px-2 py-1 font-display text-2xl font-bold text-sidebar-primary">DeptDesk</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((i) => (
                  <SidebarMenuItem key={i.to}>
                    <SidebarMenuButton asChild>
                      <Link to={i.to} activeProps={{ "data-active": true }}>
                        <i.icon /> <span>{i.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {i.count > 0 && <SidebarMenuBadge aria-label={`${i.count} waiting for you`}>{i.count}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="px-2 text-sm">
            <div className="font-medium">{me?.profile?.full_name}</div>
            <div className="mt-1 flex gap-1">{me?.roles.map((r) => <Badge key={r} variant="secondary" className="uppercase">{r}</Badge>)}</div>
          </div>
          <Button variant="ghost" className="justify-start" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="p-6"><Outlet /></main>
      </SidebarInset>
    </SidebarProvider>
  );
}
