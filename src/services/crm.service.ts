import type { Env, CrmEvent, ServiceResponse } from "../types/events.types";

const CRM_FETCH_TIMEOUT_MS = 180_000;
const CRM_FETCH_MAX_ATTEMPTS = 2;
const CRM_FETCH_RETRY_DELAY_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Same day one year from now (YYYY-MM-DD, UTC), e.g. 2026-10-01 -> 2027-10-01
function getEventEndDate(): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function buildCrmUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("eventEndDate", getEventEndDate());
  return url.toString();
}

export async function fetchCrmEvents(
  env: Env
): Promise<ServiceResponse<CrmEvent[]>> {
  let lastError = "Unknown error occurred";
  const crmUrl = buildCrmUrl(env.CRM_API_URL);

  for (let attempt = 1; attempt <= CRM_FETCH_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(crmUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": env.OCP_APIM_SUBSCRIPTION_KEY,
        },
        signal: AbortSignal.timeout(CRM_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: CrmEvent[] = await response.json();
      return { success: true, data };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error occurred";
      console.error(
        `❌ Fetch failed (attempt ${attempt}/${CRM_FETCH_MAX_ATTEMPTS}):`,
        lastError
      );
      if (attempt < CRM_FETCH_MAX_ATTEMPTS) {
        await sleep(CRM_FETCH_RETRY_DELAY_MS);
      }
    }
  }

  return { success: false, error: lastError };
}
