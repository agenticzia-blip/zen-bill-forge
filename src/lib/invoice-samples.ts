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
  terms: string;
  amountPaid: number;
  scheduledPayment: number;
  timeline: string;
  currency?: string;
  date?: string;
  dueDate?: string;
  paymentTerms?: string;
  billTo?: string;
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
    terms: "",
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
      { description: "Mailboxes Cost (20 @ $3.50)", quantity: "1", rate: "70" },
      { description: "Leads Cost ($50 / 10k)", quantity: "1", rate: "90" },
      { description: "Instantly Plan (Split)", quantity: "1", rate: "48.50" },
      { description: "Email Verification", quantity: "1", rate: "50" },
      { description: "Personalization Credits", quantity: "1", rate: "10" },
    ],
    notes:
      "Complete cold outreach infrastructure setup designed to reach decision-makers and book meetings and close clients.\n\n{{firstName}} thanks for partnering with us!\n\nTotal Monthly Investment $268.50\nExpected Return $9,000 - $15,000\nEstimated ROI 3,252% - 5,487%\nTime to Results 65 Days\nMailboxes & verification tools billed monthly at cost.",
    terms: "",
    amountPaid: 268.5,
    scheduledPayment: 0,
  },
  {
    id: "appointrium-academy",
    title: "Appointrium Academy",
    tagline: "Elite plan for Appointrium Academy clients.",
    product: "Elite Plan",
    timeline: "45",
    currency: "PKR",
    date: "2026-08-01",
    dueDate: "2026-08-01",
    paymentTerms: "45 Days",
    billTo: "Musab Ali",
    items: [
      { description: "Appointrium Elite Package", quantity: "1", rate: "12000" },
    ],
    notes: "Welcome To Appointrium Academy",
    terms: "First Client Guaranteed Within 45 Days",
    amountPaid: 0,
    scheduledPayment: 0,
  },
  {
    id: "ai-cold-sms-system",
    title: "AI Cold SMS System",
    tagline: "Cold SMS outreach infrastructure — numbers, leads, platform and AI personalization.",
    product: "AI Cold SMS System",
    timeline: "30",
    items: [
      { description: "Dedicated SMS Numbers (10 @ $4.50)", quantity: "1", rate: "45" },
      { description: "Leads Cost ($50 / 10k)", quantity: "1", rate: "90" },
      { description: "SMS Platform Plan (Split)", quantity: "1", rate: "65" },
      { description: "Number Verification & Carrier Lookup", quantity: "1", rate: "40" },
      { description: "AI Personalization Credits", quantity: "1", rate: "15" },
    ],
    notes:
      "Complete cold SMS outreach infrastructure setup designed to reach decision-makers directly and book meetings and close clients.\n\n{{firstName}} thanks for partnering with us!\n\nTotal Monthly Investment $255\nExpected Return $8,000 - $14,000\nEstimated ROI 3,039% - 5,392%\nTime to Results 60 Days\nSMS numbers & verification tools billed monthly at cost.",
    terms: "",
    amountPaid: 255,
    scheduledPayment: 0,
  },
];

export const SAMPLE_FROM = FROM;
