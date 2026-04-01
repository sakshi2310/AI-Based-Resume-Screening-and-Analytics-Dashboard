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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001/api/v1').replace(/\/$/, '');

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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

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
