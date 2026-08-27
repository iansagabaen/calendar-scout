# Calendar Scout Time Parsing Bugs — Root Cause Analysis

**Date:** 2026-08-06  
**Status:** Root causes identified; fixes ready

---

## Summary

Two bugs in time parsing cause incorrect calendar event times:

1. **Em-dash bug:** Gemini returns times like "5:00–7:00pm" (with em-dash U+2013), but the regex only recognizes regular hyphens (U+002D), causing the parser to extract only the END time ("7:00pm") and miss the start time, resulting in a 2-hour shift forward.

2. **PM-after-both bug:** Some formatted times like "5:00pm-7:00pm" fail to parse the range because the regex expects "5:00-7:00pm" (PM only at end), not "PM after each time."

---

## Bug 1: Em-Dash Not Recognized

### Evidence
```
Input:  "5:00–7:00pm" (with em-dash U+2013)
Parsed: { start: "7:00pm", end: null }  ← WRONG: Should be { start: "5:00pm", end: "7:00pm" }
```

### Root Cause
In `calendar-utils.ts` line 24, `parseTime()` uses regex:
```javascript
/(\d{1,2}(?::\d{2})?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?/i
```

The pattern `(?:-|to)` matches:
- Regular hyphen-minus: `-` (U+002D)
- Word: `to`

But NOT em-dash: `–` (U+2013)

When the range pattern fails, it falls back to the single-time pattern (line 27):
```javascript
/(\d{1,2}(?::\d{2})?)\s*(am|pm)/i
```

For "5:00–7:00pm":
- Single pattern matches "7:00pm" (not "5:00", because the next char is em-dash, not am/pm)
- Returns: { start: "7:00pm", end: null }

### Impact
- Report email shows: "5:00–7:00pm" (correct, because it displays `event.Time` as-is)
- Calendar event receives: start="7:00pm", end="8:00pm" (default 1-hour duration)
- **Result: 2-hour shift forward** (5 PM → 7 PM)

---

## Bug 2: PM-After-Both Format

### Evidence
```
Input:  "5:00pm-7:00pm"
Parsed: { start: "5:00pm", end: null }  ← WRONG: Should parse both times
```

### Root Cause
The range regex expects format: `HH:MM-HH:MMam|pm`

But Gemini sometimes returns: `HH:MMam|pm-HH:MMam|pm`

For "5:00pm-7:00pm", after matching "5:00", the next character is "p" (start of "pm"), not "-" or whitespace, so the range pattern fails.

Falls back to single-time pattern, which only matches "5:00pm".

---

## The Fix

Update the `parseTime()` function in `calendar-utils.ts` to handle these cases:

### Option A: More Flexible Regex (Recommended)
Accept em-dash and times with PM/AM after each component:

```javascript
export function parseTime(timeStr: string | null | undefined): { start: string; end: string | null } | null {
  if (!timeStr) return null;
  
  // Normalize: convert em-dash to regular dash, strip extra whitespace
  const normalized = timeStr.replace(/–|—/g, '-').trim();
  
  // Range pattern: "5:00-7:00pm" or "5:00pm-7:00pm" or "5:00 to 7:00pm"
  // Handles: optional pm/am after first time, optional after second, or only after second
  const match = normalized.match(
    /(\d{1,2}(?::\d{2})?)\s*(?:am|pm)?\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?/i
  );
  
  if (!match) {
    // Single time like "9:00pm" or "9pm"
    const single = normalized.match(/(\d{1,2}(?::\d{2})?)\s*(am|pm)/i);
    if (single) return { start: single[1] + single[2], end: null };
    return null;
  }
  
  // Extract suffix for both times
  // If suffix appears after second time, use it
  // Otherwise default to "pm"
  let suffix = match[3] || 'pm';
  
  // Handle case where am/pm appears after first time only
  const firstPartMatch = normalized.match(/^(\d{1,2}(?::\d{2})?)\s*(am|pm)?/i);
  if (firstPartMatch && firstPartMatch[2] && !match[3]) {
    suffix = firstPartMatch[2];
  }
  
  return {
    start: match[1] + (firstPartMatch?.[2] || suffix),
    end: match[2] + suffix
  };
}
```

### Option B: Simpler Approach (Normalize Input)
Pre-process `event.Time` before parsing to normalize formats:

```javascript
function normalizeTimeFormat(timeStr: string): string {
  // Convert em-dash/en-dash to regular hyphen
  timeStr = timeStr.replace(/–|—/g, '-');
  
  // If it has "pm-", move pm inside: "5:00pm-7:00pm" -> "5:00-7:00pm"
  timeStr = timeStr.replace(/(\d+)(?:pm|am)(-)/i, '$1$2');
  
  return timeStr.trim();
}
```

---

## Test Cases to Add

In `test/index.spec.ts`:

```javascript
describe('parseTime - edge cases', () => {
  it('handles em-dash format (Gemini output)', () => {
    const result = parseTime('5:00–7:00pm');
    expect(result).toEqual({ start: '5:00pm', end: '7:00pm' });
  });

  it('handles PM after both times', () => {
    const result = parseTime('5:00pm-7:00pm');
    expect(result).toEqual({ start: '5:00pm', end: '7:00pm' });
  });

  it('handles word "to" with em-dash', () => {
    const result = parseTime('5:00–7:00 PM');
    expect(result).toEqual({ start: '5:00pm', end: '7:00pm' });
  });

  it('handles no colon format', () => {
    const result = parseTime('5-7pm');
    expect(result).toEqual({ start: '5pm', end: '7pm' });
  });
});
```

---

## Verification Steps

1. **Extract Gemini output format:** Check actual Gemini responses (see regression samples or recent email processing logs) to confirm which formats it uses most.

2. **Test with real event:** Forward the Covington Back to School Picnic email again after fix and verify calendar shows "5:00-7:00pm" (or "5:00–7:00pm"), not "7:00-8:00pm".

3. **Run test suite:** `npm test` should pass all 38 tests + new edge cases.

---

## Deployment

Once fixed:
```bash
cd /Users/ian/my-projects
git add projects/calendar-scout/
git commit -m "Fix: Handle em-dash and PM-after-both time formats in parseTime()"
bash scripts/deploy-calendar-scout.sh
```

---

## Related Issues

- **Session digest:** `/Users/ian/my-projects/MEMORY/session-2026-08-06-calendar-scout-deployment.md` documented the description bug fix (already applied).
- **Testing infrastructure:** Nightly regression test should catch this if a sample email with em-dash times is added to regression samples.
