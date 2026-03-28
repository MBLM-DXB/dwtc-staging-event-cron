import * as XLSX from "xlsx";
import type { Env } from "../types/events.types";

interface EventDetails {
  title: string;
  eventId: number;
  startDate?: string;
  endDate?: string;
  location?: string | null;
  eventType?: string;
  eventOrganiser?: string;
}

interface SyncSummary {
  updatedEvents: EventDetails[];
  createdEvents: EventDetails[];
  failedEvents: Array<EventDetails & { error: string }>;
  syncDate: string;
}

function generateExcelAttachment(summary: SyncSummary): Uint8Array {
  const workbook = XLSX.utils.book_new();

  const summaryData = [
    ["CRM TO UMBRACO SYNC REPORT"],
    [""],
    ["Sync Date", summary.syncDate],
    [""],
    ["SUMMARY"],
    ["Metric", "Count"],
    ["Total Events Updated", summary.updatedEvents.length],
    ["Total Events Created", summary.createdEvents.length],
    [
      "Total Events Processed",
      summary.updatedEvents.length + summary.createdEvents.length,
    ],
    ["Total Failed Events", summary.failedEvents.length],
    [""],
    ["STATUS"],
    summary.failedEvents.length === 0
      ? ["Sync Status", "✓ All events synced successfully"]
      : ["Sync Status", `⚠ ${summary.failedEvents.length} event(s) failed`],
  ];

  if (summary.updatedEvents.length > 0) {
    summaryData.push([""], ["UPDATED EVENTS"]);
    summaryData.push(["Event Name"]);
    summary.updatedEvents.forEach((e) => {
      summaryData.push([e.title]);
    });
  }

  if (summary.createdEvents.length > 0) {
    summaryData.push([""], ["CREATED EVENTS"]);
    summaryData.push(["Event Name"]);
    summary.createdEvents.forEach((e) => {
      summaryData.push([e.title]);
    });
  }

  if (summary.failedEvents.length > 0) {
    summaryData.push([""], ["FAILED EVENTS"]);
    summaryData.push(["Event Name", "Event ID", "Error"]);
    summary.failedEvents.forEach((e) => {
      summaryData.push([e.title, e.eventId, e.error]);
    });
  }

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

  summarySheet["!cols"] = [{ wch: 40 }, { wch: 15 }, { wch: 20 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  if (summary.updatedEvents.length > 0) {
    const updatedData = [
      [
        "Event Name",
        "Event ID",
        "Start Date",
        "End Date",
        "Location",
        "Event Type",
        "Organiser",
      ],
      ...summary.updatedEvents.map((e) => [
        e.title,
        e.eventId,
        e.startDate || "N/A",
        e.endDate || "N/A",
        e.location || "N/A",
        e.eventType || "N/A",
        e.eventOrganiser || "N/A",
      ]),
    ];
    const updatedSheet = XLSX.utils.aoa_to_sheet(updatedData);
    XLSX.utils.book_append_sheet(workbook, updatedSheet, "Updated Events");
  }

  if (summary.createdEvents.length > 0) {
    const createdData = [
      [
        "Event Name",
        "Event ID",
        "Start Date",
        "End Date",
        "Location",
        "Event Type",
        "Organiser",
      ],
      ...summary.createdEvents.map((e) => [
        e.title,
        e.eventId,
        e.startDate || "N/A",
        e.endDate || "N/A",
        e.location || "N/A",
        e.eventType || "N/A",
        e.eventOrganiser || "N/A",
      ]),
    ];
    const createdSheet = XLSX.utils.aoa_to_sheet(createdData);
    XLSX.utils.book_append_sheet(workbook, createdSheet, "Created Events");
  }

  if (summary.failedEvents.length > 0) {
    const failedData = [
      [
        "Event Name",
        "Event ID",
        "Start Date",
        "End Date",
        "Location",
        "Event Type",
        "Organiser",
        "Error Message",
      ],
      ...summary.failedEvents.map((e) => [
        e.title,
        e.eventId,
        e.startDate || "N/A",
        e.endDate || "N/A",
        e.location || "N/A",
        e.eventType || "N/A",
        e.eventOrganiser || "N/A",
        e.error,
      ]),
    ];
    const failedSheet = XLSX.utils.aoa_to_sheet(failedData);
    XLSX.utils.book_append_sheet(workbook, failedSheet, "Failed Events");
  }

  // Write to buffer
  const excelBuffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });
  return new Uint8Array(excelBuffer);
}

export async function sendSyncNotificationEmail(
  env: Env,
  summary: SyncSummary
): Promise<void> {
  try {
    console.log("📧 Preparing to send notification email...");
    console.log(`📧 From: ${env.NOTIFICATION_FROM_EMAIL}`);
    console.log(`📧 To: ${env.NOTIFICATION_EMAIL}`);
    console.log(`📧 Mailgun URL: ${env.MAILGUN_API_BASE_URL}/messages`);

    const totalProcessed =
      summary.updatedEvents.length + summary.createdEvents.length;

    const emailBody = buildEmailBody(summary);
    console.log("📊 Generating Excel attachment...");
    const excelBuffer = generateExcelAttachment(summary);
    const excelBlob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const formData = new FormData();
    formData.append("from", env.NOTIFICATION_FROM_EMAIL);
    formData.append("to", env.NOTIFICATION_EMAIL);
    formData.append(
      "subject",
      `CRM to Umbraco Sync Report - ${totalProcessed} Events Processed`
    );
    formData.append("html", emailBody);
    formData.append(
      "attachment",
      excelBlob,
      `sync-report-${new Date().toISOString().split("T")[0]}.xlsx`
    );
    console.log("📧 Sending request to Mailgun...");
    const response = await fetch(`${env.MAILGUN_API_BASE_URL}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}`,
      },
      body: formData,
    });
    console.log(`📧 Mailgun response status: ${response.status}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`📧 Mailgun error response: ${errorText}`);
      throw new Error(`Mailgun API error: ${response.status} - ${errorText}`);
    }
    const responseData: any = await response.json();
    console.log("✅ Notification email sent successfully");
    console.log(`📧 Message ID: ${responseData.id}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("❌ Failed to send notification email:", errorMessage);
    throw error;
  }
}

function buildEmailBody(summary: SyncSummary): string {
  const totalProcessed =
    summary.updatedEvents.length + summary.createdEvents.length;
  const totalFailed = summary.failedEvents.length;

  const statusColor = totalFailed > 0 ? "#dc3545" : "#28a745";
  const statusText =
    totalFailed > 0
      ? `&#9888; ${totalFailed} event(s) failed`
      : "&#10003; All events synced successfully";

  let eventRows = "";

  if (summary.updatedEvents.length > 0) {
    eventRows += `
        <tr>
          <td style="padding:15px 25px 5px;">
            <p style="margin:0 0 8px;font-family:Verdana,Helvetica,Arial,sans-serif;font-size:13px;font-weight:bold;color:#9b895b;">
              Updated Events (${summary.updatedEvents.length})
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 25px 15px;">
            <ul style="margin:0;padding-left:20px;list-style-type:disc;">`;
    summary.updatedEvents.forEach((event) => {
      eventRows += `
              <li style="font-family:Arial,sans-serif;font-size:13px;color:#000000;line-height:2;">
                <b>${event.title}</b> &mdash; ID: ${event.eventId}
              </li>`;
    });
    eventRows += `
            </ul>
          </td>
        </tr>`;
  }

  if (summary.createdEvents.length > 0) {
    eventRows += `
        <tr>
          <td style="padding:15px 25px 5px;">
            <p style="margin:0 0 8px;font-family:Verdana,Helvetica,Arial,sans-serif;font-size:13px;font-weight:bold;color:#28a745;">
              Created Events (${summary.createdEvents.length})
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 25px 15px;">
            <ul style="margin:0;padding-left:20px;list-style-type:disc;">`;
    summary.createdEvents.forEach((event) => {
      eventRows += `
              <li style="font-family:Arial,sans-serif;font-size:13px;color:#000000;line-height:2;">
                <b>${event.title}</b> &mdash; ID: ${event.eventId}
              </li>`;
    });
    eventRows += `
            </ul>
          </td>
        </tr>`;
  }

  if (summary.failedEvents.length > 0) {
    eventRows += `
        <tr>
          <td style="padding:15px 25px 5px;">
            <p style="margin:0 0 8px;font-family:Verdana,Helvetica,Arial,sans-serif;font-size:13px;font-weight:bold;color:#dc3545;">
              Failed Events (${summary.failedEvents.length})
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 25px 15px;">
            <ul style="margin:0;padding-left:20px;list-style-type:disc;">`;
    summary.failedEvents.forEach((event) => {
      eventRows += `
              <li style="font-family:Arial,sans-serif;font-size:13px;color:#dc3545;line-height:2;">
                <b>${event.title}</b> &mdash; ID: ${event.eventId}<br/>
                <span style="font-size:12px;">Error: ${event.error}</span>
              </li>`;
    });
    eventRows += `
            </ul>
          </td>
        </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CRM to Umbraco Sync Report</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Verdana,Helvetica,Arial,sans-serif;">

  <!-- Header: black background with two logo images side by side -->
  <div style="background-color:#000000;margin:0 auto;max-width:600px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td width="50%" align="center" style="padding:10px 25px;">
          <img src="https://media.umbraco.io/dev-dwtc/fvsmadsf/left.jpg"
               alt="DWTC Logo Left"
               style="width:100%;max-width:250px;height:auto;display:block;border:none;" />
        </td>
        <td width="50%" align="left" style="padding:20px 0 10px 20px;">
          <img src="https://media.umbraco.io/dev-dwtc/lcjn5fke/en_01_02.jpg"
               alt="DWTC Logo Right"
               style="width:100%;max-width:280px;height:auto;display:block;border:none;" />
        </td>
      </tr>
    </table>
  </div>

  <!-- Hero / Banner image -->
  <div style="margin:0 auto;max-width:600px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td>
          <img src="https://media.umbraco.io/dev-dwtc/cmsmkss5/uae-partnership.jpg"
               alt="UAE Partnership"
               style="width:100%;height:auto;display:block;border:none;" />
        </td>
      </tr>
    </table>
  </div>

  <!-- Greeting -->
  <div style="background-color:#ffffff;margin:0 auto;max-width:600px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:20px 25px 5px;">
          <h1 style="margin:0;line-height:22px;font-family:Verdana,Helvetica,Arial,sans-serif;font-size:20px;color:#9b895b;text-align:center;">
            CRM to Umbraco Sync Report
          </h1>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:10px 25px 5px;">
          <p style="margin:13px 0;line-height:22px;font-family:Verdana,Helvetica,Arial,sans-serif;font-size:13px;color:#55575d;text-align:center;">
            The automated CRM to Umbraco event sync has completed. Please find the summary below.
          </p>
          <p style="margin:4px 0;line-height:22px;font-family:Verdana,Helvetica,Arial,sans-serif;font-size:12px;color:#55575d;text-align:center;">
            Sync Date: ${summary.syncDate}
          </p>
          <p style="margin:13px 0;">&nbsp;</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Summary stats -->
  <div style="background-color:#ffffff;margin:0 auto;max-width:600px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td style="padding:0 25px 20px;">
          <ul style="margin:0;padding-left:20px;list-style-type:disc;">
            <li style="font-family:Arial,sans-serif;font-size:13px;color:#000000;line-height:2;"><b>Total Events Processed:</b> ${totalProcessed}</li>
            <li style="font-family:Arial,sans-serif;font-size:13px;color:#000000;line-height:2;"><b>Events Updated:</b> ${summary.updatedEvents.length}</li>
            <li style="font-family:Arial,sans-serif;font-size:13px;color:#000000;line-height:2;"><b>Events Created:</b> ${summary.createdEvents.length}</li>
            <li style="font-family:Arial,sans-serif;font-size:13px;color:${statusColor};line-height:2;"><b>Status:</b> ${statusText}</li>
          </ul>
        </td>
      </tr>
    </table>
  </div>

  <!-- Event details -->
  ${
    eventRows
      ? `<div style="background-color:#ffffff;margin:0 auto;max-width:600px;padding-bottom:20px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
      <tr><td style="padding:0 25px;"><hr style="border:none;border-top:1px solid #eeeeee;margin:0;" /></td></tr>
      ${eventRows}
    </table>
  </div>`
      : ""
  }

  <!-- Footer -->
  <div style="margin:0 auto;max-width:600px;padding:15px 25px;">
    <p style="margin:0;font-family:Verdana,Helvetica,Arial,sans-serif;font-size:11px;color:#999999;text-align:center;">
      This is an automated notification from the DWTC CRM to Umbraco sync service. Please do not reply to this email.
    </p>
  </div>

</body>
</html>`;
}
