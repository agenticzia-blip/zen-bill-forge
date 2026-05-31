export const CURRENT_KEY = "invoice-generator-data-v2";
export const SAVED_LIST_KEY = "invoice-saved-list-v1";
export const LOAD_PENDING_KEY = "invoice-load-pending-v1";

export type SavedInvoice = {
  id: string;
  savedAt: number;
  invoiceNumber: string;
  total: number;
  currencySymbol: string;
  snapshot: unknown;
};

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

export function saveInvoiceSnapshot(entry: SavedInvoice) {
  const list = getSavedInvoices();
  // Replace if same invoiceNumber, else prepend
  const filtered = list.filter((i) => i.invoiceNumber !== entry.invoiceNumber);
  filtered.unshift(entry);
  try {
    localStorage.setItem(SAVED_LIST_KEY, JSON.stringify(filtered.slice(0, 50)));
  } catch {
    // strip logos to fit quota
    try {
      const slim = filtered.slice(0, 50).map((i) => ({
        ...i,
        snapshot:
          i.snapshot && typeof i.snapshot === "object"
            ? { ...(i.snapshot as Record<string, unknown>), logo: null }
            : i.snapshot,
      }));
      localStorage.setItem(SAVED_LIST_KEY, JSON.stringify(slim));
    } catch {}
  }
}

export function deleteSavedInvoice(id: string) {
  const list = getSavedInvoices().filter((i) => i.id !== id);
  localStorage.setItem(SAVED_LIST_KEY, JSON.stringify(list));
}
