# Calendar Scout Testing Standard

**Added:** 2026-08-06  
**Reason:** Prior bug fixes (time parsing, description inclusion) were verified manually by the user. This caused delay and wasn't a reliable check. Automated tests now cover the exact user-facing scenarios.

---

## Rule: Automated Verification Before Deployment

**Before claiming a Calendar Scout bug is fixed, run the test suite.** Do not rely on manual testing by Ian or his wife.

### When to Run Tests

- After any fix to time parsing, calendar URL generation, or email formatting
- Before deploying changes to Cloudflare Workers (`wrangler deploy`)
- When adding new event extraction logic

### How to Run

```bash
cd /Users/ian/my-projects/projects/calendar-scout/worker
npm test
```

**Success criteria:** All 43 tests pass (or more if new tests are added).

---

## What the Tests Cover

### 1. **Time Parsing Edge Cases** (5 tests)
The tests catch Gemini's various time formats and ensure they're parsed correctly:

- **Em-dash format:** `"5:00–7:00pm"` (U+2013) → parsed as `"5:00pm to 7:00pm"` ✓
- **En-dash format:** `"5:00—7:00pm"` (U+2014) → parsed correctly ✓
- **PM after both:** `"5:00pm-7:00pm"` → parsed correctly ✓
- **Mixed format:** `"5:00pm to 7:00pm"` (word "to") → parsed correctly ✓
- **Covington Bug (specific):** Report shows `"5:00–7:00 PM"`, calendar shows `"5:00–7:00 PM"` (NOT `"7:00–8:00 PM"`) ✓

Each test verifies:
1. The calendar event **description** includes the correct time range
2. The calendar event **dates parameter** is correctly formatted (not off by 1 hour, 2 hours, etc.)

### 2. **Calendar Event Description** (3 tests)
Verifies that calendar events include full event details:

- Event description contains the full event text (not just summary line)
- Location is included as `"Location: [place]"`
- Attribution footer `"(Added via sendtoschedule.com)"` appears after real content
- Blank line separator exists between description and footer

### 3. **Email-to-Report Pipeline** (19 tests)
End-to-end integration tests covering:

- Multi-event extraction from realistic newsletters
- Fallback handling for blank subjects
- Pre-filter rejection of non-event emails
- Proper attachment handling (images, PDFs, missing files)
- Circuit breaker limits (same-recipient, global caps)

### 4. **Circuit Breaker** (14 tests)
Safety limits that prevent runaway loops:

- Pauses after repeated sends to the same recipient
- Pauses after global email volume spike
- Sends alert emails explaining why it paused
- Manual `/admin/pause` and `/admin/resume` work

---

## The Covington Bug (Root Cause, Now Fixed)

**Original problem (2026-08-06):**
- Report email: "Covington Back to School Picnic — Monday, Aug 10, 2026 · **5:00–7:00 PM**"
- Calendar event: Shows "**7:00pm to 8:00pm**" (2-hour offset)

**Root cause:**
Gemini outputs times with an **em-dash** (–, U+2013): `"5:00–7:00pm"`

The time parser regex only recognized regular hyphens (U+002D), so it:
1. Failed to match the range pattern
2. Fell back to parsing just the end time: `"7:00pm"`
3. Added 1-hour default duration: `7:00pm + 1hr = 8:00pm`
4. Result: **2-hour forward shift** (5:00 PM → 7:00 PM → 8:00 PM)

**Fix (commit f7fc901):**
Added em-dash/en-dash normalization in `parseTime()`:
```typescript
const normalized = timeStr.replace(/–|—/g, '-').trim();
```

Now `"5:00–7:00pm"` normalizes to `"5:00-7:00pm"` before regex parsing, and both times are correctly extracted.

**Verification test:**
```javascript
it('verifies calendar event times are correct (Covington Bug)', () => {
  const url = createCalendarUrl(
    { Title: 'Covington Back to School Picnic', Date: 'Aug 10, 2026', Time: '5:00–7:00pm' },
    'Covington Newsletter',
    'Aug 1, 2026'
  );
  const datesMatch = url.match(/dates=([^&]+)/);
  // Should be 2-hour event (T...T format), not 1-hour shifted event
  expect(datesMatch![1]).toMatch(/T\d{6}\/\d{8}T\d{6}/);
  // Description should show "5:00pm to 7:00pm", not "7:00pm to 8:00pm"
  const details = decodeURIComponent(url.match(/details=([^&]+)/)![1]);
  expect(details).toContain('5:00pm to 7:00pm');
  expect(details).not.toContain('7:00pm to 8:00pm');
});
```

---

## If a Test Fails

1. **Don't change the test.** The test is the spec.
2. **Fix the code** to match the test's expectation.
3. **Re-run** `npm test` to verify the fix.
4. **Commit** the fix with a message explaining what was wrong and why the test caught it.

Example commit:
```
Fix: Handle em-dash in time ranges (fixes Covington Bug)

Root cause: Gemini outputs "5:00–7:00pm" with em-dash (U+2013).
Parser only recognized regular hyphens, so fell back to end-time parsing only,
adding default 1-hour duration → 2-hour offset.

Normalized em/en dashes to regular hyphen before parsing.
All 43 tests now pass, including em-dash, en-dash, and Covington scenarios.
```

---

## Future Edge Cases

If new bugs surface, add a test that reproduces the exact scenario **before** fixing the code. Examples:

- User reports: "Times are showing in UTC instead of local time" → Add a test with a timezone-aware scenario
- User reports: "All-day events show wrong date range" → Add a test with an all-day event and date range parsing
- User reports: "Location is missing from calendar" → Add a test asserting location is in the URL

This prevents the same bug from slipping back in later.

---

## Summary

- **Test file:** `test/index.spec.ts` (19 tests), `test/regression-test.spec.ts` (10 tests), `test/circuit-breaker.spec.ts` (14 tests)
- **Command:** `npm test`
- **Expected:** 43 tests pass
- **Never skip testing.** Manual verification by the user is not a substitute for automated tests.
