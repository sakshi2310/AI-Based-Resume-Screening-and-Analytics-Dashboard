/**
 * lib/api.ts
 * ==========
 * Added AiScoreData interface and ai_score / ai_explanation fields
 * to ResumeRecord. Everything else unchanged.
 */

export type AppRole = "admin" | "recruiter" | "viewer";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  employment_type: string;
  work_mode: string;
  experience_level: string;
  min_experience_years: number;
  max_experience_years: number | null;
  openings: number;
  salary_range: string | null;
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  qualifications: string[];
  benefits: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface JobPayload {
  title: string;
  department: string;
  location: string;
  employment_type: string;
  work_mode: string;
  experience_level: string;
  min_experience_years: number;
  max_experience_years: number | null;
  openings: number;
  salary_range: string | null;
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  qualifications: string[];
  benefits: string[];
  is_active: boolean;
}

export type CandidateStatus = "New" | "Under Review" | "Shortlisted" | "Rejected" | "Interviewed";

/** AI scoring breakdown returned by backend — output of ai_scorer.compute_ai_score() */
export interface AiScoreData {
  final_score:      number;
  skill_score:      number;
  experience_score: number;
  education_score:  number;
  profile_score:    number;
  matched_skills:   string[];
  missing_skills:   string[];

  breakdown:        string;
  method:           string; // always "semantic_ai"
}

export interface ResumeRecord {
  id: string;
  original_filename: string;
  stored_filename: string;
  file_url: string;
  file_size_bytes: number;
  mime_type: string;
  job_id: string | null;
  job_title: string | null;
  uploaded_by: string;
  uploaded_at: string;
  parse_status: "success" | "failed" | "pending";
  parse_error: string | null;
  candidate_status: CandidateStatus;
  predicted_score: number | null;
  parsed_data: {
    name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    skills: string[];
    education: string[];
    projects: string[];
    experience_years: number | null;
    experience_text: string | null;
    summary: string | null;
    raw_text_excerpt: string | null;
  } | null;
  ai_score: AiScoreData | null;       // AI scoring breakdown from backend
  ai_explanation: string | null;      // Gemini recruiter insight
}

export function getResumeFinalScore(resume: ResumeRecord): number {
  if (resume.ai_score?.final_score != null) return resume.ai_score.final_score;
  if (resume.predicted_score != null) return resume.predicted_score * 100;
  return 0;
}

const DEFAULT_API_PORT = "8000";
const REQUEST_TIMEOUT_MS = 15000;

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function normalizeApiBaseUrl(value: string): string {
  return stripTrailingSlash(value.trim().replace(/\/+api\/v1\/?$/, "/api/v1"));
}

function getCandidateApiBaseUrls(): string[] {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  const candidates = new Set<string>();

  if (configured) {
    candidates.add(normalizeApiBaseUrl(configured));
  }

  if (typeof window !== "undefined") {
    candidates.add("/api/v1");

    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    const hostname = window.location.hostname;
    const preferredHostnames = [hostname, "127.0.0.1", "localhost"];

    preferredHostnames
      .filter(Boolean)
      .forEach((host) => candidates.add(`${protocol}//${host}:${DEFAULT_API_PORT}/api/v1`));

    if (hostname === "::1" || hostname === "[::1]") {
      candidates.add(`${protocol}://[::1]:${DEFAULT_API_PORT}/api/v1`);
    }
  }

  candidates.add(`http://127.0.0.1:${DEFAULT_API_PORT}/api/v1`);
  candidates.add(`http://localhost:${DEFAULT_API_PORT}/api/v1`);
  candidates.add(`http://[::1]:${DEFAULT_API_PORT}/api/v1`);

  return Array.from(candidates);
}

let resolvedApiBaseUrl: string | null = null;
let resolvingApiBaseUrlPromise: Promise<string> | null = null;

async function resolveApiBaseUrl(): Promise<string> {
  if (resolvedApiBaseUrl) return resolvedApiBaseUrl;
  if (resolvingApiBaseUrlPromise) return resolvingApiBaseUrlPromise;

  resolvingApiBaseUrlPromise = (async () => {
    const candidates = getCandidateApiBaseUrls();

    for (const candidate of candidates) {
      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 2500);
        const response = await fetch(`${candidate}/health`, {
          method: "GET",
          signal: controller.signal,
        });
        window.clearTimeout(timeoutId);

        if (response.ok) {
          resolvedApiBaseUrl = candidate;
          return candidate;
        }
      } catch {
        // Try the next candidate base URL.
      }
    }

    resolvedApiBaseUrl = candidates[0];
    return resolvedApiBaseUrl;
  })();

  try {
    return await resolvingApiBaseUrlPromise;
  } finally {
    resolvingApiBaseUrlPromise = null;
  }
}

function getApiOrigin(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/api\/v1$/, "");
}

function extractErrorMessage(detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const r = item as Record<string, unknown>;
        const path  = Array.isArray(r.loc) ? r.loc.slice(1).join(".") : "";
        const label = path ? `${path}: ` : "";
        const msg   = typeof r.msg === "string" ? r.msg : "";
        return `${label}${msg}`.trim();
      }
      return "";
    }).filter(Boolean);
    if (messages.length) return messages.join(", ");
  }
  if (detail && typeof detail === "object") {
    const r = detail as Record<string, unknown>;
    if (typeof r.message === "string" && r.message.trim()) return r.message;
    if (typeof r.error   === "string" && r.error.trim())   return r.error;
  }
  return "Request failed";
}

async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const apiBaseUrl = await resolveApiBaseUrl();
  const controller = new AbortController();
  const timeoutId  = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(!isFormData ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw new Error("Request timed out. Please ensure backend is running on the configured API URL.");
    throw new Error("Unable to reach backend API. Please check backend server and API base URL.");
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let message = "Request failed";
    try { const p = await response.json(); message = extractErrorMessage(p.detail); }
    catch { message = response.statusText || message; }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function registerUser(payload: { email: string; full_name: string; password: string; role?: AppRole }): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ ...payload, role: payload.role || "recruiter" }) });
}

export async function loginUser(payload: { email: string; password: string }): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(payload) });
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/me", {}, token);
}

export async function getAllUsers(token: string): Promise<AuthUser[]> {
  return apiRequest<AuthUser[]>("/auth/users", {}, token);
}

export async function updateUserRole(token: string, userId: string, role: AppRole): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/auth/users/${userId}/role?role=${role}`, { method: "PATCH" }, token);
}

export async function getJobs(token: string): Promise<Job[]> {
  return apiRequest<Job[]>("/jobs", {}, token);
}

export async function createJob(token: string, payload: JobPayload): Promise<Job> {
  return apiRequest<Job>("/jobs", { method: "POST", body: JSON.stringify(payload) }, token);
}

export async function updateJob(token: string, jobId: string, payload: Partial<JobPayload>): Promise<Job> {
  return apiRequest<Job>(`/jobs/${jobId}`, { method: "PUT", body: JSON.stringify(payload) }, token);
}

export async function updateJobStatus(token: string, jobId: string, isActive: boolean): Promise<Job> {
  return apiRequest<Job>(`/jobs/${jobId}/status`, { method: "PATCH", body: JSON.stringify({ is_active: isActive }) }, token);
}

export async function deleteJob(token: string, jobId: string): Promise<void> {
  await apiRequest<void>(`/jobs/${jobId}`, { method: "DELETE" }, token);
}

function buildQueryString(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) sp.set(k, v); });
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export async function getResumes(token: string, options?: { search?: string; status?: CandidateStatus; job_id?: string }): Promise<ResumeRecord[]> {
  const qs = buildQueryString({ search: options?.search, status: options?.status, job_id: options?.job_id });
  return apiRequest<ResumeRecord[]>(`/resumes${qs}`, {}, token);
}

export async function uploadResumes(token: string, files: File[], jobId?: string): Promise<ResumeRecord[]> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  if (jobId) formData.append("job_id", jobId);
  return apiRequest<ResumeRecord[]>("/resumes/upload", { method: "POST", body: formData }, token);
}

export async function updateResumeStatus(token: string, resumeId: string, candidateStatus: CandidateStatus): Promise<ResumeRecord> {
  return apiRequest<ResumeRecord>(`/resumes/${resumeId}/status`, { method: "PATCH", body: JSON.stringify({ candidate_status: candidateStatus }) }, token);
}

export async function deleteResume(token: string, resumeId: string): Promise<void> {
  await apiRequest<void>(`/resumes/${resumeId}`, { method: "DELETE" }, token);
}

export function buildResumeUrl(filePath: string): string {
  const apiBaseUrl = resolvedApiBaseUrl ?? getCandidateApiBaseUrls()[0];
  return `${getApiOrigin(apiBaseUrl)}${filePath}`;
}
