import { DashboardLayout } from "@/components/DashboardLayout";
import { NotificationsProvider } from "@/lib/notifications";
import { OrganizationProvider } from "@/lib/organization";

/** The signed-in dashboard's providers and layout: one chunk, loaded on demand (App.tsx). */
export function DashboardShell() {
  return (
    <OrganizationProvider>
      <NotificationsProvider>
        <DashboardLayout />
      </NotificationsProvider>
    </OrganizationProvider>
  );
}
