import type {
  CrmEvent,
  UmbracoEvent,
  CreateEventRequest,
} from "../types/events.types";

const ORG_SUFFIXES = /\s*(GmbH|LLC|L\.L\.C|FZE|FZ-LLC|Ltd)\b\.?/gi;

function stripOrgSuffixes(name: string): string {
  return name.replace(ORG_SUFFIXES, "").trim();
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
  const now = new Date();
  const sixMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
  const filteredEvents = events.filter(
    (event) =>
      event.eventVenues &&
      event.eventVenues.includes(venue) &&
      event.WebsiteStatus?.toLowerCase() === "online" &&
      new Date(event.endDate) <= sixMonthsFromNow,
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
  const now = new Date();
  crmEvents.forEach((crmEvent) => {
    if (new Date(crmEvent.endDate) < now) {
      return;
    }
    const crmEventId = crmEvent.eventId.toString();
    const umbracoEvent = umbracoMap.get(crmEventId);
    if (umbracoEvent) {
      if (crmEvent.lastUpdatedDate !== normalizeDateString(umbracoEvent.lastUpdatedDate)) {
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
    // description: {
    //   "en-US": crmEvent.pageContent,
    //   ar: crmEvent.pageContent,
    // },
    // location: {
    //   "en-US": crmEvent.location ? mapLocationCodes(crmEvent.location) : null,
    //   ar: crmEvent.location ? mapLocationCodes(crmEvent.location) : null,
    // },
    eventOrganiser: {
      "en-US": stripOrgSuffixes(crmEvent.eventOrganiser),
      ar: stripOrgSuffixes(crmEvent.eventOrganiser),
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
    // eventVenues: CRM location data is unreliable — do not overwrite Umbraco values
  };

  if (parentId) {
    return { ...baseData, parentId };
  }

  return baseData;
}
