import { createFileRoute } from "@tanstack/react-router";
import InvoiceGenerator from "@/components/InvoiceGenerator";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Invoice Generator — Create & Download Professional Invoices" },
      {
        name: "description",
        content:
          "Free, modern invoice generator. Create, customize, and download professional PDF invoices in seconds with multi-currency support.",
      },
    ],
  }),
});

function Index() {
  return (
    <>
      <InvoiceGenerator />
      <Toaster />
    </>
  );
}
