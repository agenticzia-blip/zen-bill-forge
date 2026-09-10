import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  text: z.string().min(1).max(20000),
});

export type ParsedInvoice = {
  billTo?: string;
  from?: string;
  poNumber?: string;
  paymentTerms?: string;
  currency?: string;
  items?: { description?: string; quantity?: string; rate?: string }[];
  notes?: string;
  terms?: string;
  taxRate?: string;
  discount?: string;
  shipping?: string;
  amountPaid?: string;
  scheduledPayment?: string;
};

const SYSTEM = `You turn messy proposal / pricing text into structured invoice data.
Return ONLY JSON matching this shape (omit unknown fields, never invent prices):
{
  "billTo": string,            // client / company name + any contact lines
  "from": string,              // sender business block, only if present in text
  "poNumber": string,          // product / package name if mentioned
  "paymentTerms": string,
  "currency": "USD" | "PKR" | "EUR" | "GBP",
  "items": [{ "description": string, "quantity": string, "rate": string }],
  "notes": string,             // short description of the offer
  "terms": string,             // guarantees / conditions
  "taxRate": string,
  "discount": string,
  "shipping": string,
  "amountPaid": string,
  "scheduledPayment": string
}
Keep rate as the plain number (no currency symbol). Keep every line item found.
Copy every item description VERBATIM from the client text — never rewrite, shorten, summarise or invent wording.
Never output a "from" field; the sender block is fixed by the app.
Never output a "notes" field; the description block is fixed by the app.
Put any extra conditions or guarantees in "terms" only.`;

export const parseProposalToInvoice = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: data.text },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Rate limit reached, try again shortly");
    if (res.status === 402) throw new Error("AI credits exhausted");
    if (!res.ok) throw new Error(`AI request failed (${res.status})`);

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      const parsed = JSON.parse(cleaned) as ParsedInvoice;
      return parsed;
    } catch {
      throw new Error("Could not read the AI response");
    }
  });
