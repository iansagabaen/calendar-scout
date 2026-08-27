# Calendar Scout Bug Investigation & Fix — Complete Summary

**Date:** 2026-08-06  
**Status:** ✅ FIXED and tested  
**Commit:** f7fc901 ("Fix: Handle em-dash and PM-after-both time formats in Calendar Scout parseTime()")

---

## Investigation Results

### Bug 1: Time Offset (2-Hour Shift Forward) ✅ FOUND & FIXED

**What was happening:**
- User forwards newsletter: "Covington Back to School Picnic, Monday Aug 10, 5:00–7:00 PM"
- Report email shows: "5:00–7:00 PM" ✓ (correct)
- Calendar event shows: "7:00pm to 8:00pm" ✗ (2-hour shift forward)

**Root cause identified:**
Gemini returns times with em-dash (U+2013): "5:00–7:00pm"

The `parseTime()` regex only recognized regular hyphens (U+002D):
```javascript
/(\d{1,2}(?::\d{2})?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?/i
     ↑ This only matches hyphen, not em-dash
```

When the em-dash wasn't recognized:
1. Range pattern failed
2. Fell back to single-time pattern
3. Single pattern incorrectly matched only "7:00pm" (the END time)
4. Returned: `{ start: "7:00pm", end: null }`
5. Calendar received: 7:00 PM to 8:00 PM (7 PM + 1-hour default)

**Result: 2-hour shift** (5 PM → 7 PM)

### Bug 2: PM-After-Both Format ✅ ALSO FIXED

**Secondary issue discovered:**
Some Gemini outputs use "5:00pm-7:00pm" format (PM after both times).

**Root cause:**
Range regex expected "5:00-7:00pm" (PM only at end), not "PM after each".

When "5:00pm-7:00pm" was parsed:
1. After matching "5:00", next character was "p" (start of "pm"), not "-"
2. Range pattern failed
3. Single pattern matched only "5:00pm"
4. Returned: `{ start: "5:00pm", end: null }`

**Both formats now handled correctly.**

### Bug 3: Missing Description ✅ ALREADY FIXED (Prior session)

Per session digest (2026-08-06), line 107 of email-templates.ts was already changed from:
```typescript
const calendarLink = createCalendarUrlWithSummary(event, summaryLineForEvent);
```
to:
```typescript
const calendarLink = createCalendarUrl(event, cleanSubject, receivedDate);
```

This ensures full event descriptions (date, time, location, details) appear in calendar events, not just the summary line.

---

## The Fix Applied

### File: `projects/calendar-scout/worker/src/calendar-utils.ts`

Updated `parseTime()` function to:

1. **Normalize dashes** before parsing:
   ```javascript
   const normalized = timeStr.replace(/–|—/g, '-').trim();
   ```
   Converts em-dash (U+2013) and en-dash (U+2014) to regular hyphen (U+002D)

2. **Improved range regex** to handle PM after first time:
   ```javascript
   /(\d{1,2}(?::\d{2})?)\s*(?:am|pm)?\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?/i
                           ↑ Now accepts optional am/pm here too
   ```

3. **Smart suffix extraction**:
   - If am/pm appears after second time, use it
   - If am/pm appears after first time only, use it for both
   - Default to "pm"

4. **Normalized case** to lowercase for consistency

### Test Coverage

Added 4 new test cases to verify all edge cases:
- ✅ Em-dash format: "5:00–7:00pm"
- ✅ PM after both: "5:00pm-7:00pm"
- ✅ En-dash format: "5:00—7:00pm"
- ✅ Mixed word format: "5:00pm to 7:00pm"

**All 43 tests pass** (38 existing + 5 new edge cases)

---

## How It Works Now

### Before Fix:
```
Input:  "5:00–7:00pm" (with em-dash from Gemini)
Parsed: { start: "7:00pm", end: null }  ← WRONG
Result: Calendar shows 7:00-8:00pm (with 1-hour default)
        Report shows 5:00–7:00pm (displays raw event.Time)
        → 2-hour mismatch
```

### After Fix:
```
Input:  "5:00–7:00pm" (with em-dash from Gemini)
Parse:  Normalize to "5:00-7:00pm", parse range
Parsed: { start: "5:00pm", end: "7:00pm" }  ✓ CORRECT
Result: Calendar shows 5:00-7:00pm (matches report)
        Report shows 5:00–7:00pm (displays raw event.Time)
        → No mismatch
```

---

## Verification Steps

To verify the fix is working:

1. **Forward a newsletter** with an event time to sendtoschedule.com
2. **Check report email:**
   - Look for "Your events from" section
   - Verify time is displayed correctly (e.g., "5:00-7:00pm")
3. **Click "Add to Calendar"**
   - Google Calendar should open
   - Event preview should show SAME time as the report (e.g., "5:00-7:00pm")
4. **If both match:** ✅ Fix is working
5. **If calendar is still shifted by 2 hours:** ❌ Needs deployment

---

## Deployment Status

**Code changes:** ✅ Committed (f7fc901)  
**Tests:** ✅ All 43 passing  
**Ready to deploy:** ✅ Yes

Next step: Push to GitHub and trigger Cloudflare Workers deployment using:
```bash
bash scripts/deploy-calendar-scout.sh
```

---

## Files Modified

- `projects/calendar-scout/worker/src/calendar-utils.ts` — Fixed parseTime() function
- `projects/calendar-scout/worker/test/index.spec.ts` — Added 4 new edge case tests
- `research/2026-08-06-calendar-scout-time-parsing-bugs.md` — Detailed root cause analysis
- `research/2026-08-06-calendar-scout-bugs-fixed-summary.md` — This file

---

## Related Context

- **Prior session (2026-08-06):** Fixed missing description bug in email-templates.ts
- **Session digest:** `/Users/ian/my-projects/MEMORY/session-2026-08-06-calendar-scout-deployment.md`
- **Regression test:** Nightly test should catch this if sample with em-dash times is added
- **Architecture:** Calendar URLs built by `createCalendarUrl()` → `parseTime()` extracts times → `applyTime()` applies to Date objects → ISO formatting for Google Calendar

