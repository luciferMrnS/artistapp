import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { HardAlertForm } from "@/components/dashboard/HardAlertForm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/server-auth";

function AlertPageContent() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex max-w-[1500px]">
        <Sidebar />

        <main className="ml-20 min-h-screen flex-1 border-x border-border xl:ml-64">
          <header className="border-b border-border bg-black/80">
            <div className="mx-auto flex max-w-[680px] items-center px-4 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-secondary">
                  Break glass
                </p>
                <h1 className="text-xl font-bold">Hard Alert</h1>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[680px] p-6 pb-16">
            <HardAlertForm />
          </div>
        </main>
      </div>
    </div>
  );
}

export default async function AlertPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) redirect("/auth/login");
  if (payload.role !== "artist") redirect("/");

  return (
    <ProtectedRoute>
      <AlertPageContent />
    </ProtectedRoute>
  );
}