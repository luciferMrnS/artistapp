import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DirectMessages } from "@/components/messages/DirectMessages";

export default function MessagesPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto flex max-w-[1500px]">
          <Sidebar />

          <main className="ml-20 flex-1 border-x border-border xl:ml-64">
            <header className="sticky top-0 z-20 border-b border-border bg-black/80 backdrop-blur-md">
              <div className="flex items-center gap-3 px-4 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-secondary">
                    Direct conversations
                  </p>
                  <h1 className="text-xl font-bold">Messages</h1>
                </div>
              </div>
            </header>

            <DirectMessages />
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}