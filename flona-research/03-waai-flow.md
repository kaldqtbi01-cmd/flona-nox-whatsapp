# فحص WAAI Flow لإعادة كتابة منطق workflows داخل FLONA

## 1. نطاق المهمة وطريقة الفحص

تم فحص مستودع واحد فقط:

- المستودع: `https://github.com/zqdevelopers/waai-flow`
- مسار النسخة المستنسخة: `/home/ubuntu/work/flona/research-src/waai-flow`
- نسخة Git المفحوصة: `f51c618703db1738bda2de852a90b9d8f03cb96c`
- الفرع: `main`
- تاريخ commit كما سجله Git: `2026-08-22T17:48:26+05:00`
- رسالة commit: `feat: AI flow generator, pairing code login, multi-provider AI, real-time live inbox & flow management`
- إصدار المشروع في manifests: `1.0.0` لكل root وbackend؛ إصدار frontend في manifest هو `0.0.0`.

تم تنفيذ clone فعلي إلى مسار `research-src`، ولم تُجرَ أي تعديلات على ملفات مصدر FLONA أو على `/home/ubuntu/work/flona/repo` خارج إنشاء ملف التقرير المطلوب داخل `flona-research/`. فحص حالة Git للمصدر المستنسخ كان نظيفًا، وتظهر نسخة FLONA فقط ملف التقرير كملف بحث جديد.

الهدف هنا هو استخراج منطق قابل لإعادة الكتابة داخل FLONA، لا نسخ اتصال WhatsApp أو بيانات/ملفات الجلسات. لذلك اعتُبرت طبقة Baileys، إدارة الجلسات، AI providers، وواجهة التشغيل المرتبطة بـ Prisma/WAAI حدودًا خارج نطاق النقل المباشر إلا كواجهات يجب عزلها.

## 2. الترخيص

`LICENSE` هو MIT License، copyright `2026 ZQ Developers`. يسمح الترخيص بالنسخ والتعديل وإعادة التوزيع، بشرط إبقاء إشعار copyright ونص الترخيص في النسخ أو الأجزاء الجوهرية. لا يوجد في الترخيص شرط copyleft أو إلزام بفتح مصدر FLONA، لكن يجب الاحتفاظ بالإسناد عند إعادة استخدام أجزاء فعلية من الكود.

ملاحظة عملية: ملف `README.md` يعلن أيضًا MIT، و`package.json` root/backend يعلنان `license: MIT`. يجب حفظ attribution واضح في سجل FLONA إذا أُعيدت كتابة أجزاء من محرك التدفقات أو القوالب.

## 3. الملفات الفعلية المفحوصة

### ملفات الجذر والهوية

- `README.md`
- `LICENSE`
- `package.json`
- `package-lock.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `backend/package.json`
- `backend/package-lock.json`
- `backend/prisma/schema.prisma`

### منطق التدفقات والإضافات

- `backend/src/flow/engine.js`
- `backend/src/flow/template.js`
- `backend/src/plugins/loader.js`
- `backend/src/plugins/condition/index.js`
- `backend/src/plugins/delay/index.js`
- `backend/src/plugins/set-variable/index.js`
- `backend/src/plugins/text-formatter/index.js`
- `backend/src/plugins/http-request/index.js`
- `backend/src/plugins/code-exec/index.js`
- `backend/src/plugins/webhook-trigger/index.js`
- `backend/src/plugins/send-message/index.js` (لتمييز adapter WhatsApp عن المنطق العام)
- `backend/src/plugins/poll/index.js` (لتمييز adapter WhatsApp)

### API والتشغيل والتخزين

- `backend/src/controllers/flow.controller.js`
- `backend/src/routes/flow.routes.js`
- `backend/src/controllers/webhook.controller.js`
- `backend/src/routes/webhook.routes.js`
- `backend/src/database/index.js`
- `backend/src/app.js`

### الواجهة ذات الصلة ببناء التدفقات

- `frontend/src/pages/FlowBuilder.jsx`

كما تم حصر بقية الملفات الفعلية في المستودع، ومن بينها ملفات Baileys وauth وAI providers وواجهات الجلسات والوحدات. لم تُقرأ هذه الملفات كجزء من منطق النقل المطلوب لأنها تخص اتصال WhatsApp أو ميزات لا تدخل في نطاق workflow builder/branching/sequential actions/delays/variables/HTTP/storage، عدا ما يلزم لتحديد حدود التكامل.

## 4. ما وجدته في منطق workflow

### 4.1 نموذج التدفق وواجهة البناء

`FlowBuilder.jsx` يستخدم React Flow (`@xyflow/react`) لتمثيل التدفق كـ `nodes` و`edges`. كل node يحوي `type` و`data.pluginType` وحقول إعداد قابلة للحفظ. التدفق يُخزن في API على هيئة JSON strings (`nodes`, `edges`). الواجهة توفر:

- إنشاء nodes وربطها عبر edges.
- nodes مضمّنة للـ webhook trigger، الرسائل، AI، condition، code، delay، set variable، text formatter، وHTTP.
- handles باسم `true` و`false` في condition.
- قوالب flows جاهزة، import/export JSON، duplicate، delete، وتشغيل تجريبي بمتغيرات JSON.
- شاشة إعداد node تربط الحقول مباشرة بـ `data`.
- Socket.IO لعرض execution logs أثناء التشغيل.

الجزء القابل لإعادة الكتابة هو **مخطط graph وmetadata الخاصة بالـ nodes/edges ومحرر الإعدادات**، وليس عناصر WhatsApp أو تصميم الواجهة كاملًا. يمكن لـ FLONA الاحتفاظ بنموذج plugin الحالي وتوفير renderer/registry خاص به بدل نسخ React Flow إن كان لديه builder قائم.

### 4.2 التنفيذ المتسلسل والتفرع

`backend/src/flow/engine.js` ينفذ التدفق كالآتي:

1. ينشئ سجل `Execution` بحالة `RUNNING` ويسجل logs تدريجيًا.
2. يحلل `nodes` و`edges` من JSON.
3. يبحث عن أول node يصنف trigger عبر `pluginType` أو category.
4. يبني context يحوي `flow`, `logger`, `pushExecutionLog`, `variables` وحقول الإدخال.
5. يستدعي plugin الحالي ثم يجد outgoing edges ويزور targets بالتتابع باستخدام recursion و`await`.
6. يستخدم `ctx.nextNodeHandle` كإشارة edge filtering؛ condition يضعها إلى `true` أو `false`، ثم لا يتبع إلا edge ذات `sourceHandle` المطابق.
7. يمنع الحلقة غير المنتهية بحد أقصى 60 خطوة لكل execution.
8. يحول status إلى `COMPLETED` أو `FAILED` ويسجل الأخطاء.

هذا يوفر فكرة جيدة لإعادة الكتابة: **executor موحد يستقبل graph + context + plugin registry، وينفذ كل plugin بشكل async ويرجع context**. لكن يجب تحسينها في FLONA: فصل graph traversal عن persistence، دعم cancellation/timeout، تعريف سلوك branch المتعدد بوضوح، منع الاعتماد على global mutable `ctx.nextNodeHandle`، وإضافة validation قبل التشغيل.

### 4.3 condition/branching

إضافة `condition` تدعم:

- `equals`, `not_equals`
- `contains`, `not_contains`
- `starts_with`, `ends_with`
- `greater_than`, `less_than`
- `is_empty`, `is_not_empty`

تقرأ مسارًا نقطيًا من `ctx.variables`، وتسمح بقيمة مقارنة فيها template expansion. النتيجة تضبط handle `true` أو `false`.

المنطق قابل لإعادة الكتابة، مع ضرورة إضافة coercion مضبوط للأرقام/القيم المنطقية، التعامل الصريح مع arrays/objects، schema validation للمشغل، ومنع أي path traversal غير مقصود. إضافة condition نفسها تستخدم reducer غير محمي من المفاتيح المحجوزة، بخلاف template renderer؛ ينبغي توحيد accessor آمن في FLONA.

### 4.4 التأخير والإجراءات المتسلسلة

إضافة `delay` تنفذ `setTimeout` داخل Promise، والحد الأقصى الحالي 30,000ms، ثم تعيد نفس context. هذا مناسب كبذرة plugin بسيطة، لكنه blocking بالنسبة إلى worker الذي ينفذ execution في نفس العملية. في FLONA ينبغي استخدام job/sleep abstraction قابلة للإلغاء، حدًا أقصى وسياسة quota، وعدم إبقاء HTTP request مفتوحًا لفترات طويلة إن كان التنفيذ background-capable.

الترتيب المتسلسل ليس قائمة خطوات منفصلة؛ بل ناتج traversal للـ edges. لذا يمكن إعادة استخدام مفهوم graph traversal مع plugins الحالية في FLONA دون نقل اتصال WhatsApp.

### 4.5 المتغيرات والقوالب

`backend/src/flow/template.js` يوفر:

- syntax: `{{variable.path}}`
- lookup نقطي.
- حماية من `__proto__`, `constructor`, `prototype`.
- تحويل null/undefined إلى string فارغ.
- JSON stringify للكائنات.

`set-variable` يقرأ JSON من إعداد node، يوسّع templates لكل قيمة، ثم يدمجها shallow merge في `ctx.variables`. `text-formatter` يوسّع template ويكتب النتيجة في output variable.

هذا من أكثر الأجزاء القابلة لإعادة الكتابة إلى FLONA. يوصى بتحويله إلى module مستقل في ESM، مع:

- accessor آمن واحد تستخدمه condition وtemplates.
- allowlist للأنواع والحجم، وعمق أقصى للـ paths.
- دعم صريح لقيم غير نصية عند الحاجة بدل إجبار كل شيء على `String`.
- سياسة للتعامل مع missing variables بدل الصمت التام.
- فصل variables الخاصة بالـ execution عن global/storage variables.
- عدم السماح للمستخدم بكتابة مفاتيح خطرة أو أسماء output غير صالحة.

### 4.6 HTTP

`http-request` يستخدم `axios` ويقدم GET/POST/PUT/PATCH/DELETE، template expansion في URL وheaders وbody، JSON parsing تلقائيًا للـ body، timeout قدره 20 ثانية، و`validateStatus: () => true`. يكتب:

- `httpResponse`
- `httpStatus`
- `httpError`

ويدعم `continueOnError`. هذا منطق قابل لإعادة الكتابة لكن لا ينبغي نقله كما هو إلى بيئة إنتاجية؛ يلزم في FLONA:

- allowlist/denylist للـ hosts لمنع SSRF (خصوصًا localhost، RFC1918، metadata endpoints، وredirects الخطرة).
- تقييد protocol إلى HTTPS/HTTP حسب سياسة FLONA.
- حد response/body/header size.
- timeout وAbortSignal وretry policy صريحة.
- عدم تسجيل secrets أو authorization headers.
- schema للـ headers وbody، ورفض JSON غير الصالح بدل تجاهله بصمت عند الحاجة.
- حماية من template injection وتسرب المتغيرات الحساسة.
- تحديد ما إذا كان response object يمكن حفظه كاملًا أو يجب truncation/serialization آمن.

### 4.7 التخزين

المستودع لا يستخدم lowdb؛ يستخدم Prisma Client مع SQLite (`backend/prisma/schema.prisma`). التخزين ذي الصلة:

- `Flow`: name/description/nodes/edges/isActive/sessionId.
- `Execution`: flowId/status/logs/createdAt/updatedAt.
- `Variable`: key/value global-ish.
- `Plugin`: registry metadata/config.
- `Settings`: key/value.
- `Message`: history تستخدمها AI Chat.

الـ nodes وedges مخزنة كـ JSON strings في SQLite، والـ execution logs كذلك كـ JSON string يعاد تحديثه بعد كل node. في FLONA، المطلوب هو **تكييف الفكرة مع lowdb الحالي**، لا إضافة Prisma أو SQLite. يفضل schema منخفض التعقيد مثل:

```js
{
  workflows: [{ id, name, version, enabled, nodes, edges, createdAt, updatedAt }],
  executions: [{ id, workflowId, status, logs, startedAt, finishedAt }],
  variables: { key: value }
}
```

ويفضل وضع حدود للحجم وversioning وatomic writes/locking إن كان lowdb ملفيًا. يجب عدم تخزين session credentials أو مفاتيح Baileys داخل هذا النظام.

## 5. الإضافات: ما يُعاد استخدامه وما لا يُنقل

### مناسب لإعادة الكتابة

- Graph model: `nodes`, `edges`, `sourceHandle`.
- Plugin contract: metadata (`type`, `name`, `category`, `inputs`, `outputs`, `config`) + `async execute(ctx, data)`.
- Plugin registry/load concept.
- Async traversal وتسلسل التنفيذ.
- Condition semantics وbranch handles.
- Delay semantics، بعد تحويلها إلى scheduler/cancellable wait.
- Template renderer وset-variable/text-formatter بعد hardening.
- HTTP request semantics بعد security controls.
- Execution status/log concepts.
- Flow import/export وduplicate كأفكار domain operations.

### لا ينبغي نقله إلى FLONA

- `@innovatorssoft/baileys` واتصال WhatsApp وإدارة QR/pairing/sessions.
- `send-message` و`poll` implementations لأنها adapters مباشرة إلى `ctx.whatsapp.sendMessage`؛ يستبدلها plugin/adapter الخاص بنظام FLONA الحالي فقط إذا كان مطلوبًا.
- `backend/src/baileys/` وملفات auth/session وأي credentials أو state directory.
- Prisma Client، schema، SQLite migrations/config، وطبقة `database/index.js`؛ FLONA يستخدم lowdb.
- Socket.IO وواجهة WAAI الخاصة بالـ execution logs، إلا إذا كانت FLONA تملك قناة realtime مكافئة.
- AI providers و`ai-chat` وagent/message-history لأنها خارج النطاق المطلوب، وقد تتعارض مع نظام plugins أو providers في FLONA.
- `code-exec` كما هو؛ استخدام `vm` داخل نفس process ليس sandbox أمنيًا كافيًا لمستخدم غير موثوق.
- `frontend/src/pages/FlowBuilder.jsx` بالكامل؛ يؤخذ منه model/UX فقط إذا كان builder FLONA يحتاجه.

## 6. سجل الإصدارات والتبعيات

### Root

- `waai-flow-root@1.0.0`, private، ESM غير معلن في root.
- devDependency: `concurrently ^8.2.2`، lock resolved `8.2.2` بحسب lockfile.

### Backend manifest/ranges ثم resolved من lockfile

- `@hapi/boom ^10.0.1` → `10.0.1`
- `@innovatorssoft/baileys ^7.4.4` → `7.4.4`
- `@prisma/client ^5.14.0` → `5.22.0`
- `axios ^1.7.2` → `1.18.1`
- `cors ^2.8.5` → `2.8.6`
- `dotenv ^16.4.5` → `16.6.1`
- `express ^4.19.2` → `4.22.2`
- `express-rate-limit ^8.5.2` → `8.5.2`
- `multer ^1.4.5-lts.1` → `1.4.5-lts.2`
- `pino ^9.1.0` → `9.14.0`
- `pino-pretty ^13.1.3` → `13.1.3`
- `qrcode-terminal ^0.12.0` → `0.12.0`
- `socket.io ^4.7.5` → `4.8.3`
- `uuid ^9.0.1` → `9.0.1`
- dev: `nodemon ^3.1.2` → `3.1.14`
- dev: `prisma ^5.14.0` → `5.22.0`

Backend يعلن `type: module`، ويتوافق مفهوميًا مع Node.js 22 المذكور في README. FLONA المطلوب أيضًا Node 22 وESM، لذلك يمكن نقل **أسلوب الوحدات والعقود**، لا dependency set كامل.

### Frontend manifest/ranges ثم resolved

- `@xyflow/react ^12.11.1` → `12.11.1`
- `react ^19.2.7` → `19.2.7`
- `react-dom ^19.2.7` → `19.2.7`
- `axios ^1.18.1` → `1.18.1`
- `socket.io-client ^4.8.3` → `4.8.3`
- `lucide-react ^1.23.0` → `1.23.0`
- `recharts ^3.9.2` → `3.9.2`
- `react-router-dom ^7.18.1` → `7.18.1`
- `@tanstack/react-query ^5.101.2` → `5.101.2`
- `@hookform/resolvers ^5.4.0` → `5.4.0`
- `react-hook-form ^7.80.0` → `7.80.0`
- `zod ^4.4.3` → `4.4.3`
- `clsx ^2.1.1` → `2.1.1`
- `tailwindcss ^4.3.2` → `4.3.2`
- `@tailwindcss/postcss ^4.3.2` → `4.3.2`
- `tailwind-merge ^3.6.0` → `3.6.0`
- `postcss ^8.5.16` → `8.5.16`
- `autoprefixer ^10.5.2` → `10.5.2`
- `qrcode.react ^4.2.0` → `4.2.0`
- `@vitejs/plugin-react ^6.0.3` → `6.0.3`
- dev: `typescript ~6.0.2` → `6.0.3`
- dev: `vite ^8.1.1` → `8.1.3`

### التبعيات التي لا ينبغي نقلها

- Baileys وحزم QR/session: مرتبطة مباشرة بهدف لا تريده FLONA في هذه الدراسة.
- Prisma و`@prisma/client` و`prisma`: تتعارض مع lowdb وتضيف schema/runtime/migration surface غير مطلوب.
- Express/cors/rate-limit/multer: لا تنقل إلا إذا كان FLONA نفسه يحتاجها؛ ليست جزءًا من workflow semantics.
- Socket.IO و`socket.io-client`: ليست مطلوبة إذا كان نظام plugins/observability في FLONA له channel مختلف.
- Pino وpino-pretty: استبدلها logger الحالي في FLONA مع الحفاظ على execution log contract.
- كل AI provider packages/logic: خارج النطاق ومتصلة بمفاتيح/سياسات WAAI.
- React Flow وTailwind وواجهة WAAI: لا تُضاف تلقائيًا؛ فقط إذا قرر FLONA اعتماد نفس builder frontend.
- `vm` ليس dependency خارجية لكنه لا ينبغي اعتباره sandbox آمنًا قابلًا للنقل.

الاعتماد الوحيد الذي يبرر نقله كفكرة، وليس بالضرورة dependency، هو HTTP client؛ Node 22 يوفر `fetch` المدمج، لذلك يمكن تجنب `axios` إن كان أسلوب FLONA يعتمد على fetch.

## 7. المخاطر

1. **تنفيذ code-exec غير آمن:** `vm.Script` بمهلة 3 ثوانٍ لا يوفر عزلًا أمنيًا حقيقيًا ضد مستخدم خبيث أو side channels؛ لا يُنقل إلا إلى worker/process sandbox مستقل مع policy قوية، أو يُحذف.
2. **SSRF في HTTP node:** URL والheaders/body يمكنها استخدام قيم يحددها المستخدم؛ لا يوجد host allowlist ولا منع metadata/private IP ولا حد حجم response.
3. **تسرب الأسرار:** template expansion يسمح بإدخال أي قيمة موجودة في context إلى URL/header/body/logs؛ يجب تصنيف secret variables ومنع تسجيلها.
4. **حلقة/تشعب غير مضبوط:** حد 60 خطوة يمنع بعض loops لكنه ليس سياسة موارد كاملة؛ لا توجد max duration، max branches، queue isolation، أو cancellation.
5. **تحديث logs لكل node:** الكتابة المتكررة إلى Prisma داخل traversal قد تكون بطيئة؛ في lowdb قد تسبب تنافس/تلف ملفي إن لم توجد atomic queue.
6. **اعتماد global mutable context:** `nextNodeHandle` في context قد يتداخل مع traversal المتعدد/parallel مستقبلًا؛ يلزم نتيجة تنفيذ typed مثل `{ context, nextHandles }`.
7. **التخزين كسلاسل JSON:** لا يوجد schema/version migration للـ graph strings؛ import JSON قد يحمل nodes غير صالحة أو plugin types مجهولة.
8. **ترتيب edges:** المحرك ينفذ كل outgoing edges المطابقة بالتتابع، وقد يشغل أكثر من فرع إذا لم تضبط handles؛ يجب تعريف semantics صراحة.
9. **فشل/زمن delay:** delay داخل request process قد يستهلك worker؛ لا توجد durable resume بعد restart.
10. **Path access غير موحد:** template يحظر مفاتيح خطرة، لكن condition `getPathValue` لا يحظرها؛ يجب ألا تُنسخ هذه الازدواجية.
11. **غياب تحقق API قوي:** controller يتحقق من أن JSON قابل للقراءة لكنه لا يفرض graph schema أو plugin config schema أو حدود الحجم.
12. **اعتماد على trigger الأول:** engine يختار أول trigger فقط؛ flows متعددة triggers ليست معرفة بوضوح.
13. **الترخيص والإسناد:** MIT يسمح بإعادة الاستخدام، لكن نقل كود فعلي دون الإبقاء على إشعار ZQ Developers يخالف الشرط العملي للترخيص.
14. **اختلاف نموذج التخزين:** Prisma relational model لا يمكن إسقاطه مباشرة على lowdb دون تصميم atomic writes، indexing بسيط، retention لسجلات executions، وversioning.
15. **اختلاف بيئة Node/ESM:** backend ESM جيد كنقطة مرجعية، لكن root scripts وfrontend toolchain لا ينبغي إدخالها إلى FLONA بلا مواءمة مع build/runtime الحالي.

## 8. خطة تكييف آمنة مع FLONA

1. عرّف `WorkflowDefinition` مستقلًا عن WhatsApp: `{id, version, enabled, trigger, nodes, edges, metadata}`، مع JSON schema وحدود للحجم وعدد nodes/edges.
2. أعد كتابة `FlowEngine` كخدمة pure-ish تستقبل `workflow`, `initialContext`, `pluginRegistry`, `storage`, `logger`, و`adapters` عبر dependency injection؛ لا تستورد Baileys أو Prisma.
3. حافظ على ESM وNode 22، واستخدم `fetch` المدمج لـ HTTP ما لم يكن FLONA لديه client موحد.
4. اجعل plugin contract الحالي في FLONA هو المصدر؛ أضف فقط plugins عامة: `condition`, `delay`, `set_variable`, `text_formatter`, `http_request`، مع أسماء/حقول متوافقة مع conventions الحالية.
5. انقل template renderer بعد توحيد safe path accessor وحظر prototype pollution، وأضف limits وtests لقيم missing/object/array/secret.
6. نفذ branching بإرجاع نتيجة صريحة من plugin بدل mutable `ctx.nextNodeHandle`، مثل `{ next: ['true'] }` أو `{ next: ['default'] }`. امنع الفروع غير الموصولة وكرر التنفيذ بسياسة واضحة.
7. ضع execution guardrails: max steps، max wall-clock duration، max nodes/branch، AbortSignal، cancellation، وdeduplication/idempotency إن كان trigger يعاد.
8. طبّق delay عبر abstraction تدعم sleep قصيرًا، وqueue/durable resume للتأخيرات الطويلة؛ لا تبقِ HTTP request مفتوحًا.
9. استخدم lowdb الموجود في FLONA عبر repository طبقة: `workflowRepository`, `executionRepository`, `variableRepository`. نفذ atomic write/serialization queue وretention للـ logs، ولا تُدخل Prisma.
10. خزّن execution logs bounded ومختصرة، مع redaction للـ tokens/passwords/authorization وtruncation لـ HTTP response.
11. طبّق HTTP egress policy: protocols مسموحة، DNS/IP validation، منع localhost/private/link-local/metadata ranges، redirects محدودة، timeout، max response bytes، وallowlist حسب plugin أو workspace.
12. افصل context namespaces: `input`, `variables`, `steps`, `http`, `meta`. لا تخلط payload الخام مع global variables، ولا تسمح للـ node بتعديل كائنات خارج execution.
13. اكتب adapters خاصة بـ FLONA عند الحاجة للرسائل أو triggers. لا تنقل `send-message`, `poll`, Baileys، أو session fields؛ اجعلها integration plugin منفصلًا خلف interface.
14. لا تنقل code-exec في الإصدار الأول. إن كان مطلوبًا لاحقًا، نفذه في worker/container/isolated process بتقليل capabilities، quota، timeout، ورفض الشبكة/الملفات افتراضيًا.
15. أضف اختبارات contract وsecurity: linear flow، true/false، nested variables، missing paths، delay bounds، HTTP errors/continueOnError، SSRF، cycles، malformed graph، plugin unknown، concurrent executions، وrestart أثناء delay.
16. احفظ attribution MIT في ملف notices أو header عند إعادة استخدام كود فعلي، وسجل commit الأصلي والنسخة المفحوصة في وثائق البحث.

## 9. الحكم النهائي

الهدف **قابل للتنفيذ** إذا اقتصر على إعادة كتابة منطق graph execution، branching، sequential async actions، bounded delay، safe variables/templates، وHTTP/storage abstractions. لا يوصى بعمل fork أو نسخ backend كامل؛ نسبة كبيرة من المشروع هي WhatsApp/Baileys، Prisma/SQLite، AI providers، auth، وواجهة تشغيل خاصة بـ WAAI. أفضل مسار هو port انتقائي صغير إلى نظام plugins الحالي في FLONA، مع lowdb repository وHTTP/security guardrails وإبقاء WhatsApp خارج المحرك العام.
