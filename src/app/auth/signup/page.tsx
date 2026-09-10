"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Mail, Lock, ArrowRight, AlertCircle, UserCheck, Home, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [waitSeconds, setWaitSeconds] = useState(0);
  const { setUser } = useAuth();
  const router = useRouter();

  // Countdown while the confirmation-email cooldown is active.
  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setInterval(
      () => setWaitSeconds((s) => Math.max(0, s - 1)),
      1000
    );
    return () => clearInterval(timer);
  }, [waitSeconds]);

  const passwordsMatch = password && confirmPassword && password === confirmPassword;

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
    setIsLoading(true);

    try {
      const body: Record<string, unknown> = {
        email,
        password,
        confirmPassword,
        username,
        role: "fan",
      };

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Signup failed");
        if (data.rateLimited && data.retryAfterMs) {
          setWaitSeconds(Math.ceil(data.retryAfterMs / 1000));
        }
        return;
      }

      if (data.requiresVerification) {
        // Email confirmation required — show the "check your inbox" state
        setVerificationSent(true);
        return;
      }

      // Project has confirmation disabled — logged in straight away
      setUser(data.user);
      router.push("/");
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error("Signup error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── "Check your inbox" confirmation panel ──
  if (verificationSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-border bg-zinc-900/60 p-8 text-center">
          <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Confirm your email</h1>
          <p className="mt-3 text-sm text-secondary">
            We sent a verification link to{" "}
            <span className="font-semibold text-white">{email}</span>.
            Click it to activate your account.
          </p>
          {resendMessage && (
            <p className="mt-3 text-xs text-emerald-400">{resendMessage}</p>
          )}
          <button
            onClick={handleResend}
            className="mt-6 w-full rounded-lg border border-primary/40 bg-primary/10 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/20"
          >
            Resend verification email
          </button>
          <Link
            href="/auth/login"
            className="mt-4 block text-sm text-secondary hover:text-white"
          >
            Back to sign in
          </Link>
          <Link
            href="/"
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-secondary transition hover:text-white"
          >
            <Home className="h-3.5 w-3.5" /> Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" title="Back to home" className="inline-block transition hover:opacity-90">
            <Logo className="h-14 w-14" />
          </Link>
          <h1 className="mt-6 text-3xl font-bold">Join the community</h1>
          <p className="mt-2 text-sm text-secondary">Create an account to get started</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-sm text-red-200">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium mb-2">Username</label>
            <div className="relative">
              <UserCheck className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full bg-zinc-900 border border-border rounded-lg pl-12 pr-4 py-3 text-white placeholder-secondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition"
                disabled={isLoading}
              />
            </div>
          </div>

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
                placeholder="At least 6 characters"
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
            {password && (
              <p className={`mt-2 text-xs ${password.length >= 6 ? "text-emerald-500" : "text-red-500"}`}>
                {password.length >= 6 ? "✓ Password is strong" : "• At least 6 characters required"}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium mb-2">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full bg-zinc-900 border border-border rounded-lg pl-12 pr-12 py-3 text-white placeholder-secondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary transition hover:text-white"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {confirmPassword && (
              <p className={`mt-2 text-xs flex items-center gap-1 ${passwordsMatch ? "text-emerald-500" : "text-red-500"}`}>
                {passwordsMatch ? (
                  <>
                    <span className="h-4 w-4">✓</span> Passwords match
                  </>
                ) : (
                  "• Passwords don't match"
                )}
              </p>
            )}
          </div>

          {/* All accounts are fans */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-zinc-900/50 p-3 text-xs text-secondary">
            <span>Everyone signs up as a fan. Fans can like, comment &amp; follow the artist.</span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={
              isLoading ||
              !passwordsMatch ||
              !username ||
              !email ||
              waitSeconds > 0
            }
            className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
          >
            {isLoading
              ? "Creating account..."
              : waitSeconds > 0
                ? waitSeconds >= 60
                  ? `Wait ${Math.ceil(waitSeconds / 60)}m to retry…`
                  : `Wait ${waitSeconds}s to retry…`
                : "Create account"}
            {!isLoading && waitSeconds === 0 && <ArrowRight className="h-5 w-5" />}
          </button>
        </form>

        {/* Sign In Link */}
        <div className="mt-6 text-center text-sm">
          <span className="text-secondary">Already have an account? </span>
          <Link
            href="/auth/login"
            className="font-medium text-primary hover:underline transition"
          >
            Sign in
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
