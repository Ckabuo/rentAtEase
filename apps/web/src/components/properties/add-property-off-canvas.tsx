"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OffCanvas } from "@/components/ui/off-canvas";
import { api, toastApiError } from "@/lib/api";
import type { AccountMe } from "@/lib/account-types";
import { toast } from "@/lib/toast";
import { canAddUnit, nairaToKobo } from "@rae/domain";

const defaultForm = {
  name: "",
  addressLine: "",
  city: "",
  state: "Lagos",
  description: "",
  addUnit: false,
  label: "Main house",
  type: "OTHER",
  rent: "",
  cycle: "ANNUAL",
};

export type PropertyFormValues = {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  state: string;
  description: string | null;
};

type AddPropertyOffCanvasProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  property?: PropertyFormValues | null;
};

export function AddPropertyOffCanvas({ open, onClose, onSaved, property }: AddPropertyOffCanvasProps) {
  const editing = property != null;
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState<AccountMe | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(defaultForm);
      setError(null);
      setBusy(false);
      setAccount(null);
      return;
    }
    if (property) {
      setForm({
        ...defaultForm,
        name: property.name,
        addressLine: property.addressLine,
        city: property.city,
        state: property.state,
        description: property.description ?? "",
        addUnit: false,
      });
    } else {
      setForm(defaultForm);
    }
    void api<AccountMe>("/accounts/me")
      .then(setAccount)
      .catch(() => setAccount(null));
  }, [open, property]);

  const planCode = (account?.plan.code ?? "STARTER") as "STARTER" | "STANDARD" | "PRO";
  const unitsUsed = account?.usage.units ?? 0;
  const unitLimit = account?.plan.unitLimit;
  const atUnitLimit = unitLimit !== null && unitLimit !== undefined && !canAddUnit(planCode, unitsUsed);

  const save = () => {
    setError(null);
    const name = form.name.trim();
    const addressLine = form.addressLine.trim();
    const city = form.city.trim();
    const state = form.state.trim();
    if (!name || !addressLine || !city || !state) {
      setError("Fill in all required property fields.");
      return;
    }
    if (form.addUnit) {
      if (atUnitLimit) {
        const message = `${account?.plan.name ?? "Your"} plan allows ${unitLimit} units. Turn off "Add a rentable unit" to save the property only, or upgrade your plan.`;
        setError(message);
        toast.error(message);
        return;
      }
      const label = form.label.trim();
      const rentNaira = Number(form.rent);
      if (!label) {
        setError("Unit label is required when adding a unit.");
        return;
      }
      if (!Number.isFinite(rentNaira) || rentNaira <= 0) {
        setError("Enter a valid rent amount in naira.");
        return;
      }
    }

    setBusy(true);
    void (async () => {
      try {
        const description = form.description.trim();
        if (editing && property) {
          await api(`/properties/${property.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              name,
              addressLine,
              city,
              state,
              description: description || null,
            }),
          });
          toast.success("Property updated.");
          onSaved();
          onClose();
          return;
        }
        const created = await api<{ id: string }>("/properties", {
          method: "POST",
          body: JSON.stringify({
            name,
            addressLine,
            city,
            state,
            ...(description ? { description } : {}),
          }),
        });
        if (form.addUnit) {
          await api("/properties/units", {
            method: "POST",
            body: JSON.stringify({
              propertyId: created.id,
              label: form.label.trim(),
              type: form.type,
              rentAmountKobo: nairaToKobo(Number(form.rent)),
              cycle: form.cycle,
              effectiveFrom: new Date().toISOString().slice(0, 10),
            }),
          });
          toast.success("Property and unit added.");
        } else {
          toast.success("Property added.");
        }
        onSaved();
        onClose();
      } catch (caught) {
        toastApiError(caught, "Something went wrong.");
      } finally {
        setBusy(false);
      }
    })();
  };

  if (!open) return null;

  return (
    <OffCanvas title={editing ? "Edit property" : "Add a property"} onClose={onClose}>
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col gap-4">
          {editing ? null : (
            <p className="text-xs text-muted">
              Record the building or site at this address. Add a unit only if you rent out separate spaces (flats, shops, etc.).
            </p>
          )}
          <Field label="Name" required value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Field
            label="Address"
            required
            value={form.addressLine}
            onChange={(addressLine) => setForm({ ...form, addressLine })}
          />
          <Field label="City" required value={form.city} onChange={(city) => setForm({ ...form, city })} />
          <Field label="State" required value={form.state} onChange={(state) => setForm({ ...form, state })} />
          <label className="block">
            <Label>Description</Label>
            <Textarea
              className="mt-1"
              value={form.description}
              rows={4}
              maxLength={2000}
              placeholder={`Give details about the property.\nFor example: bedrooms and bathrooms, parking, compound, power, water, and anything tenants should know.`}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>

          {editing ? null : (
            <div className="rounded-control border border-border bg-cream px-3 py-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-border accent-primary"
                  checked={form.addUnit}
                  disabled={atUnitLimit}
                  onChange={(event) => setForm({ ...form, addUnit: event.target.checked })}
                />
                <span className="text-sm">
                  <span className="font-semibold text-ink">Add a rentable unit</span>
                  <span className="mt-0.5 block text-muted">
                    Optional — skip for a single-family bungalow, duplex, or whole-building rental.
                  </span>
                </span>
              </label>
              {atUnitLimit ? (
                <p className="mt-2 text-xs font-medium text-danger" role="status">
                  {account?.plan.name ?? "Starter"} plan limit reached ({unitsUsed}
                  {unitLimit != null ? ` of ${unitLimit}` : ""} units). You can still save the property without a unit.
                </p>
              ) : unitLimit != null ? (
                <p className="mt-2 text-xs text-muted">
                  {unitsUsed} of {unitLimit} units on your {account?.plan.name ?? "Starter"} plan.
                </p>
              ) : null}
            </div>
          )}

          {!editing && form.addUnit ? (
            <>
              <Field
                label="Unit label"
                required
                value={form.label}
                onChange={(label) => setForm({ ...form, label })}
                placeholder="e.g. Flat 2B, Shop 1"
              />
              <label className="block text-sm">
                <Label required>Unit type</Label>
                <select
                  className="mt-1 w-full rounded-control border border-border bg-cream px-3 py-2"
                  value={form.type}
                  onChange={(event) => setForm({ ...form, type: event.target.value })}
                >
                  <option value="FLAT">Flat</option>
                  <option value="SELF_CONTAIN">Self-contain</option>
                  <option value="SHOP_OFFICE">Shop or office</option>
                  <option value="WAREHOUSE">Warehouse</option>
                  <option value="OTHER">Other / whole building</option>
                </select>
              </label>
              <Field
                label="Rent (naira)"
                required
                value={form.rent}
                onChange={(rent) => setForm({ ...form, rent })}
                inputMode="decimal"
              />
              <label className="block text-sm">
                <Label required>Cycle</Label>
                <select
                  className="mt-1 w-full rounded-control border border-border bg-cream px-3 py-2"
                  value={form.cycle}
                  onChange={(event) => setForm({ ...form, cycle: event.target.value })}
                >
                  <option value="ANNUAL">Annual</option>
                  <option value="BI_ANNUAL">Every six months</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </label>
            </>
          ) : null}

          {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
        </div>
        <div className="mt-8 flex gap-3 pb-1">
          <Button type="button" variant="secondary" className="w-1/3" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" loading={busy} loadingLabel="Saving…" onClick={save}>
            {editing ? "Save changes" : "Save property"}
          </Button>
        </div>
      </div>
    </OffCanvas>
  );
}

function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: "decimal" | "text";
}) {
  return (
    <label className="block">
      <Label required={required}>{label}</Label>
      <Input
        className="mt-1"
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
