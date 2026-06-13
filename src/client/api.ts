import type {
  CreateOpportunityInput,
  DashboardPayload,
  Opportunity,
  UpdateOpportunityInput,
  User
} from "../shared/types";

const apiBase = import.meta.env.VITE_API_BASE ?? "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      // Keep the default message if the API did not return JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  login(email: string, password: string) {
    return request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },
  register(name: string, email: string, password: string) {
    return request<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password })
    });
  },
  logout() {
    return request<void>("/api/auth/logout", { method: "POST" });
  },
  me() {
    return request<{ user: User }>("/api/auth/me");
  },
  dashboard(filters: { query?: string; status?: string }) {
    const params = new URLSearchParams();
    if (filters.query) params.set("query", filters.query);
    if (filters.status) params.set("status", filters.status);
    return request<DashboardPayload>(`/api/dashboard${params.size ? `?${params.toString()}` : ""}`);
  },
  createOpportunity(input: CreateOpportunityInput) {
    return request<{ opportunity: Opportunity }>("/api/opportunities", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  updateOpportunity(id: string, input: UpdateOpportunityInput) {
    return request<{ opportunity: Opportunity }>(`/api/opportunities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  }
};

