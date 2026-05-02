export interface MatchPatterns {
  senders?: string[];
  subjectKeywords?: string[];
  sinceDate?: string; // ISO YYYY-MM-DD; emails before this are skipped
}

export interface Course {
  id: string;
  name: string;
  code: string;
  instructor: string;
  credits: number;
  order?: number;
  matchPatterns?: MatchPatterns;
}

export interface Notice {
  id: string;
  courseId: string;
  source: "gmail" | "paste" | "upload";
  externalId?: string;
  filename?: string;
  from?: string;
  subject?: string;
  date?: string;
  rawText: string;
  createdAt: string;
}

export interface SavedNotice {
  id: string;
  courseId: string;
  title: string;
  body: string;
  savedAt: string;
}

export interface Exam {
  id: string;
  courseId: string;
  type: string;
  title: string;
  date: string;
  syllabus: string;
}

export interface EvalComponent {
  id: string;
  courseId: string;
  name: string;
  weightage: number;
  maxMarks: number | null;
  obtained: number | null;
}

export interface Resource {
  id: string;
  courseId: string;
  title: string;
  type: "link" | "file";
  url: string;
  fileType: string | null;
  folder?: string;
  order?: number;
  isPYQ?: boolean;
  isSolution?: boolean;
  solutionStatus?: "included" | "separate" | "unavailable";
  solutionId?: string;
}

export interface ResourceFolder {
  courseId: string;
  name: string;
}

export interface Handout {
  id: string;
  courseId: string;
  filename: string;
  displayName: string;
  path: string;
}

export interface Deadline {
  id: string;
  courseId: string;
  title: string;
  date: string;
  type: "assignment" | "project" | "report" | "other";
  done: boolean;
}
