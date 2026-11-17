# بحث WA-Bot-Engine لتكييف منطق داخل FLONA

- **المستودع المفحوص:** https://github.com/Tederby/WA-Bot-Engine
- **المسار المحلي للنسخة المفحوصة:** `/home/ubuntu/work/flona/research-src/wa-bot-engine`
- **الفرع/الإصدار الفعلي:** `main`، commit `8df8cff53e49d1a857595b4652b983f6fe9bacb8` (`feat(engine): sync core infrastructure, connection lifecycle, posix flags, and webview specs`)، بتاريخ `2026-11-09T16:12:30+07:00`
- **إصدار package.json:** `1.0.0`
- **نطاق البحث:** hot reload، أخطاء plugins/commands، declarative middleware، وHTML UI فقط. لم يتم تشغيل اتصال WhatsApp، ولم تُنشأ أو تُقرأ جلسات، ولم تُنقل ملفات جلسات أو منطق اقتران إلى FLONA.

## 1. الوصول وحالة الشجرة

تم استنساخ المستودع بنجاح عبر Git إلى المسار المطلوب. حالة الشجرة بعد الاستنساخ نظيفة: `main...origin/main` دون تعديلات محلية. لا يوجد `package-lock.json` أو `npm-shrinkwrap.json` أو أي lockfile متتبع، ولذلك فإن نطاقات `^` في package.json ليست مثبتة إلى حل اعتمادات reproducible.

لم يتم تعديل `/home/ubuntu/work/flona/repo` إلا بإنشاء هذا التقرير في `flona-research/06-wa-bot-engine.md` كما طُلب. لم يتم تعديل ملفات المصدر أو إعدادات FLONA.

## 2. الترخيص

الترخيص المعلن في `LICENSE` و`package.json` وREADME هو **MIT**، مع حقوق نشر `Copyright (c) 2026 Tederby`. الترخيص يسمح بإعادة الاستخدام والتعديل والدمج، بشرط إبقاء إشعار حقوق النشر ونص الترخيص في النسخ أو الأجزاء الجوهرية. لا يعني ذلك نقل بروتوكول WhatsApp غير الموثق أو بيانات جلسات المستخدم؛ هذه أمور منفصلة عن إذن MIT ويجب إبقاؤها خارج التكييف المطلوب. عند تكييف خوارزمية أو بنية من ملفات المصدر، ينبغي الاحتفاظ بإشعار MIT في ملف NOTICE/توثيق التبعيات أو في رأس الكود وفق سياسة FLONA.

## 3. الملفات التي فُحصت فعلياً

### ملفات metadata والترخيص

- `README.md`
- `LICENSE`
- `package.json`
- `.env.example`
- `.gitignore`
- `patches/baileys+7.0.0-rc13.patch`
- `ecosystem.config.cjs`
- `setting.js`

### ملفات التنفيذ المرتبطة بالمجال

- `commands/_registry.js` — سجل commands، aliases، reply handlers، وcache-busting reload.
- `commands/html.js` — التحقق من HTML/JavaScript/CSS، تجهيز document، واستدعاء UI.
- `commands/ping.js` — مثال command declarative.
- `handler.js` — ترتيب pipeline، استدعاء middleware، flag parsing، وتنفيذ command مع error boundary.
- `index.js` — chokidar watchers وإعادة تحميل `handler.js` وملفات commands.
- `lib/middleware.js` — `checkPermissions` والرايات declarative.
- `lib/flagParser.js` — parser اختياري للرايات داخل command context.
- `lib/uiEngine.js` — builders للـ HTML و`sendUI` وبروتوكول `richResponseMessage`.
- `lib/logger.js` — سجل موحد للأخطاء والتحذيرات وأحداث reload.
- `lib/database.js` و`lib/db.js` — اعتمادية middleware على ban lookup، مع ملاحظة أن التخزين هنا SQLite وليس lowdb.
- `lib/utils.js` — `esc`/أدوات التنسيق التي يعتمد عليها السجل وUI.
- `services/cleanup.js` — دورة تنظيف reply handlers والملفات المؤقتة.
- `docs/ARCHITECTURE.md` — وصف pipeline وhot reload.
- `docs/COMMAND_DEVELOPMENT.md` — عقد command والرايات وUI.
- `docs/CONFIGURATION_DEPLOYMENT.md` — Node/PM2 ومتغيرات التشغيل.
- `docs/CHANGELOG.md` — سجل الميزات والإصلاحات.
- `docs/WEBVIEW_PAYLOAD.md` — وصف HTML webview والبروتوكول غير الموثق.
- `docs/README.md` و`docs/DATABASE.md` — فصل engine عن domain وخصائص التخزين.

### سياق FLONA الذي فُحص للمواءمة فقط

- `/home/ubuntu/work/flona/repo/package.json`
- `/home/ubuntu/work/flona/repo/package-lock.json` (وجود lockfile في FLONA، بخلاف المستودع المرجعي)
- `/home/ubuntu/work/flona/repo/src/index.js` — إنشاء `Low`/`JSONFile` و`global.db`.
- `/home/ubuntu/work/flona/repo/handler.js` — تحميل/استدعاء `global.plugins`، hooks `all`/`before`/`after`، permission flags الحالية، وplugin error boundary.
- `package.json` في FLONA يعلن `type: module` وNode `>=20.0.0`، ويحتوي `lowdb ^3.0.0` وBaileys fork و`chokidar` غير موجودة كاعتمادية مباشرة مستقلة في النسخة المفحوصة لـFLONA بحسب package.json المقروء.

## 4. ما وجدته في النطاق المطلوب

### 4.1 Hot reload

يوجد نمطان منفصلان:

1. **إعادة تحميل command منفرد:**
   - `commands/_registry.js` يحتفظ بـ`Map` تربط `name` و`aliases` بكائن command.
   - الاستيراد الأول يستخدم `import(fileUrl)`؛ عند reload يضيف query string مثل `?t=${Date.now()}` حتى يعيد Node تقييم ESM module.
   - قبل التسجيل الجديد تُزال aliases القديمة من نفس command لتقليل ghost aliases.
   - `initCommands()` يقرأ ملفات `.js` في مجلد commands ويتجاوز الملفات التي تبدأ بـ`_`.
   - `reloadCommand(absPath)` يتحقق من الامتداد ويستبعد registry نفسه، ثم يسجل module الجديد في مكانه.
   - `index.js` يستخدم `chokidar` مع `ignoreInitial: true` لحدثي `add` و`change`.

2. **إعادة تحميل pipeline الأساسي:**
   - `index.js` يحمّل `handler.js` ديناميكياً ويحتفظ بالمرجع `msgHandler`.
   - عند تغيير `handler.js`، يجري `import('./handler.js?cacheBust=...')` ثم يستبدل المرجع atomically على مستوى JavaScript.
   - يوجد عداد reload، وتحذير بعد 20 reload بسبب تراكم ESM modules ذات query strings واحتمال استهلاك الذاكرة.
   - فشل الاستيراد يُسجّل عبر `log.error('HOT-RELOAD', err)` ولا يستبدل النسخة العاملة؛ هذه نقطة جيدة: النسخة السابقة تبقى في الخدمة.

**قيود التنفيذ:** لا يوجد في watcher المعروض handler لحدث `unlink`؛ حذف plugin لا يزيل command القديم من `Map`، ولذلك قد يبقى command محذوف متاحاً حتى restart أو آلية unregister إضافية. كما أن query-string cache busting في ESM ليس تفريغاً للـmodule graph؛ الاعتماد عليه لفترات طويلة يراكم نسخاً، وهو سبب التحذير المضمن. لا يظهر debounce/queue موحد يمنع reload متزامناً أثناء حفظ الملف عدة مرات، ولا تحقق schema قوي يتجاوز اختبار `name` و`handler`.

### 4.2 أخطاء plugins/commands

- فشل import أثناء startup أو hot reload يمسكه `_registry.js`، يسجل اسم الملف ورسالة الخطأ، ويتجاهل module غير الصالح بدلاً من إسقاط العملية.
- module الذي يفتقد `default.name` أو `default.handler` يُتخطى مع warning.
- pipeline في `handler.js` يضع معالجة عامة حول `msgHandler` ويسجل الخطأ عبر `logger.error('HANDLER', err)`.
- تنفيذ command في النسخة المرجعية يمر إلى `cmd.handler(...)` داخل السياق؛ في handler العام لا يوجد crash process عند استثناء plugin، لكن مستوى العزل محدود: لا توجد circuit breaker أو disable تلقائي أو عداد فشل لكل plugin.
- `commands/html.js` يمسك فشل `sendUI` ويعيد للمستخدم رسالة عامة، مع إبقاء تفاصيل الخطأ في console.
- `lib/logger.js` يوحّد رسائل `ERROR/WARN/INFO` ويطبع أول أسطر من stack؛ مناسب للرصد، لكنه ليس event sink أو سجل JSON قابل للتحليل الآلي.
- reply handlers محفوظة في `Map` مع `createdAt`، وهناك `cleanupExpiredReplyHandlers(maxAgeMs)`؛ هذا جزء stateful مستقل ويمكن تكييف فكرته، لكن ليس مطلوباً نقل WhatsApp routing نفسه.

### 4.3 Declarative middleware

`lib/middleware.js` يحوّل خصائص command إلى guard مركزي يعيد `null` عند السماح أو نص خطأ/`SILENT_DROP` عند المنع. الرايات الموجودة:

- `groupOnly`
- `privateOnly`
- `adminOnly`
- `botAdminRequired`
- `botAdminOnly`
- `ownerOnly`
- `silentDrop`

قبل هذه الرايات يفحص المرجع group-level ban عبر `isUserGroupBanned`. في `handler.js` يتم بناء context مركزي (`isGroup`, `isGroupAdmins`, `isBotGroupAdmins`, `isOwner`, `isBotAdmin`, `sender`, `chatId`) ثم تمرير command والـcontext إلى `checkPermissions`. هذا يفصل سياسة الوصول عن أجسام plugins.

في FLONA يوجد بالفعل نموذج قريب لكنه يعتمد خصائص قديمة على function plugin: `plugin.owner`, `rowner`, `premium`, `group`, `botAdmin`, `admin`, `private`، مع `fail(...)`، إضافةً إلى hooks `all` و`before` و`after`. لذلك لا ينبغي إضافة middleware ثانٍ متوازٍ غير منسق. الأفضل بناء adapter واحد يقرأ الصيغة الحالية ويقبل aliases declarative جديدة، ثم يعيد قراراً typed مثل `{allowed, reason, silent}` بدلاً من الاعتماد على نص `SILENT_DROP` وحده.

### 4.4 HTML UI

`lib/uiEngine.js` يحتوي طبقتين:

- **Builders آمنة نسبياً للعرض:** `esc()`، `renderPage()`، `renderCard()`، `renderList()`، و`renderRows()`، مع CSS design system inline. `esc` يهتم بـ`& < > "` للنصوص، لكن بعض الحقول المقصودة كـHTML أو event attributes تحتاج سياسة أشد.
- **Transport خاص بواتساب:** `sendUI()` يبني `response_id` وBase64 JSON ثم يرسله بواسطة `sock.relayMessage()` ضمن `botForwardedMessage.richResponseMessage` و`GenAIaeacdsnwHtmlPrimitive`.

`commands/html.js` يطبق validation قبل الإرسال: توازن script/style tags، compile للـJavaScript عبر `vm.Script` دون تنفيذ، توازن CSS braces، وفحص stack للـHTML tags، ثم يلف fragment في document كامل. يستخرج العنوان من `<title>`، ويقدم auto-delete بعد 120 ثانية إلا مع flag `-k/--keep`.

**قرار النطاق:** builders والـvalidation قابلان للدراسة كمنطق UI عام؛ أما `sendUI`، `relayMessage`، `richResponseMessage`، `botForwardedMessage`، و`GenAIaeacdsnwHtmlPrimitive` فهي طبقة WhatsApp/Protocol غير موثقة ولا ينبغي نقلها إلى FLONA ضمن هذا العمل، خصوصاً أن الهدف صراحة ليس نسخ اتصال WhatsApp أو ملفات الجلسة. إذا احتاج FLONA HTML UI، يُعاد تصميم renderer خلف interface transport-neutral (مثلاً `renderHtmlDocument` + adapter إرسال مستقل) مع اختبار حجم/escaping وبدون نسخ جلسات أو بروتوكول غير موثّق تلقائياً.

## 5. الإصدارات والتبعيات

### metadata والإصدارات

- `name`: `wa-bot-engine`
- `version`: `1.0.0`، رغم أن changelog يوثق ميزات معنونة حتى `1.2.0`؛ هذا عدم اتساق يجب أخذه في الحسبان.
- `type`: `module`
- README يذكر Node `v18+` ويفضل v20 LTS؛ FLONA يعلن Node `>=20`، والخطة المطلوبة تستهدف Node 22.
- لا يوجد lockfile في المستودع المرجعي.

### dependencies المعلنة

- `any-ascii ^0.3.2` — تحويل النصوص؛ خارج النطاق، لا تنقل إلا إذا كان FLONA يحتاجه فعلاً.
- `axios ^1.13.1` — HTTP؛ خارج النطاق المطلوب، وFLONA لديه axios بالفعل بإصدار `^1.13.5`.
- `baileys ^7.0.0-rc13` — اتصال WhatsApp؛ **لا ينقل** لهذا البحث، كما أنه يختلف عن fork FLONA `@whiskeysockets/baileys`.
- `better-sqlite3 ^12.11.1` — تخزين SQLite؛ **لا ينقل** لمنطق هذه المهمة، لأن FLONA يستخدم lowdb، كما أن native DB يضيف build/concurrency وتعارض نموذج الحالة.
- `chalk ^4.1.2` — إخراج ملون؛ FLONA لديه `chalk ^5.6.2`، فلا تضف نسخة ثانية؛ أعد استخدام API المتوافق أو logger الموجود.
- `chokidar ^4.0.3` — watcher؛ مرشح وحيد منطقي إذا لم يكن موجوداً في lockfile النهائي لـFLONA، ويجب تثبيته بإصدار مقفل وتجربة Node 22.
- `dotenv ^17.2.1` — إعدادات البيئة؛ خارج النطاق، ولا حاجة لنسخها إذا كان FLONA يحمّل إعداداته بالفعل.
- `pino ^9.2.0` — logger خاص بBaileys؛ **لا ينقل** لهذه الميزة، لأن FLONA لديه logging قائم، ولا ينبغي ربط hot reload بlogger النقل.
- `patch-package ^8.0.1` — patch لـBaileys؛ **لا ينقل**، إذ يخص patch `baileys+7.0.0-rc13.patch` في المستودع المرجعي.
- `qrcode-terminal ^0.12.0` — QR؛ **لا ينقل** لأنه جزء اتصال/اقتران WhatsApp.
- `eslint ^8.22.0` كـdevDependency — ليس runtime dependency ولا حاجة لإضافته من أجل المنطق.

**التبعيات التي لا ينبغي نقلها:** `baileys`، `qrcode-terminal`، `pino` المرتبط باتصال المرجع، `patch-package` وpatch Baileys، `better-sqlite3`، وأي ملفات `sessions/` أو متغيرات pairing/auth. كذلك لا ينبغي نقل `axios`/`dotenv`/`any-ascii` بلا حاجة؛ وجودها لا يثبت علاقة بالميزات الأربع المطلوبة.

## 6. خطة تكييف آمنة مع FLONA (Node 22، ESM، lowdb، نظام plugins الحالي)

1. **ابدأ باختبار عقد plugin الحالي، لا بتبديل loader:** حافظ على `global.plugins` وملفات `plugins/*.js` وخصائص `command/help/tags` وhooks الحالية. أضف module مستقل مثل `lib/plugin-reloader.js` بواجهة صغيرة: `startPluginWatcher({dir, load, unload, onError})`.
2. **Hot reload محدود للـplugins فقط:** استخدم `chokidar` الإصدار المقفل في lockfile، مع `ignoreInitial`, `awaitWriteFinish`, debounce، والتحقق من path داخل مجلد plugins لمنع path traversal. على `add/change` استدعِ loader FLONA الحالي. على `unlink` نفذ unregister فعلياً واحذف plugin القديم من `global.plugins`؛ هذه معالجة لازمة مفقودة في المرجع.
3. **استبدال آمن atomic:** حمّل النسخة الجديدة أولاً في module namespace مؤقت، تحقق من الشكل والـcommand، ثم استبدل entry في registry. عند فشل syntax/import احتفظ بالنسخة القديمة وسجل الخطأ؛ لا تحذف plugin العامل ولا تعيد تشغيل العملية.
4. **ESM cache strategy لـNode 22:** لا تعتمد على query-string إلى أجل غير محدود. إن استُخدم `import(fileURL?rev=...)` فضع عداداً/حداً وتحذيراً، أو اعزل reload في worker/process قابل لإعادة التشغيل إذا احتاجت plugins إلى imports ذات state طويل. يجب منع reload المتوازي لنفس الملف بقفل per-path.
5. **تطبيع plugin errors:** أنشئ `safeInvokePlugin(plugin, ctx)` يسجل `{plugin, command, phase, message, stack, revision}`، ويطبق سياسة: خطأ واحد لا يسقط pipeline؛ عدد متكرر خلال نافذة زمنية يضع plugin في quarantine مؤقتاً؛ لا ترسل stack للمستخدم. هذا يطوّر boundary الحالي في FLONA بدلاً من استبداله.
6. **Declarative middleware adapter:** أنشئ `lib/plugin-policy.js` يحول الصيغة الحالية (`owner`, `rowner`, `group`, `admin`, `botAdmin`, `private`, `premium`) إلى قرار موحد، ثم يقبل aliases مستقبلية مثل `groupOnly`, `adminOnly`, `ownerOnly`, `privateOnly`, `silentDrop`. طبّق السياسة قبل `plugin.call` وبعد تحديد match، مع الحفاظ على `fail`/الرسائل العربية الحالية.
7. **سياق FLONA وlowdb:** لا تضف جداول SQLite أو حالة جديدة لمجرد middleware. اقرأ حالة users/chats/settings من `global.db.data`، واكتب عبر `global.db.write()` وفق سياسة FLONA، مع عدم تنفيذ write لكل رسالة. لا تخزّن module functions أو timers أو sessions داخل lowdb؛ registry وquarantine وwatcher state يجب أن تكون في الذاكرة وتُفرّغ عند الإيقاف.
8. **إعادة تحميل handler بحذر:** لا تبدأ بإعادة تحميل `handler.js` كله؛ loader الحالي يحمل globals/hooks وحالة واسعة. إن لزم الأمر، بدّل dispatch function بعد import ناجح فقط، مع health check، واحتفظ بالمرجع السابق عند فشل compile/import. الأفضل استخراج middleware/dispatch إلى وحدات صغيرة مستقلة قبل hot-reloading core.
9. **HTML UI دون transport المرجعي:** انقل فقط فكرة `esc` وrender builders بعد مراجعة احتياجات FLONA. قدم API مثل `renderHtmlDocument({title, body, styles})` يعيد string، واترك إرسال الرسالة إلى adapter موجود في FLONA. لا تنقل `sendUI` أو أسماء protobuf غير الموثقة أو Bot JID الافتراضي. امنع scripts/attributes غير المطلوبة، حدّاً لحجم HTML، وقيّد CSS/HTML إن كان الإدخال من المستخدم.
10. **اختبارات Node 22:** اختبر import/export ESM، reload add/change/unlink، syntax error مع بقاء النسخة القديمة، alias collision، concurrent writes للـlowdb، policy matrix (owner/admin/group/private)، وتنظيف watcher عند shutdown. لا تشغّل اختباراً يحتاج WhatsApp session لهذه المرحلة.
11. **التوثيق والـMIT:** أضف attribution واضحاً للتصميم المعاد استخدامه، ولا تنسخ ملفات الاتصال أو session أو patch. ثبّت الاعتمادية الجديدة في lockfile FLONA فقط إن وافق النظام عليها.

## 7. المخاطر والقيود

- **تراكم ESM cache:** query-string reload يترك نسخاً قديمة في module graph، ما قد يسبب نمو الذاكرة وازدواج timers/listeners.
- **حذف plugin غير مدعوم في المرجع:** watcher يعالج add/change فقط؛ دون unlink قد يستمر أمر محذوف.
- **سباقات الحفظ:** editor قد يطلق عدة change events وملف نصف مكتوب؛ يلزم await-write-finish وper-file serialization.
- **حالة plugin طويلة العمر:** plugins FLONA الحالية قد تسجل listeners أو timers عند import؛ reload دون dispose يكررها.
- **تعارض عقدي:** المرجع يستخدم object command (`default {name, handler}`)، بينما FLONA يعتمد function plugins وخصائص function؛ النقل المباشر سيكسر loader أو يفقد hooks.
- **تعارض تخزين:** المرجع SQLite/`better-sqlite3` وFLONA lowdb/JSONFile؛ نقل database أو ban helpers ليس تكييفاً آمناً، وقد يخلق مصدر حقيقة ثانياً.
- **فروق ESM والإصدارات:** المرجع يعلن Node 18+/20، والهدف Node 22؛ يجب اختبار chokidar وdynamic import وليس افتراض التوافق من package ranges.
- **HTML injection/XSS:** `esc` مناسب لبعض النصوص فقط؛ `styles` و`onClick` وHTML الخام يمكن أن تكون قنوات حقن. لا تسمح بمدخل HTML غير موثوق دون sanitizer/allowlist وحدود.
- **بروتوكول UI غير موثق:** `richResponseMessage` و`GenAIaeacdsnwHtmlPrimitive` قد يتغيران أو يفشلان حسب إصدار WhatsApp؛ إدخاله في FLONA يزيد coupling ويخرج عن هدف البحث.
- **حجم payload:** HTML inline وBase64 يضخمان الرسالة؛ يجب تحديد حد محلي وعدم اعتبار أرقام `WEBVIEW_PAYLOAD.md` ضماناً مستقراً.
- **تسريب معلومات الأخطاء:** المرجع يسجل stack في terminal ويرسل رسالة عامة، لكن plugins FLONA قد تحتوي أسراراً في errors؛ يلزم redaction وعدم إظهار stack أو config للمستخدم.
- **اعتماد changelog غير متسق:** package version `1.0.0` بينما changelog يحتوي entries حتى `1.2.0`، ولا يوجد lockfile؛ لا يمكن اعتبار وصف الإصدار ضماناً لحالة package منشورة.
- **الترخيص:** MIT ميسّر، لكن يجب حفظ attribution؛ الترخيص لا يمنح ضمان توافق أو إذن لإعادة استخدام بيانات/جلسات أو بروتوكول WhatsApp من منظور تشغيلي.

## 8. الحكم النهائي

**قابل للتكييف جزئياً (`feasible: true`)** لمنطق hot reload المنضبط، error boundary/quarantine، وdeclarative middleware adapter. أما HTML UI فالقابل للنقل هو طبقة rendering/validation العامة فقط بعد إعادة تصميمها؛ طبقة الإرسال الخاصة بواتساب والبروتوكول غير الموثق خارج النطاق ولا ينبغي نقلها. لا توجد حاجة ولا مبرر لنقل Baileys، SQLite، patch-package، QR، auth أو session files.

أفضل مسار هو إضافة وحدات صغيرة إلى FLONA تحافظ على loader الحالي وlowdb وhooks، مع دعم add/change/unlink، rollback عند فشل reload، سجل أخطاء مهيكل، وسياسة صلاحيات موحدة. يوصى بتنفيذ hot reload وerror boundary أولاً، ثم middleware adapter، ثم renderer HTML محلي منفصل إذا كان هناك use case واضح؛ لا يُنصح بدمج `sendUI` المرجعي مباشرة.
