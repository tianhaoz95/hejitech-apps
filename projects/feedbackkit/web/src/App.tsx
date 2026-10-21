import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";
import { RouteLoading } from "@/components/RouteLoading";
import { AuthProvider, RequireAuth, RedirectIfAuthed } from "@/lib/auth";
import { LandingPage } from "@/pages/LandingPage";

// Every route but the landing page loads on demand, so a first visit downloads the landing page's
// code instead of the whole dashboard, docs and SDK. Layouts keep their own <Suspense> around the
// <Outlet>, so moving between pages inside one doesn't blank its header and navigation.
// The dashboard's providers come with its layout, so supabase-js (which they import) stays out of
// the landing page's entry script; the auth provider and analytics load it on demand (supabaseLoader.ts).
const DashboardShell = lazy(() => import("@/components/DashboardShell").then((m) => ({ default: m.DashboardShell })));
const DocsLayout = lazy(() => import("@/components/docs/DocsLayout").then((m) => ({ default: m.DocsLayout })));
const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import("@/pages/TermsPage").then((m) => ({ default: m.TermsPage })));
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
const ProjectPage = lazy(() => import("@/pages/ProjectPage").then((m) => ({ default: m.ProjectPage })));
const FeedbackDetailPage = lazy(() => import("@/pages/FeedbackDetailPage").then((m) => ({ default: m.FeedbackDetailPage })));
const CliAuthPage = lazy(() => import("@/pages/CliAuthPage").then((m) => ({ default: m.CliAuthPage })));
const CliSessionsPage = lazy(() => import("@/pages/CliSessionsPage").then((m) => ({ default: m.CliSessionsPage })));
const BillingPage = lazy(() => import("@/pages/BillingPage").then((m) => ({ default: m.BillingPage })));
const TeamPage = lazy(() => import("@/pages/TeamPage").then((m) => ({ default: m.TeamPage })));
const InvitePage = lazy(() => import("@/pages/InvitePage").then((m) => ({ default: m.InvitePage })));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage").then((m) => ({ default: m.NotificationsPage })));
const GitHubCallbackPage = lazy(() => import("@/pages/GitHubCallbackPage").then((m) => ({ default: m.GitHubCallbackPage })));
const AccountPage = lazy(() => import("@/pages/AccountPage").then((m) => ({ default: m.AccountPage })));
const DocsOverviewPage = lazy(() => import("@/pages/docs/DocsOverviewPage").then((m) => ({ default: m.DocsOverviewPage })));
const DocsHowItWorksPage = lazy(() => import("@/pages/docs/DocsHowItWorksPage").then((m) => ({ default: m.DocsHowItWorksPage })));
const DocsIosSdkPage = lazy(() => import("@/pages/docs/DocsIosSdkPage").then((m) => ({ default: m.DocsIosSdkPage })));
const DocsWebSdkPage = lazy(() => import("@/pages/docs/DocsWebSdkPage").then((m) => ({ default: m.DocsWebSdkPage })));
const DocsMobileSdksPage = lazy(() => import("@/pages/docs/DocsMobileSdksPage").then((m) => ({ default: m.DocsMobileSdksPage })));
const DocsDesktopPage = lazy(() => import("@/pages/docs/DocsDesktopPage").then((m) => ({ default: m.DocsDesktopPage })));
const DocsDashboardPage = lazy(() => import("@/pages/docs/DocsDashboardPage").then((m) => ({ default: m.DocsDashboardPage })));
const DocsCliPage = lazy(() => import("@/pages/docs/DocsCliPage").then((m) => ({ default: m.DocsCliPage })));
const DocsMcpPage = lazy(() => import("@/pages/docs/DocsMcpPage").then((m) => ({ default: m.DocsMcpPage })));
const DocsSkillsPage = lazy(() => import("@/pages/docs/DocsSkillsPage").then((m) => ({ default: m.DocsSkillsPage })));
const DocsAgentsPage = lazy(() => import("@/pages/docs/DocsAgentsPage").then((m) => ({ default: m.DocsAgentsPage })));
const DocsDeliveryPage = lazy(() => import("@/pages/docs/DocsDeliveryPage").then((m) => ({ default: m.DocsDeliveryPage })));

/** One page_view per route change (lib/analytics.ts). */
function PageViewTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    trackPageView();
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <PageViewTracker />
      <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<DocsOverviewPage />} />
          <Route path="how-it-works" element={<DocsHowItWorksPage />} />
          <Route path="ios-sdk" element={<DocsIosSdkPage />} />
          <Route path="web-sdk" element={<DocsWebSdkPage />} />
          <Route path="mobile-sdks" element={<DocsMobileSdksPage />} />
          <Route path="desktop" element={<DocsDesktopPage />} />
          <Route path="dashboard" element={<DocsDashboardPage />} />
          <Route path="cli" element={<DocsCliPage />} />
          <Route path="mcp" element={<DocsMcpPage />} />
          <Route path="agents" element={<DocsAgentsPage />} />
          <Route path="delivery" element={<DocsDeliveryPage />} />
          <Route path="skills" element={<DocsSkillsPage />} />
        </Route>
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <LoginPage />
            </RedirectIfAuthed>
          }
        />
        {/* Not under RequireAuth: it needs to run its own logic (stash +
            redirect to /login) when signed out, rather than bounce straight
            there — see CliAuthPage.tsx. */}
        <Route path="/cli-auth" element={<CliAuthPage />} />
        {/* Readable signed out, so an invitee sees what they're joining before signing in. */}
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route
          element={
            <RequireAuth>
              <DashboardShell />
            </RequireAuth>
          }
        >
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/projects/:projectId/feedback/:feedbackId" element={<FeedbackDetailPage />} />
          <Route path="/cli-sessions" element={<CliSessionsPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/github/callback" element={<GitHubCallbackPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
      </Routes>
      </Suspense>
    </AuthProvider>
  );
}
