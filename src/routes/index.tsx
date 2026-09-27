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
      { property: "og:title", content: "Invoice Generator — Create & Download Professional Invoices" },
      { property: "og:description", content: "Create, customize, and download professional PDF invoices with multi-currency support." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
