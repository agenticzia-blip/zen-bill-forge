import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  CURRENT_KEY,
  LOAD_PENDING_KEY,
  type SavedInvoice,
  deleteSavedInvoiceAsync,
  getSavedInvoicesAsync,
} from "@/lib/invoice-storage";

export const Route = createFileRoute("/saved")({
  component: SavedPage,
  head: () => ({
    meta: [
      { title: "Saved Invoices — Invoice Generator" },
      {
        name: "description",
        content:
          "Your downloaded invoices, saved locally and ready to re-open or edit.",
      },
    ],
  }),
});

function SavedPage() {
  const [list, setList] = useState<SavedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    getSavedInvoicesAsync()
      .then((items) => {
        if (alive) setList(items);
      })
      .catch(() => toast.error("Could not load saved invoices"))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleOpen = (item: SavedInvoice) => {
    try {
      try {
        localStorage.setItem(CURRENT_KEY, JSON.stringify(item.snapshot));
      } catch {
        const snapshot =
          item.snapshot && typeof item.snapshot === "object"
            ? { ...(item.snapshot as Record<string, unknown>), logo: null }
            : item.snapshot;
        localStorage.setItem(CURRENT_KEY, JSON.stringify(snapshot));
      }
      localStorage.setItem(LOAD_PENDING_KEY, "1");
      navigate({ to: "/" });
    } catch {
      toast.error("Could not open invoice");
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSavedInvoiceAsync(id);
    setList((items) => items.filter((item) => item.id !== id));
    toast.success("Invoice removed");
  };

  return (
    <>
      <div className="min-h-screen bg-muted/30 py-8 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Saved Invoices</h1>
              <p className="text-sm text-muted-foreground">
                Invoices you've downloaded as PDF — open and edit any of them.
              </p>
            </div>
            <Link to="/">
              <Button variant="outline" className="rounded-lg">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to editor
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="rounded-2xl border bg-card p-12 text-center shadow-sm">
              <FileText className="mx-auto mb-3 h-10 w-10 animate-pulse text-muted-foreground" />
              <h2 className="text-lg font-semibold">Loading saved invoices...</h2>
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border bg-card p-12 text-center shadow-sm">
              <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h2 className="text-lg font-semibold">No saved invoices yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Click Save or download an invoice as PDF and it will appear here.
              </p>
              <Link to="/">
                <Button className="mt-4 rounded-lg">Create an invoice</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="grid grid-cols-12 gap-2 border-b bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="col-span-5">Invoice</div>
                <div className="col-span-4">Saved</div>
                <div className="col-span-2 text-right">Total</div>
                <div className="col-span-1" />
              </div>
              <ul className="divide-y">
                {list.map((item) => (
                  <li
                    key={item.id}
                    className="grid grid-cols-12 items-center gap-2 px-4 py-3"
                  >
                    <div className="col-span-5">
                      <button
                        onClick={() => handleOpen(item)}
                        className="text-left text-sm font-medium hover:underline"
                      >
                        {item.displayName || item.invoiceNumber || "Untitled"}
                      </button>
                      {item.displayName && (
                        <div className="text-xs text-muted-foreground">
                          {item.invoiceNumber}
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground">
                        Kept for 60 years
                      </div>
                    </div>
                    <div className="col-span-4 text-sm text-muted-foreground">
                      {new Date(item.savedAt).toLocaleString()}
                    </div>
                    <div className="col-span-2 text-right text-sm tabular-nums">
                      {item.currencySymbol}
                      {item.total.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="col-span-1 flex justify-end gap-1">
                      <button
                        onClick={() => handleOpen(item)}
                        className="rounded p-1 text-muted-foreground hover:text-primary"
                        aria-label="Open"
                        title="Open & edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                        aria-label="Delete"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <Toaster />
    </>
  );
}
