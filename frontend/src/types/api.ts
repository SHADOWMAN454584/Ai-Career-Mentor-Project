export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface RoleScore {
  role_name: string;
  match_score: number;
  contributing_skills: string[];
}

export interface SkillGap {
  skill: string;
  closest_match: string | null;
  similarity: number;
  importance: number;
  explanation: string;
}

export interface CourseRecommendation {
  name: string;
  platform: string;
  link: string;
  relevance_score?: number;
}

export interface CourseGroup {
  skill_gap: string;
  recommendations: CourseRecommendation[];
}

export interface RoadmapTask {
  task_id: string;
  title: string;
  completed: boolean;
}

export interface RoadmapWeek {
  week_number: number;
  focus_skills: string[];
  tasks: RoadmapTask[];
}

export interface AnalysisResult {
  role_scores: RoleScore[];
  skill_gaps: SkillGap[];
  courses: CourseGroup[];
  placement_probability: number;
  shap_factors: Record<string, unknown>[];
  roadmap: RoadmapWeek[];
  model_version: string;
  disclaimer: string;
  target_role?: string | null;
}

export interface AnalysisJobStatus {
  id: string;
  status: string;
  target_role: string;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  result?: AnalysisResult;
}

export interface DashboardProgress {
  placement_probability: number;
  role_scores: RoleScore[];
  skill_radar: { skill: string; value: number }[];
  roadmap_completion: number;
  history: { date: string; placement_probability: number }[];
  result?: AnalysisResult;
}

export interface InterviewQuestion {
  category: string;
  question: string;
}

export interface InterviewSession {
  id: string;
  role_name: string;
  questions: InterviewQuestion[];
  provider: string;
  scoring_note: string;
}

export interface InterviewAnswerResult {
  score: number;
  note: string;
}
