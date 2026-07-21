import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Download, Printer, Upload, Save, FolderOpen } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
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
import {
  CURRENT_KEY,
  LOAD_PENDING_KEY,
  type SavedInvoice,
  saveInvoiceSnapshotAsync,
} from "@/lib/invoice-storage";
import { SAMPLES, SAMPLE_FROM, type InvoiceSample } from "@/lib/invoice-samples";


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
  themeColor: string | null;
  logoPalette: string[];
};

const STORAGE_KEY = CURRENT_KEY;

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
  notes: "Description",
  terms: "Notes",
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
  themeColor: null,
  logoPalette: [],
});

export default function InvoiceGenerator() {
  const [state, setState] = useState<InvoiceState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setState({ ...defaultState(), ...JSON.parse(saved) });
      // clear "load pending" flag if set from /saved navigation
      localStorage.removeItem(LOAD_PENDING_KEY);
    } catch {}
    setHydrated(true);
  }, []);

  // Apply theme color to CSS variables (not background)
  useEffect(() => {
    const root = document.documentElement;
    if (state.themeColor) {
      root.style.setProperty("--primary", state.themeColor);
      root.style.setProperty("--accent", state.themeColor);
      const fg = readableForeground(state.themeColor);
      root.style.setProperty("--primary-foreground", fg);
      root.style.setProperty("--accent-foreground", fg);
    } else {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--accent");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--accent-foreground");
    }
    return () => {
      // don't clear on unmount — keep theme while editing
    };
  }, [state.themeColor]);

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

  // Derive an invoice "name" automatically — client company / name first line,
  // falling back to your own business, then the invoice number.
  const firstLine = (s: string) =>
    (s || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "";
  const clientName = firstLine(state.billTo) || firstLine(state.from);
  const clientFirstName = firstLine(state.billTo).split(/\s+/).filter(Boolean)[0] || "";
  const personalizeText = (text: string) =>
    clientFirstName ? text.replace(/{{\s*firstName\s*}}/gi, clientFirstName) : text;
  const personalizedNotes = personalizeText(state.notes);
  const displayName = [clientName, state.invoiceNumber, state.date]
    .filter(Boolean)
    .join(" — ");
  const safeFile = (s: string) =>
    s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "invoice";
  const fileName = safeFile(
    clientName
      ? `${clientName} ${state.invoiceNumber || ""}`.trim()
      : state.invoiceNumber || "invoice",
  );

  const buildSavedEntry = (): SavedInvoice => ({
    id: crypto.randomUUID(),
    savedAt: Date.now(),
    invoiceNumber: state.invoiceNumber,
    displayName,
    total,
    currencySymbol: currency.symbol,
    snapshot: { ...state, notes: personalizedNotes },
  });


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
        const palette = extractPalette(ctx, w, h);
        setState((s) => ({ ...s, logo: out, logoPalette: palette }));
      };
      img.onerror = () => update("logo", dataUrl);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const prepareForExport = () => {
    if (!invoiceRef.current) return () => {};
    const restore: (() => void)[] = [];
    const hide = (selector: string) => {
      const el = invoiceRef.current!.querySelector<HTMLElement>(selector);
      if (!el) return;
      const prev = el.style.display;
      el.style.display = "none";
      restore.push(() => {
        el.style.display = prev;
      });
    };
    if (!state.shipTo.trim()) hide('[data-export="shipTo"]');
    if (!state.paymentTerms.trim()) hide('[data-export="paymentTerms"]');
    if (!state.dueDate) hide('[data-export="dueDate"]');
    if (!state.poNumber.trim()) hide('[data-export="poNumber"]');
    if (!personalizedNotes.trim()) hide('[data-export="notes"]');
    if (!state.terms.trim()) hide('[data-export="terms"]');
    if (!Number(state.scheduledPayment) && !state.scheduledDate)
      hide('[data-export="scheduled"]');
    if (!Number(state.taxRate)) hide('[data-export="tax"]');
    if (!Number(state.discount)) hide('[data-export="discount"]');
    if (!Number(state.shipping)) hide('[data-export="shipping"]');
    if (!Number(state.amountPaid)) hide('[data-export="amountPaid"]');
    return () => restore.forEach((f) => f());
  };

  const downloadPDF = async () => {
    if (!invoiceRef.current) return;
    toast.loading("Generating PDF...", { id: "pdf" });
    let saved = false;
    let restore: () => void = () => {};
    try {
      try {
        await saveInvoiceSnapshotAsync(buildSavedEntry());
        saved = true;
      } catch (saveErr) {
        console.warn("Could not save invoice snapshot:", saveErr);
      }

      restore = prepareForExport();
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
      pdf.save(`${fileName}.pdf`);
      toast.success(saved ? "PDF downloaded & saved" : "PDF downloaded, but not saved", {
        id: "pdf",
      });
    } catch (e) {
      console.error("PDF error:", e);
      toast.error("Failed to generate PDF", { id: "pdf" });
    } finally {
      restore();
    }
  };

  const saveLocal = async () => {
    try {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, logo: null }));
      }
      await saveInvoiceSnapshotAsync(buildSavedEntry());
      toast.success("Invoice saved to Saved Invoices");
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Could not save invoice");
    }
  };

  const saveAndOpenSaved = async () => {
    try {
      await saveInvoiceSnapshotAsync(buildSavedEntry());
      toast.success("Invoice saved");
      navigate({ to: "/saved" });
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Could not save invoice");
    }
  };

  const loadSample = (sample: InvoiceSample) => {
    setState((s) => ({
      ...defaultState(),
      // preserve logo, theme & currency the user already set
      logo: s.logo,
      logoPalette: s.logoPalette,
      themeColor: s.themeColor,
      currency: s.currency,
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      from: SAMPLE_FROM,
      billTo: "",
      shipTo: "",
      date: today(),
      paymentTerms: `Net ${sample.timeline}`,
      poNumber: sample.product,
      items: sample.items.map((it) => ({ id: crypto.randomUUID(), ...it })),
      notes: sample.notes,
      amountPaid: sample.amountPaid,
      scheduledPayment: sample.scheduledPayment,
    }));
    toast.success(`Loaded sample: ${sample.title}`);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
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
            <Button variant="outline" onClick={saveAndOpenSaved} className="rounded-lg">
              <FolderOpen className="mr-2 h-4 w-4" /> Saved
            </Button>
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
              {state.logo && state.logoPalette.length > 0 && (
                <div className="mt-3 flex items-center gap-2 print:hidden">
                  <span className="text-xs text-muted-foreground">Theme:</span>
                  {state.logoPalette.map((c) => (
                    <button
                      key={c}
                      onClick={() => update("themeColor", c)}
                      title={`Use ${c}`}
                      aria-label={`Use color ${c}`}
                      className={`h-6 w-6 rounded-full border-2 transition ${
                        state.themeColor === c
                          ? "border-foreground scale-110"
                          : "border-white shadow"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  {state.themeColor && (
                    <button
                      onClick={() => update("themeColor", null)}
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      Reset
                    </button>
                  )}
                </div>
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
            <div data-export="shipTo">
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
              dataExport="paymentTerms"
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
              dataExport="dueDate"
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
              dataExport="poNumber"
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
                  value={personalizedNotes}
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

        {/* Samples — visible only outside print, sits below the invoice card */}
        <div className="mt-10 print:hidden">
          <div className="mb-4">
            <h2 className="text-xl font-bold tracking-tight">Sample Invoices</h2>
            <p className="text-sm text-muted-foreground">
              Pre-built Appoint Funnels invoices. Click "Use this sample" to load it
              straight into the editor above.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {SAMPLES.map((sample) => {
              const subtotal = sample.items.reduce(
                (sum, it) => sum + (Number(it.rate.match(/-?\d+(\.\d+)?/)?.[0]) || 0),
                0,
              );
              return (
                <div
                  key={sample.id}
                  className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">{sample.title}</h3>
                      <p className="text-xs text-muted-foreground">{sample.tagline}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {sample.product}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {sample.items.map((it, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between gap-3 border-b border-dashed border-border/60 py-1 last:border-0"
                      >
                        <span className="truncate text-foreground">
                          {it.description}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          ${it.rate}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <span className="text-sm text-muted-foreground">Subtotal</span>
                    <span className="text-base font-bold tabular-nums">
                      ${subtotal.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <Button
                    onClick={() => loadSample(sample)}
                    className="mt-4 rounded-lg"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Use this sample
                  </Button>
                </div>
              );
            })}
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
  dataExport,
}: {
  label: string;
  onLabelChange?: (v: string) => void;
  children: React.ReactNode;
  dataExport?: string;
}) {
  return (
    <div data-export={dataExport}>
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
  dataExport,
}: {
  label: string;
  onLabelChange?: (v: string) => void;
  value: React.ReactNode;
  bold?: boolean;
  dataExport?: string;
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
    <div className="flex items-center justify-between gap-4" data-export={dataExport}>
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

// ---------- color helpers ----------

function rgbToHex(r: number, g: number, b: number) {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function readableForeground(hex: string): string {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m) return "#ffffff";
  const [r, g, b] = m.map((x) => parseInt(x, 16));
  // perceived luminance
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.6 ? "#111111" : "#ffffff";
}

function extractPalette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): string[] {
  const run = (opts: {
    requireSaturation: boolean;
    skipNearWhite: boolean;
    skipNearBlack: boolean;
  }): string[] => {
    try {
      const { data } = ctx.getImageData(0, 0, w, h);
      const buckets = new Map<
        string,
        { r: number; g: number; b: number; n: number }
      >();
      const step = 4 * 4;
      for (let i = 0; i < data.length; i += step) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 200) continue;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (opts.skipNearWhite && max > 240 && min > 240) continue;
        if (opts.skipNearBlack && max < 25) continue;
        if (opts.requireSaturation && max - min < 20) continue;
        const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
        const cur = buckets.get(key);
        if (cur) {
          cur.r += r;
          cur.g += g;
          cur.b += b;
          cur.n += 1;
        } else {
          buckets.set(key, { r, g, b, n: 1 });
        }
      }
      const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
      const picked: string[] = [];
      for (const c of sorted) {
        const hex = rgbToHex(
          Math.round(c.r / c.n),
          Math.round(c.g / c.n),
          Math.round(c.b / c.n),
        );
        if (picked.every((p) => colorDistance(p, hex) > 60)) picked.push(hex);
        if (picked.length >= 5) break;
      }
      return picked;
    } catch {
      return [];
    }
  };

  // Pass 1: saturated, non-background colors (best for colorful logos)
  let palette = run({
    requireSaturation: true,
    skipNearWhite: true,
    skipNearBlack: true,
  });
  if (palette.length > 0) return palette;
  // Pass 2: allow grays (mono logos), still skip pure white/black
  palette = run({
    requireSaturation: false,
    skipNearWhite: true,
    skipNearBlack: true,
  });
  if (palette.length > 0) return palette;
  // Pass 3: include black (white/black logos)
  palette = run({
    requireSaturation: false,
    skipNearWhite: true,
    skipNearBlack: false,
  });
  return palette;
}


function colorDistance(a: string, b: string): number {
  const pa = a.replace("#", "").match(/.{2}/g)?.map((x) => parseInt(x, 16)) ?? [0, 0, 0];
  const pb = b.replace("#", "").match(/.{2}/g)?.map((x) => parseInt(x, 16)) ?? [0, 0, 0];
  return Math.sqrt(
    (pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2 + (pa[2] - pb[2]) ** 2,
  );
}
