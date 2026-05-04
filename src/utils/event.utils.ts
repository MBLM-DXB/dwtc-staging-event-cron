import type {
  CrmEvent,
  UmbracoEvent,
  CreateEventRequest,
} from "../types/events.types";
import { location as locationMap } from "../constants/location";

function mapLocationCodes(locationCodes: string): string[] {
  return [
    ...new Set(
      locationCodes
        .split(",")
        .map(
          (code) =>
            locationMap[code.trim() as keyof typeof locationMap] ?? code.trim(),
        ),
    ),
  ];
}

/**
 * Remove surrounding quotes from a date string if present
 */
function normalizeDateString(dateString: string): string {
  return dateString.replace(/^"(.*)"$/, "$1");
}

export function filterEventsByVenue(
  events: CrmEvent[],
  venue: string,
): CrmEvent[] {
  const filteredEvents = events.filter(
    (event) =>
      event.eventVenues &&
      event.eventVenues.includes(venue) &&
      event.WebsiteStatus.toLowerCase() === "online",
  );
  return filteredEvents;
}

export interface SyncResult {
  toUpdate: Array<{ umbracoEvent: UmbracoEvent; crmEvent: CrmEvent }>;
  toCreate: CrmEvent[];
}

export function compareEvents(
  crmEvents: CrmEvent[],
  umbracoEvents: UmbracoEvent[],
): SyncResult {
  const toUpdate: Array<{ umbracoEvent: UmbracoEvent; crmEvent: CrmEvent }> =
    [];
  const toCreate: CrmEvent[] = [];
  const umbracoMap = new Map<string, UmbracoEvent>();
  umbracoEvents.forEach((event) => {
    umbracoMap.set(event.eventId, event);
  });
  crmEvents.forEach((crmEvent) => {
    const crmEventId = crmEvent.eventId.toString();
    const umbracoEvent = umbracoMap.get(crmEventId);
    if (umbracoEvent) {
      const normalizedCrmDate = normalizeDateString(crmEvent.lastUpdatedDate);
      const normalizedUmbracoDate = normalizeDateString(
        umbracoEvent.lastUpdatedDate,
      );
      if (normalizedCrmDate !== normalizedUmbracoDate) {
        toUpdate.push({ umbracoEvent, crmEvent });
      }
    } else {
      toCreate.push(crmEvent);
    }
  });

  return { toUpdate, toCreate };
}

export function mapCrmEventToUmbraco(
  crmEvent: CrmEvent,
  parentId?: string,
): CreateEventRequest | Omit<CreateEventRequest, "parentId"> {
  const baseData = {
    name: {
      "en-US": crmEvent.title,
      ar: crmEvent.title,
    },
    contentTypeAlias: "event",
    title: {
      "en-US": crmEvent.title,
      ar: crmEvent.title,
    },
    description: {
      "en-US": crmEvent.pageContent,
      ar: crmEvent.pageContent,
    },
    // location: {
    //   "en-US": crmEvent.location ? mapLocationCodes(crmEvent.location) : null,
    //   ar: crmEvent.location ? mapLocationCodes(crmEvent.location) : null,
    // },
    eventOrganiser: {
      "en-US": crmEvent.eventOrganiser,
      ar: crmEvent.eventOrganiser,
    },
    websiteURL: {
      "en-US": crmEvent.websiteURL,
      ar: crmEvent.websiteURL,
    },
    eventId: {
      $invariant: crmEvent.eventId,
    },
    lastUpdatedDate: {
      $invariant: `"${crmEvent.lastUpdatedDate}"`,
    },
    // facebook: {
    //   "en-US": crmEvent.socialMedia?.facebook || null,
    //   ar: crmEvent.socialMedia?.facebook || null,
    // },
    // linkedIn: {
    //   "en-US": crmEvent.socialMedia?.linkedIn || null,
    //   ar: crmEvent.socialMedia?.linkedIn || null,
    // },
    // twitter: {
    //   "en-US": null,
    //   ar: null,
    // },
    // instagram: {
    //   "en-US": crmEvent.socialMedia?.instagram || null,
    //   ar: crmEvent.socialMedia?.instagram || null,
    // },
    // youtube: {
    //   "en-US": crmEvent.socialMedia?.youtube || null,
    //   ar: crmEvent.socialMedia?.youtube || null,
    // },
    // tiktok: {
    //   "en-US": crmEvent.socialMedia?.tiktok || null,
    //   ar: crmEvent.socialMedia?.tiktok || null,
    // },
    startDate: {
      $invariant: crmEvent.startDate,
    },
    endDate: {
      $invariant: crmEvent.endDate,
    },
    dWTCEvent: {
      $invariant: crmEvent.dWTCEvent,
    },
    // eventSectors: {
    //   $invariant: crmEvent.eventSectors,
    // },
    eventType: {
      $invariant: crmEvent.eventType,
    },
    eventVenues: {
      $invariant: crmEvent.location
        ? mapLocationCodes(crmEvent.location)
        : null,
    },
  };

  if (parentId) {
    return { ...baseData, parentId };
  }

  return baseData;
}
