export type AppRole = 'admin' | 'recruiter' | 'viewer';

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
  parsed_data: {
    name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    skills: string[];
    education: string[];
    experience_years: number | null;
    summary: string | null;
    raw_text_excerpt: string | null;
  } | null;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/, '');
const REQUEST_TIMEOUT_MS = 15000;

function extractErrorMessage(detail: unknown): string {
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>;
          const fieldPath = Array.isArray(record.loc) ? record.loc.slice(1).join('.') : '';
          const fieldLabel = fieldPath ? `${fieldPath}: ` : '';
          const message = typeof record.msg === 'string' ? record.msg : '';
          return `${fieldLabel}${message}`.trim();
        }
        return '';
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(', ');
    }
  }

  if (detail && typeof detail === 'object') {
    const record = detail as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error;
    }
  }

  return 'Request failed';
}

async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out. Please ensure backend is running on the configured API URL.');
    }
    throw new Error('Unable to reach backend API. Please check backend server and API base URL.');
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const payload = await response.json();
      message = extractErrorMessage(payload.detail);
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function registerUser(payload: {
  email: string;
  full_name: string;
  password: string;
  role?: AppRole;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      role: payload.role || 'recruiter',
    }),
  });
}

export async function loginUser(payload: { email: string; password: string }): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  return apiRequest<AuthUser>('/auth/me', {}, token);
}

export async function getAllUsers(token: string): Promise<AuthUser[]> {
  return apiRequest<AuthUser[]>('/auth/users', {}, token);
}

export async function updateUserRole(token: string, userId: string, role: AppRole): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/auth/users/${userId}/role?role=${role}`, {
    method: 'PATCH',
  }, token);
}

export async function getJobs(token: string): Promise<Job[]> {
  return apiRequest<Job[]>('/jobs', {}, token);
}

export async function createJob(token: string, payload: JobPayload): Promise<Job> {
  return apiRequest<Job>('/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
}

export async function updateJob(token: string, jobId: string, payload: Partial<JobPayload>): Promise<Job> {
  return apiRequest<Job>(`/jobs/${jobId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);
}

export async function updateJobStatus(token: string, jobId: string, isActive: boolean): Promise<Job> {
  return apiRequest<Job>(`/jobs/${jobId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive }),
  }, token);
}

export async function deleteJob(token: string, jobId: string): Promise<void> {
  await apiRequest<void>(`/jobs/${jobId}`, {
    method: 'DELETE',
  }, token);
}

export async function getResumes(token: string): Promise<ResumeRecord[]> {
  return apiRequest<ResumeRecord[]>('/resumes', {}, token);
}

export async function uploadResumes(token: string, files: File[], jobId?: string): Promise<ResumeRecord[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  if (jobId) {
    formData.append('job_id', jobId);
  }

  return apiRequest<ResumeRecord[]>(
    '/resumes/upload',
    {
      method: 'POST',
      body: formData,
    },
    token,
  );
}

export async function deleteResume(token: string, resumeId: string): Promise<void> {
  await apiRequest<void>(`/resumes/${resumeId}`, { method: 'DELETE' }, token);
}

export function buildResumeUrl(filePath: string): string {
  return `${API_ORIGIN}${filePath}`;
}
