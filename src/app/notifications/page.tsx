import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { NotificationsFeed } from "@/components/notifications/NotificationsFeed";

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto flex max-w-[1500px]">
          <Sidebar />

          <main className="ml-20 min-h-screen flex-1 border-x border-border xl:ml-64">
            <header className="sticky top-0 z-20 border-b border-border bg-black/80 backdrop-blur-md">
              <div className="mx-auto flex max-w-[680px] items-center gap-3 px-4 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-secondary">
                    Stay in the loop
                  </p>
                  <h1 className="text-xl font-bold">Notifications</h1>
                </div>
              </div>
            </header>

            <div className="mx-auto max-w-[680px] pb-16">
              <NotificationsFeed />
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}