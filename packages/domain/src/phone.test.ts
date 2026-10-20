import { toLocalNigerianPhone } from "./phone";

describe("toLocalNigerianPhone", () => {
  it("maps the stored 234 form back to an 11-digit local number", () => {
    expect(toLocalNigerianPhone("2348131828508")).toBe("08131828508");
    expect(toLocalNigerianPhone("+234 813 182 8508")).toBe("08131828508");
  });

  it("leaves an 11-digit local number unchanged", () => {
    expect(toLocalNigerianPhone("08131828508")).toBe("08131828508");
    expect(toLocalNigerianPhone("0813 182 8508")).toBe("08131828508");
  });
});
