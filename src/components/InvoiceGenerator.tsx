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
import { toJpeg } from "html-to-image";
import { toast } from "sonner";

type LineItem = {
  id: string;
  description: string;
  quantity: string;
  rate: string;
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
  scheduledPayment: number;
  scheduledDate: string;
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
  scheduledPayment: "Scheduled Payment",
  scheduledDate: "Scheduled Date",
};

const today = () => new Date().toISOString().slice(0, 10);

const newItem = (): LineItem => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: "",
  rate: "",
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
  scheduledPayment: 0,
  scheduledDate: "",
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
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Likely quota exceeded (large logo data URL). Persist without the logo.
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...state, logo: null }),
        );
      } catch {}
    }
  }, [state, hydrated]);

  const currency = CURRENCIES.find((c) => c.code === state.currency) ?? CURRENCIES[0];
  const fmt = (n: number) =>
    `${currency.symbol}${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const parseNum = (v: string | number) => {
    const m = String(v ?? "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  };
  const subtotal = state.items.reduce((s, i) => s + parseNum(i.rate), 0);
  const taxAmount = subtotal * ((Number(state.taxRate) || 0) / 100);
  const total =
    subtotal + taxAmount - (Number(state.discount) || 0) + (Number(state.shipping) || 0);
  const balanceDue = total - (Number(state.amountPaid) || 0);

  const updateLabel = (k: string, v: string) =>
    setState((s) => ({ ...s, labels: { ...s.labels, [k]: v } }));

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
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Downscale to keep storage small and rendering crisp
      const img = new Image();
      img.onload = () => {
        const maxW = 480;
        const maxH = 240;
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          update("logo", dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const out =
          file.type === "image/png"
            ? canvas.toDataURL("image/png")
            : canvas.toDataURL("image/jpeg", 0.9);
        update("logo", out);
      };
      img.onerror = () => update("logo", dataUrl);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const downloadPDF = async () => {
    if (!invoiceRef.current) return;
    toast.loading("Generating PDF...", { id: "pdf" });
    try {
      const node = invoiceRef.current;
      const dataUrl = await toJpeg(node, {
        pixelRatio: 1.5,
        quality: 0.82,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("image load failed"));
      });
      const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / img.width, pageHeight / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      pdf.addImage(dataUrl, "JPEG", (pageWidth - w) / 2, 20, w, h, undefined, "FAST");
      pdf.save(`${state.invoiceNumber || "invoice"}.pdf`);
      toast.success("PDF downloaded", { id: "pdf" });
    } catch (e) {
      console.error("PDF error:", e);
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
                    crossOrigin="anonymous"
                    className="block h-24 w-auto max-w-[260px] rounded-lg object-contain"
                  />
                  <div className="absolute -top-2 -right-2 hidden gap-1 group-hover:flex print:hidden">
                    <label className="cursor-pointer rounded-full bg-primary p-1 text-primary-foreground shadow">
                      <Upload className="h-3 w-3" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          e.target.files?.[0] && onLogo(e.target.files[0])
                        }
                      />
                    </label>
                    <button
                      onClick={() => update("logo", null)}
                      className="rounded-full bg-destructive p-1 text-destructive-foreground shadow"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
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
              <EditableText
                value={state.labels.title}
                onChange={(v) => updateLabel("title", v)}
                className="text-4xl font-bold tracking-tight text-primary"
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <EditableText
                  value={state.labels.numberPrefix}
                  onChange={(v) => updateLabel("numberPrefix", v)}
                  className="text-sm font-medium text-muted-foreground"
                />
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
              <EditableText
                value={state.labels.from}
                onChange={(v) => updateLabel("from", v)}
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              />
              <Textarea
                value={state.from}
                onChange={(e) => update("from", e.target.value)}
                placeholder="Your business name&#10;Email&#10;Address"
                rows={4}
                className="mt-2 rounded-lg resize-none"
              />
            </div>
            <div>
              <EditableText
                value={state.labels.billTo}
                onChange={(v) => updateLabel("billTo", v)}
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              />
              <Textarea
                value={state.billTo}
                onChange={(e) => update("billTo", e.target.value)}
                placeholder="Client name&#10;Email&#10;Address"
                rows={4}
                className="mt-2 rounded-lg resize-none"
              />
            </div>
            <div>
              <EditableText
                value={state.labels.shipTo}
                onChange={(v) => updateLabel("shipTo", v)}
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              />
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
            <FieldRow
              label={state.labels.date}
              onLabelChange={(v) => updateLabel("date", v)}
            >
              <Input
                type="date"
                value={state.date}
                onChange={(e) => update("date", e.target.value)}
                className="rounded-lg"
              />
            </FieldRow>
            <FieldRow
              label={state.labels.paymentTerms}
              onLabelChange={(v) => updateLabel("paymentTerms", v)}
            >
              <Input
                value={state.paymentTerms}
                onChange={(e) => update("paymentTerms", e.target.value)}
                placeholder="Net 30"
                className="rounded-lg"
              />
            </FieldRow>
            <FieldRow
              label={state.labels.dueDate}
              onLabelChange={(v) => updateLabel("dueDate", v)}
            >
              <Input
                type="date"
                value={state.dueDate}
                onChange={(e) => update("dueDate", e.target.value)}
                className="rounded-lg"
              />
            </FieldRow>
            <FieldRow
              label={state.labels.poNumber}
              onLabelChange={(v) => updateLabel("poNumber", v)}
            >
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
              <div className="col-span-6">
                <EditableText
                  value={state.labels.itemDescription}
                  onChange={(v) => updateLabel("itemDescription", v)}
                  className="text-primary-foreground"
                />
              </div>
              <div className="col-span-2 text-right">
                <EditableText
                  value={state.labels.quantity}
                  onChange={(v) => updateLabel("quantity", v)}
                  className="text-primary-foreground"
                />
              </div>
              <div className="col-span-2 text-right">
                <EditableText
                  value={state.labels.rate}
                  onChange={(v) => updateLabel("rate", v)}
                  className="text-primary-foreground"
                />
              </div>
              <div className="col-span-2 text-right">
                <EditableText
                  value={state.labels.amount}
                  onChange={(v) => updateLabel("amount", v)}
                  className="text-primary-foreground"
                />
              </div>
            </div>
            <div className="divide-y">
              {state.items.map((item) => {
                const amount = parseNum(item.rate);
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
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.id, { quantity: e.target.value })
                        }
                        placeholder="1"
                        className="rounded-lg border-transparent bg-transparent text-right shadow-none focus-visible:border-input focus-visible:bg-background"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        value={item.rate}
                        onChange={(e) =>
                          updateItem(item.id, { rate: e.target.value })
                        }
                        placeholder="0.00"
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
                <EditableText
                  value={state.labels.notes}
                  onChange={(v) => updateLabel("notes", v)}
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                />
                <Textarea
                  value={state.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Notes — any relevant information not already covered"
                  rows={3}
                  className="mt-2 rounded-lg"
                />
              </div>
              <div>
                <EditableText
                  value={state.labels.terms}
                  onChange={(v) => updateLabel("terms", v)}
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                />
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
              <TotalRow
                label={state.labels.subtotal}
                onLabelChange={(v) => updateLabel("subtotal", v)}
                value={fmt(subtotal)}
              />
              <TotalRow
                label={state.labels.tax}
                onLabelChange={(v) => updateLabel("tax", v)}
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
                label={state.labels.discount}
                onLabelChange={(v) => updateLabel("discount", v)}
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
                label={state.labels.shipping}
                onLabelChange={(v) => updateLabel("shipping", v)}
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
              <TotalRow
                label={state.labels.total}
                onLabelChange={(v) => updateLabel("total", v)}
                value={fmt(total)}
                bold
              />
              <TotalRow
                label={state.labels.amountPaid}
                onLabelChange={(v) => updateLabel("amountPaid", v)}
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
                <EditableText
                  value={state.labels.balanceDue}
                  onChange={(v) => updateLabel("balanceDue", v)}
                  className="text-sm font-semibold uppercase tracking-wide text-primary-foreground"
                />
                <span className="text-lg font-bold tabular-nums">{fmt(balanceDue)}</span>
              </div>

              {/* Scheduled Payment */}
              <div className="mt-4 rounded-lg border bg-background p-4">
                <EditableText
                  value={state.labels.scheduledPayment}
                  onChange={(v) => updateLabel("scheduledPayment", v)}
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={state.scheduledPayment}
                    onChange={(e) =>
                      update("scheduledPayment", Number(e.target.value))
                    }
                    placeholder="Amount"
                    className="rounded-lg text-right"
                  />
                  <Input
                    type="date"
                    value={state.scheduledDate}
                    onChange={(e) => update("scheduledDate", e.target.value)}
                    className="rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  onLabelChange,
  children,
}: {
  label: string;
  onLabelChange?: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      {onLabelChange ? (
        <EditableText
          value={label}
          onChange={onLabelChange}
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        />
      ) : (
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </Label>
      )}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function TotalRow({
  label,
  onLabelChange,
  value,
  bold,
}: {
  label: string;
  onLabelChange?: (v: string) => void;
  value: React.ReactNode;
  bold?: boolean;
}) {
  const labelEl = onLabelChange ? (
    <EditableText
      value={label}
      onChange={onLabelChange}
      className={`text-sm ${bold ? "font-bold text-foreground" : "text-muted-foreground"}`}
    />
  ) : (
    <span
      className={`text-sm ${bold ? "font-bold text-foreground" : "text-muted-foreground"}`}
    >
      {label}
    </span>
  );
  return (
    <div className="flex items-center justify-between gap-4">
      {labelEl}
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

function EditableText({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.textContent ?? "")}
      className={`inline-block min-w-[1ch] cursor-text rounded px-0.5 outline-none transition hover:bg-accent/10 focus:bg-accent/15 focus:ring-1 focus:ring-ring print:hover:bg-transparent print:focus:bg-transparent print:focus:ring-0 ${className}`}
    >
      {value}
    </span>
  );
}
