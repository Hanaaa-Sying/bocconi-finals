# Bocconi Finals Dashboard — Claude Instructions

## What this project is

Single-file study dashboard for Bocconi Spring 2026 finals.
- **Main file:** `D:\BocconiFinals\dashboard.html` (all HTML/CSS/JS in one file, no build step)
- **User:** Bocconi student, communicates in Chinese and English, comfortable with HTML/CSS/JS
- **Courses:** LLM · SNO · MC · Sociology · IELTS

---

## Architecture

### Data layer
All state lives in JavaScript variables, persisted via two mechanisms:

| Variable | localStorage key | Meaning |
|---|---|---|
| `planState` | `bocconi_plan_v6` | Study task completion + custom tasks per day |
| `scratchItems` | `bocconi_scratch_v1` | Scratchpad / someday tasks |
| `categories` | `bocconi_cats_v1` | Course categories with colors |
| `customEvents` | `bocconi_evts_v1` | User-added calendar events |
| `hiddenEventIds` | `bocconi_hidden_evts_v1` | Set of default event IDs the user deleted |

**File storage layer:** `dashboard-data.json` (same folder) via File System Access API. Written on every change via `scheduleFsWrite()` → `_fsWrite()`. Handle persisted in IndexedDB (`bocconi_fsh`). This is the authoritative source if it exists — it overrides localStorage on load.

### Key functions
- `save()` — persists `planState` to localStorage + schedules file write
- `saveScratch/saveCategories/saveCustomEvents/saveHiddenEvents()` — same pattern
- `scheduleFsWrite()` — debounced 800ms write to `dashboard-data.json`
- `initState()` — loads `planState` from localStorage, falls back to `DEFAULT_PLAN`
- `refreshAll()` — calls `save()` + re-renders plan, scratch, popup, todo
- `renderPlan/renderScratch/renderCal/renderEvList/renderLegend/renderTodo()` — render functions

### Storage key versioning rule
**Never bump `PLAN_KEY` (e.g. v6 → v7) without adding migration logic** in `initState()`. Bumping without migration silently resets everyone's study plan to `DEFAULT_PLAN`.

---

## Design rules (do not break these)

1. **Max 2 tasks per course per day** in `DEFAULT_PLAN` — user explicitly requested this
2. **Drag-and-drop** must work on both `.day-card` elements and `.cal-d` calendar cells
3. **Calendar cells are clickable** and show a popup (`calClick` → `renderPopup`) — preserve this
4. **INFJ dark theme:** `--bg1:#09091a`, `--purple:#9b8ec4`, `--teal:#7ab8a8`, Crimson Pro serif headings, Inter body — don't change the color palette unless asked
5. Trust source documents over verbal date summaries (e.g. Advanto .docx said May 9, not May 10)

---

## After every code change

**Always append a log entry to `D:\BocconiFinals\statuslog.md`** in this format:

```
## YYYY-MM-DD — <one-line summary>
- <what changed and why>
- <file(s) modified>
```

Use today's date. Keep entries short (2–4 bullets max). Do not skip this step.

---

## Style preferences

- Responses in Chinese by default (user messages are typically Chinese)
- No inline comments in code unless the WHY is non-obvious
- No emoji unless user asks
- Minimal UI additions — don't introduce new UI patterns unless asked
