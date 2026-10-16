import { nextResendAt, resendCooldownSeconds } from "./otp";

describe("resendCooldownSeconds", () => {
  it("uses channel-specific initial delay after the first code", () => {
    expect(resendCooldownSeconds(1, "SMS")).toBe(30);
    expect(resendCooldownSeconds(1, "EMAIL")).toBe(60);
  });

  it("applies progressive backoff for later resends", () => {
    expect(resendCooldownSeconds(2, "SMS")).toBe(60);
    expect(resendCooldownSeconds(3, "SMS")).toBe(120);
    expect(resendCooldownSeconds(4, "EMAIL")).toBe(120);
  });
});

describe("nextResendAt", () => {
  it("matches the SMS resend timeline", () => {
    const t0 = new Date("2026-01-01T12:00:00.000Z");
    const t30 = nextResendAt(t0, 1, "SMS");
    expect(t30.toISOString()).toBe("2026-01-01T12:00:30.000Z");

    const t90 = nextResendAt(t30, 2, "SMS");
    expect(t90.toISOString()).toBe("2026-01-01T12:01:30.000Z");

    const t210 = nextResendAt(t90, 3, "SMS");
    expect(t210.toISOString()).toBe("2026-01-01T12:03:30.000Z");
  });
});
