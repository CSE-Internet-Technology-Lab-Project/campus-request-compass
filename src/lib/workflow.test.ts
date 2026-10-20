import { describe, expect, it } from "vitest";
import { canReviewRequest, canReviewApplication, validProjectCapacity, canWithdrawRequest, canSubmitDecision, requestSteps } from "./workflow";
const faculty = { id: "guide", isFaculty: true, isHod: false };
const hod = { id: "head", isFaculty: false, isHod: true };
describe("Department workflow permissions", () => {
  it("allows only assigned faculty to review the faculty stage", () => {
    const request = { status: "pending_faculty", faculty_id: "guide" };
    expect(canReviewRequest(request, faculty)).toBe(true);
    expect(canReviewRequest(request, { ...faculty, id: "other" })).toBe(false);
    expect(canReviewRequest(request, { ...faculty, isFaculty: false })).toBe(false);
    expect(canReviewRequest(request, hod)).toBe(false);
  });
  it("requires HOD for final request approval", () => {
    const request = { status: "pending_hod", faculty_id: "guide" };
    expect(canReviewRequest(request, hod)).toBe(true);
    expect(canReviewRequest(request, faculty)).toBe(false);
    expect(canReviewRequest({ ...request, status: "approved" }, hod)).toBe(false);
  });
  it("requires the project guide before HOD allocation", () => {
    expect(canReviewApplication({ status: "applied" }, "guide", faculty)).toBe(true);
    expect(canReviewApplication({ status: "applied" }, "guide", hod)).toBe(false);
    expect(canReviewApplication({ status: "faculty_accepted" }, "guide", hod)).toBe(true);
    expect(canReviewApplication({ status: "faculty_accepted" }, "guide", faculty)).toBe(false);
    expect(canReviewApplication({ status: "allocated" }, "guide", hod)).toBe(false);
  });
  it("requires a positive whole-number project capacity", () => {
    expect(validProjectCapacity(1)).toBe(true);
    for (const value of [0, -1, 1.5, NaN, Infinity]) expect(validProjectCapacity(value)).toBe(false);
  });
  it("lets only the submitting student withdraw, and only while pending", () => {
    expect(canWithdrawRequest({ status: "pending_faculty", student_id: "s1" }, "s1")).toBe(true);
    expect(canWithdrawRequest({ status: "pending_hod", student_id: "s1" }, "s1")).toBe(true);
    expect(canWithdrawRequest({ status: "pending_faculty", student_id: "s1" }, "s2")).toBe(false);
    for (const status of ["approved", "rejected", "withdrawn"]) expect(canWithdrawRequest({ status, student_id: "s1" }, "s1")).toBe(false);
  });
  it("requires a reason to reject but not to approve", () => {
    expect(canSubmitDecision(false, "  ")).toBe(false);
    expect(canSubmitDecision(false, "Missing documents")).toBe(true);
    expect(canSubmitDecision(true, "")).toBe(true);
  });
  it("marks the stage where a request was rejected", () => {
    expect(requestSteps("rejected", false)[1]).toBe("failed");
    expect(requestSteps("rejected", true)[2]).toBe("failed");
    expect(requestSteps("pending_hod", true)[2]).toBe("current");
  });
});
