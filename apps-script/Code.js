// @OnlyCurrentDoc
// ============================================================
//  YOUR CALENDAR SCOUT — Code.gs (The Master Build)
// ============================================================

const CONFIG = {
  SEARCH_QUERY: 'is:unread -from:me newer_than:1d',
  MAX_THREADS: 10,
  MODELS: ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-2.0-flash-lite'],
  MY_EMAIL: 'iansagabaen@gmail.com',
  DISPLAY_NAME: 'Calendar Scout · report in ~1 min',
  DEBUG_FTUX_EMAIL: 'iansagabaen@gmail.com', // Set to email to force FTUX. Set to null to disable.
  DEBUG_SHEET_ID: '1McrLtZlwzSrQ-JUOapZlWq2-s8qtVSoEt5tdOozSBqQ' // Google Sheet for execution logs
};

const SIGNATURE = "<p>— your calendar scout</p>";
const FOOTER_HTML = `
  <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
  <div style="font-size: 13px; color: #888;">
    <p><strong>About the scout</strong><br>
    I am an experimental tool built to help you easily find and add events to your calendar. I am not always perfect, so please check my work. 
    <a href="https://forms.gle/687QErQW5soF9mCu8">Report an Error</a> | 
    <a href="https://buymeacoffee.com/lionsaga">Buy me a coffee</a></p>
    <p><strong>Privacy</strong><br>
    I process your text, find your dates, and don't store your data. 
    <a href="https://calendarscout.netlify.app/">calendarscout.netlify.app</a></p>
  </div>
`;

// --- MAIN CONTROLLER ---

function startScoutProcess() {
  // EMERGENCY KILL SWITCH (2026-07-18): self-delete this function's triggers and stop immediately.
  // Reason: CONFIG.SEARCH_QUERY scans the whole personal inbox, not a dedicated intake address —
  // this caused a runaway auto-reply loop against an external auto-responder (Namecheap support).
  // Remove this block only once the search-query scoping bug is actually fixed.
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'startScoutProcess') {
      ScriptApp.deleteTrigger(t);
    }
  });
  console.log("KILL SWITCH: deleted startScoutProcess trigger(s), exiting without processing.");
  return;

  // Prevent two simultaneous executions from doubling API calls
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    console.log("Manager: Another instance is running, skipping.");
    return;
  }

  try {
    // Initialize debug sheet on first run
    initializeDebugSheet();

    console.log("Manager: Starting search...");
    const props = PropertiesService.getScriptProperties();
    const apiKey = props.getProperty('GEMINI_API_KEY');
    if (!apiKey) throw new Error("GEMINI_API_KEY missing.");

    const threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, CONFIG.MAX_THREADS);

    // Sort newest first so a fresh forward always wins over older unread emails
    threads.sort((a, b) => b.getLastMessageDate() - a.getLastMessageDate());

    for (const thread of threads) {
      const messages = thread.getMessages();
      const lastMessage = messages[messages.length - 1];

      if (lastMessage.isUnread() && !isAlreadyProcessed(lastMessage.getId())) {
        markProcessed(lastMessage.getId());
        lastMessage.markRead();
        processSingleEmail(lastMessage, apiKey);
        break; // process ONE email per run — next trigger picks up the next one
      }
    }
  } catch (e) {
    console.log("Manager Error: " + e.toString());
    try {
      GmailApp.sendEmail(CONFIG.MY_EMAIL, "Calendar Scout: script error", e.toString());
    } catch (_) {}
  } finally {
    lock.releaseLock();
  }
}

function isAlreadyProcessed(messageId) {
  const props = PropertiesService.getScriptProperties();
  const log = JSON.parse(props.getProperty('PROCESSED_IDS') || '[]');
  return log.includes(messageId);
}

function markProcessed(messageId) {
  const props = PropertiesService.getScriptProperties();
  const log = JSON.parse(props.getProperty('PROCESSED_IDS') || '[]');
  log.push(messageId);
  // Keep only the most recent 500 IDs to prevent unbounded growth
  if (log.length > 500) log.splice(0, log.length - 500);
  props.setProperty('PROCESSED_IDS', JSON.stringify(log));
}

function extractEmail(fromStr) {
  // Pulls jane@gmail.com out of "Jane Smith <jane@gmail.com>" or returns as-is
  const match = fromStr.match(/<([^>]+)>/);
  return match ? match[1].trim() : fromStr.trim();
}

function processSingleEmail(message, apiKey) {
  const startTime = new Date().getTime();
  const senderEmail = extractEmail(message.getFrom());
  const emailSubject = message.getSubject() || "Your flyer";
  const receivedDate = formatDateCleanly(message.getDate());

  // 1. Prepare Data
  const emailBody = message.getPlainBody().trim();
  const attachments = message.getAttachments();
  let mediaParts = [];

  attachments.forEach(file => {
    const type = file.getContentType();
    if (type.includes('image/') || type.includes('pdf')) {
      mediaParts.push({
        inline_data: { mime_type: type, data: Utilities.base64Encode(file.getBytes()) }
      });
    }
  });

  // 2. Check Context (needed before any email sending)
  const props = PropertiesService.getScriptProperties();
  const rawWelcomed = props.getProperty('WELCOMED_USERS') || '[]';
  let welcomedList;
  try { welcomedList = JSON.parse(rawWelcomed); }
  catch (e) { welcomedList = rawWelcomed.split(',').map(s => s.trim()).filter(Boolean); }
  const isFirstTime = !welcomedList.includes(senderEmail) || (CONFIG.DEBUG_FTUX_EMAIL && senderEmail === CONFIG.DEBUG_FTUX_EMAIL);

  // 3. Pre-filter: skip obvious non-events before burning an API call
  if (!looksLikeEvent(emailBody, emailSubject, mediaParts)) {
    console.log("Pre-filter: no event signals found, skipping AI call.");
    const processingTime = new Date().getTime() - startTime;
    logExecutionToSheet(senderEmail, 'FILTERED_OUT', 0, 'Pre-filter: no event signals', processingTime);
    sendFallbackEmail(senderEmail, "I couldn't find any events or dates in that email.", isFirstTime);
    return;
  }

  // 4. Call AI
  const aiResponse = callGeminiVisionAI(apiKey, emailBody || emailSubject, mediaParts, receivedDate);

  // 5. Route Response
  try {
    if (aiResponse.events && aiResponse.events.length > 0) {
      sendReport(senderEmail, aiResponse.events, emailSubject, receivedDate, isFirstTime, aiResponse.summary);
      trackUsageAndSurvey(senderEmail);
      const processingTime = new Date().getTime() - startTime;
      logExecutionToSheet(senderEmail, 'SUCCESS', aiResponse.events.length, '', processingTime);

      // Alert if processing was slow
      if (processingTime > 90000) { // 90 seconds
        sendClearErrorAlert(senderEmail, 'SLOW', '', processingTime);
      }

      if (isFirstTime) {
        welcomedList.push(senderEmail);
        props.setProperty('WELCOMED_USERS', JSON.stringify(welcomedList));
      }
    } else {
      const processingTime = new Date().getTime() - startTime;
      logExecutionToSheet(senderEmail, 'NO_EVENTS', 0, aiResponse.summary || 'No events found', processingTime);
      sendFallbackEmail(senderEmail, aiResponse.summary, isFirstTime);
    }
  } catch (e) {
    const processingTime = new Date().getTime() - startTime;
    logExecutionToSheet(senderEmail, 'ERROR', 0, e.toString(), processingTime);
    sendClearErrorAlert(senderEmail, 'ERROR', e.toString(), processingTime);
    console.log("Send failed for " + senderEmail + ": " + e.toString());
  }
}

// --- EXTERNAL CONNECTORS ---

function looksLikeEvent(body, subject, mediaParts) {
  // Always process if there's an image or PDF attachment (could be a flyer)
  if (mediaParts && mediaParts.length > 0) return true;

  const combined = (subject + " " + body).toLowerCase();
  const dateWords = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tonight|tomorrow|next week|pm|am|:\d{2})\b/;
  const eventWords = /\b(event|party|meeting|appointment|join|register|rsvp|invite|invited|conference|workshop|webinar|class|game|concert|show|dinner|lunch|visit|trip|due|deadline|reminder)\b/;

  return dateWords.test(combined) || eventWords.test(combined);
}

function callGeminiVisionAI(apiKey, text, mediaParts, emailDate) {
  const currentYear = new Date().getFullYear();
  const dateContext = emailDate ? `This email was received on ${emailDate}. Use this to resolve relative dates like "tomorrow", "next Monday", "this Friday", etc.` : "";
  const prompt = `${dateContext}

Extract events from this content into a JSON array "events". For each event include:
- Title: short event name
- Date: full date in "Mmm D, YYYY" format (e.g. "Aug 10, 2026"). Use ${currentYear} if no year is specified. For date ranges use "Aug 10, 2026 - Aug 20, 2026".
- Time: start and end time if mentioned, otherwise ""
- Location: physical location if mentioned, otherwise ""
- Description: 1-2 sentence summary of what the event is and anything attendees need to know (bring, do, sign up for, etc.)
- RequiredItems: any items to bring
- DateConfidence: "high" if the date is explicitly stated; "low" if inferred from vague language like "this week", "soon", "next month", or if no specific day was found
- DateNote: if DateConfidence is "low", one short sentence explaining why (e.g. "Email says 'this week' but no specific day is mentioned"). Otherwise "".
- DateContext: the 1-2 sentences from the email that reference this event's date, copied verbatim. Otherwise "".

Important rules:
- If a single named event repeats on consecutive days at the same specific time (e.g. "Monday-Thursday 4:15-8pm"), create one entry per day and append "(1 of 4)", "(2 of 4)" etc. to that event's title only. Do not number events that do not repeat at a specific time each day.
- A multi-day event or festival (e.g. "May 1-3") is NOT a repeating event — keep it as one entry with a date range. Do not split it into individual days and do not number it.
- If there are multiple time slots on the same day for different groups, create a separate entry for each slot. Do not number these unless they also repeat across days.
- Use the exact date for each individual day, not a range, when expanding truly recurring events.
- For Description: only include genuinely useful information (what to bring, what to expect, who it's for). If there is nothing useful to add, leave Description as "".

Return ONLY valid JSON with keys: is_relevant, events, summary.
For "summary": one sentence identifying the source (e.g. "From the Covington 6th Grade Newsletter, May 12") and the 2-3 most notable events. This helps the reader remember why they forwarded the email.

Content: ${text}`;
  
  for (const modelName of CONFIG.MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const payload = { contents: [{ parts: [{ text: prompt }, ...mediaParts] }] };
      const options = { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true };
      const response = UrlFetchApp.fetch(url, options);
      
      if (response.getResponseCode() === 200) {
        let aiText = JSON.parse(response.getContentText()).candidates[0].content.parts[0].text;
        let cleanJson = aiText.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanJson);
      }
    } catch (e) { console.log("AI Error: " + e.toString()); }
  }
  return { events: [], summary: "I hit a snag." };
}

// --- DEBUG LOGGING ---

function initializeDebugSheet() {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.DEBUG_SHEET_ID).getSheetByName('Sheet1');
    // Check if headers exist (if A1 is empty, add them)
    if (sheet.getRange('A1').getValue() === '') {
      sheet.appendRow(['Timestamp', 'Email', 'Status', 'Events Found', 'Error Message', 'Processing Time (ms)']);
    }
  } catch (e) {
    console.log("Sheet initialization failed: " + e.toString());
  }
}

function sendClearErrorAlert(senderEmail, status, errorMsg, processingTimeMs) {
  try {
    const debugSheetLink = `https://docs.google.com/spreadsheets/d/${CONFIG.DEBUG_SHEET_ID}/edit`;
    let subject = "";
    let body = "";

    if (status === "ERROR") {
      subject = `⚠️ Calendar Scout: Error processing email from ${senderEmail}`;
      body = `
Something went wrong while processing an email.

👤 User: ${senderEmail}
❌ Problem: ${errorMsg}
⏱️ Processing Time: ${processingTimeMs}ms (${(processingTimeMs / 1000).toFixed(1)}s)
📅 Time: ${new Date()}

What to do:
This usually happens if the AI service is temporarily down or slow. The email is safely stored in Gmail.
You can check the Debug Sheet to see the pattern of errors.

🔍 Debug Sheet: ${debugSheetLink}

— Your Calendar Scout
`;
    } else if (status === "SLOW") {
      subject = `⏱️ Calendar Scout: Slow processing from ${senderEmail}`;
      body = `
An email took longer than expected to process.

👤 User: ${senderEmail}
⏱️ Processing Time: ${processingTimeMs}ms (${(processingTimeMs / 1000).toFixed(1)}s)
📅 Time: ${new Date()}

What to do:
This might indicate the AI service is under load. Monitor the next few emails. If this persists, check the Debug Sheet.

🔍 Debug Sheet: ${debugSheetLink}

— Your Calendar Scout
`;
    }

    GmailApp.sendEmail(CONFIG.MY_EMAIL, subject, body);
  } catch (e) {
    console.log("Alert email failed: " + e.toString());
  }
}

function logExecutionToSheet(senderEmail, status, eventsFound, errorMsg, processingTimeMs) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.DEBUG_SHEET_ID).getSheetByName('Sheet1');
    sheet.appendRow([
      new Date(),
      senderEmail,
      status,
      eventsFound || 0,
      errorMsg || '',
      processingTimeMs || 0
    ]);
  } catch (e) {
    console.log("Debug logging failed: " + e.toString());
  }
}

// --- USAGE TRACKING & SURVEYS ---

function trackUsageAndSurvey(senderEmail) {
  const props = PropertiesService.getScriptProperties();
  const usageLog = JSON.parse(props.getProperty('USER_USAGE_COUNT') || '{}');

  usageLog[senderEmail] = (usageLog[senderEmail] || 0) + 1;
  props.setProperty('USER_USAGE_COUNT', JSON.stringify(usageLog));

  // Send survey after 5 successful uses (not counting empty emails)
  if (usageLog[senderEmail] === 5) {
    sendSurveyEmail(senderEmail);
  }
}

function sendSurveyEmail(recipient) {
  const surveyBody = `
    <h2 style="font-size: 18px; color: #2E4A2E; margin-bottom: 16px;">Quick question: How's Calendar Scout working for you?</h2>

    <p style="font-size: 14px; color: #333; margin-bottom: 12px;">
      I noticed you've used Scout 5 times now. I'd love your feedback so I can make it better.
    </p>

    <div style="background-color: #F0F8F0; border-left: 4px solid #2E4A2E; padding: 16px; margin: 16px 0; border-radius: 4px; font-size: 14px; color: #333; line-height: 1.6;">
      <p style="margin: 0 0 8px 0;"><strong>Just reply with:</strong></p>
      <p style="margin: 0 0 4px 0;">• Are you enjoying the Scout?</p>
      <p style="margin: 0 0 4px 0;">• Have any dates been wrong?</p>
      <p style="margin: 0 0 0 0;">• Anything you'd like to see?</p>
    </div>

    <p style="font-size: 14px; color: #333;">
      I read every reply. Thanks for using it! 🙏
    </p>
  `;

  try {
    GmailApp.sendEmail(recipient, "How's Calendar Scout working?", "", {
      name: CONFIG.DISPLAY_NAME,
      htmlBody: wrapEmail(surveyBody),
      replyTo: CONFIG.MY_EMAIL
    });

    // Also notify you
    GmailApp.sendEmail(
      CONFIG.MY_EMAIL,
      `[Scout Survey Sent] ${recipient} at 5 uses`,
      `Survey email sent to ${recipient}. They'll reply to: ${CONFIG.MY_EMAIL}`
    );
  } catch (e) {
    console.log("Survey email failed for " + recipient + ": " + e.toString());
  }
}

// --- EMAIL HELPERS ---

function wrapEmail(bodyText) {
  return `<div style="font-family: Georgia, serif; color: #333; max-width: 600px; margin: auto; line-height: 1.6;">${bodyText}${SIGNATURE}${FOOTER_HTML}</div>`;
}

function sendAutoReceipt(recipient) {
  GmailApp.sendEmail(recipient, "Calendar Scout: Got it!", "", {
    name: CONFIG.DISPLAY_NAME,
    htmlBody: wrapEmail(`<p>I’m scouting through your message right now and will send you a summary in just a moment.</p>`)
  });
}

function sendReport(recipient, events, subject, receivedDate, isFirstTime, aiSummary) {
  events.sort((a, b) => {
    const da = new Date(String(a.Date).split(' - ')[0]);
    const db = new Date(String(b.Date).split(' - ')[0]);
    return (isNaN(da) ? Infinity : da) - (isNaN(db) ? Infinity : db);
  });

  const summaryStr = aiSummary ? `<p style="font-size:14px; color:#555; margin: 4px 0 16px; font-style:italic;">${aiSummary}</p>` : "";

  let header = "";
  if (isFirstTime) {
    header = `<h2 style="font-size: 20px; color: #2E4A2E; margin-bottom: 16px;">Welcome to Calendar Scout</h2>
    <div style="background-color: #F0F8F0; border-left: 4px solid #2E4A2E; padding: 16px; margin-bottom: 20px; border-radius: 4px; font-size: 14px; color: #333; line-height: 1.6;">
      <p style="margin: 0 0 12px 0;"><strong>Here's how your data works:</strong></p>
      <p style="margin: 0 0 8px 0;">✓ We read your email that you forwarded to us</p>
      <p style="margin: 0 0 8px 0;">✓ We found ${events.length} events</p>
      <p style="margin: 0 0 16px 0;">✓ We immediately delete your email in our system</p>
      <p style="margin: 0 0 8px 0;"><strong>What we use:</strong> Event dates, times, locations</p>
      <p style="margin: 0 0 8px 0;"><strong>What we don't do:</strong> Store emails, train models, sell data</p>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">Learn more: <a href="https://calendarscout.netlify.app/" style="color: #2E4A2E; text-decoration: underline;">calendarscout.netlify.app</a></p>
    </div>
    <h3 style="font-size: 16px; color: #2E4A2E; margin-bottom: 12px;">Your events from "${subject}":</h3>
    ${summaryStr}`;
  } else {
    header = `<h2>I found ${events.length} events for you:</h2>${summaryStr}`;
  }

  let eventCards = "";

  events.forEach(event => {
    const calendarLink = createCalendarUrl(event, subject, receivedDate);
    const formattedDate = formatDateWithDay(event.Date);
    const timeStr = event.Time ? `· ${event.Time}` : "";
    const locationStr = event.Location ? `<div style="color:#8A9A8A; font-size:13px; margin-top:2px;"><span style="font-style:italic;">at</span> ${event.Location}</div>` : "";
    const descStr = event.Description ? `<div style="font-size:13px; color:#555; margin: 8px 0 12px;">${event.Description}</div>` : `<div style="margin-bottom:12px;"></div>`;
    const isUncertain = event.DateConfidence === "low";

    if (isUncertain) {
      const warningStr = event.DateNote ? `<div style="font-size:12px; color:#92600A; margin: 6px 0 4px;">⚠ ${event.DateNote}</div>` : "";
      const contextStr = event.DateContext ? `<div style="font-size:12px; color:#777; border-left: 3px solid #F5C542; padding-left: 10px; margin: 8px 0 12px; font-style: italic;">"${event.DateContext}"</div>` : `<div style="margin-bottom:12px;"></div>`;
      eventCards += `
        <div style="background-color: #FFFBF0; border: 1px solid #F5C542; border-radius: 16px; padding: 20px; margin-bottom: 16px;">
          <div style="font-weight: bold; font-size: 17px; color: #1a1a1a;">${event.Title}</div>
          <div style="color: #8A9A8A; font-size: 14px; margin-top: 4px;">${formattedDate} ${timeStr}</div>
          ${locationStr}
          ${warningStr}
          ${contextStr}
          ${descStr}
          <a href="${calendarLink}" style="display: block; background-color: #92600A; color: #ffffff; text-align: center; padding: 14px; text-decoration: none; border-radius: 12px; font-weight: bold;">Add to Calendar (review first)</a>
        </div>`;
    } else {
      eventCards += `
        <div style="background-color: #ffffff; border: 1px solid #E0E7E0; border-radius: 16px; padding: 20px; margin-bottom: 16px;">
          <div style="font-weight: bold; font-size: 17px; color: #1a1a1a;">${event.Title}</div>
          <div style="color: #8A9A8A; font-size: 14px; margin-top: 4px;">${formattedDate} ${timeStr}</div>
          ${locationStr}
          ${descStr}
          <a href="${calendarLink}" style="display: block; background-color: #2E4A2E; color: #ffffff; text-align: center; padding: 14px; text-decoration: none; border-radius: 12px; font-weight: bold;">Add to Calendar</a>
        </div>`;
    }
  });

  GmailApp.sendEmail(recipient, `Scout Report: ${subject}`, "", {
    name: CONFIG.DISPLAY_NAME,
    htmlBody: wrapEmail(`<div style="background-color: #F3F7F3; padding: 24px; border-radius: 24px;">${header}${eventCards}</div>`)
  });
}

function sendFallbackEmail(recipient, summary, isFirstTime) {
  let bodyContent = "";

  if (isFirstTime) {
    bodyContent = `
      <h2 style="font-size: 20px; color: #2E4A2E; margin-bottom: 16px;">Welcome to Calendar Scout!</h2>

      <p style="font-size: 15px; color: #333; margin-bottom: 16px;">
        I didn't find any events in that first email, but that's okay—let me explain what I do.
      </p>

      <div style="background-color: #F0F8F0; border-left: 4px solid #2E4A2E; padding: 16px; margin-bottom: 20px; border-radius: 4px; font-size: 14px; color: #333; line-height: 1.8;">
        <p style="margin: 0 0 12px 0;"><strong>How it works:</strong></p>
        <p style="margin: 0 0 8px 0;">You forward any email to me (newsletters, flyers, invitations, anything with dates).</p>
        <p style="margin: 0 0 8px 0;">I read it, find the dates and times, and send you a clean summary.</p>
        <p style="margin: 0 0 16px 0;">You click once to add events to your calendar.</p>

        <p style="margin: 12px 0 8px 0;"><strong>I work best with:</strong></p>
        <p style="margin: 0 0 4px 0;">• Long school newsletters with multiple dates</p>
        <p style="margin: 0 0 4px 0;">• Sports practice schedules and tournament brackets</p>
        <p style="margin: 0 0 4px 0;">• Birthday party invitations with times</p>
        <p style="margin: 0 0 8px 0;">• PDF flyers for community events</p>
        <p style="margin: 0 0 8px 0;">• A photo of a flyer on a community bulletin board — snap it and send, no typing needed</p>

        <p style="margin: 12px 0 8px 0;"><strong>Your privacy is protected:</strong></p>
        <p style="margin: 0 0 4px 0;">✓ We read your email that you forward to us</p>
        <p style="margin: 0 0 4px 0;">✓ We immediately delete it from our system</p>
        <p style="margin: 0 0 0 0;">✓ We never store, sell, or train models on your data</p>
      </div>

      <p style="font-size: 14px; color: #666; margin-bottom: 8px;">
        <strong>Ready to try?</strong> Forward a school newsletter or event flyer to me and I'll show you what I can do.
      </p>
      <p style="font-size: 12px; color: #999;">
        Learn more: <a href="https://calendarscout.netlify.app/" style="color: #2E4A2E; text-decoration: underline;">calendarscout.netlify.app</a>
      </p>
    `;
  } else {
    bodyContent = `<p>${summary}</p>`;
  }

  GmailApp.sendEmail(recipient, `Calendar Scout: No events found`, "", {
    name: CONFIG.DISPLAY_NAME,
    htmlBody: wrapEmail(bodyContent)
  });
}

// --- CALENDAR UTILITIES ---

function formatDateCleanly(dateInput) {
  if (!dateInput) return "Date not specified";
  const d = new Date(dateInput);
  return isNaN(d.getTime()) ? dateInput : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateWithDay(dateInput) {
  if (!dateInput) return "Date not specified";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return dateInput;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

function parseTime(timeStr) {
  // Parses strings like "3:30-5:30pm", "4:00pm", "9:00pm", "3:30-10:00pm"
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}(?::\d{2})?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?/i);
  if (!match) {
    // Single time like "9:00pm"
    const single = timeStr.match(/(\d{1,2}(?::\d{2})?)\s*(am|pm)/i);
    if (single) return { start: single[1] + single[2], end: null };
    return null;
  }
  const suffix = match[3] || "pm";
  return { start: match[1] + suffix, end: match[2] + suffix };
}

function applyTime(dateObj, timeStr) {
  // Applies a time string like "3:30pm" to a Date object
  const m = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!m) return dateObj;
  let hours = parseInt(m[1]);
  const mins = parseInt(m[2] || "0");
  const ampm = m[3].toLowerCase();
  if (ampm === "pm" && hours !== 12) hours += 12;
  if (ampm === "am" && hours === 12) hours = 0;
  dateObj.setHours(hours, mins, 0, 0);
  return dateObj;
}

function parseDateRange(dateStr) {
  // Handles "August 10 - August 20, 2026" or "Aug 10-20, 2026"
  const m = dateStr.match(/^(.+?)\s*[-–]\s*(.+)$/);
  if (!m) return null;
  const endD = new Date(m[2].trim());
  if (isNaN(endD.getTime())) return null;
  let startD = new Date(m[1].trim());
  if (isNaN(startD.getTime())) startD = new Date(m[1].trim() + ', ' + endD.getFullYear());
  if (isNaN(startD.getTime())) return null;
  return { start: startD, end: endD };
}

function createCalendarUrl(event, subject, receivedDate) {
  const baseUrl = "https://www.google.com/calendar/render?action=TEMPLATE";
  const title = event.Title || "Scouted Event";
  const description = [event.Description, event.Location ? "Location: " + event.Location : ""].filter(Boolean).join("\n");
  let startD = new Date();
  let endD = new Date();
  let allDay = true;

  try {
    const dateStr = String(event.Date);

    // Check for a date range first (e.g. "August 10 - August 20, 2026")
    const range = parseDateRange(dateStr);
    if (range) {
      startD = range.start;
      endD = range.end;
      // allDay stays true; time parsing below will override if time exists
    } else {
      startD = new Date(dateStr);
      endD = new Date(dateStr);
      if (isNaN(startD.getTime())) { startD = new Date(); endD = new Date(); }
    }

    const times = parseTime(event.Time || "");
    if (times && times.start) {
      allDay = false;
      applyTime(startD, times.start);
      if (times.end) {
        applyTime(endD, times.end);
      } else {
        endD = new Date(startD.getTime() + 60 * 60 * 1000); // default 1hr
      }
    }
  } catch(e) { startD = new Date(); endD = new Date(); }

  let dateParam;
  if (allDay) {
    const s = startD.toISOString().split("T")[0].replace(/-/g, "");
    const eNext = new Date(endD); eNext.setDate(eNext.getDate() + 1);
    const e = eNext.toISOString().split("T")[0].replace(/-/g, "");
    dateParam = `${s}/${e}`;
  } else {
    const fmt = d => d.toISOString().replace(/-|:|\.\d{3}/g, "");
    dateParam = `${fmt(startD)}/${fmt(endD)}`;
  }

  return `${baseUrl}&text=${encodeURIComponent(title)}&dates=${dateParam}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(event.Location || "")}`;
}