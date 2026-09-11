"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Mail, Lock, ArrowRight, AlertCircle, MailCheck, CheckCircle2, Home, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

type PasswordNotice = { kind: "changed" | "confirmFailed"; text: string } | null;

const NOTICE_TEXTS: Record<"changed" | "confirmFailed", string> = {
  changed: "Your password was changed successfully. Sign in with your new password.",
  confirmFailed: "That confirmation link is invalid or expired. Please try changing your password again.",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [notice, setNotice] = useState<PasswordNotice>(null);
  const { setUser } = useAuth();
  const router = useRouter();

  // Read the change-password result from the URL after the email link is
  // clicked. Adjusted during render (not in an effect) per React guidance —
  // window is only available on the client, so this runs post-hydration.
  if (notice === null && typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const kind =
      params.get("password") === "changed"
        ? ("changed" as const)
        : params.get("password_confirm") === "failed"
          ? ("confirmFailed" as const)
          : null;
    if (kind) setNotice({ kind, text: NOTICE_TEXTS[kind] });
  }

  const handleResend = async () => {
    setResendMessage("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      const data = await res.json();
      setResendMessage(data.message || data.error || "Done.");
    } catch {
      setResendMessage("Something went wrong. Please try again.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setResendMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include", // Include cookies
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "EMAIL_NOT_VERIFIED") {
          setNeedsVerification(true);
        }
        setError(data.error || "Login failed");
        return;
      }

      // Update auth context
      setUser(data.user);
      // Redirect to home
      router.push("/");
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" title="Back to home" className="inline-block transition hover:opacity-90">
            <Logo className="h-14 w-14" />
          </Link>
          <h1 className="mt-6 text-3xl font-bold">Welcome Back</h1>
          <p className="mt-2 text-sm text-secondary">Sign in to your account</p>
        </div>

        {/* Change-password result notice */}
        {notice && (
          <div
            className={`mb-6 flex items-center gap-3 rounded-lg border p-4 ${
              notice.kind === "changed"
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-red-500/30 bg-red-500/10"
            }`}
          >
            {notice.kind === "changed" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            )}
            <span
              className={`text-sm ${
                notice.kind === "changed" ? "text-emerald-300" : "text-red-200"
              }`}
            >
              {notice.text}
            </span>
          </div>
        )}

        {/* Verify-email banner */}
        {needsVerification && (
          <div className="mb-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
            <div className="flex items-center gap-3">
              <MailCheck className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm text-primary">
                Your email isn&apos;t verified yet.
              </span>
            </div>
            {resendMessage ? (
              <p className="mt-3 text-xs text-emerald-400">{resendMessage}</p>
            ) : (
              <button
                onClick={handleResend}
                className="mt-3 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
              >
                Resend verification email
              </button>
            )}
            <p className="mt-3 text-xs text-secondary/80">
              Can&apos;t find it? Check your spam or promotions folder — it can
              take a few minutes.
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-sm text-red-200">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-zinc-900 border border-border rounded-lg pl-12 pr-4 py-3 text-white placeholder-secondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-900 border border-border rounded-lg pl-12 pr-12 py-3 text-white placeholder-secondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary transition hover:text-white"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
          >
            {isLoading ? "Signing in..." : "Sign in"}
            {!isLoading && <ArrowRight className="h-5 w-5" />}
          </button>
        </form>

        {/* Note */}
        <div className="mt-6 rounded-lg border border-border bg-zinc-900/50 p-4 text-center">
          <p className="text-xs text-secondary">
            New fans must verify their email before signing in.
          </p>
        </div>

        {/* Sign Up Link */}
        <div className="mt-6 text-center text-sm">
          <span className="text-secondary">Don&apos;t have an account? </span>
          <Link
            href="/auth/signup"
            className="font-medium text-primary hover:underline transition"
          >
            Sign up
          </Link>
        </div>

        {/* Back to Home */}
        <div className="mt-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-secondary transition hover:text-white"
          >
            <Home className="h-3.5 w-3.5" /> Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
