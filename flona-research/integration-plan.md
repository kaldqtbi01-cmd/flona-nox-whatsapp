# خطة دمج محافظة لميزات FLONA

> **حالة الخطة:** خطة تصميم وتنفيذ فقط. لا تعني أن أي ميزة أدناه قد نُفذت.
>
> **المبدأ الحاكم:** الحفاظ على اتصال WhatsApp الحالي، وBaileys الحالي، وملفات auth/session، وQR/pairing، ومسار استقبال وإرسال الرسائل الموجود. كل الميزات الجديدة تدخل عبر adapters وplugins وعقود محايدة للقناة، ولا تنشئ socket أو listener أو مخزن جلسة ثانياً.

## 1. النطاق والقيود غير القابلة للتفاوض

### داخل النطاق

- إعادة استخدام دورة حياة FLONA الحالية (`smsg`/التطبيع، handler، plugin hooks، `global.db` وlowdb، logger، send helpers).
- إضافة عقود داخلية مستقلة عن Baileys للرسالة، التاريخ، الإرسال، الحضور، التخزين، السياسات، التدقيق، وتنفيذ التدفقات.
- تسلسل الكتابات داخل العملية، idempotency، حدود الحجم والزمن، retention، وإلغاء العمل عند الحاجة.
- تفعيل تدريجي يبدأ بـ disabled-by-default وdry-run أو audit-only، مع allowlist صريحة ومقاييس ومراقبة.
- اختبارات offline باستخدام fake adapters وfake providers؛ لا تتطلب جلسة WhatsApp حقيقية.

### خارج النطاق

- استبدال اتصال WhatsApp أو إصدار Baileys أو patch أو auth/session أو QR/pairing.
- نقل SQLite/Prisma/Postgres/Redis/BullMQ أو إنشاء قاعدة بيانات ثانية بجانب lowdb في النسخة الأولى.
- نقل `agy` أو OAuth/profile أو `--dangerously-skip-permissions`.
- نقل Cloud API أو webhook transport أو MCP/dashboard أو بروتوكول WebView غير الموثق.
- تنفيذ code-exec أو scraping أو webfetch غير المقيد.
- الادعاء بأن النقل الحرفي من أي مستودع صالح؛ كل ما يلي تصميم مقترح يحتاج تنفيذ ومراجعة واختبارات.

## 2. تصنيف الميزات

### 2.1 قابلة للتنفيذ الآن داخل FLONA، دون خدمة أو مفتاح خارجي

هذه ميزات يمكن بناؤها فوق Node 22/ESM وlowdb والـ plugin lifecycle الحالي، بشرط تنفيذها واختبارها أولاً:

1. **عقد الرسائل والتطبيع والـ adapter**: تحويل الرسالة الحالية إلى عقد محايد يحوي `messageId`, `chatId`, `senderId`, `timestamp`, `text`, `kind`, `quoted`, `media metadata`, `isFromMe`, و`origin`. لا يغيّر الاتصال.
2. **التسجيل best-effort والتدقيق append-only**: تسجيل الوارد والصادر والأحداث الحساسة مع redaction، وفصل auditEvents عن logger والـ alerts، وحدود retention وحجم واضحة.
3. **History repository وcontext window**: `listRecent/getById/append/prune`، نافذة 15 رسالة، quote tagging، ancestor recovery بحد hop اثنين، cycle detection، وحدود prompt؛ مع fallback للرسائل المقتبسة الموجودة في payload الذاكرة.
4. **Debounce batching**: مؤقت أولي/لاحق وحد أقصى، وعزل buffer لكل `chatId + senderId`، مع flush عند الإلغاء أو انتهاء الحد.
5. **FIFO mutex per chat**: طابور مستقل لكل chat، `AbortController` للإلغاء اليدوي، typing heartbeat قابل للإيقاف، وحدود queue depth/وقت انتظار.
6. **Origin صريح للرسائل**: استخدام `manual` و`ai` عند الإرسال، وتسجيل correlation/idempotency key؛ إبقاء watermark أو message-ID cache fallback فقط وليس مصدر الحقيقة.
7. **Lowdb namespace ومخطط versioned**: namespaces للرسائل/الذاكرة/الإعدادات/التدفقات/التنبيهات/التدقيق، مع migrations، single-writer queue، retention، وحظر الكتابة المتزامنة غير المنسقة.
8. **Hot reload آمن للـ plugins/commands**: chokidar إن كان متاحاً أو dependency مراجعة؛ awaitWriteFinish، debounce، per-file serialization، containment، validation قبل swap، rollback عند الفشل، unlink، تنظيف aliases، ومراقبة reload count. لا يبدأ بإعادة تحميل handler نفسه.
9. **سياسات الصلاحيات العامة**: adapter يحوّل flags FLONA الحالية إلى قرارات موحدة مثل owner/admin/group/private/botAdmin، مع re-check داخل الخدمة، وsilent-drop عند الحاجة.
10. **Moderation أساسي**: antilink/wordlock/antispam/repeated-content، إعدادات المجموعة، warnings/expiry/cooldown، normalization Unicode/JID، قرار عقوبة واحد لكل event، والبدء audit-only ثم delete/warn خلف allowlist. لا يشمل اتصالاً جديداً.
11. **محرك workflows محلي محدود**: graph validation، condition، delay cancellable، set-variable، formatter، HTTP adapter مقيد، executions/logs bounded، max steps/wall-clock/cancellation/idempotency. يقتصر الإصدار الأول على plugins آمنة؛ لا code-exec.
12. **قوالب وrendering محلي**: accessor موحد، منع prototype keys، limits، missing-value policy، escapeHtml وrenderCard/list/stats/tabs؛ text fallback أولاً وHTML اختياري من دون WebView transport.
13. **Inbox/contacts/assignment/notes domain مبسط**: نماذج channel-neutral فوق lowdb، list/filter/keyset cursor، self-claim/takeover، notes visibility، handoff history، وأدوار/صلاحيات re-evaluated. يظل read model محدوداً ولا يدّعي خصائص PostgreSQL.
14. **Human approval outbox محلي**: draft pending افتراضياً، transitions مشروطة، actor/revision/idempotency، expiry/cancel، lease/claim، attempts، recovery، وإشعار المالك عبر adapter الإرسال الحالي. لا يضمن منع التكرار بعد crash بين الإرسال والحفظ؛ يلزم تصميم تعويض ومراجعة.
15. **Send hygiene محلي**: quotas per-chat/global، quiet hours، daily caps، typing delays، cooldown/backoff، active-target lock، وقياس latency/queue depth.
16. **اختبارات offline** لكل ما سبق باستخدام fake store/send/presence/clock/plugin loader، مع replay وconcurrency وcrash simulation وretention وsecurity regression.

### 2.2 تحتاج خدمة أو مفتاحاً خارجياً، أو موافقة تشغيلية قبل التفعيل

هذه المزايا يمكن تصميم adapters لها الآن، لكن لا ينبغي اعتبارها قابلة للتشغيل الفعلي دون مورد خارجي/سر أو قرار صريح حول egress والخصوصية:

1. **AI chat/vision/audio/PDF**: تحتاج مزود نموذج ومفاتيح/endpoint وسياسة egress. يجب أن يدعم `ModelRouter` modality routing، timeout، retry budget، circuit breaker، redaction، provider fallback، وquota. لا يُنقل agy.
2. **Embeddings والبحث الدلالي**: تحتاج embedding API أو نموذج محلي وموارد تشغيل؛ النسخة الأساسية تقدم FTS/lexical fallback محدوداً، ولا تخزن embeddings بلا bounds وmetadata/scope.
3. **تفريغ الصوت وvision**: تحتاج مزوداً أو runtime محلياً، مع MIME/byte/duration limits وlazy loading وcleanup؛ لا تُحمّل الوسائط قبل اجتياز policy/quota.
4. **استخراج PDF/OCR**: يحتاج extractor/OCR أو خدمة خارجية؛ يجب فحص signature، الصفحات، الحجم، التشفير، decompression limits، timeout، وعدم إرسال الملف لمزود دون consent.
5. **صور أو APIs خارجية للواجهات**: تحتاج HTTP egress، ويجب تطبيق SSRF/IP/host allowlist، redirects/body limits، MIME validation وsecret redaction.
6. **LLM injection classifier**: optional external model؛ لا يكون شرط availability الأساسي، ويجب أن تكون السياسة fail-closed عند الاشتباه أو فشل التصنيف وفق قرار المنتج.
7. **إشعارات مالك خارج FLONA** مثل البريد/Push/SMS أو لوحة مراقبة مستضافة: تحتاج مزوداً ومفاتيح وصلاحيات، وتظل الرسائل الحساسة redacted.
8. **Redis/NATS/قاعدة بيانات خارجية أو multi-process guarantees**: تحتاج خدمة تشغيلية؛ لا تُضاف فقط لتقليد المصادر. عند التوسع خارج single-process يجب إعادة تصميم claims/locks/transactions.
9. **ميزات realtime أو dashboard**: تحتاج backend/UI واستضافة وauth/CSRF؛ لا تدخل core integration الأولى.
10. **التحقق الأمني/التشغيلي الخارجي**: اختبار red-team، مراجعة خصوصية، load test، وموافقة مالك الحساب قبل auto-send أو moderation العقابي.

### 2.3 غير مناسبة للنقل إلى FLONA أو مؤجلة خارج الخطة الأساسية

- Baileys/auth/session/QR/pairing/reconnect والـ patches وملفات credentials.
- `agy` مع `--dangerously-skip-permissions`، وأي تنفيذ أوامر/كود غير معزول داخل عملية البوت.
- SQLite WAL/better-sqlite3 وPrisma/Postgres migrations وpgvector وRedis/BullMQ لمجرد مطابقة المصدر.
- MCP/dashboard/frontend stacks، React Flow، WebView primitives، rich protobuf/HTML transport، وSocket.IO غير الضرورية.
- `code-exec` عبر `vm.Script`؛ ليس sandboxاً كافياً. إن لزم لاحقاً فهو worker/container منفصل بصلاحيات وموارد وشبكة مقيدة.
- custom webfetch أو HTTP مفتوح، pollers غير مقيدة، scraping، وURL user-controlled دون SSRF controls.
- نقل Cloud API/Webhook HMAC كبديل لاتصال FLONA الحالي.
- الاعتماد على zero-width watermark أو in-memory ID cache كمصدر وحيد لتمييز AI/manual.
- الادعاء بضمانات distributed transaction أو exactly-once للإرسال مع lowdb.
- نقل بيانات/قوائم badwords أو نصوص رسائل أو أرقام/JIDs من المصادر إلى بيئة الإنتاج دون مراجعة خصوصية ومحتوى.
- تشغيل auto-send واسع أو kick/ban/mute افتراضي؛ يبقى خلف explicit opt-in، allowlist، capability checks، audit، وkill switch.

## 3. ترتيب commits المقترح

كل commit أدناه مستقل قدر الإمكان، صغير، قابل للمراجعة والرجوع. لا يُدمج commit لاحق قبل نجاح اختبارات السابق. الأسماء وصفية وليست سجلاً لتنفيذ فعلي.

1. `docs: record integration boundaries and source attributions`  
   توثيق عدم لمس الاتصال والجلسة، مصفوفة التصنيف، attribution MIT عند الحاجة، ومخاطر الخصوصية.
2. `test: add normalized message and adapter contract fixtures`  
   fixtures للرسائل النصية والمقتبسة والوسائط وfromMe وJID/LID دون socket حقيقي.
3. `feat: add channel-neutral message and origin contracts`  
   عقود pure وnormalizer مع validation؛ لا storage ولا send changes.
4. `feat: add serialized lowdb agentic namespace and migrations`  
   namespace versioned، writer queue، retention hooks، schema checks؛ لا SQLite.
5. `feat: add append-only audit sink and redaction`  
   audit event schema، body hashing، no-secret policy، bounded query/export.
6. `feat: add history repository and bounded context builder`  
   window/quotes/ancestors/cycle and prompt limits.
7. `feat: add per-chat debounce and cancellable fifo queue`  
   timers، abort، typing callback، queue metrics.
8. `feat: add explicit outbound origin and send adapter`  
   manual/ai، idempotency/correlation، adapter فوق sender الحالي، no new transport.
9. `feat: add safe plugin reload with rollback`  
   chokidar contract، validation، unlink، alias cleanup، per-file serialization؛ handler reload مؤجل.
10. `feat: add policy adapter and safe invocation boundary`  
    authorization mapping، error boundary، failure counters/quarantine policy.
11. `feat: add moderation policy in audit-only mode`  
    antilink/wordlock/antispam/repeated content، TTL، idempotency، normalization.
12. `feat: add moderation actions behind explicit allowlists`  
    delete/warn ثم mute/kick لاحقاً، capability checks وkill switch؛ لا تفعيل افتراضي.
13. `feat: add bounded workflow engine core`  
    graph validation، condition، variables، formatter، cancellation، max steps/time.
14. `feat: add guarded http workflow adapter`  
    fetch/timeout/SSRF/redirect/body limits/redaction؛ لا code-exec.
15. `feat: add safe UI render helpers and text fallback`  
    escaping، templates، tabs/search/pagination على بيانات مسبقة، دون WebView transport.
16. `feat: add approval outbox state machine`  
    pending/approved/rejected/sending/sent/failed/cancelled، revisions، leases، recovery، audit.
17. `feat: add send quotas quiet hours and cooldown policy`  
    تطبيق قبل الإرسال، مع fake clock ومقاييس.
18. `feat: add inbox contact assignment and notes domain`  
    lowdb repositories، keyset cursor، roles/visibility، handoff history.
19. `feat: add optional AI provider interfaces`  
    interfaces فقط وfake provider؛ لا مفتاح ولا egress ولا auto-enable.
20. `feat: add optional media modality router`  
    image/audio/PDF interfaces، lazy loaders، limits/cleanup؛ adapters الخارجية disabled.
21. `test: add replay crash retention and security regression suite`  
    suite شاملة قبل أي feature flag production.
22. `docs: add rollout runbook and rollback procedures`  
    dry-run، allowlist، metrics، kill switch، backup/restore، incident handling.

## 4. الاختبارات المطلوبة لكل ميزة

### المرحلة A: الأساس والعقود

- **Normalizer:** رسائل نصية، caption، quoted، missing fields، `fromMe`، duplicate IDs، timestamps غير صالحة، JID/LID normalization.
- **Compatibility:** اختبار أن نفس input قبل الدمج لا يغيّر dispatch أو send path الحالي.
- **Lowdb:** migration من DB فارغة وقديمة، serialized concurrent writes، restart recovery، corruption handling، retention، وحدود الحجم.
- **Audit/redaction:** عدم ظهور token/secret/JID الخام أو body غير المطلوب، append-only semantics، hash ثابت، وCSV formula neutralization إن أضيف export.

### المرحلة B: السياق والجدولة

- **History/context:** نافذة 15، ترقيم محلي، quote خارج النافذة، ancestor hop=2، missing quote fallback، cycle detection، prompt/message/byte limits، scope isolation.
- **Debounce:** burst يسبب flush واحداً، initial/later/max timers، فصل chat/sender، flush عند close، no timer leak.
- **FIFO/Abort:** ترتيب صارم لكل chat، استقلال chats، cancellation لا يلغي chat آخر، typing heartbeat cleanup، queue depth/timeout.
- **Origin:** AI/manual لا يختلطان، duplicate send idempotency، وعدم الاعتماد على watermark وحده.

### المرحلة C: reload والسياسات والمراقبة

- **Reload:** add/change/unlink، half-written file، syntax/import error rollback، alias collision، concurrent changes، path traversal، listener/timer disposal، bounded reload count.
- **Policy:** كل matrix للـ owner/admin/group/private/botAdmin، re-check وقت التنفيذ، silent drop، error boundary، quarantine بعد failures.
- **Observability:** structured fields، latency، queue depth، provider errors، audit events، no sensitive payloads.

### المرحلة D: moderation

- Unicode والعربية والتشكيل وleet/punctuation وIDN/URLs وallowlist؛ false positive corpus.
- Sliding window وburst وrepeated-content، expiry/decay، restart semantics، duplicate message idempotency.
- قرار عقوبة واحد لكل event، admin/bot capability، failed delete/kick safe handling، no double warning.
- يبدأ الاختبار والتشغيل `audit-only` ثم `warn/delete` في مجموعة allowlist؛ لا تختبر kick/ban على حسابات إنتاجية.

### المرحلة E: workflows وUI

- graph malformed/unknown node/multiple triggers/cycle، deterministic branching، max steps، wall-clock timeout، cancellation، restart behavior.
- variable path prototype blocking، missing-value policy، formatter limits، delay cancellation.
- HTTP: localhost/private IP/IPv6/redirect/URL credentials/oversized body/timeout/non-JSON/secret in headers or response.
- renderer: XSS payloads في title/body/styles/attributes، escaping، empty states، search/tabs/pagination، text fallback عند UI failure.

### المرحلة F: outbox والإرسال

- transitions الشرطية، stale revision، actor authorization، edit pending-only، expiry/cancel، idempotency duplicate draft.
- claim lease، expired lease recovery، attempts/backoff، notification failure يبقي pending، crash قبل/بعد send.
- اختبار duplicate-send window بصراحة: يجب تسجيل uncertainty والتحول إلى manual review أو reconciliation، لا ادعاء exactly-once.
- quotas/quiet hours/daily caps/cooldown، active-target lock، send adapter fake، وعدم إنشاء socket جديد.

### المرحلة G: AI/media والميزات الخارجية

- fake providers للـ routing/fallback/retry/circuit breaker والـ error classes، مع budget زمني.
- egress consent، prompt injection delimiters/classification، redaction، cross-chat leakage، scope/model metadata.
- lazy media loader لا ينزل قبل policy، MIME/bytes/duration/pages، stream limit، cleanup في `finally`، corrupted/encrypted PDF.
- embedding scope وtop-k bounds وFTS fallback؛ لا اختبار provider حقيقي في CI إلا عبر contract test مع secrets معزولة.

## 5. خطة التفعيل والرجوع

1. **Disabled-by-default:** لا تغيّر سلوك الرسائل الحالية. يمكن تشغيل parser/repositories والـ audit في وضع اختبار فقط.
2. **Shadow/audit-only:** ingest/context/moderation/outbox تُسجل قراراتها دون حذف أو إرسال AI أو عقوبة.
3. **Allowlist صغيرة:** chat IDs معروفة، owner approval إلزامي، حدود queue/quota منخفضة، وkill switch فوري.
4. **Canary:** قياس latency، failures، lowdb size، queue depth، duplicate/retry، memory/listener growth، وprovider egress.
5. **توسيع مشروط:** لا يُفعّل auto-send أو punishment الأشد إلا بعد مراجعة logs/audit ونجاح replay/crash tests.
6. **Rollback:** تعطيل flags وإيقاف workers/timers، إبقاء الاتصال الحالي ومسار الرسائل سليماً، استعادة lowdb backup إن لزم، وإزالة plugin الجديد دون حذف auth/session.
7. **بعد كل تغيير:** `npm test`/Node test suite وlint/type checks المتاحة، ثم smoke test offline. اختبار WhatsApp الحقيقي اختياري ومحدود ولا يكون شرطاً لتشغيل CI.

## 6. نقاط قرار قبل الإنتاج

- موافقة صريحة على إرسال نصوص/وسائط إلى مزود خارجي، ومراجعة retention والخصوصية.
- قرار ما إذا كانت lowdb كافية للحجم؛ عند تعدد العمليات أو archive كبير يجب الانتقال إلى datastore مناسب كمشروع مستقل، لا خلطه في هذا الدمج.
- تعريف owner/admin authority وJID/LID normalization في FLONA الحالي.
- تحديد سياسة فشل audit: fail-open أم fail-closed لكل نوع حدث، مع عدم فقد الأحداث الحساسة بصمت.
- تحديد سياسة عدم اليقين بعد crash بين send وpersist، وآلية reconciliation يدوية.
- مراجعة تراخيص MIT عند نسخ كود جوهري، مع عدم نسخ تبعيات أو ملفات session أو بيانات المصادر.

## الخلاصة التنفيذية

ابدأ بالعقود، التخزين المتسلسل، التدقيق، والسياق؛ ثم batching/FIFO وreload الآمن؛ ثم moderation/workflows/outbox كميزات محلية disabled-by-default. صمّم AI/media/embeddings كواجهات فقط إلى أن تتوفر خدمة ومفتاح وموافقة egress. أبقِ كل ما يبدّل اتصال WhatsApp أو يشغل كوداً غير معزول أو يفرض ضمانات قواعد بيانات لا يوفرها lowdb خارج الدمج. لا تُعتبر أي ميزة منفذة حتى يمر commit الخاص بها باختباراته وعرض rollback واضح.
