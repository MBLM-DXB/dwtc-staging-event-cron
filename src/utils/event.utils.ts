import type {
  CrmEvent,
  UmbracoEvent,
  CreateEventRequest,
} from "../types/events.types";
import { location as locationMap } from "../constants/location";

const ORG_SUFFIXES = /\s*(GmbH|LLC|L\.L\.C|FZE|FZ-LLC|Ltd)\b\.?/gi;

function stripOrgSuffixes(name: string): string {
  return name.replace(ORG_SUFFIXES, "").trim();
}

export function slugifyEventName(title: string, startDate: string): string {
  const year = new Date(startDate).getFullYear();
  const name = title
    .replace(/[?#[\]@!$&'()*+,;=<>\\^`{}|~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+\d{4}$/, "");
  return `${name} ${year}`;
}

export function mapLocationCodes(locationCodes: string): string[] {
  return [
    ...new Set(
      locationCodes
        .split(",")
        .filter((code) => code.trim() in locationMap)
        .map((code) => locationMap[code.trim() as keyof typeof locationMap]),
    ),
  ];
}

export function hasLocationChanged(
  crmLocation: string | null,
  umbracoVenues: string[]
): boolean {
  const crmVenues = crmLocation ? mapLocationCodes(crmLocation) : [];
  const a = [...crmVenues].sort();
  const b = [...umbracoVenues].sort();
  return a.length !== b.length || a.some((v, i) => v !== b[i]);
}

export function formatEventLocation(crmLocation: string | null): string {
  if (!crmLocation) return "N/A";
  const venues = mapLocationCodes(crmLocation);
  return venues.length > 0 ? venues.join(", ") : "N/A";
}

/**
 * Remove surrounding quotes from a date string if present
 */
function normalizeDateString(dateString: string): string {
  return dateString.replace(/^"(.*)"$/, "$1");
}

const CANCELLED_STATUSES = new Set(["cancelled", "post-contract cancellation"]);

export function isEventCancelled(event: CrmEvent): boolean {
  return CANCELLED_STATUSES.has((event.Status || "").trim().toLowerCase());
}

const ALLOWED_EVENT_TYPES = new Set([
  "Exhibition",
  "Sports",
  "Conference",
  "Brand Sales",
  "Concert",
]);

export function filterEventsByVenue(
  events: CrmEvent[],
  venue: string,
): CrmEvent[] {
  const filteredEvents = events.filter(
    (event) =>
      event.eventVenues &&
      event.eventVenues.includes(venue) &&
      event.WebsiteStatus?.toLowerCase() === "online" &&
      !isEventCancelled(event) &&
      ALLOWED_EVENT_TYPES.has(event.eventType),
  );
  return filteredEvents;
}

/**
 * CRM events that are marked Online + cancelled and already exist as an
 * event in Umbraco (matched by eventId) — these need manual follow-up since
 * they're live on the website but cancelled in the CRM.
 */
export function findCancelledLiveEvents(
  events: CrmEvent[],
  venue: string,
  umbracoEvents: UmbracoEvent[],
): CrmEvent[] {
  const umbracoEventIds = new Set(umbracoEvents.map((e) => e.eventId));
  return events.filter(
    (event) =>
      event.eventVenues &&
      event.eventVenues.includes(venue) &&
      event.WebsiteStatus?.toLowerCase() === "online" &&
      isEventCancelled(event) &&
      umbracoEventIds.has(event.eventId.toString()),
  );
}

/**
 * CRM events whose WebsiteStatus is no longer "online" but still exist in
 * Umbraco (matched by eventId) and haven't ended yet — they were synced while
 * online, so they're still showing on the website and need manual follow-up.
 */
export function findOfflineLiveEvents(
  events: CrmEvent[],
  venue: string,
  umbracoEvents: UmbracoEvent[]
): CrmEvent[] {
  const umbracoEventIds = new Set(umbracoEvents.map((e) => e.eventId));
  const now = new Date();
  return events.filter(
    (event) =>
      event.eventVenues &&
      event.eventVenues.includes(venue) &&
      event.WebsiteStatus?.toLowerCase() !== "online" &&
      new Date(event.endDate) >= now &&
      umbracoEventIds.has(event.eventId.toString())
  );
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
