"use client";

import { useEffect, useState } from "react";
import { LandlordDashboard, type DashboardLive } from "@/components/dashboard/landlord-dashboard";
import { PortalShell } from "@/components/layout/portal-shell";
import { SetupChecklist, type ChecklistItem } from "@/components/onboarding/setup-checklist";
import { useSignedInName } from "@/hooks/use-client-session";
import { api, ApiError, toastApiError } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/lib/toast";

type DashboardResponse = DashboardLive & {
  planName: string;
  checklist: ChecklistItem[];
  notices: string[];
};

export default function DashboardPage() {
  const sessionName = useSignedInName();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    void api<DashboardResponse>("/dashboard")
      .then(setData)
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.status === 401) return;
        setLoadFailed(true);
        toastApiError(caught, "The dashboard could not be loaded.");
      });
  }, []);

  const displayName = sessionName ?? "Landlord";
  const firstName = displayName.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const dayPart = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const checklist = data?.checklist ?? [];
  const checklistOpen = checklist.some((item) => !item.done);

  return (
    <PortalShell
      title={`${dayPart}, ${firstName}`}
      userName={displayName}
      planLabel={data?.planName ?? "Starter"}
      notices={data?.notices}
    >
      <div className="space-y-5">
        {checklistOpen ? <SetupChecklist items={checklist} /> : null}
        {data ? (
          <LandlordDashboard live={data} />
        ) : loadFailed ? null : (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Spinner size="md" label="Loading your ledger…" />
          </div>
        )}
        {data?.preview ? (
          <p className="text-center text-xs text-muted">
            Your ledger is empty.{" "}
            <a href="/properties" className="font-semibold text-primary hover:underline">
              Add your first property
            </a>{" "}
            to start testing with real data.
          </p>
        ) : null}
      </div>
    </PortalShell>
  );
}
