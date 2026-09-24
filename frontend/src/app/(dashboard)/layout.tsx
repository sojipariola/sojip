"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, initialized, loadUser } = useAuthStore();

  useEffect(() => {
    if (!initialized) {
      loadUser();
    }
  }, [initialized, loadUser]);

  useEffect(() => {
    if (initialized && !user) {
      router.push("/login");
    }
  }, [initialized, user, router]);

  if (!initialized || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-offwhite">
        <div className="w-6 h-6 border-2 border-terracotta-500/30 border-t-terracotta-500 rounded-full animate-spin" />
      </div>
    );
  }

  return <div className="min-h-screen bg-offwhite">{children}</div>;
}
