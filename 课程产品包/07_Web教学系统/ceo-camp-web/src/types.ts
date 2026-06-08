export interface Camp {
  id: string;
  name: string;
  city: string;
  location: string;
  current_day: number;
  current_module_id: string;
  active_task?: Activity | null;
}

export interface LessonPage {
  id: string;
  module_id: string;
  page_no: number;
  title: string;
  page_type: string;
  activity_buttons: string[];
  content_summary?: string;
}

export interface CourseModule {
  id: string;
  day: number;
  sequence: number;
  title: string;
  subtitle?: string;
  time_range?: string;
  status: string;
  pages: LessonPage[];
}

export interface Student {
  id: string;
  student_no?: string;
  nickname: string;
  age?: number;
  team_id?: string;
  team_name?: string;
  checkin_status?: string;
  photo_authorization: string;
  projection_consent: boolean;
  public_showcase_consent: boolean;
  display_status: "WAITING" | "GENERATING" | "AWAITING_REVIEW" | "ON_WALL" | "SAVED_ONLY";
  username?: string;
  account_status?: "ACTIVE" | "DISABLED";
  last_login_at?: string | null;
  future_photo?: {
    id: string;
    career_text: string;
    status: string;
    result_photo_key?: string | null;
    result_photo_url?: string | null;
  } | null;
}

export interface StudentAccount extends Student {
  username: string;
  account_status: "ACTIVE" | "DISABLED";
}

export interface Team {
  id: string;
  group_no: number;
  name: string;
  table_no?: string;
  roles: Record<string, string>;
  project_status: string;
  showcase_status: string;
}

export interface TeacherAccount {
  id: string;
  username: string;
  display_name: string;
  role: string;
}

export interface FuturePhotoSubmission {
  id: string;
  student_id?: string;
  student_name: string;
  career_text: string;
  career_source: string;
  source_photo_key?: string;
  voice_key?: string;
  result_photo_key?: string;
  status: "SUBMITTED" | "GENERATING" | "AWAITING_REVIEW" | "APPROVED" | "REJECTED" | "SAVED_ONLY";
  review_note?: string;
  created_at: string;
  updated_at: string;
}

export interface ShowcaseItem {
  id: string;
  team_id?: string | null;
  team_name?: string | null;
  product_name: string;
  track?: string | null;
  one_liner?: string | null;
  access_url?: string | null;
  screenshot_key?: string | null;
  screenshot_url?: string | null;
  publish_status: "DRAFT" | "PUBLISHED" | string;
  created_at?: string;
  updated_at?: string;
}

export interface AwardResult {
  id: string;
  award_type: string;
  winner_type: string;
  winner_id?: string | null;
  winner_name: string;
  reason?: string | null;
  publish_status: "DRAFT" | "PUBLISHED" | string;
  created_at?: string;
  updated_at?: string;
}

export type ScoreDimension =
  | "user_realness"
  | "mvp_completion"
  | "ai_collaboration"
  | "story_expression"
  | "team_pitch";

export interface ScoreSummary {
  key: string;
  showcase_item_id?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  product_name: string;
  access_url?: string | null;
  score_count: number;
  average_total: number;
  scores: Record<ScoreDimension, number>;
  highlights: string[];
  next_steps: string[];
}

export interface ObserverScoreBrief {
  camp: Pick<Camp, "id" | "name" | "city" | "location"> & { starts_on?: string; ends_on?: string };
  showcase_items: ShowcaseItem[];
}

export interface TaskSubmission {
  id: string;
  student_id?: string | null;
  student_name?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  task_type: string;
  title: string;
  payload: Record<string, unknown>;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface WallArtifact extends TaskSubmission {
  task_type: "problem_card" | "user_voice" | string;
}

export interface Activity {
  id: string;
  module_id?: string | null;
  title: string;
  activity_type: string;
  status: string;
  payload: Record<string, unknown>;
}

export interface UploadTarget {
  provider: "mock" | "cos" | "local";
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
  note?: string;
}

export interface SourcePhoto {
  object_key: string;
  updated_at: string;
}

export interface StatePayload {
  camp: Camp;
  wall: Student[];
  showcase_items?: ShowcaseItem[];
  wall_artifacts?: WallArtifact[];
  growth_reflections?: WallArtifact[];
  project_journey?: WallArtifact[];
  award_results?: AwardResult[];
  score_summaries?: ScoreSummary[];
}
