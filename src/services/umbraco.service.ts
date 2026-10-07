import type {
  Env,
  UmbracoEvent,
  ServiceResponse,
  CreateEventRequest,
  UmbracoContentResponse,
} from "../types/events.types";

interface UmbracoGraphQLResponse {
  data: {
    allEvent: {
      items: UmbracoEvent[];
    };
  };
}

export async function fetchEventById(
  env: Env,
  contentId: string,
): Promise<ServiceResponse<any>> {
  try {
    const response = await fetch(
      `https://api.umbraco.io/content/${contentId}`,
      {
        method: "GET",
        headers: {
          "Umb-Project-Alias": env.UMBRACO_PROJECT_ALIAS,
          "Api-Key": env.API_KEY,
          "Api-Version": "2",
        },
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();

    return { success: true, data };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("❌ Fetch event by ID failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Reads only the events under UMBRACO_PARENT_ID (the live events folder),
 * so copies in sibling folders such as a backup folder are never matched.
 * One request returns every child; the count is checked against totalCount
 * so a truncated response fails the sync instead of silently dropping events.
 */
export async function fetchUmbracoEvents(
  env: Env
): Promise<ServiceResponse<UmbracoEvent[]>> {
  try {
    const response = await fetch(`https://graphql.umbraco.io`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Umb-Project-Alias": env.UMBRACO_PROJECT_ALIAS,
        "Api-Key": env.API_KEY,
      },
      body: JSON.stringify({
        query: `
          query {
            content(id: ${JSON.stringify(env.UMBRACO_PARENT_ID)}, preview: true) {
              children {
                totalCount
                items {
                  id
                  name
                  ... on Event {
                    eventId
                    lastUpdatedDate
                    title
                    startDate endDate eventVenues
                  }
                }
              }
            }
          }
        `,
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const json: any = await response.json();
    const children = json?.data?.content?.children;
    if (!children) {
      throw new Error(
        json?.errors?.[0]?.message || "Parent content not found in Umbraco"
      );
    }
    if (children.items.length !== children.totalCount) {
      throw new Error(
        `Umbraco returned ${children.items.length} of ${children.totalCount} events`
      );
    }
    // Skip children that aren't events (they have no eventId field)
    const events: UmbracoEvent[] = children.items.filter(
      (item: any) => "eventId" in item
    );
    return { success: true, data: events };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("❌ Fetch failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function createUmbracoEvent(
  env: Env,
  eventData: CreateEventRequest,
): Promise<ServiceResponse<UmbracoContentResponse>> {
  try {
    const requestBody = JSON.stringify(eventData);
    const response = await fetch("https://api.umbraco.io/content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Umb-Project-Alias": env.UMBRACO_PROJECT_ALIAS,
        "Api-Key": env.API_KEY,
        "Api-Version": "2",
      },
      body: requestBody,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} — ${body}`);
    }

    const data: any = await response.json();

    // Check if the response contains an error object
    if (data.error) {
      throw new Error(
        `Umbraco API error: ${data.error.code} - ${data.error.message} | Full response: ${JSON.stringify(data)}`,
      );
    }

    if (!data._id) {
      throw new Error(`Invalid response: missing _id in created content | Full response: ${JSON.stringify(data)}`);
    }

    return { success: true, data };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("❌ Create failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function updateUmbracoEvent(
  env: Env,
  contentId: string,
  eventData: Partial<CreateEventRequest>,
): Promise<ServiceResponse<UmbracoContentResponse>> {
  try {
    const response = await fetch(
      `https://api.umbraco.io/content/${contentId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Umb-Project-Alias": env.UMBRACO_PROJECT_ALIAS,
          "Api-Key": env.API_KEY,
          "Api-Version": "2",
        },
        body: JSON.stringify({ parentId: env.UMBRACO_PARENT_ID, ...eventData }),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();
    if (data.error) {
      throw new Error(
        `Umbraco API error: ${data.error.code} - ${data.error.message}`,
      );
    }

    return { success: true, data };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("❌ Update failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function publishUmbracoEvent(
  env: Env,
  contentId: string,
): Promise<ServiceResponse<UmbracoContentResponse>> {
  try {
    const response = await fetch(
      `https://api.umbraco.io/content/${contentId}/publish`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Umb-Project-Alias": env.UMBRACO_PROJECT_ALIAS,
          "Api-Key": env.API_KEY,
          "Api-Version": "2",
        },
        body: JSON.stringify({ cultures: ["*"] }),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();
    if (data.error) {
      throw new Error(
        `Umbraco API error: ${data.error.code} - ${data.error.message}`,
      );
    }

    return { success: true, data };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("❌ Publish failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
