import { Suspense } from "react";
import { StoreProvider } from "@/components/store/providers";
import { AuthProvider } from "@/components/auth/auth-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AnalyticsScripts } from "@/components/analytics/analytics-scripts";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import ChatbotLazy from "@/components/chatbot/chatbot-lazy";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StoreProvider>
      <AuthProvider>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="flex-1 pb-bottomnav lg:pb-0">{children}</main>
        <SiteFooter />
        <BottomNav />
        <ChatbotLazy />
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <AnalyticsScripts />
      </div>
      </AuthProvider>
    </StoreProvider>
  );
}
