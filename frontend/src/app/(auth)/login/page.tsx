"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { SOJIPButton as Button } from "@/components/ui/SOJIPButton";
import { SOJIPInput as Input } from "@/components/ui/SOJIPInput";
import { ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { login, loading, user, initialized } = useAuthStore();

  const [tenantSlug, setTenantSlug] = useState("alpha");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect
  useEffect(() => {
    if (initialized && user) {
      router.push("/dashboard");
    }
  }, [initialized, user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(tenantSlug, email, password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="inline-flex items-baseline gap-1 mb-6">
          <span className="text-2xl font-bold tracking-tight">
            SOJIP<span className="text-terracotta-500">.</span>
          </span>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Sign in to continue your journey.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Institution"
          name="tenant_slug"
          placeholder="alpha"
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          autoComplete="organization"
          required
        />

        <Input
          label="Email"
          name="email"
          type="email"
          placeholder="you@institution.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <div className="relative">
          <Input
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600 transition"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>

      {/* Footer links */}
      <div className="mt-6 flex items-center justify-between text-sm">
        <Link
          href="/register"
          className="text-terracotta-600 hover:text-terracotta-700 font-medium"
        >
          Create account
        </Link>
        <Link
          href="/forgot-password"
          className="text-slate-500 hover:text-slate-700"
        >
          Forgot password?
        </Link>
      </div>

      {/* Demo hint */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">
            Demo credentials
          </p>
          <div className="space-y-1 text-xs font-mono text-slate-500">
            <div>alpha / teacher@alpha.edu / password123</div>
            <div>beta / innovator@beta.io / password123</div>
          </div>
        </div>
      )}
    </div>
  );
}
