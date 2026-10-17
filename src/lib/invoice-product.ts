export const AGENTICMYZE_DESCRIPTION = "Complete AI automation business setup, from niche and offer to client acquisition and closing, designed to get you booked appointments and land your first 2 clients in 45 days.";

export const mentionsAgenticmyze = (text: string) => /\b(?:agenticmyze|agentizmyze)\b/i.test(text);

export const replaceInvoiceBrand = (text: string) =>
  text.replace(/appoint\s*funnels/gi, "Agenticmyze");

export const hasPaymentContent = (amount: string, date = "") =>
  Boolean(amount.trim() || date.trim());

export function activateAgenticmyze<T extends {
  from: string; notes: string; terms: string; poNumber: string;
  items: { description: string }[]; labels: Record<string, string>;
}>(state: T): T {
  return {
    ...state,
    from: replaceInvoiceBrand(state.from),
    notes: AGENTICMYZE_DESCRIPTION,
    terms: replaceInvoiceBrand(state.terms),
    poNumber: replaceInvoiceBrand(state.poNumber),
    items: state.items.map((item) => ({ ...item, description: replaceInvoiceBrand(item.description) })),
    labels: Object.fromEntries(Object.entries(state.labels).map(([key, value]) => [key, replaceInvoiceBrand(value)])),
  };
}