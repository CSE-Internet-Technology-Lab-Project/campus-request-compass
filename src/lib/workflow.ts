export type Actor = { id: string; isFaculty: boolean; isHod: boolean };

export function canReviewRequest(request: { status: string; faculty_id: string }, actor: Actor) {
  return (request.status === "pending_faculty" && request.faculty_id === actor.id && actor.isFaculty) || (request.status === "pending_hod" && actor.isHod);
}

export function canReviewApplication(application: { status: string }, guideId: string | undefined, actor: Actor) {
  return (application.status === "applied" && guideId === actor.id && (actor.isFaculty || actor.isHod)) || (application.status === "faculty_accepted" && actor.isHod);
}

export function validProjectCapacity(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

/** Mirrors withdraw_request: only the submitting student, only while pending. */
export function canWithdrawRequest(request: { status: string; student_id: string }, actorId: string) {
  return request.student_id === actorId && (request.status === "pending_faculty" || request.status === "pending_hod");
}

/** Mirrors act_on_request: a rejection must carry a reason. */
export function canSubmitDecision(approve: boolean, remarks: string) {
  return approve || remarks.trim().length > 0;
}

/** Mirrors request_changes: only the assigned faculty, while the request is waiting on them. */
export function canRequestChanges(request: { status: string; faculty_id: string }, actor: Actor) {
  return request.status === "pending_faculty" && request.faculty_id === actor.id && actor.isFaculty;
}

/** Mirrors revise_request: only the student, only a request sent back for changes. */
export function canReviseRequest(request: { status: string; student_id: string }, actorId: string) {
  return request.status === "needs_revision" && request.student_id === actorId;
}

/** Mirrors submit_milestone: the allocated student submits a pending milestone. */
export function canSubmitMilestone(milestone: { status: string }, studentId: string, actor: Actor) {
  return milestone.status === "pending" && studentId === actor.id;
}

/** Mirrors act_on_milestone: the supervisor or the HOD reviews a submitted milestone. */
export function canReviewMilestone(milestone: { status: string }, guideId: string | undefined, actor: Actor) {
  return milestone.status === "submitted" && (guideId === actor.id || actor.isHod);
}

export type StepState = "done" | "current" | "upcoming" | "failed" | "skipped";

/** Request stages: Submitted → Faculty review → HOD approval → Approved. */
export function requestSteps(status: string, reachedHod: boolean): StepState[] {
  switch (status) {
    case "pending_faculty": return ["done", "current", "upcoming", "upcoming"];
    case "needs_revision": return ["done", "current", "upcoming", "upcoming"];
    case "pending_hod": return ["done", "done", "current", "upcoming"];
    case "approved": return ["done", "done", "done", "done"];
    case "rejected": return reachedHod ? ["done", "done", "failed", "skipped"] : ["done", "failed", "skipped", "skipped"];
    case "withdrawn": return reachedHod ? ["done", "done", "skipped", "skipped"] : ["done", "skipped", "skipped", "skipped"];
    default: return ["done", "upcoming", "upcoming", "upcoming"];
  }
}

/** Application stages: Applied → Guide accepted → Allocated. */
export function applicationSteps(status: string, reachedHod: boolean): StepState[] {
  switch (status) {
    case "applied": return ["done", "current", "upcoming"];
    case "faculty_accepted": return ["done", "done", "current"];
    case "allocated": return ["done", "done", "done"];
    case "rejected": return reachedHod ? ["done", "done", "failed"] : ["done", "failed", "skipped"];
    default: return ["done", "upcoming", "upcoming"];
  }
}
