import { Check, X, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StepState } from "@/lib/workflow";

const dot: Record<StepState, string> = {
  done: "border-success bg-success text-success-foreground",
  current: "border-primary bg-background text-primary ring-4 ring-primary/15",
  upcoming: "border-border bg-background text-muted-foreground",
  failed: "border-destructive bg-destructive text-destructive-foreground",
  skipped: "border-border bg-muted text-muted-foreground",
};

/** Horizontal stage tracker for a workflow item. */
export function WorkflowSteps({ labels, states, compact = false }: { labels: string[]; states: StepState[]; compact?: boolean }) {
  return (
    <ol className="flex w-full items-start" aria-label="Workflow progress">
      {labels.map((label, i) => {
        const s = states[i] ?? "upcoming";
        const last = i === labels.length - 1;
        return (
          <li key={label} className={cn("relative flex flex-1 flex-col items-center text-center", last && "flex-none")} aria-current={s === "current" ? "step" : undefined}>
            {!last && (
              <span className={cn("absolute top-3 left-1/2 h-0.5 w-full", s === "done" ? "bg-success" : "bg-border")} aria-hidden />
            )}
            <span className={cn("relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold", dot[s])}>
              {s === "done" ? <Check className="h-3.5 w-3.5" /> : s === "failed" ? <X className="h-3.5 w-3.5" /> : s === "skipped" ? <Minus className="h-3 w-3" /> : i + 1}
            </span>
            {!compact && (
              <span className={cn("mt-1.5 max-w-24 text-xs leading-tight", s === "current" ? "font-semibold text-foreground" : s === "failed" ? "font-semibold text-destructive" : "text-muted-foreground")}>
                {label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export const REQUEST_STEP_LABELS = ["Submitted", "Faculty review", "HOD approval", "Approved"];
export const APPLICATION_STEP_LABELS = ["Applied", "Guide review", "HOD allocation"];
