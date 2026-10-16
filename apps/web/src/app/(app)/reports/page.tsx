"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { Button } from "@/components/ui/button";
import { api, apiBase, readToken, redirectToSignIn, toastApiError } from "@/lib/api";

type Report = { year: string; rows: { month: string; property: string; expected: string; collected: string }[] };

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  useEffect(() => {
    void api<Report>("/reports/income")
      .then(setReport)
      .catch((caught: unknown) => toastApiError(caught, "Could not load the report."));
  }, []);

  return (
    <PortalShell title="Reports">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">Income for {report?.year ?? "this year"}, by property.</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            const token = readToken();
            void fetch(`${apiBase()}/api/reports/income?format=csv`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
              .then((response) => {
                if (response.status === 401) {
                  redirectToSignIn();
                  return null;
                }
                return response.blob();
              })
              .then((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "rent-at-ease-income.csv";
                link.click();
              });
          }}
        >
          Download CSV
        </Button>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr><th className="py-2">Month</th><th>Property</th><th>Expected</th><th>Collected</th></tr>
        </thead>
        <tbody>
          {(report?.rows ?? []).map((row) => (
            <tr key={`${row.month}-${row.property}`} className="border-t border-border">
              <td className="py-2">{row.month}</td>
              <td>{row.property}</td>
              <td>{row.expected}</td>
              <td className="font-semibold">{row.collected}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {report && report.rows.length === 0 ? <p className="mt-4 text-sm text-muted">No charges or payments in {report.year} yet.</p> : null}
    </PortalShell>
  );
}
