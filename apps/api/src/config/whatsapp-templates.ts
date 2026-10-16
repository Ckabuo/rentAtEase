/** Default Meta template names; override per env when names differ on your WABA. */
const DEFAULTS = {
  caretakerInvite: "rae_caretaker_invite",
  otp: "rae_otp",
  rentReminder: "rae_rent_reminder",
  rentOverdue: "rae_rent_overdue",
  ownerOverdue: "rae_owner_overdue",
  rentReceipt: "rae_rent_receipt",
  applicationReceived: "rae_application_received",
  applicationDecision: "rae_application_decision",
  tenantWelcome: "rae_tenant_welcome",
} as const;

function fromEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export const whatsAppTemplates = {
  caretakerInvite: () => fromEnv("WHATSAPP_CARETAKER_INVITE_TEMPLATE", DEFAULTS.caretakerInvite),
  otp: () => fromEnv("WHATSAPP_OTP_TEMPLATE", DEFAULTS.otp),
  rentReminder: () => fromEnv("WHATSAPP_TEMPLATE_RENT_REMINDER", DEFAULTS.rentReminder),
  rentOverdue: () => fromEnv("WHATSAPP_TEMPLATE_RENT_OVERDUE", DEFAULTS.rentOverdue),
  ownerOverdue: () => fromEnv("WHATSAPP_TEMPLATE_OWNER_OVERDUE", DEFAULTS.ownerOverdue),
  rentReceipt: () => fromEnv("WHATSAPP_TEMPLATE_RENT_RECEIPT", DEFAULTS.rentReceipt),
  applicationReceived: () => fromEnv("WHATSAPP_TEMPLATE_APPLICATION_RECEIVED", DEFAULTS.applicationReceived),
  applicationDecision: () => fromEnv("WHATSAPP_TEMPLATE_APPLICATION_DECISION", DEFAULTS.applicationDecision),
  tenantWelcome: () => fromEnv("WHATSAPP_TEMPLATE_TENANT_WELCOME", DEFAULTS.tenantWelcome),

  /** Maps schedule / domain template keys to the Meta template name sent on the wire. */
  resolveScheduleKey(logicalKey: string): string {
    switch (logicalKey) {
      case DEFAULTS.rentReminder:
        return whatsAppTemplates.rentReminder();
      case DEFAULTS.rentOverdue:
        return whatsAppTemplates.rentOverdue();
      case DEFAULTS.ownerOverdue:
        return whatsAppTemplates.ownerOverdue();
      default:
        return logicalKey;
    }
  },
};
