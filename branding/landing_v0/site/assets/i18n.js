(function () {
  "use strict";

  var DICT = {
    en: {
      "meta.title": "Contempo — Material participation, proven as you go",
      "meta.description": "Contempo turns a voice memo, a text, or a photo into a timestamped, audit-ready material participation record — captured the moment the work happens.",
      "nav.stamp": "v0 concept",
      "nav.how": "How it works",
      "nav.features": "Features",
      "nav.trust": "Audit defense",
      "nav.pricing": "Pricing",
      "nav.faq": "FAQ",
      "cta.waitlist": "Join the waitlist",

      "hero.eyebrow": "Material participation, logged as it happens",
      "hero.h1_line1": "Say it once.",
      "hero.h1_line2": "Prove it forever.",
      "hero.lede": "Contempo turns a voice memo, a text, or a photo into a timestamped, audit-ready record — the moment the work happens, not the night before your CPA call.",
      "hero.cta_secondary": "See how it works ↓",
      "hero.note": "Built for STR hosts and real estate professionals pursuing the 100-hour, 500-hour, or REPS 750-hour test.",

      "mock.capturing": "Capturing",
      "mock.draft_label": "AI draft · pending review",
      "mock.draft_text": "“Cleaned and restocked supplies at Maple St, then swapped the lockbox code before the next check-in.”",
      "mock.confirm_btn": "✓ Confirm · 42 min · Maintenance",
      "mock.edit_btn": "Edit",
      "mock.ring_title": "62 / 100 hrs toward the STR test",
      "mock.ring_sub": "On pace to qualify by Nov 4, at your current rate",
      "mock.live_pill": "Contempo — session running",

      "problem.eyebrow": "Why most hosts fail the test",
      "problem.h2": "The hours were real. The paperwork wasn't.",
      "problem.c1.tag": "Requirement",
      "problem.c1.text": "The IRS requires contemporaneous records — logged as the work happens, not reconstructed later from memory.",
      "problem.c2.tag": "Precedent",
      "problem.c2.text": "Courts have consistently sided with taxpayers who kept real-time logs, and against those who estimated their hours after the fact.",
      "problem.c3.tag": "Burden of proof",
      "problem.c3.text": "Proving material participation is entirely on the host. If it isn't written down as it happens, it doesn't hold up under review.",

      "how.eyebrow": "From activity to evidence",
      "how.h2": "Four steps, none of them a form.",
      "how.e1.id": "ENTRY 01 · CAPTURE",
      "how.e1.h3": "Talk, text, or let it happen automatically",
      "how.e1.p": "Send a voice memo, forward a text, snap a photo, or let a calendar event, geofence, or booking signal draft the entry before you ever open the app — whichever surface you happen to be near.",
      "how.e1.watch_label": "Watch · say it",
      "how.e1.app_bubble": "cleaned pool + restocked towels, 35 min",
      "how.e1.app_check": "✓ logged",
      "how.e1.app_label": "App · text or type it",
      "how.e1.lock_pill": "Auto-drafted from calendar",
      "how.e1.lock_label": "Lock screen · it happens for you",

      "how.e2.id": "ENTRY 02 · PARSE",
      "how.e2.h3": "The AI extracts the details",
      "how.e2.p": "Property, task, duration, category, and participant — pulled from what you actually said, with one clarifying question asked only if it's genuinely needed.",
      "how.e2.source": "“swapped the lockbox code before the next check-in, took about 20 minutes”",
      "how.e2.f1_key": "Property",
      "how.e2.f1_val": "Maple St",
      "how.e2.f2_key": "Duration",
      "how.e2.f2_val": "20 min",
      "how.e2.f3_key": "Category",
      "how.e2.f3_val": "Turnover",

      "how.e3.id": "ENTRY 03 · CONFIRM",
      "how.e3.h3": "Nothing commits without you",
      "how.e3.p": "Every draft sits for a one-tap review. Edit any field, on any entry, however it was captured — manual and AI-drafted entries carry the same weight.",
      "how.e3.confirm_text": "“Swapped the lockbox code before check-in” · 20 min · Turnover",
      "how.e3.confirm_btn": "✓ Confirm",
      "how.e3.edit_btn": "Edit",
      "how.e3.logged_tag": "Logged ✓",

      "how.e4.id": "ENTRY 04 · PROVE",
      "how.e4.h3": "It becomes part of your ledger",
      "how.e4.p": "Timestamped, contemporaneity-scored, and organized by property — ready to export the moment your CPA, or the IRS, asks for it.",
      "how.e4.row1": "Turnover clean · 38m",
      "how.e4.row2": "Guest msgs · 12m",
      "how.e4.row3": "Lockbox fix · 20m",
      "how.e4.export_btn": "Export CPA package →",

      "features.eyebrow": "Built for how the work actually happens",
      "features.h2": "Logging that survives contact with a busy day.",
      "features.f1.h3": "Capture without a screen",
      "features.f1.p": "Geofence, calendar, and booking signals draft entries before you ever unlock your phone.",
      "features.f2.h3": "Voice, text, or a photo",
      "features.f2.p": "Forward a voice memo or snap a picture of the work. No form, no typing required.",
      "features.f3.h3": "A copilot that knows the law",
      "features.f3.p": "Ask “would this count?” and get an answer grounded in the actual material participation tests and known case outcomes.",
      "features.f4.h3": "Household-aware",
      "features.f4.p": "Tracks your spouse, cleaner, and co-host's hours too, and warns you before anyone else's time outpaces yours.",
      "features.f5.h3": "Manual, whenever you want it",
      "features.f5.p": "Every entry is the same structured record, however it was captured — fully editable, always one tap away.",
      "features.f6.h3": "Live, wherever you glance",
      "features.f6.p": "A Live Activity or Live Update shows your running session and year-to-date progress right on your lock screen.",

      "trust.eyebrow": "Built for scrutiny, not just speed",
      "trust.h2": "Every entry carries its own paper trail.",
      "trust.p1": "Contempo scores every entry for contemporaneity — how soon it was logged after the work happened — and flags the patterns that actually sink an audit: vague descriptions, unrealistic durations, and entries added long after the fact.",
      "trust.p2": "Nothing here is tax advice. It's the documentation infrastructure your CPA wishes every client already had.",
      "trust.readiness_label": "2026 readiness score",
      "trust.list1": "214 entries logged within 24 hours of the activity",
      "trust.list2": "6 entries flagged as vague — needs one more detail each",
      "trust.list3": "2 entries logged more than 14 days after the activity",
      "trust.list4": "No household hour conflicts detected on the 100-hour test",

      "platforms.eyebrow": "Everywhere the work happens",
      "platforms.h2": "Not just another app you forget to open.",
      "moments.m1.caption": "“mowed the lawn, fixed the sprinkler head”",
      "moments.m1.h3": "Tap your watch, not your phone",
      "moments.m1.p": "Hold the mic, say what you did, let go. Your hands never leave the yard tools.",
      "moments.m2.date": "FRIDAY, JULY 24",
      "moments.m2.pill": "Contempo — session running",
      "moments.m2.elapsed": "elapsed",
      "moments.m2.ytd": "/100 hrs YTD",
      "moments.m2.h3": "Glance without unlocking",
      "moments.m2.p": "iOS Live Activity, Android Live Update — the same running total, right on the lock screen.",
      "moments.m3.sender": "Maria (cleaner)",
      "moments.m3.incoming": "done at Maple St, took about 40 min",
      "moments.m3.outgoing": "✓ Logged under Maria · doesn't count against your hours",
      "moments.m3.h3": "Your team logs too — correctly attributed",
      "moments.m3.p": "No app install for the cleaner. Their hours are tracked separately, so they never eat into your test.",
      "platform.web": "Web (back office)",

      "pricing.eyebrow": "Pricing",
      "pricing.h2": "Priced against the deduction, not the timer.",
      "pricing.badge": "MOST HOSTS PICK THIS",
      "pricing.p1.name": "Starter",
      "pricing.suffix": "/mo",
      "pricing.p1.desc": "One property, logged properly, at no cost.",
      "pricing.p1.f1": "1 property",
      "pricing.p1.f2": "Unlimited manual, voice & SMS entries",
      "pricing.p1.f3": "Core hour tracking & pacing dashboard",
      "pricing.p1.f4": "CSV export",
      "pricing.p2.name": "Pro",
      "pricing.p2.desc": "For hosts running one or more properties as a real operation.",
      "pricing.p2.f1": "Unlimited properties",
      "pricing.p2.f2": "Passive capture — calendar, PMS, geofence",
      "pricing.p2.f3": "Legal-grounding copilot",
      "pricing.p2.f4": "Contemporaneity & readiness scoring",
      "pricing.p2.f5": "CPA-ready export package",
      "pricing.p3.name": "Portfolio",
      "pricing.p3.desc": "For multi-property operators with a household or team.",
      "pricing.p3.f1": "Everything in Pro",
      "pricing.p3.f2": "Household & team logging with constraint checks",
      "pricing.p3.f3": "Concierge audit-defense package",
      "pricing.p3.f4": "Priority support",

      "faq.eyebrow": "Questions",
      "faq.h2": "Before you ask your CPA.",
      "faq.q1.q": "Is Contempo tax advice?",
      "faq.q1.a": "No. Contempo documents your participation; whether it qualifies is a conversation with your CPA. The logic is built around IRS Publication 925 and §1.469-5T, but we're not your accountant.",
      "faq.q2.q": "What happens if I actually get audited?",
      "faq.q2.a": "Export a CPA-ready package in one tap — full timeline, attachments, and a readiness score that flags weak entries long before they're a problem.",
      "faq.q3.q": "Do I have to share my location and bank activity?",
      "faq.q3.a": "No. Every passive signal is opt-in, individually. Turn any of them off and log entirely by hand — it carries the exact same weight in your record.",
      "faq.q4.q": "Does it work without cell service?",
      "faq.q4.a": "Yes. Capture is offline-first — entries save locally and sync once you're back in range, which matters for rural properties and basements alike.",
      "faq.q5.q": "Which platforms are supported?",
      "faq.q5.a": "iOS, Android, Apple Watch, and Wear OS for capture, plus a web dashboard for exports, bulk review, and settings.",

      "final.h2": "Start the record before you need it.",
      "final.lede": "Join the waitlist for early access. No spam, no card — just a note when it's ready.",
      "final.placeholder": "you@yourproperty.com",
      "final.success": "✓ You're on the list. We'll be in touch before next tax season.",

      "footer.fine": "Contempo is a documentation tool, not a law firm, CPA firm, or tax advisor. Consult a qualified tax professional about your specific situation before relying on any material participation test. This page is an early product-concept mockup — no product exists yet."
    },

    zh: {
      "meta.title": "Contempo — 材料参与，随手记录随时可证",
      "meta.description": "Contempo 能把一段语音、一条短信或一张照片，转化为带时间戳、经得起审计的材料参与记录——工作发生的那一刻就记下来。",
      "nav.stamp": "v0 概念版",
      "nav.how": "工作原理",
      "nav.features": "功能特性",
      "nav.trust": "审计保障",
      "nav.pricing": "价格",
      "nav.faq": "常见问题",
      "cta.waitlist": "加入候补名单",

      "hero.eyebrow": "材料参与，随手记录随时可证",
      "hero.h1_line1": "只说一次，",
      "hero.h1_line2": "永久可证。",
      "hero.lede": "Contempo 能把一段语音、一条短信或一张照片，转化为带时间戳、经得起审计的记录——就在工作发生的那一刻，而不是报税前夜临时补记。",
      "hero.cta_secondary": "了解工作原理 ↓",
      "hero.note": "为追求 100 小时、500 小时短租测试，或 REPS 750 小时认定的房东与地产从业者打造。",

      "mock.capturing": "记录中",
      "mock.draft_label": "AI 草稿 · 待确认",
      "mock.draft_text": "“打扫并补齐了 Maple St 的物资，换房前还更换了门锁密码。”",
      "mock.confirm_btn": "✓ 确认 · 42 分钟 · 维护",
      "mock.edit_btn": "编辑",
      "mock.ring_title": "距短租测试 62 / 100 小时",
      "mock.ring_sub": "按当前进度，预计 11 月 4 日前达标",
      "mock.live_pill": "Contempo — 会话进行中",

      "problem.eyebrow": "为什么大多数房东未能通过测试",
      "problem.h2": "工时是真实的，记录却站不住脚。",
      "problem.c1.tag": "要求",
      "problem.c1.text": "美国国税局要求同步记录——工作发生时即刻记下，而不是事后凭记忆补写。",
      "problem.c2.tag": "判例",
      "problem.c2.text": "法院多次支持保留实时记录的纳税人，而不利于事后估算工时的一方。",
      "problem.c3.tag": "举证责任",
      "problem.c3.text": "证明材料参与的责任完全在房东自己。工作当下没有记下来，复审时就等于没发生过。",

      "how.eyebrow": "从工作到证据",
      "how.h2": "四个步骤，没有一步需要填表。",
      "how.e1.id": "条目 01 · 记录",
      "how.e1.h3": "说出来、发短信，或让它自动发生",
      "how.e1.p": "发一段语音、转发一条短信、拍一张照片，或让日历事件、地理围栏、预订信号在你打开应用之前就先起草好条目——无论你身边正好有哪种设备。",
      "how.e1.watch_label": "手表 · 说出来",
      "how.e1.app_bubble": "清洁泳池并补齐毛巾，35 分钟",
      "how.e1.app_check": "✓ 已记录",
      "how.e1.app_label": "应用 · 打字或发短信",
      "how.e1.lock_pill": "根据日历自动起草",
      "how.e1.lock_label": "锁屏 · 自动完成",

      "how.e2.id": "条目 02 · 解析",
      "how.e2.h3": "AI 提取关键信息",
      "how.e2.p": "房产、任务、时长、类别与参与人——都从你实际说的话中提取，只有真正需要时才追问一句。",
      "how.e2.source": "“换房前更换了门锁密码，大概用了 20 分钟”",
      "how.e2.f1_key": "房产",
      "how.e2.f1_val": "Maple St",
      "how.e2.f2_key": "时长",
      "how.e2.f2_val": "20 分钟",
      "how.e2.f3_key": "类别",
      "how.e2.f3_val": "换房清洁",

      "how.e3.id": "条目 03 · 确认",
      "how.e3.h3": "没有你的确认，什么都不会生效",
      "how.e3.p": "每条草稿都会等待一次轻点确认。任何字段、任何条目都可以修改，无论是怎么记录的——手动和 AI 起草的条目同样有效。",
      "how.e3.confirm_text": "“换房前更换了门锁密码” · 20 分钟 · 换房清洁",
      "how.e3.confirm_btn": "✓ 确认",
      "how.e3.edit_btn": "编辑",
      "how.e3.logged_tag": "已记录 ✓",

      "how.e4.id": "条目 04 · 留证",
      "how.e4.h3": "它成为你台账的一部分",
      "how.e4.p": "带时间戳、经过同步性评分，并按房产整理——你的 CPA 或国税局一旦需要，随时可以导出。",
      "how.e4.row1": "换房清洁 · 38 分钟",
      "how.e4.row2": "回复客人消息 · 12 分钟",
      "how.e4.row3": "门锁维修 · 20 分钟",
      "how.e4.export_btn": "导出 CPA 材料包 →",

      "features.eyebrow": "为真实的工作场景而设计",
      "features.h2": "再忙的一天，记录也不会中断。",
      "features.f1.h3": "无需看屏幕即可记录",
      "features.f1.p": "地理围栏、日历和预订信号会在你解锁手机之前就先起草好条目。",
      "features.f2.h3": "语音、文字或照片",
      "features.f2.p": "转发一段语音或拍一张工作照片。不用填表，不用打字。",
      "features.f3.h3": "懂法规的智能助手",
      "features.f3.p": "问一句“这个算不算”，就能得到基于真实材料参与测试和已知判例的回答。",
      "features.f4.h3": "全家共用，互不冲突",
      "features.f4.p": "同时追踪配偶、清洁员、联合房东的工时，一旦有人的工时可能超过你，会提前提醒。",
      "features.f5.h3": "随时可以手动记录",
      "features.f5.p": "无论怎么记录，每条条目都是同样结构化的记录——完全可编辑，始终一键可达。",
      "features.f6.h3": "随手一瞥，进度尽览",
      "features.f6.p": "iOS 灵动岛 / Live Activity 或 Android Live Update，直接在锁屏显示当前会话与全年进度。",

      "trust.eyebrow": "为经得起审查而生，不只是为了快",
      "trust.h2": "每一条记录都自带证据链。",
      "trust.p1": "Contempo 会为每条记录评估同步性——工作发生后多久被记录下来——并标记出真正会拖垮审计的问题：描述含糊、时长不合理、事后很久才补记的条目。",
      "trust.p2": "这里的一切都不是税务建议，而是每位 CPA 都希望客户本来就具备的记录基础设施。",
      "trust.readiness_label": "2026 年就绪评分",
      "trust.list1": "214 条记录在活动发生 24 小时内完成",
      "trust.list2": "6 条记录被标记为描述含糊——各需补充一个细节",
      "trust.list3": "2 条记录在活动发生 14 天后才补记",
      "trust.list4": "100 小时测试下未检测到家庭工时冲突",

      "platforms.eyebrow": "工作发生在哪里，它就在哪里",
      "platforms.h2": "不是又一个会被你遗忘的应用。",
      "moments.m1.caption": "“修剪了草坪，还修好了喷淋头”",
      "moments.m1.h3": "点一下手表，而不是掏出手机",
      "moments.m1.p": "按住麦克风，说出你做了什么，松手即可。双手始终不用离开园艺工具。",
      "moments.m2.date": "7 月 24 日 · 星期五",
      "moments.m2.pill": "Contempo — 会话进行中",
      "moments.m2.elapsed": "已用时",
      "moments.m2.ytd": "/100 小时（今年）",
      "moments.m2.h3": "无需解锁，一眼看到进度",
      "moments.m2.p": "iOS 灵动岛、Android Live Update——同样的实时总计，就在锁屏上。",
      "moments.m3.sender": "Maria（清洁员）",
      "moments.m3.incoming": "Maple St 已经打扫完，大约用了 40 分钟",
      "moments.m3.outgoing": "✓ 已记录在 Maria 名下 · 不计入你的工时",
      "moments.m3.h3": "团队成员也能记录——自动正确归属",
      "moments.m3.p": "清洁员不需要安装任何应用。她的工时会被单独记录，不会占用你的测试工时。",
      "platform.web": "网页端（后台管理）",

      "pricing.eyebrow": "价格",
      "pricing.h2": "定价对标的是税务减免，不是计时器。",
      "pricing.badge": "多数房东的选择",
      "pricing.p1.name": "入门版",
      "pricing.suffix": "/月",
      "pricing.p1.desc": "一处房产，认真记录，完全免费。",
      "pricing.p1.f1": "1 处房产",
      "pricing.p1.f2": "手动、语音与短信记录不限次数",
      "pricing.p1.f3": "核心工时追踪与进度看板",
      "pricing.p1.f4": "CSV 导出",
      "pricing.p2.name": "专业版",
      "pricing.p2.desc": "适合把一处或多处房产当作真正生意来经营的房东。",
      "pricing.p2.f1": "房产数量不限",
      "pricing.p2.f2": "被动记录 — 日历、平台预订、地理围栏",
      "pricing.p2.f3": "懂法规的智能助手",
      "pricing.p2.f4": "同步性与就绪度评分",
      "pricing.p2.f5": "CPA 可用的导出材料包",
      "pricing.p3.name": "团队版",
      "pricing.p3.desc": "适合拥有家庭或团队协作的多房产运营者。",
      "pricing.p3.f1": "包含专业版全部功能",
      "pricing.p3.f2": "家庭与团队记录，自动冲突检测",
      "pricing.p3.f3": "专属审计保障服务",
      "pricing.p3.f4": "优先客户支持",

      "faq.eyebrow": "常见问题",
      "faq.h2": "在你联系 CPA 之前，先看看这些。",
      "faq.q1.q": "Contempo 提供的是税务建议吗？",
      "faq.q1.a": "不是。Contempo 负责记录你的参与情况；是否符合认定标准，需要和你的 CPA 沟通确认。我们的逻辑基于 IRS Publication 925 和 §1.469-5T 构建，但我们不是你的会计师。",
      "faq.q2.q": "如果真的被审计了怎么办？",
      "faq.q2.a": "一键导出 CPA 可用的材料包——完整时间线、附件，以及能提前标出薄弱条目的就绪度评分。",
      "faq.q3.q": "一定要授权位置和银行交易信息吗？",
      "faq.q3.a": "不需要。每一种被动信号都可以单独选择开启。全部关闭、完全手动记录同样有效，权重完全相同。",
      "faq.q4.q": "没有信号的地方也能用吗？",
      "faq.q4.a": "可以。记录功能默认支持离线——条目会先保存在本地，恢复信号后自动同步，这对偏远房产和地下室场景尤其重要。",
      "faq.q5.q": "支持哪些平台？",
      "faq.q5.a": "iOS、Android、Apple Watch 和 Wear OS 均可用于记录，另有网页端仪表盘用于导出、批量核对与设置管理。",

      "final.h2": "在你需要之前，先建立好记录。",
      "final.lede": "加入候补名单，抢先体验。不会打扰你，也不需要绑卡——准备好了我们会通知你。",
      "final.placeholder": "you@yourproperty.com",
      "final.success": "✓ 你已加入候补名单，下一个报税季前我们会与你联系。",

      "footer.fine": "Contempo 是一款记录工具，并非律所、会计师事务所或税务顾问。在依据任何材料参与测试之前，请就你的具体情况咨询合规税务专业人士。本页面是早期产品概念稿——目前尚无实际产品。"
    }
  };

  function detectDefaultLang() {
    var stored = null;
    try { stored = localStorage.getItem("contempo-lang"); } catch (e) {}
    if (stored === "en" || stored === "zh") return stored;
    var nav = (navigator.language || navigator.userLanguage || "en").toLowerCase();
    return nav.indexOf("zh") === 0 ? "zh" : "en";
  }

  function applyLang(lang) {
    var dict = DICT[lang] || DICT.en;

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (dict[key] !== undefined) el.textContent = dict[key];
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      if (dict[key] !== undefined) el.setAttribute("placeholder", dict[key]);
    });

    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria");
      if (dict[key] !== undefined) el.setAttribute("aria-label", dict[key]);
    });

    if (dict["meta.title"]) document.title = dict["meta.title"];
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && dict["meta.description"]) metaDesc.setAttribute("content", dict["meta.description"]);

    document.documentElement.setAttribute("lang", lang === "zh" ? "zh-CN" : "en");
    document.documentElement.setAttribute("data-lang", lang);

    var toggle = document.getElementById("lang-toggle");
    if (toggle) toggle.textContent = lang === "zh" ? "EN" : "中文";

    try { localStorage.setItem("contempo-lang", lang); } catch (e) {}
  }

  function initLangToggle() {
    var lang = detectDefaultLang();
    applyLang(lang);

    var toggle = document.getElementById("lang-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var next = document.documentElement.getAttribute("data-lang") === "zh" ? "en" : "zh";
        applyLang(next);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", initLangToggle);
})();
