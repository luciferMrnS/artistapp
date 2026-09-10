import { ReactNode } from "react";

/**
 * Auth pages layout (login, signup)
 * No sidebar or navigation - just centered forms
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
