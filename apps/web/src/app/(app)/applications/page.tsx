"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { api, toastApiError } from "@/lib/api";

type Application = {
  id: string;
  applicant: string;
  property: string;
  unit: string;
  score: number | null;
  recommendation: string | null;
  status: string;
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  useEffect(() => {
    void api<Application[]>("/applications")
      .then(setApplications)
      .catch((caught: unknown) => toastApiError(caught, "Could not load applications."));
  }, []);

  return (
    <PortalShell title="Applications">
      <Card>
        <CardTitle>Submitted applications</CardTitle>
        <CardDescription>
          Tenants apply using the application link on a vacant unit under Properties. Review scores and decide here.
        </CardDescription>
        <ul className="mt-4 divide-y divide-border">
          {applications.length === 0 ? (
            <li className="py-6 text-sm text-muted">No applications yet. Share an application link from Properties.</li>
          ) : null}
          {applications.map((application) => (
            <li key={application.id}>
              <Link
                href={`/applications/${application.id}`}
                className="flex items-center justify-between gap-3 py-3 text-sm hover:text-primary"
              >
                <span>
                  {application.applicant} · {application.property} {application.unit}
                  <span className="ml-2 text-muted">{application.status}</span>
                </span>
                <span className="shrink-0 font-display font-black">
                  {application.score ?? "—"} {application.recommendation}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </PortalShell>
  );
}
