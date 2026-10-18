import { describe, expect, test } from "bun:test";
import { activateAgenticmyze, AGENTICMYZE_DESCRIPTION, hasPaymentContent, mentionsAgenticmyze } from "./invoice-product";

describe("Agenticmyze invoice", () => {
  test("recognizes both product spellings", () => {
    expect(mentionsAgenticmyze("Product: agenticmyze")).toBe(true);
    expect(mentionsAgenticmyze("Agentizmyze")).toBe(true);
    expect(mentionsAgenticmyze("Sales System")).toBe(false);
  });
  test("switches invoice branding and uses only the supplied description", () => {
    const result = activateAgenticmyze({ from: "Ziauddin Shah | AppointFunnels", notes: "old", terms: "{{firstName}} Thanks For Choosing Appoint Funnels.", poNumber: "AppointFunnels setup", items: [{ description: "Appoint Funnels package" }], labels: { title: "AppointFunnels Invoice" } });
    expect(result.from).toBe("Ziauddin Shah | Agenticmyze");
    expect(result.notes).toBe("Complete AI automation business setup, from niche and offer to client acquisition and closing, designed to get you booked appointments and land your first 2 clients in 45 days.");
    expect(result.terms).toBe("{{firstName}} Thanks For Choosing Agenticmyze.");
    expect(result.items[0]?.description).toBe("Agenticmyze package");
    expect(result.poNumber).toBe("Agenticmyze setup");
    expect(AGENTICMYZE_DESCRIPTION).toBe(result.notes);
  });
});

test("optional payment rows export only when filled, including free-form text", () => {
  expect(hasPaymentContent("", "  ")).toBe(false);
  expect(hasPaymentContent("$300 + setup", "To be paid today")).toBe(true);
  expect(hasPaymentContent("", "After onboarding")).toBe(true);
  expect(hasPaymentContent("Rs 500 today")).toBe(true);
});