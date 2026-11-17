# بحث FLONA: Agentic-Bot

## 1. نطاق البحث ونتيجة الوصول

تم فحص مستودع واحد فقط كما طُلب:

- **المستودع:** https://github.com/Tederby/agentic-bot
- **مسار النسخة المستنسخة:** `/home/ubuntu/work/flona/research-src/agentic-bot`
- **الفرع:** `main`
- **HEAD وقت الفحص:** `b366d1e1715930b3242dd21806cfe797e59d2bd0`
- **آخر commit:** `fix(baileys): harden loggedOut handling with 401 retry guard, 503 throttling backoff, and 428 unbind cooldown`
- **تاريخ آخر commit:** `2026-11-10T16:21:03+07:00`
- **حالة النسخة:** نظيفة، متتبعة لـ `origin/main`، ولا توجد تعديلات محلية.

تم تنفيذ `git clone` فعليًا. لم يتم تعديل ملفات المصدر أو الجلسات أو الاتصال في `/home/ubuntu/work/flona/repo`. الملف الوحيد المُنشأ في ذلك المسار هو هذا التقرير.

لا توجد tags في المستودع، ولا يوجد `package-lock.json` أو `pnpm-lock.yaml` أو `yarn.lock`. لذلك فإن الإصدارات الموثقة أدناه مأخوذة من `package.json` ومن سجل Git، وليست إعادة بناء لقفل تبعيات كامل.

## 2. الترخيص

`LICENSE` يعلن **MIT License**، حقوق النشر `Copyright (c) 2026 Tederby`. يسمح الترخيص بالنسخ والتعديل والدمج والتوزيع والاستخدام التجاري، بشرط إبقاء إشعار حقوق النشر ونص الترخيص في النسخ أو الأجزاء الجوهرية. لا توجد قيود copyleft في الترخيص نفسه. عند إعادة استخدام أجزاء منطقية في FLONA:

1. يجب حفظ إشعار MIT وحقوق Tederby في ملف `THIRD_PARTY_NOTICES` أو موضع مكافئ في FLONA.
2. يجب وسم الأجزاء المعاد تصميمها أو كتابتها من جديد بوضوح في سجل المشروع.
3. يجب عدم افتراض أن ترخيص MIT للمستودع يغطي تراخيص تبعياته أو أدوات خارجية مثل `agy`؛ كل تبعية تحتاج تحققًا مستقلًا قبل إدخالها.

## 3. الملفات التي فُحصت فعليًا

### وثائق وبيانات المشروع

- `README.md`
- `LICENSE`
- `package.json`
- `.env.example`
- `setting.js`
- `docs/ARCHITECTURE.md`
- `docs/AGENTIC_INFRASTRUCTURE.md`
- `docs/DATABASE.md`
- `docs/CONFIGURATION_DEPLOYMENT.md`
- `docs/CHANGELOG.md`
- `docs/COMMAND_DEVELOPMENT.md`
- `simulate.js`

### ملفات منطق الذكاء الاصطناعي والسياق والطابور والتسجيل

- `lib/aiContextBuilder.js`
- `lib/aiQueue.js`
- `lib/contextBuilder.js`
- `lib/messageLogger.js`
- `services/aiEngine.js`
- `commands/ai.js`
- `handler.js`

### التخزين والصيانة وإعادة التحميل

- `lib/db.js`
- `lib/database.js`
- `services/cleanup.js`
- `commands/_registry.js`
- `index.js`

### ملف بروتوكول متعلق بالاتصال، تمت مراجعته لتحديد ما لا ينبغي نقله

- `patches/baileys+7.0.0-rc13.patch`

### قائمة الملفات المتتبعة في المستودع

القائمة الفعلية الكاملة الناتجة من `git ls-files` هي: `.env.example`, `.gitignore`, `LICENSE`, `README.md`, `commands/_registry.js`, `commands/ai.js`, `commands/html.js`, `commands/image.js`, `commands/ping.js`, `docs/AGENTIC_INFRASTRUCTURE.md`, `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`, `docs/COMMAND_DEVELOPMENT.md`, `docs/CONFIGURATION_DEPLOYMENT.md`, `docs/DATABASE.md`, `docs/README.md`, `docs/WEBVIEW_PAYLOAD.md`, `ecosystem.config.cjs.example`, `handler.js`, `index.js`, `lib/Messages.js`, `lib/aiContextBuilder.js`, `lib/aiQueue.js`, `lib/autoDetect.js`, `lib/commandParser.js`, `lib/contextBuilder.js`, `lib/database.js`, `lib/db.js`, `lib/events/group-participants.js`, `lib/flagParser.js`, `lib/jidHelper.js`, `lib/logger.js`, `lib/mentionHelper.js`, `lib/messageLogger.js`, `lib/middleware.js`, `lib/uiEngine.js`, `lib/utils.js`, `package.json`, `patches/baileys+7.0.0-rc13.patch`, `persona.txt.example`, `services/aiEngine.js`, `services/cleanup.js`, `services/imageService.js`, `setting.js`, `simulate.js`, `temp/.gitkeep`.

## 4. الإصدارات والتبعيات

### package.json

- `name`: `wa-bot-engine`
- `version`: `1.0.0`
- `type`: `module`
- `license`: `MIT`
- scripts: `start`, `pm2`, `pm2:stop`, `postinstall` (`patch-package`)

التبعيات المباشرة المعلنة:

- `any-ascii@^0.3.2`
- `axios@^1.13.1`
- `baileys@7.0.0-rc13` (مقفل exact، مع patch-package patch خاص)
- `better-sqlite3@^12.11.1`
- `chalk@^4.1.2`
- `chokidar@^4.0.3`
- `dotenv@^17.2.1`
- `pino@^9.2.0`
- `patch-package@^8.0.1`
- `qrcode-terminal@^0.12.0`

تبعيات التطوير:

- `eslint@^8.22.0`

### ملاحظات الإصدار

هناك عدم اتساق يجب عدم إغفاله: `package.json` يعلن `1.0.0`، بينما `docs/CHANGELOG.md` يصل إلى `1.3.5` بتاريخ 2026-11-10. كما لا توجد tags أو lockfile. سجل Git يبيّن سلسلة commits خاصة بنظام AI، منها:

- `0f50b43` و`d7b0f58`: إدخال agentic userbot وطبقة Antigravity.
- `2dc572f`: تقوية استرداد السياق وتوجيه الرسائل في multi-bot.
- `55b7713`: تمييز رسائل AI عن رسائل المالك عبر zero-width watermark.
- `bd5476c`: عزل debounce في المجموعات لكل مرسل وتحديد هدف الاقتباس.
- `b366d1e`: حماية 401 و503 و428 في دورة اتصال WhatsApp.

## 5. ما وُجد في المجالات المطلوبة

### 5.1 AI agent / execution bridge

`services/aiEngine.js` ينفذ محركًا خارجيًا عبر `child_process.execFile`، وليس LLM SDK داخل Node. النموذج التشغيلي هو:

```text
agy -p <prompt> --effort low --disable-slash-commands --dangerously-skip-permissions
```

الملف يحقق بعض العزل المفيد: working directory داخل `temp/`، `AbortSignal` للإلغاء، timeout افتراضي 45 ثانية، `maxBuffer` قدره 10MB، وتنظيف ANSI. كما ينشئ profile منفصلًا تحت `.gemini-bot-profile` وينسخ/يربط ملفات token و`installation_id`، ويكتب settings تمنع command/edit/write tools.

لكن `--dangerously-skip-permissions` يجعل هذا **غير قابل للنقل كما هو** إلى FLONA. كذلك فإن `agy` binary ليس dependency npm ولا جزءًا من المستودع، ووجوده وترخيصه وسلوك أدواته خارج نطاق MIT. المنطق القابل لإعادة الكتابة هو عقد منفصل مثل `generateReply({prompt, signal, timeout})` مع adapter آمن لمزود AI تختاره FLONA، وليس استدعاء `agy` أو profile/auth الخاص به.

### 5.2 Message batching / debounce

`lib/aiQueue.js` يحتفظ بـ Map للـ debounce buffers:

- DM: مفتاح debounce هو `chatJid`.
- Group: المفتاح هو `chatJid:sender` لمنع امتزاج رسائل مستخدمين مختلفين.
- التأخير الأولي الافتراضي: `3500ms` عبر `AI_DEBOUNCE_MS`.
- التأخير اللاحق: `3000ms` عبر `AI_SUBSEQUENT_MS`.
- الحد الأقصى للانتظار المستمر: `20000ms`.
- الرسائل المتراكمة تُدمج نصيًا مع newline.
- يتم البحث في كامل bundle عن آخر رسالة ذات quote للحفاظ على هدف الرد، حتى لو كانت الرسائل اللاحقة بلا quote.
- في DM يُرسل الرد بلا quote، وفي المجموعة يُوجّه إلى `firstTriggerMessage`.

هذا الجزء قابل لإعادة الكتابة بدرجة عالية إذا استُبدل عقد الرسالة بعقد FLONA الحالي. لا ينبغي نسخ أسماء `message.chat`, `ctx.sender`, أو Baileys message wrapper حرفيًا.

### 5.3 Queue / per-chat mutex

بعد flush ينتقل bundle إلى `chatQueues`، وهي FIFO مستقلة لكل `chatJid`. يوجد `isProcessing` يمنع تشغيل أكثر من inference في نفس المحادثة. عند نهاية المهمة يُستدعى العنصر التالي، وتُحذف Map entry الفارغة لتفادي تسرب ذاكرة.

يوجد أيضًا `activeAbortControllers` لكل chat. الرسالة اليدوية من المالك تلغي debounce buffers، تفرغ queue المنتظرة، وتستدعي `AbortController.abort()` للتنفيذ الجاري. هذا loop breaker مفيد لـ FLONA، لكن يجب تعريف سياسة دقيقة لما يحدث للمهمة الملغاة: هل تُسجل كـ cancelled؟ هل يُسمح ببدء bundle جديد؟ وهل الإلغاء المادي لمزود AI مضمون؟

يحاكي الطابور typing presence كل 8 ثوانٍ، ثم يرسل `paused`. هذا جزء WhatsApp-specific ويجب فصله خلف callback اختياري، لا نقله إلى طبقة queue العامة.

### 5.4 Context builder

`lib/aiContextBuilder.js` يبني prompt من:

1. Persona من إعداد chat، ثم global DB، ثم `persona.txt`، ثم default.
2. آخر 15 رسالة بترتيب زمني.
3. ترقيم محلي `#1..#15`.
4. وسم reply إذا كان quote داخل النافذة.
5. استرجاع quote خارج النافذة من SQLite.
6. ancestor chaining حتى hop اثنين (`#Ref-2`, `#Ref-1`, `#Ref`).
7. fallback إلى payload quote الموجود في الذاكرة إذا لم يوجد الصف في DB.
8. تمثيل media بالmetadata بدل تنزيل كل التاريخ.
9. تمييز رسائل المالك اليدوية عن رسائل AI.
10. block للمشاركين في المجموعة وموضع الرسالة المحفزة.

يوجد مسار multimodal ينزل صورة trigger أو quoted image إلى temp ويضع مسار الملف في prompt، مع طلب من `agy` استخدام `read_file`. هذا المسار لا ينبغي إدخاله إلى FLONA إلا بعد سياسة واضحة للخصوصية وحذف الملفات وprovider يدعم vision. الجزء الأفضل لإعادة الاستخدام هو pure context serialization مع repository interface مثل `history.listRecent(chatId, limit)` و`history.getById(id)`.

### 5.5 Message logger

`lib/messageLogger.js` يسجل الرسائل الواردة والصادرة إلى `chat_messages` بشكل best-effort، ولا يسمح بفشل التسجيل بإيقاف pipeline. يخزن:

- stanza/message id
- chat JID
- sender JID بعد normalization
- sender name
- text
- media type/caption
- quoted id
- `is_from_me`
- `is_ai`
- Unix timestamp

يحدد `is_ai` من cache لرسائل AI IDs وzero-width watermark `\u200B` في النص أو caption. هذه فكرة عملية، لكنها ليست مصدر حقيقة أمنيًا: watermark يمكن نسخه أو فقده عند normalization، والـ in-memory cache يضيع عند restart. في FLONA يجب إضافة `origin`/`actor` صريح عند إرسال الرسالة، مع استخدام watermark فقط كfallback للتوافق.

### 5.6 Reload logic

`index.js` يراقب:

- `handler.js` عبر `chokidar`; عند التغيير يستورد `./handler.js?cacheBust=${Date.now()}` ويستبدل `msgHandler` atomically.
- `commands/`؛ عند add/change يستدعي `reloadCommand`.

`commands/_registry.js` يستخدم ESM dynamic import مع query string cache busting. عند re-register ينظف aliases القديمة، لذلك لا تبقى ghost aliases. reply handlers تبقى في Map مستقلة مع `createdAt` وتُنظف دوريًا بعد expiry.

التوثيق يذكر hot-reload للـ core pipeline، وهذا صحيح فعليًا فقط لـ `handler.js` والـ command modules. لا يوجد reload عام لكل ملفات `lib/`، ولا unload فعلي لـ ESM modules؛ لذلك يحذر الكود بعد 20 reload من تراكم cache. في FLONA، الأفضل reload plugin بعقد موجود، مع debounce لتغييرات editor (atomic save قد يولد أكثر من event)، validation قبل استبدال النسخة الحالية، وrollback إذا فشل import.

## 6. التخزين الأصلي وما يجب تغييره

المشروع يستخدم `better-sqlite3` في `lib/db.js`، مع:

- `journal_mode = WAL`
- `busy_timeout = 5000`
- `synchronous = NORMAL`
- prepared statements في `lib/database.js`
- tables مخصصة لـ `chat_messages`, `ai_global_config`, `ai_chat_settings`, `ai_group_ignores`, إضافة إلى users/groups وmulti-bot claims.

هذا التخزين لا ينبغي نقله إلى FLONA لأن FLONA الحالي يستخدم `lowdb@^3.0.0` ويمتلك schema/runtime قائمًا. تم التحقق من `package.json` و`package-lock.json` في `/home/ubuntu/work/flona/repo`: المشروع ESM ويعلن `node >=20.0.0`، مع اعتماد lowdb وplugins كثيرة. توجد أيضًا آثار تاريخية لـ `Low`/`JSONFile` في ملفات backup، لذلك يجب احترام adapter الحالي بدل إدخال DB ثانية بلا خطة migration.

### تكييف lowdb المقترح

إن كان حجم الرسائل صغيرًا، أضف namespace واحدًا إلى lowdb، مثل:

```js
{
  agentic: {
    messages: { [chatId]: [] },
    chatSettings: { [chatId]: { enabled, mode, persona } },
    global: { enabled, persona },
    ignores: { [chatId]: { [userId]: true } }
  }
}
```

أو استخدم ملفات/collections منخفضة الحجم منفصلة عبر نفس lowdb adapter إذا كان ذلك متوافقًا مع آلية الكتابة الحالية. يجب تنفيذ عمليات read-modify-write بشكل متسلسل أو عبر mutex واحد لأن lowdb/JSON لا يقدم WAL أو atomic multi-process claims مثل SQLite. لا تستخدمه لتزامن عدة process بدون lock/atomic rename؛ لا تنقل `message_claims` و`bot_registry` حرفيًا.

احتفظ بحد 15 رسالة، pruning بعد 48 ساعة، وindexes/lookup في الذاكرة بحذر؛ في lowdb ستكون lookup scans مكلفة مع تاريخ كبير. الأفضل وضع retention صارم وMap cache محدود أو دراسة طبقة منفصلة فقط إذا أثبت القياس أن lowdb غير كافٍ.

## 7. خطة تكييف آمنة مع FLONA (Node 22، ESM، lowdb، plugins)

1. **لا تنقل الاتصال أو الجلسات:** لا تنسخ `index.js`، `useMultiFileAuthState`, `sessions/`, pairing/QR، reconnect logic، `patch-package` الخاص بـ Baileys، أو أي credential/profile من Agentic-Bot.
2. **تعريف adapter للرسائل:** أنشئ طبقة صغيرة تحول رسالة FLONA الحالية إلى `{ id, chatId, senderId, senderName, text, media, quotedId, fromMe, origin }`. جميع وحدات batching/context/logger تعتمد هذا العقد فقط.
3. **إدخال logger في نقطة واحدة:** بعد normalization وقبل plugin routing، استدعِ `logAgenticMessage(normalizedMessage)`. التسجيل best-effort، مع redaction/retention configurable وعدم تسجيل secrets أو binary.
4. **إعادة كتابة queue كخدمة مستقلة:** انقل فقط `getDebounceKey`, buffer, cap, FIFO per chat, abort state. اجعل send/presence/provider callbacks injected بدل import Baileys أو `setting.js`.
5. **عزل group sender:** احتفظ بـ `chatId + senderId` للمجموعات، و`chatId` للـ DM. طبّق tests لتداخل مستخدمين، follow-up بلا quote، وmax cap.
6. **إعادة بناء context عبر repository:** طبقة `historyRepository` تستخدم lowdb وواجهات `listRecent/getById/append/prune`. أعد serialization باللغة/الأسلوب المطلوبين في FLONA بدل نسخ persona الإندونيسية والـ prompt السياسي/الخاص بالمستودع.
7. **الحفاظ على quote chain بحدود:** نافذة 15 ورسالة quote خارجية مع hop limit اثنين كافيان، مع cycle detection وmax prompt length. لا تنفذ أي path قدمه user داخل prompt كأداة تلقائيًا.
8. **موفر AI آمن:** استخدم adapter مثل `provider.generate({ prompt, signal })`. لا تستخدم `execFile('agy', ...)` ولا `--dangerously-skip-permissions` افتراضيًا. إذا لزم process خارجي، استخدم allowlist binary، cwd مؤقتًا، environment minimal، timeout، max output، وsandbox بدون أدوات كتابة.
9. **التمييز اليدوي/AI:** خزّن `origin: 'manual'|'ai'` ضمن نتيجة الإرسال/السجل إن أمكن. اجعل zero-width watermark اختيارية فقط للتوافق، لا أساسًا وحيدًا لمنع loop.
10. **دمج plugin الحالي:** أضف plugin/controller صغيرًا يستدعي service عند trigger، ولا تنشئ registry بديلًا. ابدأ بأمر owner-only لتشغيل/إيقاف global وchat settings، مع أسماء وأسلوب FLONA العربي، وتجنب تعارض `plugins/ai.js` الموجود.
11. **reload متوافق:** استخدم loader FLONA الحالي. إذا كان دعم hot reload موجودًا، أضف lifecycle hooks للـ agentic service؛ لا تراقب `plugins/` من watcher ثانٍ. عند عدم وجود hook، لا تنقل chokidar إلا بعد إثبات عدم وجود duplicate events.
12. **Node 22/ESM:** استخدم built-in `AbortController`, `AbortSignal.timeout`, `node:fs/promises`, dynamic `import()` عند الحاجة. تحقق من API compatibility لـ lowdb v3 وBaileys المستخدم في FLONA بدل اعتماد `baileys@7.0.0-rc13`.
13. **اختبارات offline:** اكتب اختبارات Node test للـ debounce keys، FIFO ordering، abort/manual override، prompt truncation، quote fallback، pruning، وplugin reload failure/rollback. لا تتطلب WhatsApp credentials أو اتصالًا حيًا.
14. **مراقبة وتشغيل تدريجي:** ابدأ disabled by default، ثم allowlist محادثات، limits لكل chat/global، وmetrics للـ queue depth وlatency وabort/errors. راقب نمو lowdb وحجم prompt قبل التفعيل العام.

## 8. التبعيات التي لا ينبغي نقلها

- `baileys@7.0.0-rc13`: خاص بواجهة الاتصال والإصدار/patch في المستودع، وFLONA يستخدم fork مختلفًا `@whiskeysockets/baileys` من GitHub. لا تُدخل نسختين أو تغيّر اتصال FLONA.
- `patch-package` و`patches/baileys+7.0.0-rc13.patch`: patch بروتوكولي متصل بالإصدار exact؛ نقله قد يكسر fork FLONA أو يخلق mismatch.
- `better-sqlite3`: FLONA لديه lowdb؛ لا تضف SQLite ثانية لمجرد نسخ schema. لا تُنقل إلا بقرار معماري منفصل مبني على benchmark وmigration.
- `chokidar`: لا تنقل watcher قبل معرفة loader FLONA؛ watcher مزدوج قد يكرر تسجيل plugin أو تنفيذ hooks.
- `qrcode-terminal`, `pino` setup, `Browsers`, `useMultiFileAuthState`: اتصال/جلسات/تشغيل خاص بالمصدر وخارج المجال المطلوب.
- `dotenv`: FLONA يملك config/env conventions؛ استخدمها بدل تحميل `.env` مرتين.
- `agy` binary/profile وملفات OAuth: ليست dependency npm، وقد تكون حساسة وخارج ترخيص المشروع. لا تُنسخ.
- `any-ascii`, `axios`, `chalk`: ليست مطلوبة للمنطق الأساسي المطلوب. استخدم بديل FLONA الموجود فقط إن احتاجه عقد محدد.
- `imageService.js`/vision download: خارج المجال الأساسي، ويزيد مخاطر الملفات والخصوصية والتكلفة؛ لا يُنقل في المرحلة الأولى.

## 9. المخاطر والعيوب المرصودة

1. **تشغيل agent خارجي بصلاحيات واسعة:** `--dangerously-skip-permissions` خطر جوهري حتى مع cwd وsettings؛ لا يصلح كافتراض إنتاجي.
2. **prompt injection:** محتوى الرسائل والاقتباسات يدخل prompt ويطلب web/tools. يجب اعتبار كل chat content غير موثوق، مع فصل system policy عن history وعدم السماح بأدوات حساسة.
3. **تسرب الخصوصية:** تخزين تاريخ 48 ساعة وpersonas وصور مؤقتة قد يكون غير مناسبًا. يلزم opt-in/retention/redaction.
4. **lowdb concurrency:** JSON file لا يقدم WAL أو multi-process atomic claims. التزامن الحالي في Agentic-Bot لا ينتقل تلقائيًا إلى lowdb.
5. **فقدان الحالة عند restart:** queue وAbortControllers وAI ID cache كلها in-memory؛ يجب قبول ذلك أو إضافة recovery semantics.
6. **كشف AI بالـ watermark غير موثوق:** zero-width يمكن إزالته/نسخه، والـ ID cache يفقد بعد restart. استخدم origin صريح.
7. **تراكم ESM cache:** cache-busting المتكرر للـ handler/commands يزيد modules في الذاكرة، مع تحذير بعد 20 reload فقط وليس unload حقيقيًا.
8. **سباقات reload:** لا يوجد debounce/validation/rollback كامل لـ file events؛ import الفاشل لا يجب أن يزيل النسخة العاملة.
9. **حدود prompt/output:** المصدر يفرض truncation للـ Windows فقط؛ FLONA يحتاج حدًا عامًا للـ prompt، token budget، وoutput length.
10. **اختلاف message shape وJID:** منطق `message.chat`, `sender`, `quoted`, `contextInfo` وLID/PN خاص بwrapper المصدر؛ النسخ الحرفي قد يسجل sender/chat خطأ.
11. **عدم اتساق الوثائق والإصدار:** changelog 1.3.5 مقابل package 1.0.0 وغياب lockfile يصعّبان reproducibility.
12. **اختبارات غير معزولة بالكامل:** `simulate.js` يتوقع `agy` حيًا ويستورد قاعدة SQLite؛ ليس مناسبًا مباشرة لـ CI في FLONA.
13. **سلوك cleanup:** المصدر ينفذ `VACUUM` دوريًا وعمليات حذف؛ في lowdb يجب تصميم compaction/atomic writes وعدم نسخ `VACUUM` حرفيًا.
14. **تعارض plugin:** FLONA لديه `plugins/ai.js` وملفات ذكاء اصطناعي أخرى؛ إضافة `commands/ai.js` أو trigger عام قد يكرر الردود.
15. **تبعيات خارجية غير مثبتة:** `agy` وweb search/image behavior موصوفان في prompt لكن تنفيذهما لا يأتي من package.json، لذلك لا يجب اعتبارهما capabilities مضمونة.

## 10. التقييم النهائي

**قابل للتكييف: نعم، بشكل جزئي ومشروط.** أفضل قيمة قابلة لإعادة الكتابة هي:

- debounce per DM/per sender-group
- FIFO mutex per chat
- manual interrupt عبر AbortSignal
- sliding-window context مع quote/ancestor recovery
- best-effort message logging مع retention
- فصل origin اليدوي/AI
- مبادئ reload الآمن للـ plugins

أما ما يجب استبعاده من التكييف المباشر فهو اتصال WhatsApp، session/auth files، Baileys patch/version، PM2/multi-instance claims، JID/LID implementation، `agy` profile/OAuth، وامتيازات `--dangerously-skip-permissions`. التنفيذ الآمن في FLONA هو إعادة تصميم هذه الأفكار كخدمات ESM مستقلة فوق message adapter وlowdb وplugin lifecycle الحالي، مع تفعيل disabled-by-default واختبارات offline قبل أي تشغيل حي.
