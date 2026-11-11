export const statuses = ["Unattempted", "Completed", "Incomplete", "Canceled"] as const;
export const directions = ["Upstream", "Downstream"] as const;

export type Project = { id: number; organizationId: string; number: string; name: string };
export type Segment = {
  id: number; projectId: number; number: string; inspectionStatusType: number;
  notes: string; startingLongitudeLatitude: string; endingLongitudeLatitude: string;
};
export type Manhole = {
  id: number; projectId: number; manholeId: string; inspectionStatusType: number; inspectedDate: string;
};
type HistoryEntry = { id: number; userId: string; dateTime: string; notes: string };
export type SegmentRecord = HistoryEntry & { segmentId: number; inspectedLength: string; directionType: number };
export type ManholeRecord = HistoryEntry & { manholeId: number; inspectionStatusType: number };
export type Jetting = HistoryEntry & { segmentId: number; numberOfTimesJetted: number; lengthJetted: string };
export type User = { id: string; email: string };
export type Organization = { id: string; name: string };
export type ProjectPage = { items: Project[]; page: number; hasMore: boolean };
