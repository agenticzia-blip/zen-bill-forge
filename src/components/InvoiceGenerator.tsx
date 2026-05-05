import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Download, Printer, Upload, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
};

type Currency = { code: string; symbol: string; label: string };

const CURRENCIES: Currency[] = [
  { code: "USD", symbol: "$", label: "USD ($)" },
  { code: "PKR", symbol: "₨", label: "PKR (₨)" },
  { code: "EUR", symbol: "€", label: "EUR (€)" },
  { code: "GBP", symbol: "£", label: "GBP (£)" },
];

type InvoiceState = {
  logo: string | null;
  invoiceNumber: string;
  from: string;
  billTo: string;
  shipTo: string;
  date: string;
  paymentTerms: string;
  dueDate: string;
  poNumber: string;
  items: LineItem[];
  taxRate: number;
  discount: number;
  shipping: number;
  amountPaid: number;
  notes: string;
  terms: string;
  currency: string;
  labels: Record<string, string>;
};

const STORAGE_KEY = "invoice-generator-data-v2";

const DEFAULT_LABELS: Record<string, string> = {
  title: "INVOICE",
  numberPrefix: "#",
  from: "From",
  billTo: "Bill To",
  shipTo: "Ship To",
  date: "Date",
  paymentTerms: "Payment Terms",
  dueDate: "Due Date",
  poNumber: "PO Number",
  itemDescription: "Item Description",
  quantity: "Qty",
  rate: "Rate",
  amount: "Amount",
  notes: "Notes",
  terms: "Terms",
  subtotal: "Subtotal",
  tax: "Tax (%)",
  discount: "Discount",
  shipping: "Shipping",
  total: "Total",
  amountPaid: "Amount Paid",
  balanceDue: "Balance Due",
};

const today = () => new Date().toISOString().slice(0, 10);

const newItem = (): LineItem => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  rate: 0,
});

const defaultState = (): InvoiceState => ({
  logo: null,
  invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
  from: "",
  billTo: "",
  shipTo: "",
  date: today(),
  paymentTerms: "",
  dueDate: "",
  poNumber: "",
  items: [newItem()],
  taxRate: 0,
  discount: 0,
  shipping: 0,
  amountPaid: 0,
  notes: "",
  terms: "",
  currency: "USD",
  labels: { ...DEFAULT_LABELS },
});

export default function InvoiceGenerator() {
  const [state, setState] = useState<InvoiceState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setState({ ...defaultState(), ...JSON.parse(saved) });
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const currency = CURRENCIES.find((c) => c.code === state.currency) ?? CURRENCIES[0];
  const fmt = (n: number) =>
    `${currency.symbol}${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const subtotal = state.items.reduce(
    (s, i) => s + (Number(i.quantity) || 0) * (Number(i.rate) || 0),
    0,
  );
  const taxAmount = subtotal * ((Number(state.taxRate) || 0) / 100);
  const total =
    subtotal + taxAmount - (Number(state.discount) || 0) + (Number(state.shipping) || 0);
  const balanceDue = total - (Number(state.amountPaid) || 0);

  const update = <K extends keyof InvoiceState>(k: K, v: InvoiceState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const updateItem = (id: string, patch: Partial<LineItem>) =>
    setState((s) => ({
      ...s,
      items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));

  const addItem = () => setState((s) => ({ ...s, items: [...s.items, newItem()] }));
  const removeItem = (id: string) =>
    setState((s) => ({
      ...s,
      items: s.items.length > 1 ? s.items.filter((i) => i.id !== id) : s.items,
    }));

  const onLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => update("logo", reader.result as string);
    reader.readAsDataURL(file);
  };

  const downloadPDF = async () => {
    if (!invoiceRef.current) return;
    toast.loading("Generating PDF...", { id: "pdf" });
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      pdf.addImage(imgData, "PNG", (pageWidth - w) / 2, 20, w, h);
      pdf.save(`${state.invoiceNumber || "invoice"}.pdf`);
      toast.success("PDF downloaded", { id: "pdf" });
    } catch (e) {
      toast.error("Failed to generate PDF", { id: "pdf" });
    }
  };

  const saveLocal = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    toast.success("Invoice saved locally");
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl">
        {/* Action Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoice Generator</h1>
            <p className="text-sm text-muted-foreground">
              Create professional invoices in seconds
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="w-36">
              <Select value={state.currency} onValueChange={(v) => update("currency", v)}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={saveLocal} className="rounded-lg">
              <Save className="mr-2 h-4 w-4" /> Save
            </Button>
            <Button variant="outline" onClick={() => window.print()} className="rounded-lg">
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            <Button onClick={downloadPDF} className="rounded-lg">
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </Button>
          </div>
        </div>

        {/* Invoice Card */}
        <div
          ref={invoiceRef}
          className="rounded-2xl border bg-card p-8 shadow-sm md:p-12 print:border-0 print:shadow-none"
        >
          {/* Header */}
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              {state.logo ? (
                <div className="group relative inline-block">
                  <img
                    src={state.logo}
                    alt="Logo"
                    className="max-h-24 max-w-[220px] rounded-lg object-contain"
                  />
                  <button
                    onClick={() => update("logo", null)}
                    className="absolute -top-2 -right-2 hidden rounded-full bg-destructive p-1 text-destructive-foreground group-hover:block print:hidden"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-24 w-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/40 text-sm text-muted-foreground transition hover:border-primary hover:bg-muted print:hidden">
                  <Upload className="mb-1 h-5 w-5" />
                  <span>Upload Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])}
                  />
                </label>
              )}
            </div>
            <div className="text-right">
              <h2 className="text-4xl font-bold tracking-tight text-primary">INVOICE</h2>
              <div className="mt-3 flex items-center justify-end gap-2">
                <span className="text-sm font-medium text-muted-foreground">#</span>
                <Input
                  value={state.invoiceNumber}
                  onChange={(e) => update("invoiceNumber", e.target.value)}
                  className="h-9 w-44 rounded-lg text-right"
                />
              </div>
            </div>
          </div>

          {/* Parties + Dates */}
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                From
              </Label>
              <Textarea
                value={state.from}
                onChange={(e) => update("from", e.target.value)}
                placeholder="Your business name&#10;Email&#10;Address"
                rows={4}
                className="mt-2 rounded-lg resize-none"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bill To
              </Label>
              <Textarea
                value={state.billTo}
                onChange={(e) => update("billTo", e.target.value)}
                placeholder="Client name&#10;Email&#10;Address"
                rows={4}
                className="mt-2 rounded-lg resize-none"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ship To <span className="font-normal lowercase">(optional)</span>
              </Label>
              <Textarea
                value={state.shipTo}
                onChange={(e) => update("shipTo", e.target.value)}
                placeholder="Shipping address"
                rows={4}
                className="mt-2 rounded-lg resize-none"
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <FieldRow label="Date">
              <Input
                type="date"
                value={state.date}
                onChange={(e) => update("date", e.target.value)}
                className="rounded-lg"
              />
            </FieldRow>
            <FieldRow label="Payment Terms">
              <Input
                value={state.paymentTerms}
                onChange={(e) => update("paymentTerms", e.target.value)}
                placeholder="Net 30"
                className="rounded-lg"
              />
            </FieldRow>
            <FieldRow label="Due Date">
              <Input
                type="date"
                value={state.dueDate}
                onChange={(e) => update("dueDate", e.target.value)}
                className="rounded-lg"
              />
            </FieldRow>
            <FieldRow label="PO Number">
              <Input
                value={state.poNumber}
                onChange={(e) => update("poNumber", e.target.value)}
                placeholder="—"
                className="rounded-lg"
              />
            </FieldRow>
          </div>

          {/* Items Table */}
          <div className="mt-10 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-12 gap-2 bg-primary px-4 py-3 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
              <div className="col-span-6">Item Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>
            <div className="divide-y">
              {state.items.map((item) => {
                const amount =
                  (Number(item.quantity) || 0) * (Number(item.rate) || 0);
                return (
                  <div
                    key={item.id}
                    className="group grid grid-cols-12 items-center gap-2 px-4 py-3"
                  >
                    <div className="col-span-6">
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          updateItem(item.id, { description: e.target.value })
                        }
                        placeholder="Description of service or product"
                        className="rounded-lg border-transparent bg-transparent shadow-none focus-visible:border-input focus-visible:bg-background"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min={0}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.id, { quantity: Number(e.target.value) })
                        }
                        className="rounded-lg border-transparent bg-transparent text-right shadow-none focus-visible:border-input focus-visible:bg-background"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.rate}
                        onChange={(e) =>
                          updateItem(item.id, { rate: Number(e.target.value) })
                        }
                        className="rounded-lg border-transparent bg-transparent text-right shadow-none focus-visible:border-input focus-visible:bg-background"
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <span className="text-sm font-medium tabular-nums">
                        {fmt(amount)}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100 print:hidden"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t bg-muted/30 px-4 py-2 print:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={addItem}
                className="text-primary hover:text-primary"
              >
                <Plus className="mr-1 h-4 w-4" /> Add Line Item
              </Button>
            </div>
          </div>

          {/* Totals */}
          <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Notes
                </Label>
                <Textarea
                  value={state.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Notes — any relevant information not already covered"
                  rows={3}
                  className="mt-2 rounded-lg"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Terms
                </Label>
                <Textarea
                  value={state.terms}
                  onChange={(e) => update("terms", e.target.value)}
                  placeholder="Terms and conditions — late fees, payment methods, delivery..."
                  rows={3}
                  className="mt-2 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-2 rounded-xl bg-muted/40 p-5">
              <TotalRow label="Subtotal" value={fmt(subtotal)} />
              <TotalRow
                label="Tax (%)"
                value={
                  <Input
                    type="number"
                    value={state.taxRate}
                    onChange={(e) => update("taxRate", Number(e.target.value))}
                    className="h-8 w-24 rounded-md text-right"
                  />
                }
              />
              <TotalRow
                label="Discount"
                value={
                  <Input
                    type="number"
                    value={state.discount}
                    onChange={(e) => update("discount", Number(e.target.value))}
                    className="h-8 w-28 rounded-md text-right"
                  />
                }
              />
              <TotalRow
                label="Shipping"
                value={
                  <Input
                    type="number"
                    value={state.shipping}
                    onChange={(e) => update("shipping", Number(e.target.value))}
                    className="h-8 w-28 rounded-md text-right"
                  />
                }
              />
              <div className="my-2 h-px bg-border" />
              <TotalRow label="Total" value={fmt(total)} bold />
              <TotalRow
                label="Amount Paid"
                value={
                  <Input
                    type="number"
                    value={state.amountPaid}
                    onChange={(e) => update("amountPaid", Number(e.target.value))}
                    className="h-8 w-28 rounded-md text-right"
                  />
                }
              />
              <div className="mt-3 flex items-center justify-between rounded-lg bg-primary px-4 py-3 text-primary-foreground">
                <span className="text-sm font-semibold uppercase tracking-wide">
                  Balance Due
                </span>
                <span className="text-lg font-bold tabular-nums">{fmt(balanceDue)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function TotalRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={`text-sm ${bold ? "font-bold text-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </span>
      {typeof value === "string" ? (
        <span className={`tabular-nums ${bold ? "text-lg font-bold" : "text-sm"}`}>
          {value}
        </span>
      ) : (
        value
      )}
    </div>
  );
}
