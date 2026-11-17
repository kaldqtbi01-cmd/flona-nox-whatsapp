# بحث `w-agent` — ذاكرة واسترجاع وتلخيص وOutbox وسلامة وتدقيق

## نطاق المهمة وحالة الوصول

- المستودع المفحوص الوحيد: `https://github.com/Chessing234/w-agent`
- تم تنفيذ clone فعلي إلى: `/home/ubuntu/work/flona/research-src/w-agent`
- لا توجد تغييرات محلية في نسخة البحث (`git status --short` فارغ).
- لم يتم تعديل كود أو ملفات `/home/ubuntu/work/flona/repo`؛ الملف الحالي هو تقرير البحث المطلوب فقط.
- الالتزام المفحوص: `a47738f4ceb09c05fce26699064ba074cdd06e58` (`a47738f`)، بتاريخ `2026-07-24T20:40:39+03:00`، الرسالة: `fix(ci): mock engagement settings in /agent status test`.
- الإصدار المعلن في `package.json` و`CHANGELOG.md`: `0.1.0`، مع release أولي موثق في `CHANGELOG.md`.
- الوصول كان ناجحاً؛ لا توجد نتائج مخترعة أو استنتاجات مبنية على فشل الوصول.

## الترخيص

المستودع MIT، كما يثبت ذلك `package.json` (`"license": "MIT"`)، شارة README، وملف `LICENSE`. حقوق النشر المذكورة: `Copyright (c) 2026 W Agent contributors`. يسمح MIT بإعادة الاستخدام والتعديل والتوزيع، بشرط إبقاء إشعار حقوق النشر ونص الترخيص في النسخ أو الأجزاء الجوهرية، مع عدم تقديم ضمانات. قبل إدخال أي كود منسوخ فعلياً إلى FLONA يجب إبقاء الإسناد المناسب ومراجعة تراخيص الاعتماديات بشكل مستقل؛ هذا التقرير يوصي بإعادة كتابة المنطق لا نسخ اتصال WhatsApp أو ملفات الجلسة.

## الملفات التي فُحصت فعلياً

### وثائق وبيانات الإصدار

- `README.md`
- `LICENSE`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `.nvmrc`
- `tsconfig.json`
- `CHANGELOG.md`
- `SECURITY.md`
- `docs/architecture.md`
- `docs/security.md`
- `docs/providers.md`
- `CONTRIBUTING.md`

### المخطط والتخزين والميزات المطلوبة

- `migrations/1753370400000_init-schema.sql`
- `migrations/1753374000000_messages_wa_id.sql`
- `migrations/1753377600000_agent_memory_summarized_until.sql`
- `migrations/1753380000000_chat_engagement.sql`
- `migrations/1753381200000_chat_engagement.sql`
- `src/config.ts`
- `src/storage/db.ts`
- `src/storage/messages.ts`
- `src/storage/history.ts`
- `src/storage/embeddings.ts`
- `src/storage/search.ts`
- `src/storage/summary.ts`
- `src/storage/outbox.ts`
- `src/storage/settings.ts`
- `src/storage/chats.ts`
- `src/storage/chat-prefs.ts`
- `src/storage/engagement.ts`

### الطوابير والـ agent والسلامة والعمليات

- `src/queue/types.ts`
- `src/queue/ingest-pipeline.ts`
- `src/queue/ingest-worker.ts`
- `src/queue/embed-queue.ts`
- `src/queue/embed-worker.ts`
- `src/queue/summary-queue.ts`
- `src/queue/summary-worker.ts`
- `src/queue/outbox-sender.ts`
- `src/safety/guard.ts`
- `src/safety/ratelimit.ts`
- `src/agent/core.ts`
- `src/agent/outbound.ts`
- `src/agent/engage.ts`
- `src/agent/tools.ts`
- `src/ops/alerts.ts`
- `src/ops/checks.ts`
- `src/ops/watchdog.ts`

### الاختبارات والأدوات ذات الصلة

- `tests/storage.test.ts`
- `tests/search.test.ts`
- `tests/summary.test.ts`
- `tests/safety-guard.test.ts`
- `tests/ratelimit.test.ts`
- `tests/outbound.test.ts`
- `tests/agent-tools.test.ts`
- `tests/summary.test.ts`
- `tests/watchdog.test.ts`
- `scripts/redteam.ts`
- `scripts/backup.ts`
- `scripts/verify-history.ts`

لم تكن ملفات `src/bridge/*` أو `src/bridge/baileys.ts` أو `src/bridge/atomic-auth-state.ts` مطلوبة لاستخراج منطق FLONA، ولذلك لم تُستخدم كمصدر تصميم قابل للنقل؛ تم التحقق من وجودها فقط ضمن شجرة الملفات لتأكيد فصل طبقة النقل.

## ما وجده الفحص

### 1. نموذج الذاكرة الدائمة

النظام يجعل Postgres مصدر الحقيقة، وليس Redis. المخطط الأساسي ينشئ:

- `chats`, `contacts`, `messages` مع علاقات وفهارس زمنية.
- `messages.wa_message_id` مع unique constraint في migration لاحقة، ما يعطي idempotency عند ingest/history backfill.
- `agent_memory` بصف واحد لكل chat (`UNIQUE(chat_id)`)، يحوي `summary`, `updated_at`، ثم `summarized_until` لتحديد نقطة الطي الأخيرة.
- `settings` كـ JSONB لمفاتيح إعدادات عامة، ويستعمل `chat_prefs` لتخزين تفضيلات per-chat، بما فيها `autoSend`.

`src/storage/messages.ts` يطبق upsert للجهة والمحادثة داخل transaction ثم insert deduplicated للرسالة. `src/storage/history.ts` يكرر النمط على دفعات history ويعيد قائمة الرسائل النصية الجديدة المؤهلة للـ embedding وقائمة المحادثات المتأثرة. هذه أفكار مناسبة لإعادة الكتابة فوق lowdb: transaction معقول/atomic write، مفتاح idempotency لكل حدث، وفصل message records عن memory records.

لا يوجد في هذا النطاق retention policy أو consent ledger أو حذف/تصدير ذاكرة شامل. حذف chat في Postgres قد يتسلسل عبر foreign keys، لكنه ليس سياسة خصوصية أو workflow تدقيق.

### 2. الاسترجاع الدلالي والهجين

`src/storage/embeddings.ts` يستدعي OpenAI embeddings على دفعات، يخزن vector مع اسم النموذج، ويعمل upsert على `(message_id, model)`. `src/queue/embed-queue.ts` يجمع حتى 32 نصاً أو يفلش بعد ثانية، و`src/queue/embed-worker.ts` يعالج concurrency=1 مع rate limit.

`src/storage/search.ts` ينفذ hybrid retrieval:

1. استرجاع مرشحين بـ pgvector cosine distance.
2. استرجاع مرشحين بـ PostgreSQL FTS (`to_tsvector`/`plainto_tsquery`).
3. دمج النتائج على `message_id`.
4. إعادة ترتيب بالمعادلة `0.55 * vectorScore + 0.25 * ftsScore + 0.2 * recencyScore`.
5. recency prior أسي بنصف عمر تقريبي 14 يوماً.
6. دعم تقييد البحث بـ `chatJid` وlimit، وإرجاع sender/body/timestamp/direction/درجات المكونات.

`getChatContext` يعيد آخر n رسائل بتنسيق timestamp + sender، وهو منفصل عن البحث الدلالي. الاختبارات (`tests/search.test.ts`, `tests/storage.test.ts`) تثبت دمج vector-only وFTS-only والـ recency، مع embedder قابل للحقن للاختبار.

تكييف FLONA لا يحتاج pgvector: يمكن الاحتفاظ بعقد `EmbeddingProvider` plugin، وتخزين `embedding`, `model`, `sourceId` في lowdb إن كان الحجم صغيراً، أو جعل plugin يعيد نتائج semantic خارج lowdb. يجب عدم جعل lowdb مصفوفة بحث ضخمة بلا حد؛ يوصى بحدود retention/عدد سجلات وفهرس اختياري لاحقاً.

### 3. التلخيص

`src/storage/summary.ts` يطبق rolling summary لكل chat:

- لا يلخص إلا الرسائل ذات body غير الفارغ.
- يحسب عدد الرسائل بعد `summarized_until`.
- يعمل عند threshold افتراضي `SUMMARY_EVERY_N_MESSAGES=20` أو `force=true`.
- يطوي بحد أقصى `SUMMARY_BATCH_SIZE=60` رسالة في النداء الواحد.
- يمرر previous summary + الرسائل الجديدة بترتيب زمني إلى نموذج منخفض التكلفة.
- system prompt يطلب تغطية topics، المشاركين وأدوارهم، open questions، والقرارات؛ مع merge بدلاً من إسقاط الحقائق القديمة، وإخراج يقارب 500 token.
- إذا خرج النص فارغاً لا يحرّك cursor؛ عند النجاح يحدث `summary`, `summarized_until`, `updated_at`.

`src/queue/summary-queue.ts` يستخدم job id مشتقاً من chat لتقليل jobs المتزامنة لنفس المحادثة، و`summary-worker.ts` يعيد جدولة follow-up إذا بقيت رسائل فوق threshold. هذه آلية debounce/backlog folding جيدة لإعادة الكتابة كـ plugin/worker بسيط في نظام plugins الحالي، حتى لو استُبدل BullMQ بمجدول داخلي أو durable job state في lowdb.

مخاطر التصميم الأصلي التي ينبغي تحسينها في FLONA: cursor مبني على timestamp فقط، ما قد يسبب التباساً عند رسائل ذات timestamp متساوٍ؛ لا يوجد version/compare-and-swap لمنع تحديثين متزامنين من الكتابة فوق summary؛ والملخصات المشتقة من نصوص حساسة تظل بحاجة إلى retention وتصنيف/حذف.

### 4. Approval outbox

`src/storage/outbox.ts` يعرّف حالات `pending → approved → sent` مع terminal/failure states `rejected`, `failed`, `cancelled`. `draftReply` يرفض body الفارغ، يدرج draft ولا يرسل شيئاً. `approveOutbox` و`rejectOutbox` يفرضان انتقالاً من `pending` فقط، و`updateOutboxBody` يسمح بالتعديل أثناء `pending` فقط. `sendReply` الفوري gated ويرجع `{sent:false,gated:true}` بدلاً من الإرسال.

`src/agent/outbound.ts` يطبق المسار الأعلى مستوى: يقرأ per-chat `autoSend`؛ الافتراضي يخلق pending draft مع `requiresApproval=true`؛ ثم يبني owner self-chat notification تشمل chat label وbody وoutbox id. عند auto-send يبدأ status بـ approved، لكن ذلك استثناء امتيازي. إذا فشل إشعار المالك يبقى draft pending ولا يتحول إلى إرسال مباشر.

`src/queue/outbox-sender.ts` يـpoll approved rows، يمررها عبر rate limiter، يرسل، ثم يحاول transition مشروطاً من approved إلى sent. عند WhatsApp rate-limit يبقي approved مع cooldown، وعند فشل آخر يحول إلى failed. هذا يوفر أساساً جيداً لـ FLONA، لكن تنفيذ lowdb يجب أن يكون atomic في claim/transition حتى لا يرسل عاملان نفس draft؛ يوصى بحقول `attempts`, `lockedUntil`, `approvedBy`, `approvedAt`, `sentAt`, `lastError`, و`idempotencyKey`، وسجل أحداث append-only.

### 5. السلامة

`src/safety/guard.ts` يضم عدة حواجز قابلة لإعادة الكتابة:

- يوسم body الوارد بين `<<<UNTRUSTED_WHATSAPP_MESSAGE>>>` و`<<<END_UNTRUSTED_WHATSAPP_MESSAGE>>>`، مع system policy صريحة بأن المحتوى بيانات لا تعليمات.
- heuristic classifier regex/weights لتصنيف instruction override، third-party send، exfiltration، role hijack، jailbreak.
- threshold افتراضي 0.7؛ force-silent عند تجاوزه.
- optional LLM classifier منخفض التكلفة؛ يدمج بأخذ أعلى score ويعود إلى heuristics عند فشل النموذج.
- يرسل owner alert عند الحظر إن توفر provider/self-chat.
- يقفل outbound على active chat؛ target مختلف يحتاج owner-approved JID.
- يجمع قيم الأسرار من env ويعمل deep redaction لمخرجات الأدوات، إضافة إلى patterns لـ OpenAI keys وPostgres/Redis URLs.

`src/agent/core.ts` يطبق guard قبل حلقة الأدوات، يحقن untrusted-data policy في system instructions، ويسجل tool calls ويعمل redaction قبل إعادة النتائج للنموذج. `src/agent/engage.ts` يضيف allowlist/opt-in/opt-out، owner commands، group mention rule، وdefault silence للأرقام غير المعروفة.

`src/safety/ratelimit.ts` يضيف global/per-chat rolling quotas، quiet hours حسب IANA timezone، daily cap، alert عند نسبة من cap، randomized typing delay، وexponential cooldown عند rate-limit errors. الاختبارات و`scripts/redteam.ts` تثبت اختبارات regressions للحقن والحصص.

نقطة مهمة عند FLONA: heuristics ليست إثبات أمان، وLLM classifier قد يفشل أو يخطئ. يجب أن يكون fail-closed، وأن تُحفظ نتيجة القرار (score/labels/rule/policy version) في audit event دون تخزين أسرار أو نص كامل عند عدم الحاجة.

### 6. التدقيق والعمليات

لا يوجد `audit_log` أو `audit_events` domain مستقل في migrations. الموجود هو:

- structured Pino logs في معظم الطبقات.
- Redis list `w-agent:ops:alerts` في `src/ops/alerts.ts` بحد 100 alert تقريباً.
- `/healthz` و`src/ops/checks.ts` لفحص bridge/Postgres/Redis/queues.
- `src/ops/watchdog.ts` لإعادة تشغيل bridge مع backoff وتنبيه بعد فشل متكرر.
- outbox status/timestamps كأثر محدود لدورة الرسالة.

لذلك لا ينبغي وصف المشروع بأنه يملك audit trail كاملاً. لا يوجد سجل immutable لمن وافق/رفض، ولا قبل/بعد تعديل draft، ولا policy decision history، ولا retention/export للـ audit. هذه فجوة أساسية يجب سدها في FLONA.

## الإصدار والتبعيات

### Runtime/مواءمة Node وESM

- Node: `.nvmrc` يحتوي `22` و`package.json` يفرض `engines.node >=22`.
- ESM: `package.json` يحتوي `"type":"module"`؛ TypeScript يستخدم `module: NodeNext`, `moduleResolution: NodeNext`, `target: ES2022`, strict mode، وامتدادات `.js` في imports المصدرية.
- package manager: `pnpm@9.15.0`.
- workspace: الجذر و`dashboard`.

### تبعيات runtime المعلنة في `package.json`

- `@modelcontextprotocol/sdk` `^1.29.0` — MCP، غير مطلوب لمنطق FLONA المستهدف إلا إذا كان MCP جزءاً من المنتج.
- `@whiskeysockets/baileys` `7.0.0-rc13` — اتصال WhatsApp غير الرسمي؛ لا يُنقل.
- `bullmq` `^5.81.1` و`ioredis` `^5.11.1` — queues/rate coordination؛ لا يلزمان إذا كان نظام plugins الحالي وجدولة FLONA يغطيان ذلك.
- `dotenv` `^17.4.2` و`zod` `^3.25.76` — config/validation؛ يمكن استخدام Zod إن كان موجوداً، لكن لا حاجة لنسخ config بالكامل.
- `openai` `^6.49.0` — embeddings/summaries/classification/agent؛ يُستبدل بعقد provider خاص بـ FLONA أو plugin مزود نموذج.
- `pg` `^8.22.0` — Postgres؛ لا يُنقل إلى مسار lowdb.
- `pino` `^10.3.1` و`pino-pretty` `^13.1.3` — structured logging؛ يمكن إعادة استخدام الفكرة فقط بما يطابق logger الحالي.
- `qrcode-terminal` `^0.12.0` — pairing UI؛ لا علاقة له بالنطاق ولا يُنقل.

### devDependencies المعلنة

`typescript ^5.8.3`, `tsx ^4.23.1`, `vitest ^4.1.10`, `@vitest/coverage-v8 ^4.1.10`, `eslint ^10.7.0`, `@eslint/js ^10.0.1`, `typescript-eslint ^8.65.0`, `prettier ^3.9.6`, `eslint-config-prettier ^10.1.8`, `eslint-plugin-prettier ^5.5.6`, `@types/node ^22.20.1`, `@types/pg ^8.20.0`, `@types/qrcode-terminal ^0.12.0`, `node-pg-migrate ^9.0.0`, `testcontainers ^12.0.4`, `@testcontainers/postgresql ^12.0.4`.

لا توجد `lowdb` في dependencies الخاصة بـ w-agent؛ lowdb تخص بيئة FLONA ويجب تصميم adapter عليها، لا الادعاء أن w-agent يوفرها.

## ما لا ينبغي نقله إلى FLONA

1. `@whiskeysockets/baileys`، `src/bridge/baileys.ts`، `src/bridge/atomic-auth-state.ts`، مجلدات auth، QR/pairing، وraw provider payloads: خارج الهدف وخطر platform/account-ban؛ لا تنسخ اتصال WhatsApp ولا ملفات الجلسة.
2. `@modelcontextprotocol/sdk` و`src/mcp/*` ما لم يطلب FLONA MCP صراحة؛ المطلوب هنا منطق داخلي قابل لإعادة الكتابة.
3. Postgres/pgvector/`pg`/migrations و`pgvector/pg16` test container: FLONA يستخدم lowdb؛ انقل العقود والمنهجية فقط.
4. BullMQ/Redis و`ioredis`: لا تنقلها إذا كان نظام plugins/worker الحالي يكفي؛ أعد كتابة debounce/retry/idempotency على primitives FLONA.
5. `qrcode-terminal` وواجهات dashboard/Next.js وCloud API: غير ذات صلة بالنطاق.
6. `raw_json` أو provider-specific identifiers كواجهة عامة؛ عرّف message/event IDs محلية ومجردة.
7. ادعاء أن structured logs أو Redis alerts تساوي audit log؛ يجب بناء audit مستقل.

## خطة تكييف آمنة مع FLONA (Node 22، ESM، lowdb، plugins)

1. **عرّف عقوداً مجردة ESM**: `MemoryStore`, `RetrievalProvider`, `SummaryProvider`, `OutboxStore`, `SafetyPolicy`, `AuditSink`. استخدم imports `.js` وTypeScript NodeNext كما في FLONA، ولا تستورد Baileys أو `pg` من plugins.
2. **قسّم lowdb إلى namespaces**: `messages`, `memories`, `embeddings` (اختياري/محدود)، `outbox`, `auditEvents`, `settings`. أضف schema version/migration وatomic file write. لا تحفظ session/auth/WhatsApp state في هذه namespaces.
3. **اجعل ingest idempotent**: لكل event `source`, `externalId`, `receivedAt`; unique logical key، وdedupe قبل إنشاء embedding أو summary job. احتفظ بحدود الحجم وretention صريحة.
4. **نفّذ semantic retrieval كـ plugin**: `embed(texts)` و`search(query, scope, limit)`. ابدأ بـ FTS/keyword محلي إن لم يوجد vector index؛ أضف embedding provider اختيارياً، مع model/dimension metadata وfallback واضح. طبّق scope/tenant/chat boundaries قبل reranking.
5. **أعد كتابة hybrid scoring**: vector/keyword/recency weights قابلة للتهيئة، لكن سجل نسخة الخوارزمية والحدود في نتيجة retrieval. لا ترسل كامل archive للنموذج؛ مرر top-k مع source IDs.
6. **أعد كتابة rolling summaries**: cursor monotonically increasing (`message sequence` أو `event id`) لا timestamp فقط؛ lock/version لكل memory؛ batch/threshold/debounce؛ لا تقدم summary جديداً إذا كان model output فارغاً؛ خزّن `sourceRange`, `model`, `promptVersion`, `updatedAt`.
7. **اجعل كل outbound draft pending افتراضياً**: outbox state machine صريحة، transition guards، approval actor/time، body revision، reason، expiry/cancel. `autoSend` يجب أن يكون opt-in per scope مع policy gate مستقل، وليس مجرد boolean مخفي.
8. **اجعل sender آمناً للتكرار**: claim/lease ذري، idempotency key، retry/backoff، `attemptCount`، `lastError`، ونتيجة provider. لا تعتبر listing ثم send ثم update عملية ذرية؛ صمم recovery بعد crash لمنع duplicate send أو أظهر حالة unknown وتطلب مراجعة.
9. **طبقة safety قبل أي tool/send**: untrusted delimiters، heuristic score، optional classifier، active-target lock، secret redaction، limits، quiet hours/daily cap. افصل owner-trusted command path عن inbound data path، ولا تسمح للرسالة الواردة بتغيير plugin policy.
10. **ابنِ audit log حقيقياً**: append-only lowdb records لكل ingest decision، retrieval access، summary update، safety block، draft create/edit/approve/reject، send attempt/result، policy change، وplugin action. اجعل كل record يحوي `eventId`, `at`, `actor`, `scope`, `action`, `outcome`, `correlationId`, `policyVersion`, `redacted metadata`، دون الأسرار أو نصوص حساسة غير ضرورية.
11. **افصل alerts عن audit**: alerts قابلة للعرض والحد، أما audit فدائم/قابل للتصدير وفق retention. لا تعتمد على console logs وحدها.
12. **اختبر العقود لا النقل**: أعد استخدام أفكار اختبارات `tests/search.test.ts`, `summary.test.ts`, `safety-guard.test.ts`, `outbound.test.ts`, `ratelimit.test.ts` بصيغة FLONA. أضف crash/replay/concurrency tests، deletion/retention tests، cross-scope leakage tests، وproperty tests لحالة outbox.
13. **التشغيل الافتراضي الآمن**: `approval required`, LLM classifier اختياري لكن fail-closed عند الشك، no cross-chat drafts، no auto-send، no external model calls دون opt-in، وسجّل data egress/model provider في audit.

## المخاطر والفجوات

- **اعتماد غير رسمي**: Baileys يحمل خطر restriction/ban؛ غير ذي صلة ويجب عدم نقله.
- **خصوصية/إخراج البيانات**: embeddings والملخصات يرسلان نصوصاً إلى OpenAI في المسار الأصلي؛ FLONA يحتاج provider/egress consent وredaction قبل الإرسال.
- **عدم وجود audit حقيقي**: حالات outbox وPino/Redis alerts لا تكفي لإثبات من فعل ماذا ومتى.
- **تزامن summary**: لا يظهر lock/version؛ احتمال lost update عند jobs متزامنة، وtimestamp cursor غير مثالي.
- **تزامن outbox**: poll ثم send ثم status update قد يسمح بالتكرار بعد crash أو أكثر من sender.
- **auto-send**: `autoSend=true` يتجاوز approval؛ يجب إبقاؤه opt-in، محدوداً، مؤقتاً، ومدعوماً بتدقيق ومراجعة.
- **heuristic classifier**: regex تغطي أمثلة معروفة وقد تفشل أمام لغات/صياغات جديدة؛ لا تعتمد عليها وحدها.
- **LLM classifier**: تكلفة، latency، availability، واحتمال false negatives/positives؛ يجب fail-closed وحفظ policy decision.
- **secret redaction غير كامل**: patterns لا تضمن كشف كل أسرار FLONA، وقد تفشل أمام encoding أو قيم قصيرة؛ أضف secret registry واختبارات عدم التسريب.
- **حجم lowdb**: نقل archive وembeddings بكاملها إلى JSON قد يسبب I/O/تعطل/فساد وحجم كبير؛ ضع retention وحدوداً أو adapter خارجي للبحث.
- **غياب retention/consent**: المشروع يوثق data locality لكنه لا يطبق دورة حياة قانونية؛ FLONA يحتاج delete/export/purge وقيود scope.
- **اعتماديات غير متطابقة**: لا يوجد lowdb في w-agent، ونقل pg/BullMQ/Redis سيعارض متطلبات FLONA ويزيد السطح التشغيلي.
- **حدود المصدر**: الإصدار المفحوص `0.1.0` وcommit محدد؛ لا ينبغي افتراض أن تغييرات مستقبلية غير موجودة هنا متاحة.

## خلاصة القابلية

`feasible: true` لإعادة كتابة المنطق المطلوب داخل FLONA، بشرط نقل الأنماط/العقود فقط: deduplicated durable memory، hybrid retrieval concept، rolling summaries مع cursor، approval outbox، safety gates/rate limits، وaudit مستقل. ليست feasible كنسخ مباشر للبنية، لأن w-agent مبني على Postgres/pgvector + Redis/BullMQ وطبقة WhatsApp خاصة، بينما المطلوب Node 22 + ESM + lowdb + نظام plugins، ولأن اتصال WhatsApp والجلسات خارج النطاق صراحة.

## خلاصة الملفات والمنتجات القابلة لإعادة الكتابة

- ذاكرة: `src/storage/messages.ts`, `history.ts`, `summary.ts`, migrations الخاصة بـ `agent_memory`.
- استرجاع: `src/storage/embeddings.ts`, `search.ts`.
- جدولة/إعادة المحاولة: `src/queue/embed-queue.ts`, `summary-queue.ts`, workers — تُحوّل إلى plugin jobs.
- موافقة: `src/storage/outbox.ts`, `src/agent/outbound.ts`, `src/queue/outbox-sender.ts`.
- السلامة: `src/safety/guard.ts`, `ratelimit.ts`, وقيود `src/agent/core.ts`/`engage.ts`.
- العمليات/التنبيه (مع عدم اعتباره audit): `src/ops/alerts.ts`, `checks.ts`, `watchdog.ts`.
- الاختبارات المرجعية: `tests/search.test.ts`, `summary.test.ts`, `safety-guard.test.ts`, `outbound.test.ts`, `ratelimit.test.ts`, `storage.test.ts`.
