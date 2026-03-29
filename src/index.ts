import { fetchCrmEvents } from "./services/crm.service";
import {
  fetchUmbracoEvents,
  createUmbracoEvent,
  updateUmbracoEvent,
  publishUmbracoEvent,
  fetchEventById,
} from "./services/umbraco.service";
import { sendSyncNotificationEmail } from "./services/mailgun.service";
import {
  filterEventsByVenue,
  compareEvents,
  mapCrmEventToUmbraco,
} from "./utils/event.utils";
import type { Env, CreateEventRequest } from "./types/events.types";

export interface ExportedHandler {
  scheduled: (
    event: { cron: string },
    env: Env,
    ctx: ExecutionContext
  ) => Promise<void>;
  fetch: (
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ) => Promise<Response>;
}

export default {
  async scheduled(event, env, ctx) {
    console.log("🔄 Starting CRM to Umbraco sync...");

    const crmResponse = await fetchCrmEvents(env);
    const umbracoResponse = await fetchUmbracoEvents(env);
    if (!crmResponse.success) {
      console.error("❌ Failed to fetch CRM events:", crmResponse.error);
      return;
    }
    if (!umbracoResponse.success) {
      console.error(
        "❌ Failed to fetch Umbraco events:",
        umbracoResponse.error
      );
      return;
    }
    const filteredCrmEvents = filterEventsByVenue(crmResponse.data, "DWTC");
    console.log(`📊 Found ${filteredCrmEvents.length} DWTC events in CRM`);

    const { toUpdate, toCreate } = compareEvents(
      filteredCrmEvents,
      umbracoResponse.data
    );

    console.log(`🔄 Events to update: ${toUpdate.length}`);
    console.log(`➕ Events to create: ${toCreate.length}`);

    const processedEventIds: string[] = [];
    const updatedEvents: Array<{
      title: string;
      eventId: number;
      startDate: string;
      endDate: string;
      location: string | null;
      eventType: string;
      eventOrganiser: string;
    }> = [];
    const createdEvents: Array<{
      title: string;
      eventId: number;
      startDate: string;
      endDate: string;
      location: string | null;
      eventType: string;
      eventOrganiser: string;
    }> = [];
    const failedEvents: Array<{
      title: string;
      eventId: number;
      startDate: string;
      endDate: string;
      location: string | null;
      eventType: string;
      eventOrganiser: string;
      error: string;
    }> = [];

    if (toUpdate.length === 0 && toCreate.length === 0) {
      console.log("✅ All events are up to date - no sync needed!");
      return;
    }

    for (const { umbracoEvent, crmEvent } of toUpdate) {
      const fetchResult = await fetchEventById(env, umbracoEvent.id);
      if (!fetchResult.success) {
        console.error(
          `❌ Failed to fetch event ${crmEvent.eventId} for update:`,
          fetchResult.error
        );
        failedEvents.push({
          title: crmEvent.title,
          eventId: crmEvent.eventId,
          startDate: crmEvent.startDate,
          endDate: crmEvent.endDate,
          location: crmEvent.location,
          eventType: crmEvent.eventType,
          eventOrganiser: crmEvent.eventOrganiser,
          error: fetchResult.error,
        });
        continue;
      }
      const existingEvent = fetchResult.data;
      delete existingEvent._createDate;
      delete existingEvent._id;
      delete existingEvent._hasChildren;
      delete existingEvent._level;
      delete existingEvent.sortOrder;
      delete existingEvent._currentVersionState;
      delete existingEvent._updateDate;
      delete existingEvent.rel;
      delete existingEvent._links;
      const crmEventData = mapCrmEventToUmbraco(crmEvent);

      const eventData = {
        ...existingEvent,
        ...crmEventData,
      };
      const updateResult = await updateUmbracoEvent(
        env,
        umbracoEvent.id,
        eventData
      );

      if (updateResult.success) {
        console.log(`✏️ Updated: ${crmEvent.title} (ID: ${crmEvent.eventId})`);
        processedEventIds.push(umbracoEvent.id);
        updatedEvents.push({
          title: crmEvent.title,
          eventId: crmEvent.eventId,
          startDate: crmEvent.startDate,
          endDate: crmEvent.endDate,
          location: crmEvent.location,
          eventType: crmEvent.eventType,
          eventOrganiser: crmEvent.eventOrganiser,
        });
      } else {
        console.error(
          `❌ Failed to update event ${crmEvent.eventId}:`,
          updateResult.error
        );
        failedEvents.push({
          title: crmEvent.title,
          eventId: crmEvent.eventId,
          startDate: crmEvent.startDate,
          endDate: crmEvent.endDate,
          location: crmEvent.location,
          eventType: crmEvent.eventType,
          eventOrganiser: crmEvent.eventOrganiser,
          error: updateResult.error,
        });
      }
    }

    for (const crmEvent of toCreate) {
      const eventData = mapCrmEventToUmbraco(
        crmEvent,
        env.UMBRACO_PARENT_ID
      ) as CreateEventRequest;
      const createResult = await createUmbracoEvent(env, eventData);

      if (createResult.success) {
        console.log(`➕ Created: ${crmEvent.title} (ID: ${crmEvent.eventId})`);
        processedEventIds.push(createResult.data._id);
        createdEvents.push({
          title: crmEvent.title,
          eventId: crmEvent.eventId,
          startDate: crmEvent.startDate,
          endDate: crmEvent.endDate,
          location: crmEvent.location,
          eventType: crmEvent.eventType,
          eventOrganiser: crmEvent.eventOrganiser,
        });
      } else {
        console.error(
          `❌ Failed to create event ${crmEvent.eventId}:`,
          createResult.error
        );
        failedEvents.push({
          title: crmEvent.title,
          eventId: crmEvent.eventId,
          startDate: crmEvent.startDate,
          endDate: crmEvent.endDate,
          location: crmEvent.location,
          eventType: crmEvent.eventType,
          eventOrganiser: crmEvent.eventOrganiser,
          error: createResult.error,
        });
      }
    }

    for (const contentId of processedEventIds) {
      const publishResult = await publishUmbracoEvent(env, contentId);

      if (publishResult.success) {
        const eventInfo = [...updatedEvents, ...createdEvents].find(
          (e) =>
            e.eventId.toString() === contentId ||
            contentId.includes(e.eventId.toString())
        );
        const eventName = eventInfo?.title || contentId;
        console.log(`🚀 Published: ${eventName}`);
      } else {
        console.error(
          `❌ Failed to publish event ${contentId}:`,
          publishResult.error
        );
      }
    }

    console.log("✅ Sync completed successfully!");

    if (updatedEvents.length > 0 || createdEvents.length > 0 || failedEvents.length > 0) {
      try {
        await sendSyncNotificationEmail(env, {
          updatedEvents,
          createdEvents,
          failedEvents,
          syncDate: new Date().toLocaleString("en-US", {
            timeZone: "Asia/Dubai",
            dateStyle: "full",
            timeStyle: "long",
          }),
        });
      } catch (emailError) {
        console.error("⚠️ Sync completed but email notification failed");
      }
    }

    if (processedEventIds.length > 0) {
      try {
        console.log("🔨 Triggering Cloudflare Pages build...");
        const webhookResponse = await fetch(env.CLOUDFLARE_WEBHOOK, {
          method: "POST",
        });

        if (webhookResponse.ok) {
          console.log("✅ Cloudflare Pages build triggered successfully!");
        } else {
          console.error(
            `⚠️ Failed to trigger Cloudflare build: ${webhookResponse.status}`
          );
        }
      } catch (webhookError) {
        console.error("⚠️ Failed to trigger Cloudflare build webhook");
      }
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/run-cron") {
      await this.scheduled({ cron: "manual" }, env, ctx);
      return new Response("Cron job executed", { status: 200 });
    }

    if (url.pathname === "/health" || url.pathname === "/status") {
      return new Response("OK", {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    return new Response("Hello World", { status: 200 });
  },
} satisfies ExportedHandler;
