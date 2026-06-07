export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type StudentDisplayStatus =
  | "WAITING"
  | "GENERATING"
  | "AWAITING_REVIEW"
  | "ON_WALL"
  | "SAVED_ONLY";

export type FuturePhotoStatus =
  | "SUBMITTED"
  | "GENERATING"
  | "AWAITING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SAVED_ONLY";

export type PublishStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "OFFLINE";

export interface SseClient {
  id: string;
  write: (event: string, data: JsonValue) => void;
  close: () => void;
}
