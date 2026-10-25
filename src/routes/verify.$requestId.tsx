import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BadgeCheck, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Verification = {
  request_type: string;
  title: string;
  student_name: string;
  program: string;
  approved_at: string;
};

export const Route = createFileRoute("/verify/$requestId")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Approval certificate — DeptDesk" },
      { name: "description", content: "Verify an approved departmental request." },
      { property: "og:title", content: "Approval certificate — DeptDesk" },
      { property: "og:description", content: "Verify an approved departmental request." },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { requestId } = Route.useParams();
  const { data, isPending } = useQuery({
    queryKey: ["verify", requestId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_verification", { _request_id: requestId }).maybeSingle();
      if (error) throw error;
      return (data ?? null) as Verification | null;
    },
  });
  const [qr, setQr] = useState("");
  useEffect(() => {
    QRCode.toDataURL(window.location.href, { margin: 1, width: 180 }).then(setQr).catch(() => setQr(""));
  }, [requestId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      {isPending && <Skeleton className="h-96 w-full max-w-lg" />}
      {!isPending && !data && (
        <Card className="max-w-lg text-center">
          <CardContent className="py-12">
            <h1 className="font-display text-2xl font-bold">No approved request found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This link is only valid for requests that received final approval. Check the link or ask the department office.
            </p>
          </CardContent>
        </Card>
      )}
      {!isPending && data && (
        <Card className="w-full max-w-lg border-2 border-primary/30 shadow-lg">
          <CardContent className="space-y-6 p-8">
            <div className="text-center">
              <BadgeCheck className="mx-auto h-12 w-12 text-success" />
              <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Department of Academic Affairs</p>
              <h1 className="mt-1 font-display text-3xl font-bold">Sanction Verified</h1>
              <p className="mt-1 text-xs text-muted-foreground">Digitally approved through DeptDesk</p>
            </div>
            <dl className="space-y-3 border-y py-4 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Student</dt><dd className="text-right font-medium">{data.student_name}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Program</dt><dd className="font-medium">{data.program}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Request type</dt><dd className="font-medium">{data.request_type}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Title</dt><dd className="text-right font-medium">{data.title}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Approved on</dt><dd className="font-medium">{new Date(data.approved_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</dd></div>
            </dl>
            <div className="flex items-center justify-between gap-4">
              {qr
                ? <img src={qr} alt="QR code linking to this verification page" className="h-28 w-28 rounded border bg-white p-1" />
                : <div className="h-28 w-28 animate-pulse rounded border bg-muted" />}
              <p className="max-w-48 text-right text-xs text-muted-foreground">Scan to re-verify. This page is public and read-only.</p>
            </div>
            <Button className="w-full print:hidden" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print or save as PDF</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
