import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";

import { Header } from "@/components/layout/header";
import { PageBackground } from "@/components/layout/page-background";
import { Sidebar } from "@/components/layout/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authOptions } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/projects");

  return (
    <TooltipProvider delayDuration={200}>
      <PageBackground />
      <div className="relative z-10 flex h-screen w-screen overflow-hidden">
        <Sidebar isAdmin={session.user.role === "ADMIN"} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  );
}
