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

export async function fetchUmbracoEvents(
  env: Env,
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
            allEvent(preview: true) {
              items {
                id
                eventId
                lastUpdatedDate
                name
              }
            }
          }
        `,
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data: UmbracoGraphQLResponse = await response.json();
    return { success: true, data: data.data.allEvent.items };
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
    const response = await fetch("https://api.umbraco.io/content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Umb-Project-Alias": env.UMBRACO_PROJECT_ALIAS,
        "Api-Key": env.API_KEY,
        "Api-Version": "2",
      },

      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();

    // Check if the response contains an error object
    if (data.error) {
      throw new Error(
        `Umbraco API error: ${data.error.code} - ${data.error.message}`,
      );
    }

    if (!data._id) {
      throw new Error("Invalid response: missing _id in created content");
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
