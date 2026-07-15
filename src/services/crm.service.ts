import type { Env, CrmEvent, ServiceResponse } from "../types/events.types";

const CRM_FETCH_TIMEOUT_MS = 180_000;
const CRM_FETCH_MAX_ATTEMPTS = 2;
const CRM_FETCH_RETRY_DELAY_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchCrmEvents(
  env: Env
): Promise<ServiceResponse<CrmEvent[]>> {
  let lastError = "Unknown error occurred";

  for (let attempt = 1; attempt <= CRM_FETCH_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(env.CRM_API_URL, {
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
