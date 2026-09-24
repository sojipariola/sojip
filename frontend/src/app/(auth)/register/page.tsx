"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { SOJIPButton as Button } from "@/components/ui/SOJIPButton";
import { SOJIPInput as Input } from "@/components/ui/SOJIPInput";
import { ApiError, apiFetch } from "@/lib/api-client";
import { useAuthStore } from "@/store/authStore";

type UserRead = {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: string;
  skill_tier: string;
};

const ROLES = [
  { value: "student", label: "Student" },
  { value: "innovator", label: "Innovator" },
  { value: "teacher", label: "Teacher" },
] as const;

const SKILL_TIERS = [
  { value: "beginner", label: "Beginner — new to building" },
  { value: "intermediate", label: "Intermediate — some experience" },
  { value: "advanced", label: "Advanced — comfortable shipping" },
  { value: "expert", label: "Expert" },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const { user, initialized, login } = useAuthStore();

  const [tenantSlug, setTenantSlug] = useState("alpha");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]["value"]>("student");
  const [skillTier, setSkillTier] =
    useState<(typeof SKILL_TIERS)[number]["value"]>("beginner");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, skip registration
  useEffect(() => {
    if (initialized && user) {
      router.push("/dashboard");
    }
  }, [initialized, user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch<UserRead>("/auth/register", {
        method: "POST",
        body: {
          tenant_slug: tenantSlug,
          email,
          full_name: fullName.trim(),
          password,
          role,
          skill_tier: skillTier,
        },
      });

      // Auto-login after successful registration
      await login(tenantSlug, email, password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setLoading(false);
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
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          You'll join your institution's workspace and start your first project.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Institution code"
          name="tenant_slug"
          placeholder="e.g. alpha"
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          autoComplete="organization"
          required
        />

        <Input
          label="Full name"
          name="full_name"
          placeholder="Ada Lovelace"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
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
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
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

        <div className="space-y-1.5">
          <label
            htmlFor="role"
            className="block text-sm font-medium text-slate-700"
          >
            I am a…
          </label>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={
                  "px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition " +
                  (role === r.value
                    ? "border-terracotta-500 bg-terracotta-50 text-terracotta-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="skill_tier"
            className="block text-sm font-medium text-slate-700"
          >
            Experience level
          </label>
          <select
            id="skill_tier"
            value={skillTier}
            onChange={(e) =>
              setSkillTier(e.target.value as typeof skillTier)
            }
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-terracotta-500/40 focus:border-terracotta-500 transition"
          >
            {SKILL_TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
      </form>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between text-sm">
        <Link
          href="/login"
          className="text-terracotta-600 hover:text-terracotta-700 font-medium"
        >
          I already have an account
        </Link>
        <Link
          href="/pricing"
          className="text-slate-500 hover:text-slate-700"
        >
          See plans
        </Link>
      </div>

      {/* Demo hint */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">
            Dev hint
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            The <code className="font-mono">alpha</code> institution is
            pre-seeded. Register with any email at{" "}
            <code className="font-mono">@alpha.edu</code> to join it.
          </p>
        </div>
      )}
    </div>
  );
}
