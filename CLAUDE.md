# Bocconi Finals Dashboard — Claude Instructions

## What this project is

Single-file study dashboard for Bocconi Spring 2026 finals.
- **Project root:** `D:\1mylife\vibecoding\J人时刻\`
- **Main file:** `D:\1mylife\vibecoding\J人时刻\dashboard.html` (all HTML/CSS/JS in one file, no build step)
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

## daily.html — 每日主线任务

### 设计意图

用户给自己发明的一套任务+奖励机制：每个任务有一个"完成后的 reward"，reward 往往就是当下最想逃避去做的事（比如想用来拖延任务的那件事）。完成任务后 reward 进入"兑奖池"，随时可以兑现。这个机制的核心是：把"逃避的冲动"变成可以合法兑现的奖励，而不是无限制的拖延。

这不是一个项目管理工具，而是一个**当日执行追踪 + 自我激励**工具。

### 入口与定位

`daily.html` 是 J人时刻 hub（`index.html`）顶部的**固定入口**，不是可创建/删除的项目类型。之所以不做成项目，是因为每天一条记录，做成项目会让 hub 首页迅速被塞满。URL 固定为 `daily.html?project=daily`。

### 三栏布局的设计逻辑

| 左列 | 中列 | 右列 |
|---|---|---|
| 昨天（只读） | 今天（可添加/完成） | 明天（可计划） |

- 用户习惯在**前一天晚上**规划第二天，所以右列允许添加任务
- 右列上限是明天，**不能规划后天**——防止过度计划导致焦虑
- 顶部箭头可回溯历史（往前无限，往后最多到今天为中列）

### 数据结构

```javascript
// localStorage keys（projectId = 'daily'）
DAYS_KEY        = 'daily_days_v1'
REWARDS_KEY     = 'daily_rewards_v1'
LINKED_META_KEY = 'daily_linked_meta_v1'

// days 格式
{ "2026-05-19": [{id, text, ddl, notes, reward, done}], ... }

// rewards 格式（全局跨天积累）
[{id, text, redeemed, date, taskId, taskText}]

// linkedMeta 格式（联动任务的本地 DDL/reward）
{ "projectId:taskId:date": {ddl, reward} }
```

文件持久化层：`daily-data.json`，写入 `{days, rewards, linkedMeta, savedAt}`，句柄存 IndexedDB `jhub_daily_fsh`。

### 联动任务（来自其他项目）

每列底部自动显示 hub 中其他项目（如 Bocconi Final）当天的计划任务。

- **勾选**同步写回源项目的 `<pid>_plan_v7`（双向同步）
- **点击正文**可为联动任务单独设置 DDL 和 reward，存入 `linked_meta_v1`，**不回写源项目**——因为 DDL/reward 是用户在每日维度额外加的，与源项目的学习计划语义不同
- 明天列的联动任务禁用勾选（防误操作）

### 关键函数

- `renderAll()` — 渲染三列 + 兑奖池
- `renderTimeline(iso, containerId)` — 渲染单列时间流（个人任务 + 联动任务）
- `getLinkedTasks(date)` — 读取所有其他项目当天的任务
- `toggleLinkedTask(pid, taskId, date, isDone)` — 同步勾选状态回源项目
- `completeTask(iso, id)` — 完成任务，reward 自动进奖池
- `openEditModal(iso, id)` — 编辑未完成的个人任务
- `openLinkedEditModal(pid, taskId, date)` — 设置联动任务的本地 DDL/reward

---

## After every code change

**Step 1 — prepend a log entry to `D:\1mylife\vibecoding\J人时刻\log.md`** (newest first, right after the `---` separator at the top):

```
## YYYY-MM-DD — <one-line summary>

**Prompt:** <one sentence: what the user asked for, or "(自发现)" if Claude spotted it unprompted>
**Files:** `file1.html`, `file2.md`
- <bullet: what changed and why>
**Debug:** <symptom → root cause → fix> (omit this line if no debugging was needed)
```

One entry = one complete feature or fix. If a feature took multiple conversation turns to implement, it still gets one entry. Use today's date.

**Step 2 — commit and push to GitHub:**

```powershell
git -C "D:\1mylife\vibecoding\J人时刻" add dashboard.html log.md CLAUDE.md index.html daily.html merge.html gcal.js .gitignore
git -C "D:\1mylife\vibecoding\J人时刻" commit -m "<same one-line summary as log entry>"
git -C "D:\1mylife\vibecoding\J人时刻" push origin main
```

Only stage the files listed above — never stage `dashboard-data.json` (personal data). Do not skip this step.

---

## Style preferences

- Responses in Chinese by default (user messages are typically Chinese)
- No inline comments in code unless the WHY is non-obvious
- No emoji unless user asks
- Minimal UI additions — don't introduce new UI patterns unless asked
