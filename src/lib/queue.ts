import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { canReviewApplication, canReviewRequest } from "@/lib/workflow";
import { useMe } from "@/lib/auth";

/** Everything the signed-in user can see, plus the items waiting on them. */
export function useWorkQueue() {
  const { data: me } = useMe();
  const query = useQuery({
    queryKey: ["queue"],
    queryFn: async () => {
      const [r, a, p, h] = await Promise.all([
        supabase.from("requests").select("id,title,status,request_type,student_id,faculty_id,created_at,needed_by").order("created_at", { ascending: false }),
        supabase.from("project_applications").select("id,status,student_id,project_id,created_at").order("created_at", { ascending: false }),
        supabase.from("projects").select("id,title,is_open,faculty_id,max_students"),
        supabase.from("request_history").select("id,request_id,actor_id,action,remarks,created_at").order("created_at", { ascending: false }).limit(8),
      ]);
      for (const res of [r, a, p, h]) if (res.error) throw res.error;
      return { reqs: r.data ?? [], apps: a.data ?? [], projects: p.data ?? [], history: h.data ?? [] };
    },
  });
  const data = query.data;
  const reqQueue = me && data ? data.reqs.filter((x) => canReviewRequest(x, me)) : [];
  const appQueue = me && data
    ? data.apps.filter((x) => canReviewApplication(x, data.projects.find((p) => p.id === x.project_id)?.faculty_id, me))
    : [];
  return { ...query, me, reqQueue, appQueue };
}
