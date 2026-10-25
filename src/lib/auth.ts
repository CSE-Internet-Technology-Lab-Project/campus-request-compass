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
  withdrawn: "Withdrawn",
  applied: "Awaiting guide",
  faculty_accepted: "Awaiting HOD",
  allocated: "Allocated",
};

export const actionLabel: Record<string, string> = {
  submitted: "Submitted the request",
  faculty_approved: "Faculty approved and forwarded to HOD",
  faculty_rejected: "Faculty rejected",
  hod_approved: "HOD gave final approval",
  hod_rejected: "HOD rejected",
  withdrawn: "Student withdrew the request",
};

export function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "approved" || s === "allocated") return "default";
  if (s === "rejected") return "destructive";
  if (s === "pending_hod" || s === "faculty_accepted") return "secondary";
  return "outline";
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  const units: [number, string][] = [[60, "minute"], [3600, "hour"], [86400, "day"], [604800, "week"], [2592000, "month"]];
  let label = "";
  for (let i = units.length - 1; i >= 0; i--) {
    const [secs, name] = units[i]!;
    if (diff >= secs) { const n = Math.floor(diff / secs); label = `${n} ${name}${n > 1 ? "s" : ""} ago`; break; }
  }
  return label;
}

export function initials(name?: string | null) {
  return (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}
