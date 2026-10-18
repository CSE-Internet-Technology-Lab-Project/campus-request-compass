type Actor = { id: string; isFaculty: boolean; isHod: boolean };
export function canReviewRequest(request: { status: string; faculty_id: string }, actor: Actor) {
  return (request.status === "pending_faculty" && request.faculty_id === actor.id && actor.isFaculty) || (request.status === "pending_hod" && actor.isHod);
}
export function canReviewApplication(application: { status: string }, guideId: string | undefined, actor: Actor) {
  return (application.status === "applied" && guideId === actor.id && (actor.isFaculty || actor.isHod)) || (application.status === "faculty_accepted" && actor.isHod);
}
export function validProjectCapacity(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}