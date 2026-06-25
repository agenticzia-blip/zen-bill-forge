export const CURRENT_KEY = "invoice-generator-data-v2";
export const SAVED_LIST_KEY = "invoice-saved-list-v1";
export const LOAD_PENDING_KEY = "invoice-load-pending-v1";

export type SavedInvoice = {
  id: string;
  savedAt: number;
  invoiceNumber: string;
  displayName?: string;
  total: number;
  currencySymbol: string;
  snapshot: unknown;
};

// Effectively unlimited capacity — keep up to 10,000 invoices locally.
const MAX_SAVED = 10000;

export function getSavedInvoices(): SavedInvoice[] {
  try {
    const raw = localStorage.getItem(SAVED_LIST_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function trySetList(list: SavedInvoice[]): boolean {
  try {
    localStorage.setItem(SAVED_LIST_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function saveInvoiceSnapshot(entry: SavedInvoice) {
  const list = getSavedInvoices();
  // Replace if same invoiceNumber, else prepend
  const filtered = list.filter((i) => i.invoiceNumber !== entry.invoiceNumber);
  filtered.unshift(entry);
  let trimmed = filtered.slice(0, MAX_SAVED);
  if (trySetList(trimmed)) return;

  // Quota hit — progressively shed logos from oldest first, then drop oldest entries.
  const stripLogo = (i: SavedInvoice): SavedInvoice =>
    i.snapshot && typeof i.snapshot === "object"
      ? {
          ...i,
          snapshot: {
            ...(i.snapshot as Record<string, unknown>),
            logo: null,
          },
        }
      : i;

  for (let i = trimmed.length - 1; i >= 0; i--) {
    trimmed[i] = stripLogo(trimmed[i]);
    if (trySetList(trimmed)) return;
  }
  while (trimmed.length > 1) {
    trimmed = trimmed.slice(0, Math.floor(trimmed.length / 2));
    if (trySetList(trimmed)) return;
  }
}

export function deleteSavedInvoice(id: string) {
  const list = getSavedInvoices().filter((i) => i.id !== id);
  localStorage.setItem(SAVED_LIST_KEY, JSON.stringify(list));
}

