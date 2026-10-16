import {
  isValidNigerianPhone,
  parseWholeNairaInput,
  type ReferenceStanding,
  type RentCycle,
} from "@rae/domain";

export type ApplyUnit = {
  property: string;
  unit: string;
  city: string;
  unitType?: string;
  rentAmountKobo: number;
  cycle: string;
};

export type UploadedApplyDocument = {
  kind: "ID" | "PROOF_OF_INCOME";
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  fileName: string;
};

export type ApplyFormState = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  currentAddress: string;
  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinPhone: string;
  nextOfKinAddress: string;
  employmentStatus: string;
  employerName: string;
  jobTitle: string;
  workAddress: string;
  yearsInJob: string;
  monthlyIncome: string;
  incomeSource: string;
  hasGuarantor: "" | "yes" | "no";
  guarantorName: string;
  guarantorRelationship: string;
  guarantorPhone: string;
  guarantorEmail: string;
  guarantorAddress: string;
  guarantorOccupation: string;
  guarantorEmployment: string;
  guarantorSignStatus: "" | "signed" | "will_sign" | "no";
  idType: string;
  idNumber: string;
  idDocument: UploadedApplyDocument | null;
  incomeDocument: UploadedApplyDocument | null;
  previousLandlordName: string;
  previousLandlordPhone: string;
  referenceStatus: string;
  consentAdult: boolean;
  consentNotice: boolean;
  consentGuarantor: boolean;
};

export const APPLY_STEP_LABELS = ["Unit", "Personal", "Employment", "Guarantor", "Documents", "Review"];

export const INITIAL_APPLY_FORM: ApplyFormState = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  dateOfBirth: "",
  gender: "Male",
  maritalStatus: "Single",
  currentAddress: "",
  nextOfKinName: "",
  nextOfKinRelationship: "Parent",
  nextOfKinPhone: "",
  nextOfKinAddress: "",
  employmentStatus: "",
  employerName: "",
  jobTitle: "",
  workAddress: "",
  yearsInJob: "",
  monthlyIncome: "",
  incomeSource: "",
  hasGuarantor: "",
  guarantorName: "",
  guarantorRelationship: "Parent",
  guarantorPhone: "",
  guarantorEmail: "",
  guarantorAddress: "",
  guarantorOccupation: "",
  guarantorEmployment: "employed",
  guarantorSignStatus: "",
  idType: "",
  idNumber: "",
  idDocument: null,
  incomeDocument: null,
  previousLandlordName: "",
  previousLandlordPhone: "",
  referenceStatus: "",
  consentAdult: false,
  consentNotice: false,
  consentGuarantor: false,
};

const UNIT_TYPE_LABELS: Record<string, string> = {
  FLAT: "Residential flat",
  SELF_CONTAIN: "Self-contain room",
  SHOP_OFFICE: "Shop / office",
  WAREHOUSE: "Warehouse",
  OTHER: "Other",
};

export function formatApplyUnitType(type: string): string {
  return UNIT_TYPE_LABELS[type] ?? type.replaceAll("_", " ").toLowerCase();
}

export function applyFullName(form: ApplyFormState): string {
  return `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
}

function mapReference(value: string): ReferenceStanding {
  const map: Record<string, ReferenceStanding> = {
    verified: "VERIFIED_GOOD_STANDING",
    provided: "PROVIDED",
    first_time: "FIRST_TIME_RENTER",
    none: "NONE",
  };
  return map[value] ?? "NONE";
}

function mapIncomeSource(value: string): string {
  const map: Record<string, string> = {
    salary: "salary",
    business: "business",
    rental: "business",
    pension: "pension",
    multiple: "salary",
  };
  return map[value] ?? value;
}

function yearsInJobNumber(value: string): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type ApplyFieldKey =
  | "firstName"
  | "lastName"
  | "phone"
  | "dateOfBirth"
  | "currentAddress"
  | "nextOfKinName"
  | "nextOfKinPhone"
  | "employmentStatus"
  | "employerName"
  | "yearsInJob"
  | "monthlyIncome"
  | "incomeSource"
  | "hasGuarantor"
  | "guarantorName"
  | "guarantorPhone"
  | "guarantorAddress"
  | "guarantorOccupation"
  | "guarantorSignStatus"
  | "idType"
  | "referenceStatus"
  | "consentAdult"
  | "consentNotice"
  | "consentGuarantor";

export type ApplyFieldErrors = Partial<Record<ApplyFieldKey, string>>;

export function validateApplyStepFields(step: number, form: ApplyFormState): ApplyFieldErrors {
  const errors: ApplyFieldErrors = {};

  switch (step) {
    case 1:
      break;
    case 2:
      if (!form.firstName.trim()) errors.firstName = "Enter your first name.";
      if (!form.lastName.trim()) errors.lastName = "Enter your last name.";
      if (!isValidNigerianPhone(form.phone)) errors.phone = "Enter an 11-digit Nigerian phone number.";
      if (!form.dateOfBirth) errors.dateOfBirth = "Enter your date of birth.";
      if (!form.currentAddress.trim()) errors.currentAddress = "Enter your current address.";
      if (!form.nextOfKinName.trim()) errors.nextOfKinName = "Enter your next of kin's name.";
      if (!isValidNigerianPhone(form.nextOfKinPhone)) {
        errors.nextOfKinPhone = "Enter a valid next of kin phone number.";
      }
      break;
    case 3:
      if (!form.employmentStatus) errors.employmentStatus = "Select your employment status.";
      if (form.employmentStatus !== "unemployed" && !form.employerName.trim()) {
        errors.employerName = "Enter your employer or business name.";
      }
      if (!form.yearsInJob) errors.yearsInJob = "Select how long you have been in your current role.";
      if (!form.monthlyIncome.trim()) {
        errors.monthlyIncome = "Enter your monthly income.";
      } else {
        try {
          parseWholeNairaInput(form.monthlyIncome);
        } catch {
          errors.monthlyIncome = "Enter a valid monthly income in naira.";
        }
      }
      if (!form.incomeSource) errors.incomeSource = "Select your income source.";
      break;
    case 4:
      if (!form.hasGuarantor) errors.hasGuarantor = "Say whether you have a guarantor.";
      if (form.hasGuarantor === "yes") {
        if (!form.guarantorName.trim()) errors.guarantorName = "Enter your guarantor's full name.";
        if (!isValidNigerianPhone(form.guarantorPhone)) {
          errors.guarantorPhone = "Enter a valid guarantor phone number.";
        }
        if (!form.guarantorAddress.trim()) errors.guarantorAddress = "Enter your guarantor's address.";
        if (!form.guarantorOccupation.trim()) errors.guarantorOccupation = "Enter your guarantor's occupation.";
        if (!form.guarantorSignStatus) errors.guarantorSignStatus = "Select the guarantor form status.";
      }
      break;
    case 5:
      if (!form.idType) errors.idType = "Select your ID type.";
      if (!form.referenceStatus) errors.referenceStatus = "Select your reference status.";
      break;
    case 6:
      if (!form.consentAdult) errors.consentAdult = "Confirm you are 18 years or older.";
      if (!form.consentNotice) errors.consentNotice = "Accept the consent notice to continue.";
      if (form.hasGuarantor === "yes" && !form.consentGuarantor) {
        errors.consentGuarantor = "Confirm you have permission to share guarantor details.";
      }
      break;
    default:
      break;
  }

  return errors;
}

export function firstApplyStepError(errors: ApplyFieldErrors): string | null {
  const message = Object.values(errors).find(Boolean);
  return message ?? null;
}

export function validateApplyStep(step: number, form: ApplyFormState): string | null {
  return firstApplyStepError(validateApplyStepFields(step, form));
}

export function applyConsentsComplete(form: ApplyFormState): boolean {
  if (!form.consentAdult || !form.consentNotice) return false;
  if (form.hasGuarantor === "yes" && !form.consentGuarantor) return false;
  return true;
}

export function stepComplete(step: number, form: ApplyFormState): boolean {
  if (step === 6) return applyConsentsComplete(form);
  return Object.keys(validateApplyStepFields(step, form)).length === 0;
}

export function buildApplySubmitBody(unit: ApplyUnit, form: ApplyFormState) {
  const monthlyIncomeKobo = parseWholeNairaInput(form.monthlyIncome);
  const hasGuarantor = form.hasGuarantor === "yes";
  const documents = [form.idDocument, form.incomeDocument].filter(
    (document): document is UploadedApplyDocument => document !== null,
  );

  return {
    fullName: applyFullName(form),
    phone: form.phone.replace(/\D/g, ""),
    email: form.email.trim() || undefined,
    consent: {
      isAdult: true,
      acceptedNotice: true,
      noticeVersion: "2026-10",
      guarantorPermission: true,
    },
    employmentStatus: form.employmentStatus,
    yearsInCurrentJob: yearsInJobNumber(form.yearsInJob),
    monthlyIncomeKobo,
    incomeSource: mapIncomeSource(form.incomeSource),
    affordableRentKobo: unit.rentAmountKobo,
    rentCycle: unit.cycle as RentCycle,
    guarantorName: hasGuarantor ? form.guarantorName.trim() : undefined,
    guarantorPhone: hasGuarantor ? form.guarantorPhone.replace(/\D/g, "") : undefined,
    guarantorWillSign: hasGuarantor && form.guarantorSignStatus !== "no",
    guarantorEmployment: hasGuarantor ? form.guarantorEmployment : undefined,
    nextOfKinName: form.nextOfKinName.trim(),
    nextOfKinPhone: form.nextOfKinPhone.replace(/\D/g, ""),
    idType: form.idType || undefined,
    idNumber: form.idNumber.trim() || undefined,
    reference: mapReference(form.referenceStatus),
    documents: documents.map((document) => ({
      kind: document.kind,
      storageKey: document.storageKey,
      contentType: document.contentType,
      sizeBytes: document.sizeBytes,
      sha256: document.sha256,
    })),
  };
}
