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
      { description: "Mailboxes Cost (20 @ $3.50)", quantity: "1", rate: "70" },
      { description: "Leads Cost ($50 / 10k)", quantity: "1", rate: "90" },
      { description: "Instantly Plan (Split)", quantity: "1", rate: "48.50" },
      { description: "Email Verification", quantity: "1", rate: "50" },
      { description: "Personalization Credits", quantity: "1", rate: "10" },
    ],
    notes:
      "{{firstName}} thanks for partnering with us!\n\nTotal Monthly Investment $268.50\nExpected Return $9,000 - $15,000\nEstimated ROI 3,252% - 5,487%\nTime to Results 65 Days\nMailboxes & verification tools billed monthly at cost.",
    amountPaid: 268.5,
    scheduledPayment: 0,
  },
];

export const SAMPLE_FROM = FROM;
