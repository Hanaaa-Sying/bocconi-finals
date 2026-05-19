# Dashboard Status Log

## 2026-05-19 — 新增 Daily Routine 项目模板
- 新建 daily.html：垂直时间流 + 任务卡片（DDL/内容/reward）+ 兑奖池（完成任务 → reward 进入奖池 → 随时兑现）
- 更新 index.html：新建项目弹窗加模板选择（Study Dashboard / Daily Routine），openProject 按模板路由到正确 HTML
- 修改文件：daily.html（新建）、index.html

## 2026-05-19 — 新增 J人时刻 元 Dashboard（多项目支持）
- index.html 重写为 J人时刻 项目列表 hub：显示项目卡片，支持新建/删除项目
- dashboard.html 改为按 ?project=id URL 参数运行：所有 localStorage key 加 projectId 前缀，支持任意项目数据隔离
- EVENTS 和 DEFAULT_PLAN 包在 IS_BOCCONI 条件中；新建项目从空白状态开始，日历显示当前月+下月
- 页头加"← J人时刻"返回按钮，标题动态显示项目名
- 修改文件：index.html、dashboard.html、statuslog.md

## 2026-05-19 — 删除有效学习时间功能
- 移除 scoreboardPanel HTML、Log Study Session modal、Manage Study Methods modal
- 删除相关 CSS（score-card、eff-preview、method-row 等全部样式）
- 删除 studyLog、studyMethods 变量及全部相关函数（renderScoreboard、fmtMins 等）
- 清理 refreshAll、toggleTheme、updateCatColor 等处的残留调用
- 修改文件：dashboard.html、statuslog.md

## 2026-05-19 — 重构 May 20–28 复习计划（SNO + Sociology 三阶段）

- 将 May 20–28 的 SNO 和 Sociology 任务全部替换为三阶段结构：Phase 1 过课件+思维导图（5/20–5/24）、Phase 2 背诵（5/25）、Phase 3 模拟题（5/26–5/27）
- SNO 覆盖全部 L1–L21（20 讲），Sociology 覆盖 L1–L15（15 讲）；May 22（IELTS 考试日）减负只各留 1 任务
- PLAN_KEY 升至 v7，迁移逻辑保留 May 20 前已完成状态，May 20 起从新 DEFAULT_PLAN 重建
- 文件：`dashboard.html`、`dashboard-data.json`

## 2026-05-19 — 修复"开启文件保存"覆盖已有数据的问题
- `onFsBtnClick()` 选中已有文件时先读内容，有有效数据则加载而非覆盖，防止跨 origin 切换后数据丢失
- 文件：`dashboard.html`

## 2026-05-19 — 修复 Task List 新类目不显示 + 深浅主题颜色改善
- Bug1: `addCategory()` 和 `deleteCategory()` 新增 `renderTodoCourseRow()` 调用，确保 Task List 标签栏实时同步
- Bug2: `injectCategoryCSS()` 改为生成 `:root:not(.light)` / `:root.light` 双套规则，不再用单一 hex 覆盖 CSS 变量
- `getCatColor()` 改为主题感知：浅色模式返回 `colorLight`；`toggleTheme()` 后重绘 scoreboard / legend / evlist / todo
- 新增 `hslToHex` / `hexToHue` / `autoGenCatColors`：新建类目自动生成深浅模式各一套颜色，移除手动颜色选择器
- `BUILTIN_CATEGORIES` 补充 `colorLight`；`loadCategories` 加向后兼容迁移；`renderCatList` 展示暗/亮两个颜色选择器
- 文件：`dashboard.html`

## 2026-05-14 — Task List 新增批量多选操作
- 标题栏加 "Select" 按钮切换多选模式，再次点击或操作完成后退出
- 多选模式下任务显示选择框，点击任务/复选框切换选中；工具栏显示已选数量、全选、日期移动、删除
- 新增函数：`toggleBulkMode` `toggleBulkTask` `bulkSelectAll` `bulkDelete` `bulkMoveConfirm`；`buildTask` 新增 `selectable` 参数
- 文件：`dashboard.html`

## 2026-05-14 — 防止文件句柄失效时数据静默丢失
- `_fsWrite()` 检测 NotFoundError 时主动清掉坏句柄并显示重连提示，不再静默失败
- 每次成功写入后在 localStorage 存 `bocconi_last_saved` 时间戳
- `reloadFromPicker()` 恢复前比较文件与 localStorage 时间戳，文件更旧时弹确认框防止意外覆盖
- 文件：`dashboard.html`

## 2026-05-14 — 修复文件恢复 NotFoundError 崩溃
- 旧文件句柄失效（文件被移动过）时会抛 NotFoundError，之前被 catch 吞掉只显示"恢复失败"
- 新增 `_clearFsHandle()` 清除坏句柄，新增 `reloadFromPicker()` 用 showOpenFilePicker 让用户重新选文件
- 提取 `_applyAndRefresh()` 复用渲染逻辑；`onReconnectClick` 检测 NotFoundError 后自动走重选流程
- 文件：`dashboard.html`

## 2026-05-12 — Todo 列表支持拖拽调整任务日期
- Todo 标签页内的任务现在可拖拽：`buildTask` 第三参数由 `false` 改为 `true`
- 每个日期标签（`.todo-date-lbl`）作为 drop 区，拖任务到日期标题上可移动日期
- 新增 `todoDatDragOver/Leave/Drop` 三个处理函数；新增 `.todo-date-lbl.drop-ok` 高亮样式
- 文件：`dashboard.html`

## 2026-05-08 — 新增有效学习计分板功能
- 新增 `studyLog`（学习记录）和 `studyMethods`（学习方式 + 权重）两个持久化状态，存入 localStorage + file JSON
- 默认 11 种学习方式，权重基于 Dunlosky et al. 2013 认知科学研究（主动回忆 1.0 → 划重点 0.15）
- 新增计分板面板（today/week 有效时长统计 + 7 天 CSS 柱状图 + 各科本周进度条）
- 新增「+ 记录」modal（选科目 + 时长 + 方式，实时预览有效时长）
- 新增「管理方式」modal（可增删改学习方式名称和权重）
- 文件：`dashboard.html`（CSS/HTML/JS 全部内联修改）


## 2026-05-07 — 放大 task checkbox 点击区域
- `.task-check` 从 13×13px 改为 18×18px，更易点击
- 文件：`dashboard.html` line 156


## 2026-05-07 — 修复 localStorage 数据丢失问题 + 创建 CLAUDE.md

- **问题根因：** 所有数据仅存于浏览器 localStorage，浏览器关闭时清除数据的设置会导致改动丢失
- **修复：** 新增 File System Access API 文件保存层，将全部状态写入 `dashboard-data.json`；所有 `save*()` 函数现在同时调用 `scheduleFsWrite()`；页面启动时优先从文件恢复数据
- **Bug 修复：** `_setFsBtn` 中 `display:''` 无法覆盖 CSS `display:none`，改为 `display:'inline-block'`
- **文件修改：** `dashboard.html`，新建 `CLAUDE.md`，新建 `statuslog.md`
