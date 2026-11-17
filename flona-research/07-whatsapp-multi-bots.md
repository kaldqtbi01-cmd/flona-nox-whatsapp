# بحث 07 — Whatsapp-Multi-Bots

## النطاق والنتيجة التنفيذية

تم فحص مستودع واحد فقط كما طُلب:

- المستودع: `https://github.com/Tederby/Whatsapp-Multi-Bots`
- مسار النسخة المستنسخة: `/home/ubuntu/work/flona/research-src/whatsapp-multi-bots`
- الفرع: `main`، مع وجود `origin/multi-bot` كفرع بعيد غير مستخدم في هذا الفحص.
- commit المفحوص: `6a4516204efc81885bfb141d66023a3d265e1c2c`
- تاريخ آخر commit: `2026-11-10T09:46:24+07:00`، الرسالة: `fix(baileys): 503 throttling backoff`.
- تاريخ أول commit: `2025-10-29`، الرسالة: `first commit`.
- عدد الملفات المتتبعة في commit: 120؛ منها 68 ملف command، و20 ملفًا تحت `lib/`، و12 خدمة، و8 وثائق.
- لا يوجد `package-lock.json` أو `pnpm-lock.yaml` أو `yarn.lock` في المستودع المصدر.

النتيجة: **قابل لإعادة الكتابة جزئيًا وبشكل آمن**. الجزء المفيد لـ FLONA هو نمط توليد واجهة HTML محلية: design system بسيط، page/card/list builders، نمط بيانات مسبقة للبحث والتصفية والتبويبات/الشاشات، إحصاءات معروضة كـ key/value، escaping، ونمط UI ثم text fallback. لا ينبغي نسخ اتصال WhatsApp، جلسات Baileys، relay/protobuf غير الموثق، أو قاعدة SQLite. لا توجد حاجة لإضافة تبعية جديدة كي يبدأ هذا الجزء؛ FLONA لديه Node/ESM و`axios` و`lowdb` ونظام plugins قائم.

## الترخيص

`LICENSE` يعلن **MIT License**، حقوق `Copyright (c) 2026 Tederby`. الترخيص يسمح بالنسخ والتعديل والدمج والتوزيع، بشرط إبقاء إشعار copyright ونص الترخيص في النسخ أو الأجزاء الجوهرية، مع disclaimer “AS IS”. عند إعادة كتابة الفكرة في FLONA، الأفضل إبقاء attribution في ملف NOTICE/توثيق داخلي إذا أُعيد استخدام أي جزء حرفي؛ أما إعادة تنفيذ السلوك والتصميم من الصفر فتظل مختلفة عن نسخ الكود. لا يوجد ترخيص آخر ظاهر في الملفات المفحوصة، و`package.json` يعلن MIT أيضًا.

## الإصدار والبنية والتبعيات

`package.json` يحتوي:

- الاسم المعلن: `simple-wa-bot`، الإصدار `1.0.0`، وليس اسم GitHub الظاهر.
- `type: module` وscripts: `start`, `migrate`, `pm2`, `pm2:stop`, `postinstall`.
- README يذكر Node.js `v18.0.0 or higher`، بينما الهدف هنا Node 22؛ هذا ليس ضمان توافق كاملًا، بل نقطة بداية تتطلب اختبارًا.
- التبعيات المعلنة: `any-ascii ^0.3.2`, `axios ^1.13.1`, `baileys ^7.0.0-rc.9`, `better-sqlite3 ^12.11.1`, `chalk ^4.1.2`, `chokidar ^4.0.3`, `dotenv ^17.2.1`, `jimp ^1.6.1`, `link-preview-js ^3.0.14`, `moment-timezone ^0.5.45`, `patch-package ^8.0.1`, `puppeteer ^25.3.0`, `qrcode-terminal ^0.12.0`, `wa-sticker-formatter ^4.4.4`.
- devDependency: `eslint ^8.22.0`.
- يوجد patch محلي: `patches/baileys+7.0.0-rc13.patch`؛ وهذا يستدعي الحذر لأن package range يعلن rc9 بينما patch اسمه rc13. لا ينبغي نقل هذا patch أو Baileys transport إلى FLONA.

التبعيات التي **لا ينبغي نقلها لهذا الهدف**:

1. `baileys`، `qrcode-terminal`، `patch-package`، وملفات `index.js`/`handler.js`/`.env.example`: تخص الاتصال والبروتوكول والجلسة والتشغيل.
2. `better-sqlite3` و`lib/db.js` و`lib/database.js` وسكربت migration: المصدر يستخدم SQLite WAL وschema خاصة به، بينما FLONA يستخدم lowdb؛ نقلها ينشئ مصدر حقيقة ثانٍ ويخلط storage guarantees.
3. `puppeteer`، `jimp`، `wa-sticker-formatter`، yt-dlp/media queues، وملفات الخدمات غير المرتبطة: خارج مجال HTML UI/cards/search/fallback، وبعضها native أو يتطلب Chromium/FFmpeg.
4. `chokidar` وregistry المصدر لا ينقلان كما هما؛ FLONA لديه loader/plugins قائم. يمكن استعارة فكرة hot reload فقط بعد مواءمة lifecycle وunlink/error rollback.
5. `any-ascii`, `moment-timezone`, `link-preview-js`, `chalk`, وخدمات AniList/Steam/YouTube ليست مطلوبة لبناء renderer مستقل.

التبعيات التي يمكن أن تبقى في FLONA دون إضافة جديدة: ESM/Node 22، `axios` الموجود لجلب صورة أو API عند الحاجة، و`lowdb ^3.0.0` الموجود للتفضيلات/عدادات المنتج إذا كانت مطلوبة. لا تُخزّن HTML functions أو timers أو webview state في lowdb.

## الملفات الفعلية التي تمت قراءتها

الملفات الأساسية:

- `README.md`
- `LICENSE`
- `package.json`
- `.env.example`
- `docs/ARCHITECTURE.md`
- `docs/COMMAND_DEVELOPMENT.md`
- `docs/DATABASE.md`
- `docs/WEBVIEW_PAYLOAD.md`
- `docs/CHANGELOG.md`
- `lib/uiEngine.js`
- `commands/menu.js`
- `commands/html.js`
- `commands/markdown.js`
- `commands/steam.js`
- `commands/anime.js`
- `commands/profile.js`
- `commands/register.js`
- `commands/info.js`
- `commands/wvtest.js`
- `commands/_wvtestTemplates.js`
- `commands/_registry.js` (تمت مراجعته ضمن توثيق الـ registry ومواضع الاستخدام)
- `services/steam.js`
- `services/anilist.js` (مواضع الإحصاءات والبيانات المشار إليها)
- `lib/database.js` (إحصاءات `getDBStats` ونمط user meta المشار إليهما)
- `lib/db.js` (نمط SQLite المذكور في الوثائق)
- `lib/flagParser.js` (عقد flags المشار إليه في الأوامر)
- `lib/autoDetect.js` (قاعدة text-only للروابط السلبية)
- `handler.js` (تدفق command/reply المشار إليه)

كما تم استخدام `git ls-files` لتسجيل القائمة الفعلية كاملة، وفحص `git log`, الفروع، remote، وغياب ملفات lock. لم تُعدّل أي ملفات مصدر داخل النسخة المستنسخة، ولم تُعدّل ملفات FLONA الأخرى؛ الملف الناتج الوحيد المطلوب داخل مستودع FLONA هو هذا التقرير.

## ما وجدته في HTML interactive UI

### 1. طبقة renderer مستقلة نسبيًا

`lib/uiEngine.js` هو أهم ملف قابل لإعادة الكتابة. يحتوي على:

- `esc(str)`: escape لـ `&`, `<`, `>`, `"` قبل إدخال قيم المستخدم في HTML.
- `renderPage({ title, body, badge, styles })`: يبني وثيقة HTML كاملة مع viewport/referrer meta، CSS أساس، header، badge، وbody.
- `renderCard({ icon, title, subtitle, rows, sections })`: يبني بطاقة معلومات بصفوف label/value وأقسام فرعية.
- `renderList({ icon, title, subtitle, items })`: يبني header اختياريًا وقائمة عناصر قابلة للنقر عبر `onclick` مسبق التجهيز.
- `sendUI(sock, chatId, { title, html })`: ليس renderer محايدًا؛ هو adapter خاص بـ Baileys يغلّف HTML في `GenAIaeacdsnwHtmlPrimitive` ثم يرسل عبر `sock.relayMessage`.

الجزء الآمن لـ FLONA هو إعادة كتابة الثلاثة الأولى وطبقة escaping/validation. يجب استبدال `sendUI` بعقد FLONA channel adapter (مثل `sendHtmlPreview` أو إخراج نصي/رابط داخلي حسب المنتج)، وعدم نسخ `relayMessage` أو protobuf envelope.

### 2. design system والبطاقات

`BASE_CSS` في `uiEngine.js` يستخدم palette dark zinc/gray، CSS variables، spacing، cards، rows، sections، lists، buttons، و`.ui-screen/.ui-screen.active`. التصميم flat/minimal، بلا gradients أو glassmorphism أو shadow ثقيل. هذا مناسب كمصدر إلهام لإخراج HTML ثابت أو preview، مع إعادة تسمية classes إلى namespace خاص بـ FLONA لتجنب collision.

`renderCard` يفرض فصل المحتوى عن layout نسبيًا: الحقول النصية تمر عبر `esc`، لكن `icon` و`styles` و`body` مقصودة كـ trusted HTML. في FLONA يجب اعتماد سياسة واضحة: values escaped افتراضيًا، وHTML raw لا يُقبل إلا من template داخلي موثوق أو بعد sanitizer/allowlist.

### 3. الإحصاءات

`commands/info.js` يبني إحصاءات النظام وقاعدة البيانات نصيًا عبر `getDBStats()` (users, registered users, banned users, groups وغيرها). `lib/database.js` يحسب العدادات باستعلامات COUNT. هذا يثبت نمطًا مفيدًا فقط: احسب view model صغيرًا ثم مرره إلى card/stat renderer. لا تُنقل schema أو `getDBStats`؛ في FLONA يجب القراءة من lowdb أو read model قائم، مع تجنب write لكل رسالة.

`commands/profile.js` يعرض registration/roles/display mode كنص؛ يمكن إعادة استخدام نفس الحقول في `renderCard` أو stat tiles إذا احتاجت واجهة FLONA.

### 4. التبويبات/الشاشات والبحث

`commands/menu.js` هو أفضل reference للمجال المطلوب:

- يجمّع commands حسب category ويرتبها.
- يحوّل `categoriesData` و`commandsData` إلى JSON يضم name, aliases, category, description, usage وpermission labels.
- يهرب `<` من JSON (`replace(/</g, '\\u003c')`) قبل تضمينه في script.
- ينشئ ثلاث شاشات داخل وثيقة واحدة: `screenCategories`, `screenCommands`, `screenSearch`.
- يستخدم `switchScreen` لتبديل `.active` محليًا دون round trip.
- `onSearchInput` يبحث في name/description/aliases، ويعرض count وempty state.
- يعرض category counts كـ badges، command cards، permission tags، usage chips، back button، وshow-all.
- يوجد text fallback كامل: في UI failure أو text preference يعرض category list/all commands ويستعمل temporary reply handler للردود النصية.

هذا النمط قابل لإعادة الكتابة داخل plugin FLONA، لكن يجب تحويل بيانات plugins الحالية إلى view model موحد، وليس افتراض object command المصدر (`default {name, handler}`). FLONA يعتمد function plugins وخصائصه الحالية؛ يلزم adapter read-only يقرأ metadata الموجودة.

### 5. بطاقات النتائج والتصفح

`services/steam.js` و`commands/steam.js` يقدمان نمطًا أغنى:

- server-side fetch لصورة Steam وتحويلها إلى `data:image/...;base64,...` لأن WebView المصدر air-gapped حسب وثائق المشروع.
- list screen مع pagination (`renderPageItems`, `changePage`) وdetail screen مع `showGameDetail` وback navigation.
- بطاقة detail تعرض banner، title، release/developer، price/discount، table metadata، genres tags، description.
- UI failure يعود إلى text caption/image أو text فقط.
- auto-detect مقيّد بالنص، ولا يرسل UI.

`commands/anime.js` في commit الحالي يركز على text pagination/reply handler؛ وثائق changelog تذكر interactive anime webview كميزة سابقة/مرجع، لذلك لا ينبغي افتراض أن الملف الحالي نفسه يحتوي كل UI القديم. المرجع الحالي المؤكد للـ UI multi-screen هو `steam.js` و`menu.js`.

### 6. HTML/Markdown renderer

`commands/html.js` يوفر validation قبل الإرسال: فحص وجود tags، توازن script/style، compile للـ JavaScript عبر `node:vm` دون تنفيذ، توازن CSS braces، وتوازن HTML tags مع void/SVG self-closing tags. ثم يلف snippet في document responsive ويشتق title. هذا مفيد كفكرة دفاعية، لكن لا يكفي كـ sanitizer: compile لا يمنع XSS أو loops أو APIs خطرة عند التنفيذ داخل أي browser. في FLONA لا تُعرض HTML يرسلها المستخدم مباشرة إلا sandbox/allowlist قوي أو feature owner-only.

`commands/markdown.js` يحول markdown إلى HTML (headings, lists, code, tables وغيرها) ثم يرسله إلى UI مع auto-delete. يمكن إعادة كتابة parser أو استعمال parser موجود في FLONA؛ المطلوب هنا pattern “structured input → escaped HTML → preview/fallback”، لا نقل Baileys send.

## النص fallback

النمط العام ثابت في الأوامر:

1. default display mode هو `text`.
2. `--ui/-u` و`--text/-x` override لكل استدعاء، و`meta.displayMode` preference اختيارية.
3. محاولة UI داخل `try/catch`.
4. عند فشل relay أو غياب UI، إرسال نص مفهوم بدل الفشل الصامت.
5. webview يُحذف بعد 120 ثانية لتقليل إعادة mount/lag؛ الرسائل النصية لا تحتاج ذلك.
6. auto-detect/روابط passive لا ترسل UI، بل text فقط.

في FLONA يجب تطبيق ذلك كـ renderer strategy عام (`mode = ui|text`) مع fallback مضمون، لا كمنطق مكرر داخل كل plugin. يجب ألا يؤدي فشل optional HTML إلى فشل command الأساسي.

## خطة التكييف الآمنة مع FLONA

1. **تعريف عقد channel-neutral أولًا:** `renderPage`, `renderCard`, `renderList`, `renderStats`, `escapeHtml`, وربما `renderTabs`; كل الدوال pure وتعيد strings/HTML، بلا import من Baileys أو lowdb أو sessions.
2. **وضع module ESM صغير** داخل `lib/ui/` أو ما يناسب بنية FLONA، متوافق مع Node 22. استخدم classes ذات namespace مثل `flona-ui-*`، واحتفظ بـ `escapeHtml` افتراضيًا لكل data value.
3. **بناء view models من plugins الحالية:** adapter يقرأ أسماء/أوصاف/aliases/permissions من `global.plugins` أو metadata FLONA، ويُنتج categories/commands/stats. لا تغيّر loader إلى object command المصدر.
4. **إضافة menu/search/tabs محليًا:** pre-bake dataset صغير داخل الصفحة، filter في الذاكرة، `switchScreen` أو tabs keyboard/touch، empty state، count badges، و`aria`/focus. لا تعتمد على fetch/WebSocket/localStorage داخل preview.
5. **تطبيق strategy للعرض:** `resolveDisplayMode(ctx, flags, preference)`؛ default text، override صريح UI/text، ثم `try render/send UI` وcatch إلى `m.reply`/send text. لا تخزن preference أو counters إلا عبر lowdb الحالي وبشكل محدود.
6. **الإحصاءات:** أنشئ read-only service/selector يجمع counters المطلوبة من `global.db.data` أو البيانات القائمة. استخدم serialized lowdb writes فقط عند تغيير preference؛ لا تنقل SQLite tables أو WAL assumptions.
7. **التعامل مع الصور:** إذا كانت واجهة FLONA تحتاج الصور، اجلبها عبر HTTP موجود (`axios`) في server-side adapter، قيّد MIME/الحجم، واضبط budget للـ HTML. لا تجعل renderer ينفذ remote URLs بلا سياسة.
8. **حماية HTML:** raw HTML user input ليس آمنًا. استخدم allowlist للعناصر/attributes أو sanitizer مع اختبارات؛ امنع `onclick` القادم من المستخدم، `javascript:`، event attributes، unbounded script، وURL schemes غير المسموحة. `node:vm` compile check وحده غير كافٍ.
9. **الـ adapter الخارجي:** إن احتاج FLONA قناة ترسل HTML، اجعلها module منفصلًا خلف interface، بحيث يمكن استبداله بنص/رابط/مرفق. لا تضمّن session paths أو auth state أو `sendUI` الخاص بالمصدر.
10. **الاختبارات على Node 22:** اختبر ESM import، escaping، JSON embedding، XSS cases، category/search/tabs، empty/all results، UI throw → text fallback، lowdb concurrent preference writes، وحجم payload. اختبر بدون WhatsApp session.
11. **المراحل المقترحة:** renderer + tests، ثم menu/search/tabs، ثم cards/stats، ثم optional media inlining، ثم channel adapter إن كان use case مثبتًا. لا تبدأ بنقل `commands/wvtest.js` أو البروتوكول.

## ما لا ينبغي نقله

- `index.js`, `handler.js` ككل، `useMultiFileAuthState` أو أي sessions/auth/QR.
- `lib/uiEngine.js::sendUI` وحقول `GenAIaeacdsnwHtmlPrimitive`, `richResponseMessage`, `botForwardedMessage`, `sock.relayMessage`؛ هذه transport/protocol غير موثقة وقد تتوقف في أي إصدار.
- `lib/db.js`, `lib/database.js`, SQLite schema/WAL، `message_claims`, `identity_map`, وmulti-bot registry.
- `commands/wvtest.js` و`_wvtestTemplates.js`؛ هي suite تشخيصية للبروتوكول/بيئة WhatsApp وليست feature product.
- `sessions/`, `temp/`, credentials، `.env` secrets، PM2 config، وpatches الخاصة بـ Baileys.
- `puppeteer`/Chromium، media conversion، sticker، yt-dlp، queues، APIs الخارجية، وSteam/AniList business logic إلا إذا طلبها FLONA كميزة مستقلة.

## المخاطر والقيود

- **بروتوكول غير موثق:** relay/HTML primitive قد يتغير أو يُحظر server-side؛ لا تبنِ core FLONA عليه.
- **حجم payload:** Base64 يزيد الحجم؛ وثائق المصدر تسجل safe zone أقل من 500KB، moderate حتى نحو 1MB، وsilent drop عند 1.4MB مع ceiling تجريبي 1.35MB. هذه أرقام تجريبية غير مضمونة خارج بيئتها؛ ضع budget أصغر بكثير.
- **Sandbox:** الوثائق تسجل blocking لـ fetch/WebSocket/storage/external links وclipboard API، مع دعم جزئي لـ DOM/CSS. يجب أن تكون الواجهة self-contained ولا تعتمد على network أو persistence.
- **Lifecycle:** viewport remount يمسح JS memory؛ state لا يبقى. auto-delete 120s في المصدر workaround خاص بالعميل وليس قاعدة FLONA العامة.
- **XSS/injection:** `renderPage` يسمح `styles/body` raw، و`renderList` يكوّن onclick من input. لا تقبل هذه القيم من المستخدم دون sanitization.
- **صور وخصوصية:** server-side image fetching قد يسرّب طلبات/يتعرض لـ SSRF إن لم تقيّد schemes/hosts/timeouts/bytes؛ Base64 قد يستهلك الذاكرة.
- **اختلاف storage:** lowdb ملف JSON وليس SQLite WAL؛ لا توجد row locks/transactions مكافئة للتوازي متعدد العمليات. serialize writes ولا تبنِ claims قوية عليه.
- **اختلاف plugin contract:** المصدر exports command objects، بينما FLONA loader الحالي يعتمد function plugins/metadata مختلفة؛ النقل المباشر يكسر loader أو hooks.
- **ESM/hot reload:** dynamic import cache busting قد يسبب memory growth؛ أي watcher جديد يحتاج unlink، rollback عند syntax failure، dispose للـ listeners/timers، وقفل per-path.
- **تبعيات native/بيئية:** `better-sqlite3`, Puppeteer, Jimp، وsticker/FFmpeg paths قد تتطلب build tools أو binaries؛ لا تدخلها في feature UI.
- **البيانات الخارجية:** Steam/AniList APIs لها timeouts/rate limits/availability؛ افصل data fetcher عن renderer، واحتفظ بفallback نصي عند 404/429/timeout.

## الحكم النهائي

`feasible: true` **لإعادة كتابة منطق العرض فقط**: HTML page/card/list/stat builders، client-side category/search/tabs/pagination، escaping، وtext fallback. التنفيذ يجب أن يكون FLONA-native على Node 22/ESM فوق نظام plugins وlowdb الحاليين، مع adapter اختياري للقناة. `feasible: false` لنسخ الاتصال أو sessions أو relay/protobuf أو SQLite/multi-bot architecture كجزء من هذا الهدف. لا يلزم نقل تبعية من المستودع المصدر إلى FLONA في المرحلة الأولى.
