# تقرير بحث: `martinsuii/wa-bot`

**المعرّف:** 09-wa-bot  
**المستودع:** https://github.com/martinsuii/wa-bot  
**مسار النسخة المفحوصة:** `/home/ubuntu/work/flona/research-src/wa-bot`  
**حالة المصدر:** clone ناجح، الفرع `main`، commit `da9b1c6339c9c95f30357e514db58f25c11caea0`، بتاريخ `2026-11-15T16:31:30+01:00`، والنسخة المحلية نظيفة. لا توجد tags أو فروع أخرى معروضة محليًا.

## هدف الفحص وحدوده

تم فحص مستودع واحد فقط، واستخراج منطق قابل لإعادة الكتابة داخل FLONA في نطاق moderation الإضافية، إعدادات المجموعات، التحذيرات، الاستثناءات الإدارية، والكوارث/الحظر. لم يتم نسخ اتصال WhatsApp أو مجلد `auth` أو أي ملفات جلسة إلى FLONA، ولم تُعدّل `/home/ubuntu/work/flona/repo` من ناحية كود التطبيق. الملف الوحيد المنشأ هناك هو هذا التقرير.

## الترخيص

الترخيص هو **MIT** كما يذكر `README.md` وكما يثبت `LICENSE`، وحقوق النشر في الملف لـ Martin Mikéska (2026). يسمح MIT بالنسخ والتعديل وإعادة الاستخدام والتوزيع، بشرط الاحتفاظ بإشعار حقوق النشر ونص الترخيص في النسخ أو الأجزاء substantial. عند إعادة كتابة منطق مستوحى من المصدر يجب الاحتفاظ بإشعار MIT في سجل third-party/notices داخل FLONA إذا نُقلت أجزاء substantial من الشيفرة، والأفضل إعادة تصميمها بدل نسخ الملف الأحادي. نص الترخيص لا يمنح ضمانًا ولا يلزم صاحب المشروع بالدعم.

## الملفات الفعلية المفحوصة

الملفات المتتبعة في commit المفحوص هي:

- `README.md` — الوصف، الميزات، الأوامر، ملفات البيانات، واللغة/الترخيص المعلن.
- `LICENSE` — MIT وشروطه.
- `package.json` — الإصدار `1.0.0`، CommonJS، scripts والتبعيات المباشرة.
- `package-lock.json` — lockfile v3 والتثبيتات الفعلية للتبعيات.
- `index.js` — كل التشغيل والمنطق: الحالة، التخزين، فحص الرسائل، الأوامر، التحذير، mute/kick/ban، الترحيب، join enforcement، وcustom commands.
- `badwords.js` — مجموعة كلمات مسيئة متعددة اللغات، تطبيع leet-speak/diacritics وفحص prefix/suffix/compound.
- `lang.js` — الرسائل المترجمة، `t()`، اللغات الثماني، والقيم الافتراضية.
- `docs/index.html` — وثائق/مولد إعدادات HTML، ويكرر نماذج الميزات والأوامر ويدعم توليد import code.
- `.gitignore` — يستثني `node_modules/` و`auth/` و`data/` وملفات السجل.

لم تُعتبر `auth/` أو `data/` مصادر منطق قابلة للنقل؛ وهي غير موجودة في النسخة المتتبعة بسبب `.gitignore`.

## سجل الإصدار والتبعيات

- المشروع: `wa-mod-bot`, version `1.0.0`، `main: index.js`، `type: commonjs`.
- آخر commit المفحوص: `da9b1c6`، رسالة commit: `Remove terminal hints, minify config maker script`.
- يتطلب Baileys المثبت فعليًا `@whiskeysockets/baileys@7.0.0-rc14`، ومحرك Node المعلن له `>=20.0.0`.
- التبعيات المباشرة في `package.json` وlockfile: `@hapi/boom@10.0.1`، `@whiskeysockets/baileys@7.0.0-rc14`، `pino@10.3.1`، `pino-pretty@13.1.3`، و`qrcode-terminal@0.12.0`.
- lockfile: `lockfileVersion: 3`، وفيه 117 package entries تقريبًا، بما فيها تبعيات Baileys غير المباشرة مثل `libsignal@6.0.0` (GPL-3.0)، `protobufjs@7.6.5` (BSD-3-Clause)، `sharp@0.35.3` (Apache-2.0)، `music-metadata@11.14.0` (MIT)، `p-queue@9.3.3` (MIT)، `whatsapp-rust-bridge@0.5.4` (MIT)، و`ws@8.21.1` (MIT). `qrcode-terminal` لا يضع license field في مدخل lockfile، لذلك يلزم التحقق منه مستقلًا قبل أي توزيع.
- لا توجد مكتبة `lowdb` في مستودع wa-bot؛ التخزين هو JSON متزامن عبر `fs`.
- لا توجد اختبارات فعلية: script `test` يفشل عمدًا برسالة `no test specified`.

## ما وجدته في منطق الإشراف

### 1. دورة الرسائل والإشراف التلقائي

`handleMessage()` يستخرج النص من الرسائل النصية، extended text، captions للصورة/الفيديو/المستند/الصوت، ويتجاهل الرسائل الذاتية. في المجموعة يسجل مفاتيح الرسائل في buffer محدود بـ 100 رسالة تقريبًا. إذا كان المستخدم muted يحذف الرسالة، يضيف warning باسم `muted`، ثم يشغل العقوبة التلقائية عند بلوغ الحد. بعد ذلك يفحص anti-spam (5 رسائل خلال 5 ثوانٍ، mute افتراضي 5 دقائق)، ثم الأوامر المخصصة، ثم أوامر الإدارة، ثم فحص الكلمات المسيئة.

لا يعمل الفحص التلقائي إلا إذا كان البوت admin في المجموعة. `isBotAdmin()` يجلب metadata مع cache لمدة 60 ثانية ويدعم معرف bot الرقمي وLID جزئيًا. إذا لم يكن البوت admin يرسل تنبيهًا دوريًا يطلب ترقيته.

### 2. الكلمات المسيئة

`badwords.js` يحتوي Set كبيرًا متعدد اللغات (README يعلن 20+ لغة)، مع:

- إزالة diacritics وتطبيع حروف مثل `ß/æ/œ/ø/đ/ł`.
- تطبيع leet-speak (`0..9`, `@`, `!`, `$` وغيرها).
- إزالة zero-width characters.
- token matching للكلمة الكاملة.
- كشف إخفاء الكلمة في بداية/نهاية token.
- كشف العبارات المركبة بعد compacting.

هناك قوائم per-group في `custom_words.json` عبر `?addword` و`?removeword`. `checkCustomWords()` يستخدم token equality وcompact substring. هذه خوارزمية قابلة لإعادة الكتابة، لكن قائمة الكلمات نفسها يجب مراجعتها لغويًا وسياساتيًا، خصوصًا slurs والكلمات القصيرة ذات الإيجابيات الكاذبة مثل `ass`, `con`, `er`, `cu`, `mal`.

### 3. التحذيرات والعقوبات

التحذير مخزن لكل `(groupJid,userJid)` كمصفوفة entries `{reason, by, time}` في `warnings.json`. الحد الافتراضي 3، وقابل للتغيير لكل مجموعة عبر `?set-warnlimit`. عند بلوغ الحد توجد عقوبات `ban` أو `kick` أو `mute`، قابلة للضبط عبر `?set-warnpunish`; الـ mute له مدة في milliseconds.

الرسائل المخالفة تحذف، يرسل DM تحذير، ويسجل warning باسم `bot`. أمر `?warn @user [reason]` يرسل DM ويسجل من نفذ التحذير، و`?warnings @user` يعرض التاريخ. عند kick/ban تُمسح تحذيرات المستخدم بعد نجاح الإزالة؛ وعند auto-mute تُمسح بعد تطبيق العقوبة. لا توجد سياسة انتهاء أو تقادم للتحذيرات غير هذا المسح.

### 4. mute وanti-spam

`mutes.json` يضم expiry timestamps لكل مجموعة ومستخدم. `isMuted()` يحذف الـ mute المنتهي أثناء فحص الرسالة، و`checkExpiredMutes()` يعمل دوريًا ويرسل DM ورسالة للمجموعة عند الانتهاء. `parseDuration()` يقبل `s/m/d`، ولا يفرض حدًا أعلى للمدة. anti-spam يحتفظ بمصفوفة timestamps في الذاكرة فقط، لذلك لا يستمر عبر restart، ولا يوجد تنظيف دوري صريح لكل users/groups غير إضافة timestamps الجديدة.

### 5. الحظر وإنفاذه

`banned.json` يخزن Set للمستخدمين لكل مجموعة. `?ban` يزيل المستخدم، يضيفه إلى القائمة، ويحاول تفعيل `groupJoinApprovalMode`. عند `group-participants.update` action `add` يزيل أي banned user أُعيدت إضافته. وعند `group.join-request` يرفض طلب الانضمام للمحظور. `?unban` يزيله من القائمة.

هذا ليس ban عالميًا؛ هو deny-list لكل مجموعة ويتطلب صلاحيات Baileys/WhatsApp. المقارنة في أحداث الإضافة/الانضمام تستخدم JID الخام، ولا تطبق دائمًا `jidNormalizedUser`، ما قد يفشل مع اختلافات LID/التنسيق.

### 6. الاستثناءات الإدارية

يوجد `ignored.json` و`?ignore @user`/`?unignore @user`. إذا كان المستخدم ignored يتجاوز **فحص الكلمات المسيئة فقط**، لكنه لا يتجاوز mute أو anti-spam أو الأوامر. الاستثناء per-group ويخزن Set.

لكن لا يوجد في المسار العادي استثناء مدمج لكل مشرف/مالك قبل فحص profanity. الاستثناءات المطبقة فعليًا في `handleAdminCommand()` هي bot نفسه ومالك المجموعة فقط (`cantSelf`, `cantOwner`). لذلك لا ينبغي تفسير المشروع على أنه يملك admin exemption كاملة.

### 7. إعدادات المجموعة

`settings.json` يخزن `warnLimit`, `warnPunish`, `warnPunishDuration`, `antiSpam`, `welcome`, و`goodbye`. توجد أوامر `?settings`, `?set-antispam`, `?set-welcome`, `?set-goodbye`, `?set-lang`, و`?set-warnpunish`. الترجمات في `lang.js` تدعم `en`, `cs`, `es`, `de`, `fr`, `pt`, `ru`, `id` مع fallback للإنجليزية.

أحداث أعضاء المجموعة ترسل welcome عند الإضافة وgoodbye عند الإزالة، مع placeholder `{user}` وmentions. الـ goodbye يستثني حالة أن `author === participant` فقط، وهي دلالة تقريبية وليست policy موثقة كافية.

### 8. custom commands ومخاطرها

يوجد `custom_commands.json` ودعم خطوات `reply`, `webfetch`, و`command` مع قوالب `{user}`, `{mention}`, `{args}`, `{result}` وحقول JSON الناتجة من webfetch. هذه الميزة ليست ضمن هدف FLONA الأساسي ويجب عدم نقلها.

`webfetch` يجلب URL يحدده إعداد المجموعة مع timeout 10 ثوانٍ ويعيد حتى 4000 حرف. هذا يفتح SSRF/استنزاف/تسريب metadata إذا وصل الإعداد إلى مستخدم غير موثوق. كذلك أوامر الإدارة المضمنة في custom commands ليست sandbox حقيقية.

## عيوب ومخاطر مؤكدة في المصدر

1. **ثغرة صلاحيات حرجة:** بعد التأكد أن البوت admin، يستدعي `runAdminCommand()` من `handleMessage()` من دون فحص `isSenderAdmin()`. لذلك يمكن لعضو عادي إرسال `?ban`, `?kick`, `?mute`, `?ignore`, `?import` وغيرها. helper `isSenderAdmin()` موجود لكنه يستخدم فقط في custom commands عند `adminOnly`. هذا يجب إصلاحه قبل الاستفادة من أي تصميم.
2. `?import` يقبل Base64 JSON ويستبدل إعدادات المجموعة وقائمة الحظر والاستثناءات والأوامر المخصصة، ومع غياب فحص مرسل الإدارة يصبح مسار تصعيد مباشر. حتى بعد إضافة auth يجب whitelist للحقول، validation للأنواع والمدد، وسجل تدقيق.
3. `?set-warnpunish mute` قد يحصل على مدة غير صالحة من `parseDuration()` ثم يخزن قيمة null ويستخدم `formatDuration()`؛ يجب التحقق من null وحدود duration.
4. الحظر/الانضمام يقارن JIDs غير مطبّعة في بعض المسارات، ما يسبب bypass محتملًا عند اختلاف LID/phone JID.
5. الكتابة المتزامنة المباشرة بـ `writeFileSync` بلا atomic rename أو lock قد تفقد البيانات مع تداخل handlers أو توقف العملية أثناء الكتابة. لا يوجد schema migration/versioning.
6. anti-spam و`groupStats` وadmin caches في الذاكرة، بينما بعض الإعدادات الأخرى persistent؛ سلوك restart غير متجانس.
7. الإرسال إلى DM مفترض؛ فشل DM يُبتلع غالبًا، وقد لا يصل التحذير إلى المستخدم، مع استمرار العقوبة.
8. تنفيذ عمليات remove/send/delete متسلسل وغير idempotent؛ retry أو أحداث Baileys المكررة قد تضاعف التحذيرات أو الرسائل.
9. لا توجد اختبارات unit/integration أو fixtures لأحداث Baileys، ولا تحقق من صحة حالات participant/admin.
10. قائمة الكلمات الواسعة، الكلمات القصيرة، وsubstring matching قد تنتج false positives، ولا توجد مراجعة/allowlist أو سياسة للغات FLONA.
11. المشروع يحتوي اتصالًا وجلسة QR عبر `useMultiFileAuthState`, `auth/`, reconnect و`qrcode-terminal`. هذه أجزاء تشغيلية لا ينبغي نقلها إلى FLONA، الذي يملك lifecycle واتصالًا قائمًا.
12. `fetch()` و`AbortController` متاحان في Node 22، لكن ميزة webfetch نفسها لا ينبغي إدخالها في moderation plugin دون allowlist شبكية واضحة.
13. `pino@10.3.1` و`pino-pretty` خاصان بتشغيل المشروع الأصلي؛ FLONA يستخدم بنية logging مختلفة، و`qrcode-terminal` غير مطلوب إطلاقًا للمنطق.
14. الملف الواحد `index.js` يسجل listeners ويهيئ state عند import/startup، ولذلك لا يصلح نسخه إلى نظام plugins؛ يلزم استخراج pure services وhooks فقط.

## خطة تكييف آمنة مع FLONA (Node 22، ESM، lowdb، plugins)

1. **لا تنقل `index.js` أو `connect()` أو `useMultiFileAuthState()` أو `auth/` أو QR أو reconnect.** استخدم message lifecycle والـ `conn` الموجودين في FLONA (`handler.js`/`src`) فقط.
2. اكتب plugin ESM صغيرًا في صيغة FLONA الحالية (`export default handler`) يستقبل الرسالة المطبوعة `m`، ويتحقق من `m.isGroup`, `m.sender`, `m.chat`, `m.mentionedJid` ومن صلاحيات الإدارة عبر helper مركزي موجود/مضاف مرة واحدة.
3. افصل المنطق النقي إلى module مثل `lib/moderation-policy.js`: `normalizeText`, `checkBadWords`, `get/setWarning`, `isExempt`, `isMuted`, `shouldPunish`, `parseDuration`. لا تجعل هذا module يستورد Baileys أو يرسل رسائل.
4. استخدم `global.db.data.chats[groupJid]` أو schema lowdb الحالي لتخزين إعدادات المجموعة، التحذيرات، الاستثناءات، mutes، وقائمة الحظر. لا تنشئ ملفات JSON متنافسة. أضف schema version/defaults وmigration واحدة، وفعّل الحفظ بالطريقة التي يستخدمها FLONA بدل `writeFileSync`.
5. اقترح schema محدودًا ومُتحققًا منه: `moderation.enabled`, `warnLimit`, `warnPunish`, `warnPunishDuration`, `antiSpam`, `welcome`, `goodbye`, `exemptJids`, `customWords`, `bannedJids`, `warningsByUser`, `muteUntilByUser`, `updatedAt`. لا تخزن auth/session فيه.
6. ضع **authorization قبل أي تعديل أو حذف أو إعداد**: `isGroupAdmin(sender, metadata)`، ثم استثناء مالك/مشرفي المجموعة من profanity حسب policy صريحة. لا تعتمد على prefix وحده. امنع target bot، المالك، وكل admin/owner وفق policy FLONA، وطبّع JIDs بالمساعد المركزي.
7. ابدأ بنطاق محدود قابل للاختبار: profanity + custom words + warnings + configurable punishment + admin exemptions. أضف mute/ban enforcement وwelcome كمرحلة ثانية بعد اختبار أحداث `group-participants.update` وjoin-request في Baileys المستخدم فعليًا لدى FLONA.
8. عند حذف الرسالة استخدم helper FLONA الموجود للتعامل مع quoted key وحقوق البوت، وسجّل نتيجة العملية. لا تستخدم اتصالًا جديدًا أو socket جديدًا.
9. اجعل anti-spam bounded وTTL-based مع تنظيف دوري/حدود ذاكرة، وقرّر صراحة هل يستمر عبر restart. لا تسجل كل رسالة إلى DB؛ احتفظ timestamps قصيرة في الذاكرة مع حفظ mute النهائي فقط.
10. أضف rate limits وaudit log للأوامر الإدارية، ورسائل فشل آمنة. DM تحذير اختياري لا يجب أن يفشل العملية كلها.
11. انقل فقط خوارزمية التطبيع بعد مراجعة القائمة. أضف اختبارات Node 22 لكل من leet/diacritics/compound/false-positive، واختبارات authorization وJID normalization وmigration وexpiry.
12. أعد استخدام i18n/أسلوب رسائل FLONA بدل `lang.js` ذي 68KB. لا تنقل الترجمات الثماني كاملة ما لم يطلب المنتج ذلك.
13. لا تنقل custom commands/webfetch/export/import. إذا احتاج FLONA إعدادًا، يكون عبر config/admin plugin موثوق مع validation؛ لا تقبل Base64 يغير bans أو plugins من الرسائل.
14. احتفظ بإشعار MIT في `THIRD-PARTY-NOTICES` فقط إذا نُقلت أجزاء substantial حرفيًا؛ التوصية العملية هي إعادة كتابة السلوك مع توثيق المصدر والاقتباس، وعدم نسخ `badwords.js` كما هو دون مراجعة حقوق/سياسة المحتوى.

## ما لا ينبغي نقله كتبعيات

- `@whiskeysockets/baileys@7.0.0-rc14`: FLONA يملك Baileys fork/نسخة تشغيلية (`github:Loydsumer/baileys-speed`)؛ لا تستبدلها بتبعية المستودع.
- `@hapi/boom`: لا حاجة لها في policy/plugin؛ استخدم error helpers الموجودة في FLONA.
- `pino`, `pino-pretty`: استخدم logger الحالي في FLONA.
- `qrcode-terminal`: جزء pairing فقط، ممنوع ضمن هدف إعادة الكتابة.
- كل التبعيات غير المباشرة الخاصة بـ Baileys (`libsignal`, `protobufjs`, `whatsapp-rust-bridge`, `ws`, `music-metadata`, `sharp` وغيرها): لا تضفها بسبب هذا البحث.
- لا توجد حاجة لإضافة `lowdb` من wa-bot؛ استخدم lowdb الموجود لدى FLONA، ولا تخلط data files.

## القرار

**قابل للتنفيذ جزئيًا (feasible = true كبحث/إعادة كتابة)، غير قابل للدمج المباشر.** القيمة العملية هي تصميم state machine للإشراف، خوارزمية التطبيع، نموذج warning/mute/ban per-group، وأحداث enforcement. يلزم إعادة كتابة ESM plugin/service مع تخزين lowdb وصلاحيات FLONA واختبارات قبل الإنتاج. لا يجوز نسخ المشروع أو تشغيل اتصاله أو جلساته، ولا يجوز نقل custom commands/webfetch أو منطق الأوامر قبل إصلاح ثغرة authorization والتحقق من JID وschema.

## خلاصة الملفات والميزات ذات الصلة

المرجع الأساسي لكل السلوك هو `index.js` (السطور التقريبية 69–426 للحالة والتخزين والعقوبات، 487–530 لأحداث المجموعة والانضمام، 600–667 لدورة الرسالة، 670–950 للأوامر الإدارية والإعدادات، 986–1059 للأوامر المخصصة). `badwords.js` (397–457) هو مرجع التطبيع والفحص. `README.md` (5–15، 37–69) و`docs/index.html` يثبتان الميزات المعلنة، لكن التقرير يعتمد على التنفيذ الفعلي لا الإعلان فقط.
