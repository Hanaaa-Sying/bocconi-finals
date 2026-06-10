# J人时刻 · 开发日志

> 格式：每条对应一个完整功能或修复（不以对话回合为单位）。
> `statuslog.md` 已停止维护，历史条目迁移于下方。

---

## 🚧 OPEN BUG — AI 聊天 400 错误（待查）

**现象：** 点"兑现"→ AI 聊天 modal → API 返回 400，无论从 `file://` 还是 `http://localhost:8080` 访问均失败
**已排查：** messages 顺序问题已修复（以 user 开头）；API Key 有效；CORS header 已加
**待查：** 实际 400 response body（F12 → Network → 找 api.anthropic.com 请求 → Response tab）；model ID `claude-haiku-4-5-20251001` 是否对该 key 可用

---

## 2026-06-10 — 首页主入口由「每日主线任务」换成「合并视图」

**Prompt:** 把首页那个每日主线任务的醒目入口换成合并视图，并删掉 header 里单独的合并视图按钮，这样点同一个位置就直接看到合并后的样子
**Files:** `index.html`
- `.daily-entry` 卡片 onclick 改为 `merge.html`，标题改「合并视图」、副标「多项目 · 日历总览」，分区标题由「每日」改「总览」
- 删除 header 中单独的「合并视图」`new-btn`，避免重复入口
- `daily.html` 文件保留，仅首页不再有入口（如需可改回）



**Prompt:** 担心 Pages 公开后日程/项目泄露，想要注册账号密码、登录后只有自己能看自己的数据，并要一个游客体验版
**Files:** `supa.js`（新建）, `login.html`（新建）, `index.html`, `dashboard.html`, `daily.html`, `merge.html`, `CLAUDE.md`
- 澄清：纯静态站做不出真隐私（前端密码可绕过、localStorage 按设备非按账号），真账号必须有后端 → 选 Supabase（Auth + Postgres + RLS，免费）
- `supa.js`：localStorage 当同步缓存、Supabase 当云端真源。登录后 `hydrate()` 把云端 KV 灌进 localStorage；monkey-patch `localStorage.setItem/removeItem` 拦截需同步的键（debounce 800ms upsert/delete 上云），现有 save 函数零改动
- 数据表 `app_data(user_id,key,value jsonb)` + RLS `auth.uid()=user_id`，每人只能读写自己的行；anon/publishable key 公开可提交，靠 RLS 兜底
- 首次登录迁移：云端为空且本机有数据且 `jhub_synced_user` 标记匹配 → 把本机现有项目一次性上云
- `login.html`：邮箱+密码 登录/注册（免邮箱验证）+「游客体验」入口；游客用 `seedGuest()` 造健身/读书/副业三个假项目，仅写 localStorage、绝不入云
- 四个页面统一加门禁：init 第一步 `SUPA.boot()`，无 session 跳 login.html；dashboard/daily 在登录态/游客态短路本地文件保存层（云端取代，避免旧 JSON 回灌覆盖云数据）
- `isSyncedKey()` 圈定同步键（`jhub_projects_v1`/`daily_*`/`*_plan_v7` 等），排除 theme、gcal client id、anthropic key 等设备级键

## 2026-06-09 — 新增 Google Calendar 双向同步（gcal.js）

**Prompt:** 部署到 GitHub Pages 后，希望 dashboard 能和 Google 日历双向联动
**Files:** `gcal.js`（新建）, `dashboard.html`
- 新建共享模块 `gcal.js`：用 Google Identity Services token client 做纯前端 OAuth（无后端），封装 connect / listEvents / insert / patch / delete，以及 hex→Google colorId 就近映射；Client ID 存 localStorage（`jhub_gcal_client_id`），运行时网页内粘贴，不写死进仓库
- dashboard 日历卡片加「⟳ Google」按钮 → `gcalSync()`：PUSH 本项目事件为全天事件（标题 `[项目名] label`，描述带 `jhub:<pid>:<eventId>` 标记，按项目色上色），已删除事件同步删除；PULL 把 Google 上被改了日期的（仅自定义事件）写回本地
- 映射存 `<pid>_gcal_map_v1`（dashboardEventId ↔ gcalEventId）；仅在 https（Pages）下可用，file:// 给出提示
- 对「单文件」约定的一处有意偏离：OAuth 代码抽成外部 `gcal.js` 以便 dashboard/merge 共用
- 内置默认 Client ID（受 OAuth origin 限制只能从 Pages 网址发起，非机密），用户点按钮即用，无需粘贴

## 2026-06-09 — daily.html 暂时隐藏兑奖池

**Prompt:** 把兑奖池功能先隐藏不呈现，但保留代码，之后修改优化后再放回
**Files:** `daily.html`
- `.pool-section` 加 `style="display:none"`，整块兑奖池及 AI 回味聊天暂不展示
- 渲染与奖励累积逻辑（`renderPool`、`completeTask`、联动勾选写入 `rewards`）全部保留，数据照常累积不丢失；恢复只需去掉该 `display:none`

## 2026-06-09 — 新增 merge.html 多项目合并视图

**Prompt:** 回国后想把面板当个人多项目规划器，要一个 merge 按钮把各项目按不同颜色汇总到一张大日历
**Files:** `merge.html`, `index.html`
- 新建 `merge.html`：同源读取所有项目的 localStorage（`<pid>_evts_v1` 事件 + `<pid>_plan_v7` 任务，扣除 `<pid>_hidden_evts_v1`），bocconi 硬编码事件在页内保留一份副本
- 日历每格按"有活动的项目"渲染彩色圆点（项目色去重，最多 6 个）；点某天右栏列出当天跨项目的事件/任务，可一键跳进对应 dashboard
- 底部图例列出全部项目 + 各自颜色 + 当期条目数；复用暗/亮主题与 dashboard 日历样式
- `index.html` header 加"合并视图"入口

## 2026-06-09 — dashboard 日历改为滚动动态月份

**Prompt:** 同上（长期规划不能再写死 2026 年 4/5 月）
**Files:** `dashboard.html`
- 新增 `calBaseDate` 状态 + `renderCalendars()/calShift()/calToday()`，日历改为"基准月 + 下一月"两格，加上一月/下一月/今天导航按钮
- 替换所有写死的 `renderCal(2026,3/4,...)` 调用（`refreshCalendar`、`_applyAndRefresh`、init），bocconi 项目初始仍停在 2026-04，其余项目默认本月

---

## 2026-05-19 — 兑奖池新增 AI 回味聊天功能

**Prompt:** 兑现 reward 太快没有回味感，希望 AI 根据 reward 内容问问题，像朋友聊天一样，并记录下来
**Files:** `daily.html`
- 点"兑现"→ 打开"回味时刻" modal，Claude Haiku 根据 reward 内容自动发起对话（吃饭问味道/同伴，休闲问感受等）
- 用户回复后可"记录并兑现"保存聊天记录到 reward 对象，或"直接兑现"跳过
- API Key 首次输入后存入 localStorage，支持 401 时自动清除并提示重新输入
- 模型：`claude-haiku-4-5-20251001`，直接浏览器调用，需 `anthropic-dangerous-direct-browser-access` header

---

## 2026-05-19 — 修复联动任务勾选后 reward 不入池

**Prompt:** 勾选今天的任务后兑奖池没有出现奖励
**Files:** `daily.html`
- `toggleLinkedTask` 补充 reward pool 同步：勾选时若 `linkedMeta` 有本地 reward 则入池，取消勾选则移除未兑现的 reward
- 用 `_pid` 字段标记联动任务 reward 的来源项目，防止跨项目 id 碰撞

**Debug:** 症状：勾选联动任务 checkbox 后兑奖池无变化 → 根因：`toggleLinkedTask` 只同步 done 状态到源项目，没有写 rewards 数组 → 修复：勾选时检查 linkedMeta，有 reward 则 push 入池

---

## 2026-05-19 — 每日主线任务新增文件保存层（防数据丢失）

**Prompt:** 担心每日主线任务像之前 Bocconi Final 那样因 localStorage 被清除而丢失数据
**Files:** `daily.html`
- 头部新增"开启文件保存"按钮，用户选择本地 `daily-data.json` 写入持久化
- 每次 save 触发 `scheduleFsWrite()`（debounced 800ms）写入 days + rewards + linkedMeta
- 页面加载时通过 IndexedDB 恢复文件句柄，优先从文件读取数据
- 句柄失效（文件被移动）时按钮变为"⚠ 重新连接"，引导用户重选文件

---

## 2026-05-19 — 任务正文可点击编辑；联动任务可设置本地 DDL & Reward

**Prompt:** 点击任务正文进入编辑界面（可修改 DDL/reward）；联动任务也能设置自己的 DDL 和 reward，但不回写到源项目
**Files:** `daily.html`
- 个人任务（未完成）：点击任务名称文字打开编辑 modal，复用添加 modal 加 edit mode，支持修改全部字段
- 联动任务：点击正文区域打开独立 modal，设置本地 DDL / reward，存入 `<pid>_linked_meta_v1`；设置后在联动任务卡片上显示
- 新增：`openEditModal` / `openLinkedEditModal` / `submitLinkedEdit` / `saveLinkedMeta`

---

## 2026-05-19 — 每日主线任务联动其他项目任务

**Prompt:** 让每日主线任务的今天栏自动显示其他项目（如 Bocconi Final）当天的计划任务，勾选后双向同步
**Files:** `daily.html`
- 三栏每列底部新增"来自其他项目"区块，读取 `jhub_projects_v1` 遍历所有非 daily 项目的 `<pid>_plan_v7`
- 勾选联动任务写回源项目 localStorage，明天列禁用勾选
- 新增 `getLinkedTasks(date)` / `toggleLinkedTask(pid, taskId, date, isDone)`

---

## 2026-05-19 — 每日主线任务改为三栏布局

**Prompt:** 把每日主线任务改成左昨天、中今天、右明天三栏，上方箭头可回溯，但不能规划后天以防过度规划
**Files:** `daily.html`
- 重写为左中右三栏 grid，`viewCenter` 控制中间日期，`shiftView()` 做边界限制（center 不超今天，右列不超明天）
- 兑奖池改为 grid 布局，reward card 更紧凑

---

## 2026-05-19 — 每日主线任务改为固定入口

**Prompt:** Daily routine 不应该是需要每天新建的项目类型，否则 hub 首页会越来越满；改成固定入口，改名叫"每日主线任务"
**Files:** `index.html`, `daily.html`
- hub 顶部改为固定卡片直达 `daily.html?project=daily`，移除新建项目弹窗中的模板选择
- `daily.html` 标题固定为"每日主线任务"

**Debug:** 用户找不到 Daily Routine → 根因是它被实现成了需要手动新建的项目类型，而不是固定入口 → 移出项目列表改为顶部固定卡片

---

## 2026-05-19 — 新增每日主线任务（daily.html）

**Prompt:** 希望有个新模板，记录每日任务时间流（DDL + 任务名 + 备注 + reward），完成任务后 reward 进入兑奖池随时兑现
**Files:** `daily.html`（新建）, `index.html`
- 新建 `daily.html`：垂直时间流 + 任务卡片 + 兑奖池
- 数据结构：`<pid>_days_v1`（按日期存任务数组）/ `<pid>_rewards_v1`（reward 列表）

---

## 2026-05-19 — 新增 J人时刻 元 Dashboard（多项目支持）

**Prompt:** 希望当前 dashboard 变成一个叫"J人时刻"的平台里的子项目，可以新建/删除项目，每个项目用同一套模板但数据独立
**Files:** `index.html`（新建 hub）, `dashboard.html`
- `index.html` 重写为项目列表 hub，支持新建/删除项目
- `dashboard.html` 改为 `?project=<id>` 路由，所有 localStorage key 加 projectId 前缀
- 零迁移策略：Bocconi 项目 ID = `"bocconi"`，与现有 key 前缀完全匹配
- `EVENTS` / `DEFAULT_PLAN` 包在 `IS_BOCCONI` 条件中；页头加返回按钮

---

## 2026-05-19 — 删除有效学习时间功能

**Prompt:** 在建 J人时刻多项目架构之前，先删掉 dashboard 里面的有效学习时间功能
**Files:** `dashboard.html`
- 移除 scoreboardPanel HTML、Log Study Session modal、Manage Study Methods modal 及全部相关 CSS / JS

---

## 2026-05-19 — 重构 May 20–28 复习计划（SNO + Sociology 三阶段）

**Prompt:** 将 SNO 和 Sociology 的复习任务重构为三阶段：过课件、背诵、模拟题
**Files:** `dashboard.html`
- May 20–28 SNO/Sociology 任务替换为 Phase 1（过课件+思维导图）/ Phase 2（背诵）/ Phase 3（模拟题）
- PLAN_KEY 升至 v7，迁移逻辑保留 May 20 前已完成状态

---

## 2026-05-19 — 修复"开启文件保存"覆盖已有数据的问题

**Prompt:** （自发现）切换 origin 后重新开启文件保存时数据被覆盖
**Files:** `dashboard.html`
- `onFsBtnClick()` 选中已有文件时先读内容，有有效数据则加载而非覆盖

**Debug:** 症状：跨 origin 切换后点"开启文件保存"数据清空 → 根因：直接覆盖写入没有先读取文件已有内容 → 修复：选文件后先 read，有数据则 `_applyAndRefresh()` 而非直接写

---

## 2026-05-19 — 修复 Task List 新类目不显示 + 深浅主题颜色改善

**Prompt:** 新建类目后 Task List 标签栏不更新；深浅主题切换后颜色不同步
**Files:** `dashboard.html`
- `addCategory()` / `deleteCategory()` 新增 `renderTodoCourseRow()` 调用

**Debug:**
- Bug1：新建类目不显示 → 根因：`addCategory` 没有调用 `renderTodoCourseRow()` → 补调用
- Bug2：主题切换颜色不对 → 根因：`injectCategoryCSS()` 生成单一 hex 覆盖变量，切主题后失效 → 改为生成 `:root:not(.light)` / `:root.light` 双套规则

---

## 2026-05-14 — Task List 新增批量多选操作

**Prompt:** 希望能批量选中任务后统一移日期或删除
**Files:** `dashboard.html`
- 标题栏加 "Select" 按钮切换多选模式，支持全选、批量移日期、批量删除
- 新增：`toggleBulkMode` `toggleBulkTask` `bulkSelectAll` `bulkDelete` `bulkMoveConfirm`

---

## 2026-05-14 — 防止文件句柄失效时数据静默丢失

**Prompt:** （自发现）文件句柄失效时写入失败但没有任何提示，数据静默丢失
**Files:** `dashboard.html`
- `_fsWrite()` 检测 NotFoundError 时主动清掉坏句柄并显示重连提示
- 成功写入后在 localStorage 存 `last_saved` 时间戳；恢复时比较时间戳防止旧文件覆盖新数据

**Debug:** 症状：关闭页面再开，发现数据回滚 → 根因：文件句柄失效后 write 静默失败，localStorage 有数据但文件没更新 → 修复：检测 NotFoundError 并提示用户重连

---

## 2026-05-14 — 修复文件恢复 NotFoundError 崩溃

**Prompt:** （自发现）文件被移动后点"恢复"只显示"恢复失败"，没有办法重新选文件
**Files:** `dashboard.html`
- 新增 `_clearFsHandle()` 清除坏句柄，`reloadFromPicker()` 触发重新选文件流程

**Debug:** 症状：NotFoundError 被 catch 吞掉，用户看到"恢复失败"但无法操作 → 修复：catch 内识别 NotFoundError，自动走 `showOpenFilePicker` 重选

---

## 2026-05-12 — Todo 列表支持拖拽调整任务日期

**Prompt:** 希望 Todo 标签页的任务可以拖拽到不同日期
**Files:** `dashboard.html`
- 每个日期标签作为 drop 区，新增 `todoDatDragOver/Leave/Drop` 三个处理函数

---

## 2026-05-08 — 新增有效学习计分板功能

**Prompt:** 希望记录每次学习的时长和方式，统计"有效学习时间"（按认知科学权重加权）
**Files:** `dashboard.html`
- 新增计分板面板、「+ 记录」modal、「管理方式」modal
- 权重基于 Dunlosky et al. 2013（主动回忆 1.0 → 划重点 0.15）
- *(注：此功能后于 2026-05-19 被整体删除)*

---

## 2026-05-07 — 放大 task checkbox 点击区域

**Prompt:** checkbox 太小了不好点
**Files:** `dashboard.html`
- `.task-check` 从 13×13px 改为 18×18px

---

## 2026-05-07 — 修复 localStorage 数据丢失 + 新建 CLAUDE.md

**Prompt:** 浏览器关闭后数据丢失
**Files:** `dashboard.html`, `CLAUDE.md`（新建）, `statuslog.md`（新建，现已由 log.md 接替）
- 新增 File System Access API 文件保存层，所有 `save*()` 同时写 `dashboard-data.json`

**Debug:** 症状：关闭浏览器后所有勾选状态消失 → 根因：数据只存 localStorage，浏览器设置为关闭时清除 session → 修复：File System Access API 持久化到本地文件；顺带修复 `_setFsBtn` 中 `display:''` 无法覆盖 CSS `display:none` 的小 bug（改为 `display:'inline-block'`）
