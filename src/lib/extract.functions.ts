import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Shape shared across all extraction methods.
export interface ExtractedProperty {
  title?: string | null;
  monthly_rent?: number | null;
  security_deposit?: number | null;
  utilities_estimate?: number | null;
  agent_fee?: number | null;
  address?: string | null;
  description?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  furnished?: string | null;
  parking?: boolean | null;
  pet_friendly?: boolean | null;
  internet?: boolean | null;
  facilities?: string[];
  property_type?: string | null;
  agent_name?: string | null;
  agent_phone?: string | null;
  listing_url?: string | null;
  image_urls?: string[];
}

const EXTRACTION_TOOL = {
  type: "function",
  function: {
    name: "record_property_details",
    description: "Save the property details extracted from the source.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short property name / listing headline" },
        monthly_rent: { type: "number", description: "Monthly rent as a plain number" },
        security_deposit: { type: "number" },
        utilities_estimate: { type: "number" },
        agent_fee: { type: "number" },
        address: { type: "string" },
        description: { type: "string" },
        bedrooms: { type: "number" },
        bathrooms: { type: "number" },
        furnished: {
          type: "string",
          description: "One of: fully, partially, unfurnished, unknown",
        },
        parking: { type: "boolean" },
        pet_friendly: { type: "boolean" },
        internet: { type: "boolean" },
        facilities: {
          type: "array",
          items: { type: "string" },
          description: "Amenities like pool, gym, aircon, balcony, laundry",
        },
        property_type: {
          type: "string",
          description: "e.g. apartment, house, studio, condo, townhouse, room",
        },
        agent_name: { type: "string" },
        agent_phone: { type: "string" },
        image_urls: {
          type: "array",
          items: { type: "string" },
          description: "Only absolute https image URLs found in the source",
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You extract structured rental property details from unstructured sources (webpages, ads, screenshots).
- Only fill fields you are confident about. Omit anything unclear.
- Numbers must be plain numeric values, no currency symbols or thousands separators.
- Return concise strings; strip marketing fluff from titles.
- Always call the record_property_details tool exactly once.`;

const MODEL = "google/gemini-2.5-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callGateway(messages: unknown[]): Promise<ExtractedProperty> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "function", function: { name: "record_property_details" } },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI is busy right now. Try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    throw new Error(`AI extraction failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as any;
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("AI returned no structured data");
  try {
    return JSON.parse(call.function.arguments) as ExtractedProperty;
  } catch {
    throw new Error("AI returned malformed data");
  }
}

// ---------- URL ----------
export const extractFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().url() }).parse(d))
  .handler(async ({ data }): Promise<ExtractedProperty> => {
    let html = "";
    try {
      const r = await fetch(data.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; RentalHubBot/1.0; +https://lovable.dev)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!r.ok) throw new Error(`Site returned ${r.status}`);
      html = await r.text();
    } catch (e: any) {
      throw new Error(`Could not fetch page: ${e?.message ?? "network error"}`);
    }

    // Extract candidate absolute image URLs so the model can pick relevant ones.
    const imgMatches = Array.from(
      html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi),
    )
      .map((m) => m[1])
      .filter((u) => /^https?:\/\//i.test(u))
      .slice(0, 30);

    // Strip scripts/styles then collapse whitespace, trim to a workable size.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 20000);

    const extracted = await callGateway([
      {
        role: "user",
        content: `Extract property details from this listing.
LISTING URL: ${data.url}

CANDIDATE IMAGES (pick the most relevant, discard logos/icons):
${imgMatches.join("\n")}

PAGE TEXT:
${text}`,
      },
    ]);

    return { ...extracted, listing_url: data.url };
  });

// ---------- Text ----------
export const extractFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ text: z.string().min(20).max(20000) }).parse(d),
  )
  .handler(async ({ data }): Promise<ExtractedProperty> => {
    return callGateway([
      {
        role: "user",
        content: `Extract property details from this ad text (may be from WhatsApp, Facebook Marketplace, PropertyGuru, iProperty, Mudah, etc.):\n\n${data.text}`,
      },
    ]);
  });

// ---------- Images / OCR ----------
export const extractFromImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        images: z
          .array(z.string().startsWith("data:image/"))
          .min(1)
          .max(8),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<ExtractedProperty> => {
    const content = [
      {
        type: "text",
        text: "Read these listing screenshots and extract every property detail you can. Perform OCR on text and infer amenities from icons.",
      },
      ...data.images.map((url) => ({ type: "image_url", image_url: { url } })),
    ];
    return callGateway([{ role: "user", content }]);
  });
