"use client";

import { create } from "zustand";
import { apiFetch, clearToken, getToken, setToken } from "@/lib/api-client";

export type User = {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: string;
  skill_tier: string;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  login: (tenantSlug: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  login: async (tenantSlug, email, password) => {
    set({ loading: true });
    try {
      const res = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: { tenant_slug: tenantSlug, email, password },
      });
      setToken(res.access_token);
      const user = await apiFetch<User>("/auth/me");
      set({ user, loading: false, initialized: true });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  logout: () => {
    clearToken();
    set({ user: null, initialized: true });
  },

  loadUser: async () => {
    if (!getToken()) {
      set({ user: null, initialized: true });
      return;
    }
    try {
      const user = await apiFetch<User>("/auth/me");
      set({ user, initialized: true });
    } catch {
      clearToken();
      set({ user: null, initialized: true });
    }
  },
}));
