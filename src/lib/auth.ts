import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "student" | "faculty" | "hod";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!u.user) return null;
      const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      if (profileError) throw profileError;
      if (rolesError) throw rolesError;
      const r = (roles ?? []).map((x) => x.role as Role);
      return {
        id: u.user.id,
        email: u.user.email ?? "",
        profile,
        roles: r,
        isHod: r.includes("hod"),
        isFaculty: r.includes("faculty"),
        isStudent: r.includes("student"),
      };
    },
  });
}

export function usePeople() {
  return useQuery({
    queryKey: ["people"],
    queryFn: async () => {
      const [{ data: profiles, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profileError) throw profileError;
      if (rolesError) throw rolesError;
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Role),
      }));
    },
  });
}

export const REQUEST_TYPES = [
  "Leave application",
  "Bonafide certificate",
  "Course registration / add-drop",
  "Internship permission",
  "Thesis / dissertation submission",
  "Exam re-evaluation",
  "Other",
];

export const statusLabel: Record<string, string> = {
  pending_faculty: "Awaiting faculty",
  pending_hod: "Awaiting HOD",
  approved: "Approved",
  rejected: "Rejected",
  applied: "Applied",
  faculty_accepted: "Guide accepted",
  allocated: "Allocated",
};

export function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "approved" || s === "allocated") return "default";
  if (s === "rejected") return "destructive";
  if (s === "pending_hod" || s === "faculty_accepted") return "secondary";
  return "outline";
}
