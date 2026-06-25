// Pre-built sample invoices for Appoint Funnels.
// Clicking "Use sample" loads the snapshot into the editor canvas.

export type SampleItem = {
  description: string;
  quantity: string;
  rate: string;
};

export type InvoiceSample = {
  id: string;
  title: string;
  tagline: string;
  product: string;
  items: SampleItem[];
  notes: string;
  amountPaid: number;
  scheduledPayment: number;
  timeline: string;
};

const FROM = "Ziauddin Shah\nAppoint Funnels\nhello@appointfunnels.com";

export const SAMPLES: InvoiceSample[] = [
  {
    id: "website-design",
    title: "Website Design",
    tagline: "Conversion-focused website build for a client brand.",
    product: "Website Design & Development",
    timeline: "21",
    items: [
      { description: "UI/UX design (up to 6 pages)", quantity: "1", rate: "450" },
      { description: "Responsive front-end development", quantity: "1", rate: "550" },
      { description: "CMS integration (Webflow / WordPress)", quantity: "1", rate: "250" },
      { description: "On-page SEO setup", quantity: "1", rate: "120" },
      { description: "1 month of post-launch support", quantity: "1", rate: "80" },
    ],
    notes: "Includes 2 revision rounds. Hosting billed separately.",
    amountPaid: 700,
    scheduledPayment: 750,
  },
  {
    id: "sales-system",
    title: "Sales System",
    tagline: "End-to-end outbound + CRM setup, modeled on our Cold Emailing System.",
    product: "AI Sales System",
    timeline: "30",
    items: [
      { description: "CRM setup (HubSpot / GoHighLevel)", quantity: "1", rate: "180" },
      { description: "Pipeline & automation build", quantity: "1", rate: "220" },
      { description: "Cold email sequences (Instantly.ai)", quantity: "1", rate: "150" },
      { description: "Leads scraping & verification", quantity: "1", rate: "95" },
      { description: "Reporting dashboard", quantity: "1", rate: "75" },
      { description: "Team training (2 sessions)", quantity: "1", rate: "80" },
    ],
    notes: "Mailboxes & verification tools billed monthly at cost.",
    amountPaid: 400,
    scheduledPayment: 400,
  },
];

export const SAMPLE_FROM = FROM;
