# بحث تصميم دورة الموافقة في `w-agent`

## 1. النطاق والنتيجة التنفيذية

تم فحص مستودع واحد فقط كما طُلب:

- المستودع: [Chessing234/w-agent](https://github.com/Chessing234/w-agent)
- النسخة المفحوصة: الفرع `main`، commit `a47738f` (آخر commit وقت الفحص)، والوسم `v0.1.0` عند `59f40b9`.
- تاريخ آخر سجل ظاهر في المستودع: 2026-07-24.
- مسار النسخة المستنسخة: `/home/ubuntu/work/flona/research-src/approval-design`
- حالة الاستنساخ: نجح `git clone`، والنسخة نظيفة (`main...origin/main`).
- لم تُنسخ ملفات اتصال WhatsApp أو ملفات جلسة إلى FLONA، ولم يُعدّل محتوى `/home/ubuntu/work/flona/repo` خارج إنشاء هذا التقرير.

الخلاصة: لدى `w-agent` تصميم واضح ومفيد لإعادة الكتابة كمفهوم **approval outbox**: تُنشأ المسودة أولاً، تُحفظ بحالة `pending`، يُخطر المالك، ثم يقرر المالك `approve` أو `reject` أو يعدّل النص قبل الموافقة. عامل إرسال منفصل يرسل فقط السجلات `approved`، ويترك السجل معلقاً عند quiet hours أو rate limit. هذا قابل للتكييف مع FLONA، لكن لا ينبغي نسخ طبقة Postgres/BullMQ/Next.js أو Baileys. كذلك لا ينبغي وصف التصميم الحالي بأنه idempotent بالكامل: idempotency موثق ومختبر بوضوح لرسائل الإدخال، أما outbox فله انتقالات شرطية تمنع الموافقة/الرفض المزدوجين، لكنه لا يملك مفتاح idempotency أو lease/claim يضمن عدم التكرار عند تعطل العملية بعد الإرسال وقبل تحديث التخزين.

## 2. الترخيص والإصدارات

### الترخيص

- `LICENSE`: MIT License، Copyright (c) 2026 W Agent contributors.
- `package.json` يعلن `"license": "MIT"`، وREADME يعرض MIT.
- MIT يسمح بإعادة الاستخدام والتعديل والدمج في FLONA، بشرط إبقاء إشعار حقوق النشر ونص الترخيص في النسخ أو الأجزاء الجوهرية المنقولة.
- التوصية العملية: لا تنقل الملفات حرفياً. أعد كتابة السلوك، واحتفظ في سجل FLONA/ملف NOTICE بإسناد تصميمي مختصر إلى `Chessing234/w-agent` ونسخة `v0.1.0`، مع نص MIT إذا نُقل أي جزء جوهري من الشيفرة.

### تعريف المشروع وسلسلة الأدوات

من `package.json` و`pnpm-lock.yaml`:

- `name`: `w-agent`
- `version`: `0.1.0`
- ESM: `"type": "module"`
- Node: `>=22`
- package manager: `pnpm@9.15.0`
- TypeScript: `5.8.3`
- Vitest: `4.1.10`
- Pino: `10.3.1` و`pino-pretty`: `13.1.3`
- Postgres client: `pg@8.22.0`
- Redis/BullMQ: `ioredis@5.11.1` و`bullmq@5.81.1`
- Zod: `3.25.76`
- Baileys: `@whiskeysockets/baileys@7.0.0-rc13`
- OpenAI: `openai@6.49.0`
- MCP: `@modelcontextprotocol/sdk@1.29.0`
- اختبارات الحاويات: `@testcontainers/postgresql@12.0.4` و`testcontainers@12.0.4`
- Migration tooling: `node-pg-migrate@9.0.0`
- Dashboard منفصل: Next `16.2.11`، React/React DOM `19.1.0`، Zod `4.4.3`.

هذه أرقام النسخة المفحوصة، وليست توصية بإضافتها إلى FLONA.

## 3. الملفات الفعلية التي فُحصت

### ملفات التعريف والتاريخ

- `/home/ubuntu/work/flona/research-src/approval-design/README.md`
- `/home/ubuntu/work/flona/research-src/approval-design/LICENSE`
- `/home/ubuntu/work/flona/research-src/approval-design/package.json`
- `/home/ubuntu/work/flona/research-src/approval-design/pnpm-lock.yaml`
- `/home/ubuntu/work/flona/research-src/approval-design/CHANGELOG.md`
- `/home/ubuntu/work/flona/research-src/approval-design/docs/architecture.md`
- `/home/ubuntu/work/flona/research-src/approval-design/docs/security.md`
- سجل Git والوسم `v0.1.0` وملخص release commit.

### التخزين ودورة الإرسال

- `src/storage/outbox.ts`
- `src/agent/outbound.ts`
- `src/queue/outbox-sender.ts`
- `src/logger.ts`
- `migrations/1753370400000_init-schema.sql`

### واجهة المالك

- `dashboard/src/app/api/approvals/route.ts`
- `dashboard/src/app/api/approvals/[id]/route.ts`
- `dashboard/src/app/approvals/page.tsx`

### الاختبارات

- `tests/storage.test.ts`
- `tests/outbound.test.ts`
- `tests/lifecycle.test.ts`
- `tests/chaos-recovery.test.ts`

### فحص توافق FLONA (قراءة فقط)

- `/home/ubuntu/work/flona/repo/package.json`
- `/home/ubuntu/work/flona/repo/index.js`، وموضع تهيئة `Low`/`JSONFile`
- `/home/ubuntu/work/flona/repo/lib/plugins.js`
- `/home/ubuntu/work/flona/repo/handler.js`، مسار تنفيذ plugins
- `/home/ubuntu/work/flona/repo/src/index.js`، الذي يطابق نسخة/نمط التشغيل الحالي وتهيئة lowdb
- حالة Git قبل إنشاء التقرير: فرع `manus/rare-features-integration`، وكان مجلد `flona-research/` غير متتبع ويحتوي تقارير سابقة؛ لم تُعدل الملفات الأخرى.

## 4. ما وجدته: نموذج البيانات ودورة الحالة

### جدول outbox

في `migrations/1753370400000_init-schema.sql` يوجد جدول `outbox` بهذه الفكرة:

- `id UUID PRIMARY KEY`
- `chat_id` مرجع إلى `chats`
- `body TEXT NOT NULL`
- `status` افتراضياً `pending`
- `requires_approval BOOLEAN NOT NULL DEFAULT TRUE`
- `created_at` و`sent_at`
- قيد الحالات: `pending`, `approved`, `sent`, `rejected`, `failed`, `cancelled`
- فهرس `(status, created_at)` لتصفية قائمة الانتظار بالترتيب.

`src/storage/outbox.ts` يعرّف نفس الحالات ويقدم:

- `draftReply`: ينظف النص (`trim`)، يرفض النص الفارغ، يتأكد من وجود chat، ثم يدرج مسودة ولا يرسلها.
- `listOutbox`: يجلب الحالات مع حد بين 1 و200 ويرتب الأقدم أولاً.
- `getOutboxItem`: جلب مسودة واحدة.
- `updateOutboxBody`: لا يسمح بالتعديل إلا عندما تكون الحالة `pending`، ويرفض النص الفارغ.
- `approveOutbox`: انتقال ذري مشروط من `pending` إلى `approved`.
- `rejectOutbox`: انتقال ذري مشروط من `pending` إلى `rejected`.
- `setOutboxStatus`: تحديث شرطي `WHERE status = ANY(...)`، ويضع `sent_at` عند حالة `sent`.
- `sendReply`: لا يرسل فورياً؛ يرجع نتيجة gated ويطلب استخدام `draft_reply`.

الانتقالات المقصودة:

```text
إنشاء:          -> pending
التعديل:        pending -> pending (تغيير body)
الموافقة:       pending -> approved
الرفض:          pending -> rejected
الإرسال:        approved -> sent
فشل الإرسال:    approved -> failed
إلغاء محتمل:    pending/approved/failed -> cancelled (حسب المستدعي)
rate limit:     approved -> approved (تأجيل، لا تغيير)
```

نقطة مهمة: الانتقال الشرطي يعالج سباقاً بسيطاً؛ طلبان متزامنان للموافقة لن يعيدا صفاً قابلاً للتحديث بعد نجاح الأول. لكنه ليس سجلاً تدقيقياً ولا يعبّر عن actor أو revision أو سبب التغيير.

## 5. الإشعار والمالك

`src/agent/outbound.ts` يقدم `draftReplyAndNotify`:

1. يقرأ تفضيل المحادثة `autoSend`.
2. في الوضع العادي يفرض `requiresApproval: true` و`status: pending`، بصرف النظر عن العلم الذي يرسله المستدعي.
3. ينشئ outbox قبل محاولة الإخطار؛ لذلك فشل الإخطار لا يفقد المسودة.
4. يبني رسالة `Draft for <chat>\n<body>\n\nid: <outboxId>`.
5. يحدد JID المالك من `OWNER_NOTIFY_JID` أو `provider.getSelfJid()`.
6. إذا لم يوجد JID، يسجل warning ويعيد `notified: false` مع بقاء المسودة `pending`.
7. إذا فشل `sendText`، يسجل error ويعيد `notified: false` مع بقاء المسودة.
8. عند النجاح يعيد `notified: true` و`notificationMessageId`.
9. auto-send يبدأ بحالة `approved` ولا يرسل إشعار موافقة؛ عامل الإرسال سيتولى الإرسال.

هذا ترتيب جيد لخاصية **interruption tolerance** في مرحلة الإشعار: الحفظ يسبق الشبكة، وفشل الشبكة قابل للاسترداد يدوياً من لوحة الموافقات. لكنه قد ينتج إشعارات مكررة إذا أعيد استدعاء pipeline بعد timeout غير معلوم النتيجة؛ لا يوجد notification idempotency key أو جدول محاولات في المصدر.

## 6. approve / reject / edit في لوحة التحكم

- `dashboard/src/app/api/approvals/route.ts`: يعرض فقط `pending`، حتى 100 سجل، بالترتيب الزمني.
- `dashboard/src/app/api/approvals/[id]/route.ts`: يقبل `PATCH` مع `action` من `approve`, `reject`, `edit`.
- `edit` يتطلب نصاً غير فارغاً ويحدّث فقط صفاً `pending`.
- `approve` و`reject` يحدّثان فقط صفاً `pending`.
- عند عدم وجود الصف أو تغير الحالة يعاد `404 not_found_or_not_pending`؛ لذلك الطلب المكرر لا يعيد نجاحاً مضللاً.
- `dashboard/src/app/approvals/page.tsx`: تحديث دوري كل 5 ثوانٍ، textarea لكل مسودة، وأزرار Approve/Save edit/Reject مع منع التكرار أثناء الطلب لنفس السجل.

ما لم أجده في هذا المسار: optimistic concurrency (`version`/ETag)، actor identity، CSRF token ظاهر في route نفسه، audit history، سبب الرفض، أو endpoint يعيد نتيجة idempotent لطلب سبق تنفيذه. قد توجد حماية عامة في middleware، لكنها ليست جزءاً من منطق lifecycle الذي فُحص هنا ولا ينبغي افتراضها عند إعادة الكتابة.

## 7. عامل الإرسال، المقاطعة، والفشل

`src/queue/outbox-sender.ts` هو poller داخل العملية وليس BullMQ worker:

- يستطلع `approved` كل 2000ms افتراضياً وبحد 20.
- متغير `running` يمنع تداخل tick داخل نفس process.
- يمرر الرسائل إلى rate limiter: quotas، quiet hours، typing delay، cooldown.
- عند منع الإرسال يترك الحالة `approved` لتعاد المحاولة في tick لاحق.
- عند نجاح `provider.sendText` يحدّث `approved -> sent` ثم يسجل الإرسال.
- عند WhatsApp rate limit يترك الحالة `approved` ويوقف بقية الجولة مؤقتاً.
- عند خطأ آخر يحدّث `approved -> failed` ويسجل error.
- `timer.unref()` و`stop()` يسمحان بإيقاف poller نظيفاً.

### حدود السلامة الفعلية

- يمنع `running` التداخل المحلي فقط؛ لا يمنع duplicate workers/processes.
- توجد نافذة خطرة بين نجاح `sendText` وفشل/انقطاع قبل `setOutboxStatus(..., sent)`. بعد إعادة التشغيل قد يعاد إرسال نفس النص.
- توجد نافذة معاكسة: قد يتغير السجل بعد أن جلبه poller وقبل الإرسال؛ لا يوجد claim/lease أو `SELECT ... FOR UPDATE SKIP LOCKED`.
- لا يوجد correlation/audit event لكل انتقال، ولا attempt number أو last error في نموذج outbox.
- اختبار `chaos-recovery.test.ts` يختبر تعافي Postgres/Redis وwatchdog، لكنه لا يختبر crash تحديداً بين provider send وتسجيل `sent`، ولا duplicate send.

لذلك يُعاد استخدام الفكرة (approved queue + retry policy) لا الادعاء بأنها exactly-once.

## 8. idempotency: الموجود والمفقود

### الموجود

- اختبار `tests/storage.test.ts` يثبت idempotency لرسائل inbound بواسطة `waMessageId`: الإدخال الثاني يعيد نفس message id ولا ينشئ رسالة جديدة.
- انتقالات outbox تستخدم تحديثاً شرطياً بالحالة؛ approve/reject/edit بعد انتقال ناجح لا يطبّق تغييراً ثانياً.
- `outbox-sender` يمنع tick متزامناً في العملية نفسها.

### المفقود في lifecycle المطلوب

- لا يوجد `idempotency_key` لمسودة منشأة من نفس event/plugin invocation.
- لا يوجد unique constraint يمنع إنشاء مسودتين عند retry للمستدعي.
- لا يوجد idempotency key للإشعار إلى المالك.
- لا يوجد claim/lease أو lock موزع لعامل الإرسال.
- لا يوجد outbox attempt record أو provider message key مربوط بالمسودة.
- لا توجد version/revision في edit/approve/reject.

## 9. السجلات والمراقبة

`src/logger.ts` ينشئ Pino ويستخدم child loggers. المسارات المفحوصة تسجل structured fields مثل `outboxId`, `chatJid`, `ownerNotifyJid`, `notificationMessageId`, `cooldownMs`, و`err`، مع رسائل مميزة:

- `Draft auto-approved (chat auto-send enabled)`
- `Draft staged but owner notify JID unavailable — skipping WhatsApp notification`
- `Notified owner of staged draft`
- `Failed to notify owner of staged draft`
- `Deferring auto-send (rate limit / quiet hours)`
- `WhatsApp rate-limit on auto-send; cooling down (draft stays approved)`
- `Outbox draft sent`
- `Failed to send approved outbox draft`
- `Outbox sender tick failed`

هذا جيد للتشخيص التشغيلي، لكن لا يوجد audit log دائم يجيب: من وافق؟ متى؟ من عدّل النص؟ ما النص السابق؟ لماذا رُفض؟ كم محاولة إرسال؟ لذلك يجب إضافة audit trail في FLONA بدلاً من اعتبار log النصي سجلاً قانونياً أو تشغيلياً كافياً.

## 10. خطة تكييف آمنة مع FLONA

### قرار معماري

أعد كتابة lifecycle كخدمة صغيرة مستقلة عن WhatsApp داخل إضافة أو module داخلي، ولا تنقل provider/session code. اقترح واجهات مفهومية:

```text
createDraft(input, idempotencyKey)
listPendingApprovals()
editDraft(id, newBody, expectedRevision, actor)
approveDraft(id, expectedRevision, actor)
rejectDraft(id, expectedRevision, reason, actor)
runApprovalSenderOnce()
recordApprovalEvent(event)
```

الـ plugin يكون thin adapter فقط: يستقبل أمر المالك ويستدعي service؛ لا يضع منطق الانتقالات داخل handler ولا يكتب إلى JSON مباشرة من أكثر من موضع.

### ملاءمة Node 22 وESM

- FLONA معلن حالياً `type: module` وNode `>=20`؛ ارفع شرط التشغيل إلى Node 22 في خطة FLONA قبل اعتماد الكود، واستخدم ESM imports مع امتدادات `.js` في الملفات الناتجة/المكتوبة بصيغة ESM.
- استخدم `crypto.randomUUID()` لمعرفات المسودات/الأحداث، و`AbortController`/timeouts عند عمليات الشبكة.
- تجنب نسخ TypeScript أو Next.js فقط لأن المرجع يستخدمهما؛ lifecycle بسيط ويمكن كتابته JavaScript ESM مطابقاً لأسلوب FLONA الحالي، مع اختبارات `node --test`.
- لا تستورد أي نوع أو module من Baileys داخل service؛ مرّر adapter مثل `sendText(jid, text, options)`.

### ملاءمة lowdb 3.0.0

FLONA يستخدم `lowdb@^3.0.0` و`Low` مع `JSONFile`، ويقوم بكتابة دورية كل 60 ثانية في `index.js`. هذا ليس transaction store مناسباً وحده لدورة موافقة حساسة إذا ظلت كل transitions مجرد تعديل للكائن ثم write دوري.

التوصية الآمنة، بالترتيب:

1. أضف namespace منفصلاً، مثلاً `global.db.data.approvals` و`global.db.data.approvalEvents`، ولا تخلط المسودات مع `users/chats/settings`.
2. لا تنتظر الكتابة الدورية للموافقة/الرفض/الإرسال؛ نفّذ `await db.write()` بعد كل transition ناجح.
3. ضع mutex داخل العملية حول read-modify-write، وامنع plugins من تعديل namespace مباشرة.
4. قبل كل transition، تحقق من `status` و`revision` و`expectedRevision`، ثم زد revision؛ بذلك يصبح approve/edit/reject المتزامن fail-closed.
5. أضف `idempotencyKey` فريداً لكل draft event، وابحث عنه قبل الإنشاء؛ خزّن result/id في سجل أو index قابل للبحث.
6. استخدم كتابة ذرية للملف (temp + rename) أو wrapper موثوق حول lowdb إذا كانت نسخة FLONA الحالية لا تضمن atomic write. افحص مسار backup/restore حتى لا تُفقد approvals.
7. إذا شُغلت أكثر من عملية FLONA أو أكثر من bot connection تكتب نفس database.json، لا تعتمد على lowdb كـ lock موزع؛ إمّا process واحد كشرط تشغيل، أو انقل approval state إلى SQLite/DB بعمليات ذرية قبل الإنتاج متعدد العمليات.
8. لا تُدخل نص المسودة الكامل في logs؛ سجّل hash/length عند الحاجة، والنص في التخزين المحمي فقط.

### نموذج سجل مقترح لـ FLONA

```js
approvals: {
  [id]: {
    id, chatJid, body, status: 'pending',
    createdAt, updatedAt, sentAt: null,
    revision: 1,
    requiresApproval: true,
    idempotencyKey,
    notification: { status: 'pending|sent|failed|skipped', messageId, attempts, lastError },
    send: { attempts: 0, lastError: null, providerMessageId: null }
  }
}
approvalEvents: [
  { eventId, approvalId, type, actorJid, at, fromStatus, toStatus, revision, bodyHash, reason }
]
```

`bodyHash` يفيد لإثبات أن النص الذي وافق عليه المالك هو النص الذي أرسل، دون تكرار نص حساس في السجلات. عند edit يجب إنشاء revision جديد وتسجيل hash القديم والجديد؛ approve يجب أن يقبل revision متوقعاً.

### الإشعار والتكامل مع plugins

- أضف module مثل `lib/approval-service.js` أو `lib/approvals/store.js`، وليس plugin الذي يحمل state في الذاكرة.
- أضف plugin owner-only لأوامر مثل `!approvals`, `!approve <id>`, `!reject <id>`, `!edit <id> <text>`، مع فحص `isOwner` الموجود في handler، لكن اجعل service يعيد التحقق من actor أيضاً.
- يفضل owner self-chat أو قناة مالك محددة؛ لا ترسل إشعار المسودة إلى chat الهدف.
- يمكن استخدام plugin `before`/handler الحالي للتوجيه، لكن يجب ألا يؤدي reload في `lib/plugins.js` إلى فقدان approval state؛ state في lowdb لا في module globals.
- أضف notification debounce/idempotency بحيث لا يرسل retry نفس الإشعار بلا داعٍ، مع إبقاء pending draft قابلاً للوصول إذا كانت WhatsApp غير متاحة.
- راعِ أن handler الحالي يعالج أول command مطابق ويستخدم `global.plugins`; لا تضف approval plugin بأسماء أو prefixes تصطدم مع plugins موجودة، واستخدم owner-only metadata.

### عامل الإرسال في FLONA

ابدأ بـ `runApprovalSenderOnce()` يستدعى من timer واحد في process، مع:

- اختيار `approved` فقط.
- claim ذري من `approved` إلى `sending` مع `leaseUntil` و`workerId`، أو على الأقل mutex + `sending`/timeout إذا بقيت lowdb.
- بعد `sendText` سجّل provider message id ثم `sent`.
- عند خطأ rate limit: أعد إلى `approved` مع `nextAttemptAt`.
- عند خطأ دائم: `failed` مع `lastError` و`attempts`، دون إسقاط المسودة.
- عند timeout/تعطل: عامل recovery يعيد `sending` المنتهية lease إلى `approved`، مع التحذير من أن ذلك يوفر at-least-once لا exactly-once.
- إن كان provider يدعم client message id أو dedupe key، اربطه بـ `approval.id`; وإلا لا يمكن منع duplicate على مستوى WhatsApp بشكل مضمون.

## 11. التبعيات التي لا ينبغي نقلها إلى FLONA

لا تنقل هذه التبعيات لمجرد اعتماد منطق الموافقة:

- `@whiskeysockets/baileys`: اتصال WhatsApp وإدارة النقل؛ FLONA لديه اتصال Baileys خاص به، والطلب صراحةً يستبعد نسخ الاتصال والجلسة.
- `pg`, `node-pg-migrate`, `@testcontainers/postgresql`: طبقة Postgres ومخطط migrations المرجعي؛ لا تناسب lowdb مباشرة.
- `bullmq`, `ioredis`: queues/Redis؛ approval sender المرجعي poller ويمكن إعادة كتابته فوق timer/queue FLONA، ولا حاجة لإضافة Redis.
- `next`, `react`, `react-dom`, `qrcode`: لوحة dashboard مستقلة؛ FLONA يمكنه استعمال owner plugins أو واجهة منفصلة لاحقاً.
- `@modelcontextprotocol/sdk`: MCP surface غير مطلوب لهذا lifecycle.
- `openai`: model/embedding dependency، لا علاقة لها بإدارة حالات الموافقة.
- `zod`: مفيد اختيارياً للتحقق من payloads، لكن لا تنقل نسخة المرجع تلقائياً؛ إن كان FLONA يستخدم Zod فوحّد النسخة، وإلا استخدم validation محلياً بسيطاً.
- `pino@10` و`pino-pretty`: FLONA لديه `pino@8.16.2`؛ لا ترفع النسخة فقط بسبب reference. اجعل logger adapter يطابق API الحالي.
- `tsx`, TypeScript, ESLint/Prettier, Vitest: أدوات تطوير المرجع وليست runtime requirement لـ plugin JavaScript الحالي.
- rate-limit/config وprovider types من المرجع: أعد صياغة قواعد FLONA الحالية بدلاً من نسخ إعدادات quiet hours أو Baileys-specific behavior.

الإضافة الوحيدة المحتملة هي عدم إضافة أي dependency جديدة إذا أمكن: `crypto.randomUUID`, `fs`, وlowdb الموجود كافية للنموذج الأولي أحادي العملية. إذا أضيفت مكتبة lock أو SQLite فيجب تبريرها باحتياج تعدد العمليات والنسخ الاحتياطي.

## 12. الاختبارات المطلوبة قبل الدمج

اكتب اختبارات FLONA على الأقل للآتي:

1. إنشاء draft ينظف body ويرفض الفارغ.
2. idempotency: نفس `idempotencyKey` يعيد نفس draft ولا ينشئ اثنين.
3. إشعار المالك بعد الحفظ؛ فشل الإشعار لا يحذف draft.
4. غياب owner channel يسجل الحالة ويترك draft pending.
5. edit يعمل فقط على pending ويزيد revision.
6. approve/reject متنافسان: واحد فقط ينجح، والثاني يحصل على stale/not-pending.
7. approve بعد edit القديم يفشل عند `expectedRevision` قديم.
8. رفض draft يمنع الإرسال.
9. sender يرسل approved فقط.
10. crash simulation بعد provider send وقبل persistence: يثبت السلوك المختار (at-least-once مع recovery أو dedupe provider)، ولا يدّعي exactly-once بلا دليل.
11. rate limit/quiet hours يبقي approved ويعيد المحاولة.
12. خطأ دائم يحول إلى failed مع attempts/lastError.
13. restart يعيد تحميل approvals من database.json ولا يعتمد على ذاكرة plugin.
14. سجل audit يثبت actor، transition، revision، body hash، وسبب الرفض/الفشل.
15. إرسال إشعار/إرسال هدف لا يسرّب نصوصاً أو session data في logs.

## 13. المخاطر والقيود

- **duplicate send عند crash**: أخطر فجوة في المرجع؛ lowdb يزيدها إذا كانت الكتابة دورية أو غير ذرية.
- **فقدان updates مع أكثر من process**: JSONFile/lowdb ليس lock موزعاً؛ يجب تشغيل writer واحد أو اختيار datastore مناسب.
- **تكرار المسودات عند retry**: لا يوجد idempotency key في المرجع؛ يجب إضافته في FLONA.
- **إشعار مالك غير موثوق**: timeout أو reconnect قد يجعل نتيجة `sendText` غير معروفة؛ خزّن attempts وحالة الإشعار ولا تسقط draft.
- **تجاوز الصلاحيات**: route المرجعي يفترض حماية dashboard العامة؛ FLONA يجب أن يفحص ownerJid داخل plugin/service، لا في UI فقط.
- **غياب audit trail**: Pino logs قابلة للدوران/الفقد وليست تاريخاً دائماً.
- **تضارب plugins**: plugin reload وglobal plugin registry قد يسببان ازدواج handlers أو أوامر متنافسة إن لم يُحسم prefix/command.
- **الجلسة والخصوصية**: لا تضع approval state أو نصوصه في مجلد auth، ولا تنسخ Baileys auth/session إلى مسار البحث أو report.
- **MIT compliance**: إعادة كتابة الفكرة لا تلغي واجب الإسناد إذا نُقلت أجزاء جوهرية من الكود.
- **مخاطر WhatsApp**: لا يخفف approval lifecycle مخاطر حظر Baileys أو سياسات WhatsApp؛ هو فقط يقلل الإرسال غير المقصود.
- **قصور الاختبارات المرجعية**: لا يوجد اختبار قوي لتعطل نافذة send/persist، ولا لعمل عدة workers، ولا لطلب approval idempotent عبر الشبكة.

## 14. الحكم النهائي

- قابلية إعادة استخدام المنطق: **نعم، مع إعادة كتابة**.
- ما يستحق الاقتباس التصميمي: outbox منفصل، الحفظ قبل الإشعار، حالات انتقال شرطية، owner notification، عدم اعتبار draft مرسلاً، retry عند rate limit، ورفض الإرسال المباشر.
- ما لا يستحق النقل: اتصال Baileys، إدارة session/auth، Postgres migrations، Redis/BullMQ، dashboard Next، MCP، model integrations، وملفات الإعداد الخاصة بالمرجع.
- مستوى الجاهزية للإنتاج بعد التكييف الحالي دون تحسينات: **غير كافٍ** بسبب نافذة duplicate send وغياب idempotency/audit/lease.
- التوصية لـ FLONA: تنفيذ نسخة أولى أحادية العملية فوق lowdb مع mutex وatomic write وrevision/idempotency/audit، ثم إضافة sender claim/recovery واختبارات crash قبل تفعيل أي auto-send. اجعل default دائماً `pending`، ولا تسمح بأي send مباشر من plugin أو model.
