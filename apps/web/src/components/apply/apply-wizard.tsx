"use client";

import { useState, type ReactNode } from "react";
import { formatNaira } from "@rae/domain";
import { ApplySidebar } from "@/components/apply/apply-sidebar";
import { ApplyStepper } from "@/components/apply/apply-stepper";
import { DocumentUploadZone } from "@/components/apply/document-upload-zone";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { RadioCard } from "@/components/ui/radio-card";
import { StepProgress } from "@/components/ui/step-progress";
import { api, toastApiError } from "@/lib/api";
import {
  APPLY_STEP_LABELS,
  INITIAL_APPLY_FORM,
  applyConsentsComplete,
  applyFullName,
  buildApplySubmitBody,
  firstApplyStepError,
  formatApplyUnitType,
  validateApplyStepFields,
  type ApplyFieldErrors,
  type ApplyFieldKey,
  type ApplyFormState,
  type ApplyUnit,
} from "@/lib/apply-form";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
const selectClass =
  "mt-1 w-full rounded-control border border-border bg-cream px-3 py-2 text-sm text-ink outline-none focus:border-primary";

type ApplyWizardProps = {
  token: string;
  unit: ApplyUnit;
};

export function ApplyWizard({ token, unit }: ApplyWizardProps) {
  const [step, setStep] = useState(1);
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [form, setForm] = useState<ApplyFormState>(INITIAL_APPLY_FORM);
  const [fieldErrors, setFieldErrors] = useState<ApplyFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const patch = (partial: Partial<ApplyFormState>) => {
    setForm((current) => ({ ...current, ...partial }));
    const keys = Object.keys(partial) as ApplyFieldKey[];
    if (keys.length === 0) return;
    setFieldErrors((current) => {
      const next = { ...current };
      for (const key of keys) {
        delete next[key];
      }
      return next;
    });
  };

  const failValidation = (errors: ApplyFieldErrors) => {
    setFieldErrors(errors);
    const message = firstApplyStepError(errors);
    if (message) toast.error(message);
  };

  const goTo = (next: number) => {
    setFieldErrors({});
    setStep(next);
    setMaxStepReached((max) => Math.max(max, next));
  };

  const next = () => {
    const errors = validateApplyStepFields(step, form);
    if (Object.keys(errors).length > 0) {
      failValidation(errors);
      return;
    }
    setFieldErrors({});
    goTo(Math.min(step + 1, APPLY_STEP_LABELS.length));
  };

  const back = () => {
    setFieldErrors({});
    setStep((current) => Math.max(1, current - 1));
  };

  const submit = () => {
    const errors = validateApplyStepFields(6, form);
    if (Object.keys(errors).length > 0) {
      failValidation(errors);
      return;
    }
    setSubmitting(true);
    setFieldErrors({});
    void api(`/public/apply/${token}`, {
      method: "POST",
      body: JSON.stringify(buildApplySubmitBody(unit, form)),
    })
      .then(() => setDone(true))
      .catch((caught: unknown) => {
        toastApiError(caught, "The application was not sent.");
        setSubmitting(false);
      });
  };

  if (done) {
    return (
      <Card className="max-w-lg">
        <CardTitle>Application received</CardTitle>
        <CardDescription>
          {applyFullName(form)} — the landlord will review your application for {unit.unit} at {unit.property}.
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="sm:hidden">
        <StepProgress current={step} total={APPLY_STEP_LABELS.length} labels={APPLY_STEP_LABELS} />
      </div>
      <ApplyStepper current={step} maxReached={maxStepReached} onGoTo={goTo} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <StepPanel
            title={stepTitles[step - 1]?.title ?? ""}
            subtitle={stepTitles[step - 1]?.subtitle ?? ""}
          >
            {step === 1 ? <StepUnit unit={unit} /> : null}
            {step === 2 ? <StepPersonal form={form} patch={patch} errors={fieldErrors} /> : null}
            {step === 3 ? <StepEmployment form={form} patch={patch} errors={fieldErrors} /> : null}
            {step === 4 ? <StepGuarantor form={form} patch={patch} errors={fieldErrors} /> : null}
            {step === 5 ? <StepDocuments token={token} form={form} patch={patch} errors={fieldErrors} /> : null}
            {step === 6 ? <StepReview form={form} patch={patch} errors={fieldErrors} unit={unit} /> : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
              {step > 1 ? (
                <Button type="button" variant="secondary" onClick={back}>
                  Back
                </Button>
              ) : (
                <span />
              )}
              {step < APPLY_STEP_LABELS.length ? (
                <Button type="button" onClick={next}>
                  Continue
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={submit}
                  loading={submitting}
                  loadingLabel="Sending…"
                  disabled={!applyConsentsComplete(form)}
                >
                  Submit application
                </Button>
              )}
            </div>
          </StepPanel>
        </div>

        <ApplySidebar unit={unit} form={form} maxStepReached={maxStepReached} />
      </div>
    </div>
  );
}

const stepTitles = [
  { title: "Your unit", subtitle: "This link is for the vacant unit below." },
  { title: "Personal information", subtitle: "Identity and contact details." },
  { title: "Employment & income", subtitle: "The main factors in qualification." },
  { title: "Guarantor", subtitle: "A guarantor can strengthen your application." },
  { title: "Documents & references", subtitle: "Upload ID and income proof if you have them." },
  { title: "Review & submit", subtitle: "Check your answers and send to the landlord." },
];

function StepPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="border-b border-border px-5 py-5 sm:px-6">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </Card>
  );
}

function StepUnit({ unit }: { unit: ApplyUnit }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-control border border-primary bg-teal-light px-4 py-3">
        <p className="font-heading font-bold text-ink">{unit.unit} at {unit.property}</p>
        <p className="mt-1 text-muted">
          {formatNaira(unit.rentAmountKobo)} · {unit.cycle.toLowerCase().replaceAll("_", " ")} · {unit.city}
        </p>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        <Meta label="Unit type" value={formatApplyUnitType(unit.unitType ?? "OTHER")} />
        <Meta label="Rent cycle" value={unit.cycle.replaceAll("_", " ")} />
      </dl>
      <p className="text-muted">
        You are applying for this specific unit. If you need a different flat, ask the landlord for another application
        link.
      </p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-border bg-cream px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold capitalize text-ink">{value}</p>
    </div>
  );
}

type StepFormProps = {
  form: ApplyFormState;
  patch: (partial: Partial<ApplyFormState>) => void;
  errors: ApplyFieldErrors;
};

function StepPersonal({ form, patch, errors }: StepFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required error={errors.firstName}>
          <Input
            value={form.firstName}
            onChange={(e) => patch({ firstName: e.target.value })}
            className={cn(errors.firstName && "border-danger focus:border-danger")}
          />
        </Field>
        <Field label="Last name" required error={errors.lastName}>
          <Input
            value={form.lastName}
            onChange={(e) => patch({ lastName: e.target.value })}
            className={cn(errors.lastName && "border-danger focus:border-danger")}
          />
        </Field>
        <Field label="Phone" required error={errors.phone}>
          <PhoneInput value={form.phone} onChange={(phone) => patch({ phone })} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} />
        </Field>
        <Field label="Date of birth" required error={errors.dateOfBirth}>
          <Input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => patch({ dateOfBirth: e.target.value })}
            className={cn(errors.dateOfBirth && "border-danger focus:border-danger")}
          />
        </Field>
        <Field label="Gender">
          <select className={selectClass} value={form.gender} onChange={(e) => patch({ gender: e.target.value })}>
            <option>Male</option>
            <option>Female</option>
            <option>Prefer not to say</option>
          </select>
        </Field>
        <Field label="Marital status">
          <select
            className={selectClass}
            value={form.maritalStatus}
            onChange={(e) => patch({ maritalStatus: e.target.value })}
          >
            <option>Single</option>
            <option>Married</option>
            <option>Divorced</option>
            <option>Widowed</option>
          </select>
        </Field>
      </div>
      <Field label="Current address" required error={errors.currentAddress}>
        <Input
          value={form.currentAddress}
          onChange={(e) => patch({ currentAddress: e.target.value })}
          className={cn(errors.currentAddress && "border-danger focus:border-danger")}
        />
      </Field>

      <SectionTitle>Next of kin</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={errors.nextOfKinName}>
          <Input
            value={form.nextOfKinName}
            onChange={(e) => patch({ nextOfKinName: e.target.value })}
            className={cn(errors.nextOfKinName && "border-danger focus:border-danger")}
          />
        </Field>
        <Field label="Relationship" required>
          <select
            className={selectClass}
            value={form.nextOfKinRelationship}
            onChange={(e) => patch({ nextOfKinRelationship: e.target.value })}
          >
            <option>Spouse</option>
            <option>Parent</option>
            <option>Sibling</option>
            <option>Child</option>
            <option>Other</option>
          </select>
        </Field>
        <Field label="Phone" required error={errors.nextOfKinPhone}>
          <PhoneInput value={form.nextOfKinPhone} onChange={(phone) => patch({ nextOfKinPhone: phone })} />
        </Field>
        <Field label="Address">
          <Input value={form.nextOfKinAddress} onChange={(e) => patch({ nextOfKinAddress: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function StepEmployment({ form, patch, errors }: StepFormProps) {
  const statuses = [
    { value: "employed", title: "Full-time employed" },
    { value: "self_employed", title: "Self-employed" },
    { value: "business_owner", title: "Business owner" },
    { value: "contract", title: "Contractor" },
    { value: "unemployed", title: "Unemployed" },
  ];

  return (
    <div className="space-y-4">
      <Field label="Employment status" required error={errors.employmentStatus}>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {statuses.map((status) => (
            <RadioCard
              key={status.value}
              name="employmentStatus"
              value={status.value}
              checked={form.employmentStatus === status.value}
              onChange={(value) => patch({ employmentStatus: value })}
              title={status.title}
            />
          ))}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Employer / business name" required={form.employmentStatus !== "unemployed"} error={errors.employerName}>
          <Input
            value={form.employerName}
            onChange={(e) => patch({ employerName: e.target.value })}
            className={cn(errors.employerName && "border-danger focus:border-danger")}
          />
        </Field>
        <Field label="Job title / role">
          <Input value={form.jobTitle} onChange={(e) => patch({ jobTitle: e.target.value })} />
        </Field>
        <Field label="Work address">
          <Input value={form.workAddress} onChange={(e) => patch({ workAddress: e.target.value })} />
        </Field>
        <Field label="Years in current job" required error={errors.yearsInJob}>
          <select
            className={cn(selectClass, errors.yearsInJob && "border-danger")}
            value={form.yearsInJob}
            onChange={(e) => patch({ yearsInJob: e.target.value })}
          >
            <option value="">Select</option>
            <option value="0">Less than 1 year</option>
            <option value="1">1–2 years</option>
            <option value="2">2–5 years</option>
            <option value="3">5+ years</option>
          </select>
        </Field>
      </div>

      <SectionTitle>Income</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Monthly income (₦)" required hint="Ideally at least 3× the monthly rent equivalent." error={errors.monthlyIncome}>
          <Input
            inputMode="numeric"
            value={form.monthlyIncome}
            onChange={(e) => patch({ monthlyIncome: e.target.value })}
            placeholder="e.g. 250000"
            className={cn(errors.monthlyIncome && "border-danger focus:border-danger")}
          />
        </Field>
        <Field label="Income source" required error={errors.incomeSource}>
          <select
            className={cn(selectClass, errors.incomeSource && "border-danger")}
            value={form.incomeSource}
            onChange={(e) => patch({ incomeSource: e.target.value })}
          >
            <option value="">Select source</option>
            <option value="salary">Salary (bank credit)</option>
            <option value="business">Business revenue</option>
            <option value="rental">Rental income</option>
            <option value="pension">Pension</option>
            <option value="multiple">Multiple sources</option>
          </select>
        </Field>
      </div>
    </div>
  );
}

function StepGuarantor({ form, patch, errors }: StepFormProps) {
  return (
    <div className="space-y-4">
      <Field label="Do you have a guarantor?" required error={errors.hasGuarantor}>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <RadioCard
            name="hasGuarantor"
            value="yes"
            checked={form.hasGuarantor === "yes"}
            onChange={() => patch({ hasGuarantor: "yes" })}
            title="Yes"
          />
          <RadioCard
            name="hasGuarantor"
            value="no"
            checked={form.hasGuarantor === "no"}
            onChange={() => patch({ hasGuarantor: "no" })}
            title="No"
          />
        </div>
      </Field>

      {form.hasGuarantor === "yes" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Guarantor full name" required error={errors.guarantorName}>
              <Input
                value={form.guarantorName}
                onChange={(e) => patch({ guarantorName: e.target.value })}
                className={cn(errors.guarantorName && "border-danger focus:border-danger")}
              />
            </Field>
            <Field label="Relationship" required>
              <select
                className={selectClass}
                value={form.guarantorRelationship}
                onChange={(e) => patch({ guarantorRelationship: e.target.value })}
              >
                <option>Employer</option>
                <option>Parent</option>
                <option>Sibling</option>
                <option>Spouse</option>
                <option>Colleague</option>
                <option>Friend</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Guarantor phone" required error={errors.guarantorPhone}>
              <PhoneInput value={form.guarantorPhone} onChange={(phone) => patch({ guarantorPhone: phone })} />
            </Field>
            <Field label="Guarantor email">
              <Input type="email" value={form.guarantorEmail} onChange={(e) => patch({ guarantorEmail: e.target.value })} />
            </Field>
          </div>
          <Field label="Home address" required error={errors.guarantorAddress}>
            <Input
              value={form.guarantorAddress}
              onChange={(e) => patch({ guarantorAddress: e.target.value })}
              className={cn(errors.guarantorAddress && "border-danger focus:border-danger")}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Occupation" required error={errors.guarantorOccupation}>
              <Input
                value={form.guarantorOccupation}
                onChange={(e) => patch({ guarantorOccupation: e.target.value })}
                className={cn(errors.guarantorOccupation && "border-danger focus:border-danger")}
              />
            </Field>
            <Field label="Employment status">
              <select
                className={selectClass}
                value={form.guarantorEmployment}
                onChange={(e) => patch({ guarantorEmployment: e.target.value })}
              >
                <option value="employed">Employed</option>
                <option value="business">Business owner</option>
                <option value="self_employed">Self-employed</option>
                <option value="retired">Retired</option>
              </select>
            </Field>
          </div>
          <Field label="Guarantor form" required error={errors.guarantorSignStatus}>
            <div className="mt-2 grid gap-2">
              {[
                { value: "signed" as const, title: "Yes — form signed" },
                { value: "will_sign" as const, title: "Not yet — will sign before move-in" },
                { value: "no" as const, title: "No" },
              ].map((option) => (
                <RadioCard
                  key={option.value}
                  name="guarantorSignStatus"
                  value={option.value}
                  checked={form.guarantorSignStatus === option.value}
                  onChange={(value) => patch({ guarantorSignStatus: value as ApplyFormState["guarantorSignStatus"] })}
                  title={option.title}
                />
              ))}
            </div>
          </Field>
        </>
      ) : null}
    </div>
  );
}

function StepDocuments({
  token,
  form,
  patch,
  errors,
}: StepFormProps & { token: string }) {
  return (
    <div className="space-y-5">
      <SectionTitle>Government ID</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ID type" required error={errors.idType}>
          <select
            className={cn(selectClass, errors.idType && "border-danger")}
            value={form.idType}
            onChange={(e) => patch({ idType: e.target.value })}
          >
            <option value="">Select ID type</option>
            <option value="nin">NIN slip / card</option>
            <option value="bvn">BVN</option>
            <option value="intl">International passport</option>
            <option value="dl">Driver&apos;s licence</option>
            <option value="voter">Voter&apos;s card</option>
          </select>
        </Field>
        <Field label="ID number">
          <Input value={form.idNumber} onChange={(e) => patch({ idNumber: e.target.value })} placeholder="e.g. 12345678901" />
        </Field>
      </div>
      <DocumentUploadZone
        applyToken={token}
        kind="ID"
        label="Upload government ID"
        hint="JPG, PNG, or PDF — max 10 MB"
        document={form.idDocument}
        onUploaded={(document) => patch({ idDocument: document })}
      />

      <SectionTitle>Proof of income</SectionTitle>
      <DocumentUploadZone
        applyToken={token}
        kind="PROOF_OF_INCOME"
        label="Upload proof of income"
        hint="Bank statement or payslip — PDF preferred"
        document={form.incomeDocument}
        onUploaded={(document) => patch({ incomeDocument: document })}
      />

      <SectionTitle>Previous landlord reference</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Landlord name">
          <Input value={form.previousLandlordName} onChange={(e) => patch({ previousLandlordName: e.target.value })} />
        </Field>
        <Field label="Landlord phone">
          <PhoneInput value={form.previousLandlordPhone} onChange={(phone) => patch({ previousLandlordPhone: phone })} />
        </Field>
      </div>
      <Field label="Reference status" required error={errors.referenceStatus}>
        <div className="mt-2 grid gap-2">
          {[
            { value: "verified", title: "Verified — good standing" },
            { value: "provided", title: "Provided — not yet verified" },
            { value: "first_time", title: "First-time renter" },
            { value: "none", title: "Not provided" },
          ].map((option) => (
            <RadioCard
              key={option.value}
              name="referenceStatus"
              value={option.value}
              checked={form.referenceStatus === option.value}
              onChange={(value) => patch({ referenceStatus: value })}
              title={option.title}
            />
          ))}
        </div>
      </Field>
    </div>
  );
}

function StepReview({ unit, form, patch, errors }: StepFormProps & { unit: ApplyUnit }) {
  return (
    <div className="space-y-5 text-sm">
      <ReviewBlock title="Unit">
        {unit.unit} at {unit.property} · {formatNaira(unit.rentAmountKobo)}
      </ReviewBlock>
      <ReviewBlock title="Applicant">
        {applyFullName(form)} · {form.phone}
        {form.email ? ` · ${form.email}` : ""}
      </ReviewBlock>
      <ReviewBlock title="Employment">
        {form.employmentStatus.replaceAll("_", " ")} · ₦{form.monthlyIncome || "—"} / month
      </ReviewBlock>
      <ReviewBlock title="Guarantor">
        {form.hasGuarantor === "yes" ? form.guarantorName || "Provided" : "None"}
      </ReviewBlock>
      <ReviewBlock title="Documents">
        ID: {form.idDocument ? "Uploaded" : "Not uploaded"} · Income proof:{" "}
        {form.incomeDocument ? "Uploaded" : "Not uploaded"}
      </ReviewBlock>

      <div
        className={cn(
          "space-y-3 rounded-control border bg-cream px-4 py-4",
          errors.consentAdult || errors.consentNotice || errors.consentGuarantor ? "border-danger" : "border-border",
        )}
      >
        <div>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={form.consentAdult}
              onChange={(e) => patch({ consentAdult: e.target.checked })}
            />
            <span>I am 18 years or older.</span>
          </label>
          {errors.consentAdult ? <p className="mt-1 text-xs text-danger">{errors.consentAdult}</p> : null}
        </div>
        <div>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={form.consentNotice}
              onChange={(e) => patch({ consentNotice: e.target.checked })}
            />
            <span>I accept the consent notice. My answers are declared and may be used to score this application.</span>
          </label>
          {errors.consentNotice ? <p className="mt-1 text-xs text-danger">{errors.consentNotice}</p> : null}
        </div>
        {form.hasGuarantor === "yes" ? (
          <div>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-primary"
                checked={form.consentGuarantor}
                onChange={(e) => patch({ consentGuarantor: e.target.checked })}
              />
              <span>I have permission to share my guarantor&apos;s details.</span>
            </label>
            {errors.consentGuarantor ? <p className="mt-1 text-xs text-danger">{errors.consentGuarantor}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="block text-sm">
      <Label>
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </Label>
      <div className="mt-1">{children}</div>
      {error ? <p className="mt-1 text-xs text-danger" role="alert">{error}</p> : null}
      {hint && !error ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="border-b border-border pb-2 text-xs font-bold uppercase tracking-wide text-muted">{children}</p>
  );
}

function ReviewBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-control border border-border px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-1 font-medium text-ink">{children}</p>
    </div>
  );
}
