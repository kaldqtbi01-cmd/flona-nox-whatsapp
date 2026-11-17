# تحليل Wa-guard لاستخراج منطق مكافحة الإغراق لـ FLONA

## نطاق المهمة وحالة الفحص

تم فحص مستودع واحد فقط: [overtunned/Wa-guard](https://github.com/overtunned/Wa-guard)، واستنساخه فعليًا في:

`/home/ubuntu/work/flona/research-src/wa-guard`

لم تُنسخ ملفات اتصال WhatsApp أو ملفات الجلسة إلى FLONA، ولم تُعدّل ملفات مصدر FLONA. التقرير يهدف إلى استخراج منطق قابل لإعادة الكتابة فقط ضمن نطاق: مكافحة الرسائل المزعجة، الرسائل المتكررة/الإرسال السريع، فلاتر الكلمات والروابط، التحذيرات والعقوبات.

الفرع المفحوص هو `main`، وحالته نظيفة بعد الاستنساخ. لا توجد وسوم Git لإصدارات رسمية. آخر commit في النسخة المفحوصة:

- commit: `8beb4d7505433a51936d370cd630df5f5047b3d3`
- العنوان: `Add Docker deployment: Dockerfile, docker-compose.yml, and QR-code fix`
- التاريخ: `2026-09-12T08:04:34+00:00`
- سجل التاريخ يبدأ بـ `d7b2d54` (Initial commit) ويتضمن لاحقًا refactor وميزات لوحة ويب في التاريخ نفسه؛ لوحة الويب/الفروع غير مطلوبة لهذا الفحص ولم تُعتمد.
- يوجد remote branch باسم `origin/feat/web-dashboard`، لكن التحليل الأساسي مقتصر على `main` كما طُلب.

تم تشغيل الاختبارات والفحص النحوي:

- `npm test`: نجح، 10 assertions.
- `npm run lint`: نجح (`node --check` لكل ملفات المصدر).
- `npm ls --all`: أظهر أن dependencies غير مثبتة في نسخة الاستنساخ الحالية؛ تم الاعتماد على `package.json` و`package-lock.json` لتحديد الإصدارات، دون تثبيت أو تعديل المستودع.

## الترخيص

المستودع يحمل `MIT License` في `LICENSE`، و`package.json` يحدد `"license": "MIT"`. حقوق النسخة في الملف باسم `overtunned` وسنة 2026. رخصة MIT تسمح بإعادة الاستخدام والتعديل والتوزيع، بشرط إبقاء إشعار حقوق النشر ونص الترخيص في النسخ أو الأجزاء الجوهرية. هذا لا ينقل شروط أو مخاطر WhatsApp؛ README يصرح صراحة بأن Baileys عميل غير رسمي وأن الأتمتة قد تخالف شروط WhatsApp وتؤدي إلى حظر الرقم.

الخلاصة العملية: يمكن إعادة كتابة خوارزميات الكشف والحالة/التحذير مع الاحتفاظ بإشعار MIT في توثيق أو ملف notices مناسب، لكن لا ينبغي نسخ اتصال Baileys، `auth_info`، أو مسار الجلسة. كما يجب مراجعة ترخيص كل dependency مستقلة، وبالأخص عدم إدخال `libsignal` إلى FLONA لمجرد الاستفادة من منطق الوساطة.

## الملفات الفعلية المفحوصة

### ملفات المستودع العامة والإعداد

- `README.md` — الوصف، الإعداد، السلوك، المخاطر، أمثلة الإعداد، الأوامر، والتنبيه إلى أن الجلسة في `auth_info/` حساسة.
- `LICENSE` — نص MIT.
- `package.json` — الاسم `wa-guard`، الإصدار `0.1.0`، CommonJS، Node `>=18`، scripts والتبعيات المباشرة.
- `package-lock.json` — lockfileVersion 3 والإصدارات المقفلة.
- `config.json` — القيم الافتراضية الفعلية للفلاتر ومكافحة الإغراق.
- `.gitignore`, `.dockerignore`, `Dockerfile`, `docker-compose.yml` — راجعت خصوصًا فصل `auth_info` و`data` والتحذيرات؛ ليست أجزاء مطلوبة لإعادة كتابة المنطق.
- `test/moderation.test.js` — اختبارات link/wordlock/antispam.

### ملفات المصدر ذات الصلة مباشرة

- `src/moderation/antilink.js` — استخراج الروابط، تحليل hostname، allow-list.
- `src/moderation/wordlock.js` — مطابقة العبارات المحظورة case-insensitive كـ substring.
- `src/moderation/antispam.js` — sliding window وburst detector وحالة الذاكرة.
- `src/moderation/index.js` — تشغيل الفحوص وترتيب violations.
- `src/lib/warnings.js` — عدادات التحذير الدائمة في JSON.
- `src/index.js` — استخراج النص، admin immunity، الحذف، التحذير، الطرد، وربط الرسائل؛ تمت قراءته لاستخراج orchestration فقط، وليس لإعادة استخدام اتصال WhatsApp أو الجلسة.
- `src/commands.js` — أوامر تفعيل/تعطيل الفلاتر وإضافة عبارة ومسح التحذيرات.
- `src/lib/config.js` — دمج defaults مع إعدادات المجموعة وحفظ `config.json`.
- `src/lib/groupAdmins.js` — cache لبيانات المجموعة والتحقق من admin؛ مرجع سلوكي فقط، وليس مطلوبًا نقله.
- `src/lib/logger.js` — راجعته ضمن قائمة الملفات، وليس جزءًا من منطق الكشف.

## ما وجدته في المنطق المطلوب

### 1. Anti-link

`src/moderation/antilink.js` يعرّف regex بسيطًا يلتقط:

- روابط `http://` و`https://`.
- روابط دعوة `chat.whatsapp.com/...`.
- روابط `wa.me/...`.
- نطاقات شائعة بلا scheme بامتدادات محددة مثل `com`, `net`, `org`, `io`, `co`, `link`, `xyz`, `shop`, `site`, `online`, `club`, `top`, `info`.

`extractLinks(text)` يعيد كل المطابقات بعد trim. `hostnameOf()` يضيف scheme مؤقتًا للرابط بلا scheme ثم يستخدم `URL`; يزيل بادئة `www.` ويحوّل إلى lowercase. `checkAntilink(text, cfg)` يتوقف إذا كان disabled، ويعتبر الرابط مسموحًا إذا كان hostname مساويًا لـ allowed domain أو subdomain منه (`host === a || host.endsWith('.' + a)`). الناتج `{ violated, matched }`.

ميزة قابلة لإعادة الكتابة: detector pure تقريبًا، لا يحتاج WhatsApp، ويمكن جعله ESM plugin يعيد قرارًا وبيانات مطابقة فقط. لا ينبغي نسخ regex كما هو دون اختبارات؛ فهو محدود بالامتدادات، وقد يلتقط نصًا زائدًا حتى whitespace، ولا يعالج كل Unicode/obfuscation/IDN أو punctuation بأمان. كذلك يلزم تطبيع domain ورفض allow-list غير الصالحة بدل الاعتماد على `endsWith` وحده.

### 2. Wordlock / word filter

`src/moderation/wordlock.js` يتوقف عند disabled أو نص فارغ، يحول النص إلى lowercase، ثم يمر على `cfg.words`. أول عبارة غير فارغة موجودة كـ substring تعيد `{ violated: true, matched: word }`; وإلا `{ violated: false, matched: null }`.

ميزة قابلة لإعادة الكتابة: simplicity، ترتيب أول تطابق، وعدم وجود side effects. يلزم تحسينات FLONA قبل الإنتاج: Unicode normalization، trim، معالجة اختلافات التشكيل/الأحرف العربية، حدود كلمات اختيارية بدل substring دائم، escape إذا أصبحت القائمة regex، وتحجيم القائمة/compilation لتفادي كلفة خطية كبيرة. يجب أن تكون قائمة الكلمات وقرارها per-group في `global.db.data.chats`/lowdb، مع صلاحيات admin لأوامر الإضافة والحذف.

### 3. Anti-spam: الرسائل السريعة والإغراق

`src/moderation/antispam.js` يحتفظ بـ `Map` داخل الذاكرة بمفتاح `groupJid::userJid` وقائمة timestamps بالميلي ثانية. كل رسالة تمر عبر `checkAntispam()` حتى إذا كانت رسالة link/word violation، لأن عداد السرعة يحتاج كل الرسائل.

الإعدادات الأساسية:

- `windowMs`: نافذة الإغراق العامة.
- `maxMessages`: الحد داخل النافذة العامة.
- `burstMs`: نافذة قصيرة.
- `burstMax`: حد burst.

بعد إضافة `Date.now()`, تُحذف timestamps الأقدم من أكبر نافذة. ثم يحسب count داخل `burstMs`؛ إذا وصل `burstMax` تكون النتيجة `reason: "burst"`. وإلا يفحص `windowMs` ويعيد `reason: "window"` عند بلوغ `maxMessages`. الناتج `{ violated, reason, count }`. `resetCounter()` يحذف حالة المستخدم بعد العقوبة أو بأمر admin.

ميزة قابلة لإعادة الكتابة: خوارزمية sliding-window مفهومة، bounded نسبيًا لكل مفتاح، وقرارها لا يحتاج مكتبة. الحالة volatile عمدًا وتُمسح بعد restart حتى لا يعاقب البوت شخصًا على نشاط قديم. في FLONA يجب إضافة TTL/garbage collection للمفاتيح الخاملة وعدّادات آمنة عند تعدد المعالجات، والتحقق من أن الحدود أعداد موجبة، وربما استخدام queue/deque بدل `filter` المتكرر للمجموعات الكبيرة.

### 4. Repeated messages

لا يوجد في Wa-guard detector مستقل لبصمة أو تكرار محتوى الرسالة. الموجود هو flood/burst حسب الزمن وعدد الرسائل، أي أنه يلتقط الإرسال السريع حتى لو اختلف النص، لكنه لا يلتقط شخصًا يكرر نفس النص ببطء داخل النافذة أو عبر نوافذ متتابعة. لذلك لا ينبغي وصفه بأنه implements repeated-message detection كاملًا.

خطة FLONA يمكن أن تضيف طبقة مستقلة: تطبيع text، hash (مثل SHA-256 من Node crypto) لكل `(chat,sender)`, حفظ آخر N hashes مع timestamps، ثم trigger عند تكرار نفس hash K مرات خلال T، مع تجاهل الرسائل الفارغة/الأوامر/الردود أو ضبطها حسب policy. يجب فصل هذا عن antispam العددي حتى لا تضاعف العقوبات لنفس الحدث.

### 5. تجميع violations

`src/moderation/index.js` يشغل antilink ثم wordlock ثم antispam، ويعيد array من violations مع `kind`, `detail`, `action`. Antispam يعمل حتى إذا سبقته مخالفة محتوى. التعليق يسمي الترتيب “most-severe first”، لكن التنفيذ لا يطبق severity ranking فعليًا ولا يمنع تعدد العقوبات في الرسالة نفسها.

هذه نقطة مهمة عند التكييف: FLONA ينبغي أن يحول النتائج إلى policy decision واحدة لكل رسالة، مع precedence واضح (مثلاً link/word delete مرة واحدة، ثم تحديث spam state، ثم عقوبة واحدة بأشد action)، وإلا قد يرسل تحذيرين أو يحاول الطرد مرتين عند اجتماع مخالفتين.

### 6. التحذيرات والعقوبات

`src/lib/warnings.js` يحمّل `data/warnings.json` عند import، ويستخدم مفتاحًا نصيًا `groupJid::userJid` وقيمًا حسب `kind`. `addWarning()` يزيد counter ويكتب الملف synchronous بالكامل بعد كل تحذير. توجد `getWarnings`, `resetWarnings`, `resetAllForGroup`.

في `src/index.js`، `punish()`:

1. يحاول حذف رسالة المخالفة للـ antilink/wordlock؛ لا يحذف شيئًا خاصًا بـ antispam غير الرسالة الأحدث.
2. `action: delete`: يتوقف بعد الحذف.
3. `action: warn`: يزيد عداد kind، يرسل تحذيرًا، ثم يطرد عند بلوغ `warnLimit` إذا لم يكن المرسل admin.
4. `action: kick`: يرسل إشعارًا ثم يزيل المشارك، مع منع الطرد التلقائي للـ admin.
5. فشل الحذف أو الطرد يسجل warning/error ولا يوقف المعالجة كلها.

الإعداد الفعلي في README/config يتيح `delete`, `warn`, `kick`، مع `adminsImmune: true` افتراضيًا. تحذيرات antilink وwordlock وantispam منفصلة حسب kind؛ لا يوجد decay أو مدة انتهاء أو audit history منطقية في الملفات الأساسية.

ميزة قابلة لإعادة الكتابة: نموذج policy بسيط وواضح، admin immunity، وفصل العدادات حسب المجموعة/المستخدم/نوع المخالفة. ما يحتاج إعادة تصميم: atomic persistence، منع race conditions، idempotency، cooldown للإشعارات، decay/expiry، وسجل تدقيق مختصر.

### 7. إعدادات المجموعة والأوامر

`src/lib/config.js` يحمّل `config.json`، ينسخ defaults ثم يدمج override الخاص بالمجموعة، ويحفظ `config.json` عند التغيير. الأوامر في `src/commands.js` تسمح للمشرف/المالك بتفعيل antilink/wordlock/antispam، إضافة phrase، إظهار status، ومسح التحذيرات والعداد.

هذا النموذج مفيد وظيفيًا لكنه لا ينبغي نقله كما هو إلى FLONA: FLONA يملك بالفعل ESM/plugin loader وبيانات group في lowdb، لذا يجب تحويل الأوامر إلى plugin(s) متوافقة مع contract الموجود، لا إنشاء `config.json` عالمي جديد أو loader مستقل.

## الإصدارات والتبعيات

### package metadata

- package: `wa-guard@0.1.0`
- `type`: `commonjs`
- engine: Node `>=18`
- lockfile: npm lockfileVersion 3
- scripts: `start`, `test`, `lint`

### direct dependencies في package.json

- `@hapi/boom`: `^10.0.1`، مقفل فعليًا `10.0.1`، BSD-3-Clause.
- `@whiskeysockets/baileys`: `^6.7.9`، مقفل فعليًا `6.7.24`، MIT، وله متطلبات/تبعيات مرتبطة ببروتوكول WhatsApp.
- `qrcode-terminal`: `^0.12.0`، مقفل فعليًا `0.12.0`.

`overrides` يثبت `libsignal` على `6.0.0`. من تبعيات Baileys المهمة في lock: `@cacheable/node-cache`, `@hapi/boom`, `async-mutex`, `axios`, `libsignal`, `music-metadata`, `pino`, `protobufjs`, `ws`. يوجد أيضًا `link-preview-js` كـ optional peer لدى Baileys. لا توجد dependency مطلوبة للكشف نفسه؛ detectors الثلاثة تعتمد على JavaScript built-ins فقط (`URL`, `Date`, `Map`, regex/string operations).

### ما لا ينبغي نقله إلى FLONA

- `@whiskeysockets/baileys`: FLONA لديه Baileys/فرع speed قائم ومتكامل؛ إضافة نسخة ثانية أو استبدالها سيخلق تضاربًا في protocol/client lifecycle.
- `qrcode-terminal`: خاص بإقلاع Wa-guard وQR في الطرفية، وليس جزءًا من moderation plugin.
- `@hapi/boom`: مستخدم لتحليل disconnect في lifecycle؛ لا حاجة له في detector/policy.
- `libsignal` و`overrides`: جزء من auth/crypto stack الخاص بعميل Baileys؛ لا تنقل إلى FLONA لهذا الغرض، مع الانتباه إلى ترخيصه المختلف (lock يذكر `libsignal@6.0.0` بترخيص GPL-3.0).
- `useMultiFileAuthState`, `auth_info`, `saveCreds`, reconnect/QR/browser options: خارج النطاق، حساسة، ولا تُنسخ.
- Docker و`docker-compose`, web dashboard، و`config.json` المستقل: لا حاجة لها في بنية FLONA الحالية.

## خطة التكييف الآمنة مع FLONA

1. **استخراج pure services لا lifecycle:** إعادة كتابة `checkAntilink`, `checkWordlock`, sliding-window/burst، وrepeat-content detector جديد في وحدات ESM صغيرة تحت plugin أو lib مناسب. واجهتها تقبل normalized event (`chat`, `sender`, `text`, `isGroup`, `isAdmin`) وتعيد decision data، ولا تستورد Baileys ولا auth.
2. **الاندماج مع loader الحالي:** FLONA يستخدم `type: module` و`lib/plugins.js` الذي يحمّل ملفات `plugins/*.js` عبر `import`. أنشئ plugin حماية واحدًا أو مجموعة plugins متوافقة مع `export default handler` والعقد الحالي، بدل نسخ `src/index.js` أو إنشاء `messages.upsert` listener ثانٍ.
3. **الموضع الصحيح في pipeline:** شغّل policy بعد `smsg`/تطبيع `m.text` وتحديد `m.chat`, `m.sender`, `m.isGroup` وبيانات المشاركين، وقبل تشغيل plugins العادية. لا تُعد معالجة نفس event من listener مستقل؛ استخدم `handler.js`/pipeline الموجود كي لا تتكرر الأفعال.
4. **الاستفادة من lowdb:** خزّن إعدادات المجموعة في `global.db.data.chats[m.chat]` (مع keys مثل `antiLink`, `antiSpam`, `wordLock`, `repeatGuard`, `moderation`) والتحذيرات في بنية مستقرة مثل `chat.moderation.strikes[sender][kind]`. احترم آلية `global.loadDatabase()` والحفظ الموجودة، ولا تنشئ `data/warnings.json` متوازيًا. إن استُخدم lowdb مباشرة في module جديد فليكن عبر abstraction واحدة وبعمليات queued/atomic، لا write synchronous لكل رسالة.
5. **Node 22 وESM:** استخدم `import/export`, `node:crypto`, `node:url`/WHATWG `URL`، وميزات Node 22 دون CommonJS `require`. لا تُدخل `type: commonjs` أو نسخة package مستقلة. تحقق من `node --test` و`node --check`/اختبار ESM ضمن FLONA.
6. **قرار عقوبة واحد:** اجمع نتائج detectors ثم طبّق precedence/allow policy واحدة: تجاهل owner/bot/admin بحسب إعدادات المجموعة، حذف الرسالة مرة واحدة فقط إن كان مسموحًا، ثم warning أو mute/kick وفق عقوبة FLONA الحالية. لا تفترض أن bot admin؛ افحص capability وامنع retry loop.
7. **تحذيرات آمنة:** نفّذ `warnLimit`, expiry/decay، وcooldown للإشعار. اجعل increment idempotent بمفتاح message id حتى لا تضاعف إعادة التسليم التحذير. سجّل سببًا مختصرًا ووقتًا وmoderator policy، مع إمكانية أمر admin لمسح strikes.
8. **إضافة repeated-message فعلية:** canonicalize النص (normalization، whitespace، case policy)، hash آخر الرسائل لكل user/chat، وطبّق حدًا منفصلًا عن count-rate. تجاهل الأوامر الإدارية والرسائل المقتبسة حسب الحاجة.
9. **تحسين detector الروابط:** استخدم URL parsing بعد استخراج candidates، allow-list exact/subdomain آمنة، وحدد ما إذا كانت invite links دائمًا محظورة. أضف اختبارات Arabic/Unicode، punctuation، URL بلا scheme، domain allow-list، وfalse positives.
10. **الاختبارات قبل التفعيل:** انقل أفكار الاختبارات العشرة إلى tests ESM داخل FLONA وأضف اختبارات decision precedence، admin immunity، repeated content، restart persistence، concurrent events، malformed config، وفشل delete/kick. ابدأ بوضع audit/log-only ثم فعّل delete/warn تدريجيًا على مجموعة اختبار.
11. **حدود الحالة:** استخدم deque أو ring buffer وTTL للمفاتيح الخاملة، وحدًا أقصى لعدد users/groups في الذاكرة. لا تحفظ timestamp flood state في lowdb؛ احفظ فقط strikes/policy، حتى لا يصبح DB عنق زجاجة.
12. **التوافق مع منطق FLONA الموجود:** راجع `handler.js` و`lib/group-moderation.js` و`lib/rateLimit.js` قبل التفعيل لمنع التعارض مع `antiLink`, mute، queue، ومؤشرات `warn`. يجب توحيد أسماء الحقول بدل إنشاء نظام عقوبات ثانٍ يتنافس مع `global.db.data.users[].warn` و`global.db.data.chats[]`.

## المخاطر والتحفظات

- **حظر WhatsApp/Terms:** README نفسه يحذر من أن Baileys غير رسمي وأن الأتمتة قد تعرض الرقم للحظر. إعادة استخدام detectors لا يلغي هذا الخطر؛ لا تُشغّل اتصالًا ثانيًا ولا تستخدم حسابًا رئيسيًا للاختبار.
- **صلاحيات الحذف والطرد:** الحذف وإزالة المشاركين يتطلبان أن يكون البوت admin. فشل capability قد يجعل policy ترسل تحذيرًا دون إزالة، لذلك يجب إظهار failure واضح وعدم اعتبار العقوبة ناجحة.
- **false positives في link regex:** امتدادات محدودة، punctuation، subdomains، IDN وobfuscation قد تؤدي إلى كشف ناقص أو زائد. allow-list عبر suffix تحتاج تطبيعًا واختبارًا.
- **false positives في substring wordlock:** كلمة محظورة قد تكون جزءًا من كلمة سليمة؛ العربية والتشكيل وتنوع Unicode غير معالج.
- **غياب repeated-content الحقيقي:** Wa-guard لا يحقق مطلب الرسائل المتكررة إلا بمعنى flood العددي؛ يلزم مكون جديد.
- **مضاعفة العقوبات:** الرسالة قد تنتج link + word + antispam violations، والتنفيذ الأصلي يمر على كلها. في FLONA يجب تجميعها في قرار واحد.
- **حالة الذاكرة:** sliding-window state لا تستمر بعد restart، وقد تنمو مع مفاتيح كثيرة حتى مع pruning لكل مفتاح؛ أضف global eviction/TTL.
- **استدامة التحذيرات:** `warnings.js` يكتب JSON synchronous بعد كل strike، بلا locking أو atomic rename أو schema validation. هذا غير مناسب مباشرة لتدفق FLONA/lowdb.
- **race conditions وإعادة التسليم:** listeners المتوازية أو reconnect/replay قد تكرر delete/warn/kick؛ message-id idempotency وserialization لكل chat/user مطلوبان.
- **تعريف admin stale:** cache في Wa-guard مدته 60 ثانية؛ تغيير صلاحية admin قد لا ينعكس فورًا إلا مع invalidate event. استخدم metadata الحالية وآلية FLONA، وتعامل بحذر مع `@lid`/JID normalization.
- **تعارض architecture:** FLONA ESM وplugin loader وlowdb/Baileys الموجود تختلف عن Wa-guard CommonJS وstandalone config. النسخ الحرفي سيؤدي إلى listener مزدوج، package conflicts، أو DB state منفصل.
- **تراخيص التبعيات:** MIT للمستودع لا يعني أن كل dependency لها MIT؛ `libsignal` المقفلة GPL-3.0، وهو سبب إضافي لعدم إدخال stack الاتصال إلى FLONA. احتفظ بإشعار MIT عند إعادة استخدام أجزاء جوهرية وراجع أي كود من الفرع/اللوحة غير المفحوصة قبل أخذه.
- **نقص hardening:** config الأصلي لا يظهر validation كافيًا للحدود والأفعال؛ قيم سالبة/صفرية أو action غير معروفة تحتاج رفضًا آمنًا.

## الحكم النهائي

`feasible: true` لإعادة كتابة منطق الكشف والسياسة داخل FLONA، لأن جوهر antilink وwordlock وsliding-window/burst لا يعتمد على Baileys أو ملفات الجلسة، والاختبارات الحالية ناجحة. التوصية هي **إعادة كتابة انتقائية** داخل plugin ESM واحد أو طبقة moderation مشتركة، مع lowdb الموجود، وإضافة repeated-content detector حقيقي، وليس نسخ Wa-guard كبرنامج أو dependencies أو lifecycle.

ما يستحق النقل كمفهوم: pure detectors، sliding-window + burst thresholds، per-group overrides، admin immunity، فصل strikes حسب kind، وعمليات reset. ما يجب عدم نقله: اتصال WhatsApp، auth/session، QR/reconnect، standalone `config.json`, CommonJS structure، synchronous JSON warning store، و`libsignal`/Baileys stack. يبدأ الدمج بوضع مراقبة فقط، ثم اختبارات، ثم delete/warn على مجموعة اختبار، مع إبقاء kick/mute خلف إعداد صريح ومحدد.
