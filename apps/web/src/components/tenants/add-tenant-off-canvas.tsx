"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OffCanvas } from "@/components/ui/off-canvas";
import { PhoneInput } from "@/components/ui/phone-input";
import { api, toastApiError } from "@/lib/api";
import { toast } from "@/lib/toast";
import { isValidNigerianPhone, nairaToKobo } from "@rae/domain";

type VacantUnit = {
  id: string;
  label: string;
  property: string;
  status: string;
  rentAmountKobo: number;
  cycle: string;
};

export type TenantEditValues = {
  id: string;
  fullName: string;
  phone: string;
  whatsappConsent: boolean;
};

type AddTenantOffCanvasProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  vacantUnits: VacantUnit[];
  tenant?: TenantEditValues | null;
};

const defaultAddForm = (unitId: string) => ({
  fullName: "",
  phone: "",
  unitId,
  startDate: new Date().toISOString().slice(0, 10),
  paidThrough: "",
  arrears: "0",
  whatsappConsent: false,
});

const defaultEditForm = (tenant: TenantEditValues) => ({
  fullName: tenant.fullName,
  phone: tenant.phone,
  whatsappConsent: tenant.whatsappConsent,
});

export function AddTenantOffCanvas({ open, onClose, onSaved, vacantUnits, tenant }: AddTenantOffCanvasProps) {
  const editing = tenant != null;
  const [addForm, setAddForm] = useState(() => defaultAddForm(vacantUnits[0]?.id ?? ""));
  const [editForm, setEditForm] = useState(() => (tenant ? defaultEditForm(tenant) : { fullName: "", phone: "", whatsappConsent: false }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setAddForm(defaultAddForm(vacantUnits[0]?.id ?? ""));
      setEditForm(tenant ? defaultEditForm(tenant) : { fullName: "", phone: "", whatsappConsent: false });
      setError(null);
      setBusy(false);
      return;
    }
    if (tenant) {
      setEditForm(defaultEditForm(tenant));
    } else {
      setAddForm((current) => ({
        ...defaultAddForm(vacantUnits[0]?.id ?? ""),
        ...current,
        unitId: current.unitId || vacantUnits[0]?.id || "",
      }));
    }
  }, [open, tenant, vacantUnits]);

  const save = () => {
    setError(null);
    if (editing && tenant) {
      const fullName = editForm.fullName.trim();
      if (!fullName) {
        setError("Enter the tenant's name.");
        return;
      }
      if (!isValidNigerianPhone(editForm.phone)) {
        setError("Enter an 11-digit Nigerian phone number (e.g. 08030000000).");
        return;
      }
      setBusy(true);
      void (async () => {
        try {
          await api(`/tenancies/tenants/${tenant.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              fullName,
              phone: editForm.phone,
              whatsappConsent: editForm.whatsappConsent,
            }),
          });
          toast.success("Tenant updated.");
          onSaved();
          onClose();
        } catch (caught) {
          toastApiError(caught, "The tenant could not be saved.");
        } finally {
          setBusy(false);
        }
      })();
      return;
    }

    const unit = vacantUnits.find((item) => item.id === addForm.unitId);
    if (!unit) {
      setError("Choose a vacant unit.");
      return;
    }
    if (!addForm.fullName.trim()) {
      setError("Enter the tenant's name.");
      return;
    }
    if (!isValidNigerianPhone(addForm.phone)) {
      setError("Enter an 11-digit Nigerian phone number (e.g. 08030000000).");
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        const created = await api<{ id: string }>("/tenancies/tenants", {
          method: "POST",
          body: JSON.stringify({
            fullName: addForm.fullName.trim(),
            phone: addForm.phone,
            whatsappConsent: addForm.whatsappConsent,
          }),
        });
        await api("/tenancies", {
          method: "POST",
          body: JSON.stringify({
            tenantId: created.id,
            unitId: unit.id,
            startDate: addForm.startDate,
            cycle: unit.cycle,
            rentAmountKobo: unit.rentAmountKobo || nairaToKobo(1),
            paidThrough: addForm.paidThrough || undefined,
            openingArrearsKobo: nairaToKobo(Number(addForm.arrears || "0")),
          }),
        });
        toast.success("Tenant added.");
        onSaved();
        onClose();
      } catch (caught) {
        toastApiError(caught, "The tenancy could not be saved.");
      } finally {
        setBusy(false);
      }
    })();
  };

  if (!open) return null;

  return (
    <OffCanvas title={editing ? "Edit tenant" : "Add an existing tenant"} onClose={onClose}>
      <div className="flex h-full flex-col">
        {editing ? null : (
          <p className="mb-4 text-sm text-muted">Record who moved in and their paid-up-to date if they are not starting fresh.</p>
        )}
        <div className="flex flex-1 flex-col gap-4">
          <label className="block">
            <Label required>Name</Label>
            <Input
              className="mt-1"
              value={editing ? editForm.fullName : addForm.fullName}
              onChange={(event) =>
                editing
                  ? setEditForm({ ...editForm, fullName: event.target.value })
                  : setAddForm({ ...addForm, fullName: event.target.value })
              }
            />
          </label>
          <label className="block">
            <Label required>Phone</Label>
            <PhoneInput
              className="mt-1"
              value={editing ? editForm.phone : addForm.phone}
              onChange={(phone) =>
                editing ? setEditForm({ ...editForm, phone }) : setAddForm({ ...addForm, phone })
              }
            />
          </label>
          {editing ? null : (
            <>
              <label className="block text-sm">
                <Label required>Vacant unit</Label>
                <select
                  className="mt-1 w-full rounded-control border border-border bg-cream px-3 py-2"
                  value={addForm.unitId}
                  onChange={(event) => setAddForm({ ...addForm, unitId: event.target.value })}
                >
                  {vacantUnits.length === 0 ? <option value="">No vacant units</option> : null}
                  {vacantUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.property} · {unit.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <Label required>Lease start</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={addForm.startDate}
                  onChange={(event) => setAddForm({ ...addForm, startDate: event.target.value })}
                />
              </label>
              <label className="block">
                <Label>Paid through</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={addForm.paidThrough}
                  onChange={(event) => setAddForm({ ...addForm, paidThrough: event.target.value })}
                />
              </label>
              <label className="block">
                <Label>Opening arrears (naira)</Label>
                <Input
                  className="mt-1"
                  value={addForm.arrears}
                  onChange={(event) => setAddForm({ ...addForm, arrears: event.target.value })}
                />
              </label>
            </>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editing ? editForm.whatsappConsent : addForm.whatsappConsent}
              onChange={(event) =>
                editing
                  ? setEditForm({ ...editForm, whatsappConsent: event.target.checked })
                  : setAddForm({ ...addForm, whatsappConsent: event.target.checked })
              }
            />
            Tenant agreed to WhatsApp reminders and receipts
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
        <div className="mt-8 flex gap-3 pb-1">
          <Button type="button" variant="secondary" className="w-1/3" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            loading={busy}
            loadingLabel="Saving…"
            disabled={!editing && vacantUnits.length === 0}
            onClick={save}
          >
            {editing ? "Save changes" : "Save tenant"}
          </Button>
        </div>
      </div>
    </OffCanvas>
  );
}
