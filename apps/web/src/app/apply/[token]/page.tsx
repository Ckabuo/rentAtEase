"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { ApplyWizard } from "@/components/apply/apply-wizard";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { api, toastApiError } from "@/lib/api";
import type { ApplyUnit } from "@/lib/apply-form";

export default function ApplyPage() {
  const params = useParams<{ token: string }>();
  const [unit, setUnit] = useState<ApplyUnit | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(false);

  useEffect(() => {
    void api<ApplyUnit>(`/public/apply/${params.token}`)
      .then(setUnit)
      .catch((caught: unknown) => {
        setLinkInvalid(true);
        toastApiError(caught, "This link is not valid.");
      });
  }, [params.token]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-ink px-4 py-3.5 sm:px-6">
        <Logo href="/" inverted />
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 max-w-2xl">
          <h1 className="font-display text-2xl font-black tracking-tight text-ink sm:text-3xl">Tenant application</h1>
          <p className="mt-2 text-sm text-muted">
            Complete each step to pre-qualify for the vacant unit on your link. Your landlord reviews the application.
          </p>
        </div>

        {linkInvalid ? (
          <Card className="max-w-lg">
            <CardTitle>Link not valid</CardTitle>
            <CardDescription>This application link is not valid or the unit is no longer accepting applications.</CardDescription>
          </Card>
        ) : unit ? (
          <ApplyWizard token={params.token} unit={unit} />
        ) : (
          <p className="text-sm text-muted">Loading the unit…</p>
        )}
      </main>
    </div>
  );
}
