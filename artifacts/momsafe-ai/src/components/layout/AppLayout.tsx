import Sidebar from "./Sidebar";
import { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <Sidebar />
      <main className="ml-56 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
