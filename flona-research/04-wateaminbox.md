# WATeamInbox — مراجعة منطق قابل لإعادة الكتابة داخل FLONA

## 1. نطاق المهمة ونتيجة الوصول

تم فحص **مستودع واحد فقط**:

- المستودع: `https://github.com/ygncode/wateaminbox`
- مسار الاستنساخ: `/home/ubuntu/work/flona/research-src/wateaminbox`
- حالة الاستنساخ: نجح `git clone` ولم تظهر تعديلات محلية.
- commit المفحوص: `a148996b1962d567458b91bd9d182245ce049ae0`
- تاريخ commit: `2026-11-14T02:26:45+07:00`
- الرسالة: `feat(auth): sign in with Google (#488)`
- الفروع/الوسوم: لا توجد وسوم إصدار ظاهرة في النسخة المستنسخة.

لم أعدل شجرة المصدر الخاصة بـ FLONA. الملف الوحيد الذي أُنشئ خارج شجرة البحث هو هذا التقرير في المسار الذي طلبه المستخدم.

الهدف هنا هو استخراج أفكار ونماذج وسلوكيات قابلة لإعادة الكتابة، وليس نسخ اتصال WhatsApp أو ملفات الجلسة. لذلك استُبعدت عمدًا مكونات `services/whatsapp`، وملفات الجلسات، وطبقة `whatsmeow` من خطة النقل.

## 2. الترخيص

`LICENSE` يعلن **MIT License**، بحقوق `WATeamInbox contributors` لعام 2026. يسمح الترخيص بالاستخدام والنسخ والتعديل والدمج والنشر والترخيص من الباطن والبيع، بشرط إبقاء إشعار حقوق النشر ونص الترخيص في النسخ أو الأجزاء الجوهرية. يوجد إخلاء ضمان ومسؤولية اعتيادي.

النتيجة العملية: يمكن إعادة كتابة الأفكار أو حتى الاستفادة من أجزاء كود MIT، لكن لا ينبغي نسخ ملفات كبيرة بلا حاجة. إذا نُقلت أجزاء فعلية فيجب حفظ إشعار MIT في سجل/ملف notices مناسب داخل FLONA، مع مراجعة أي تراخيص إضافية في `THIRD_PARTY_NOTICES.md` لكل dependency يتم إدخاله. لا يعني MIT أن تبعات مزود WhatsApp أو بيانات العملاء أو أسرار الجلسات مسموحة أو آمنة.

## 3. الملفات التي فُحصت فعليًا

### الجذر والوثائق والبيانات الوصفية

- `README.md`
- `LICENSE`
- `package.json`
- `bun.lock`
- `THIRD_PARTY_NOTICES.md`
- `docs/apis/inbox.md`
- `docs/apis/conversations.md`
- `docs/apis/contacts.md`
- `docs/apis/audit.md`
- `docs/api-authorization.md`
- `docs/overview.md`
- `docs/channel-neutral-spine-rfc.md`
- `docs/unified-customer-timeline-rfc.md`
- `docs/realtime-flow.md`

### API والخدمات ذات الصلة

- `apps/api/package.json`
- `apps/api/src/services/inbox.service.ts`
- `apps/api/src/services/contact.service.ts`
- `apps/api/src/services/audit.service.ts`
- `apps/api/src/services/send-access.service.ts`
- `apps/api/src/services/conversation-case.service.ts`
- `apps/api/src/services/conversation-state.service.ts`
- `apps/api/src/services/permission.service.ts`
- `apps/api/src/services/search.service.ts`
- `apps/api/src/services/assignment-broadcast.service.ts`
- `apps/api/src/services/message-broadcast.service.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/middleware/tenant.ts`
- `apps/api/src/middleware/resource-visibility.ts`
- `apps/api/src/middleware/authorization-policy.ts`
- `apps/api/src/routes/audit.ts`
- `apps/api/src/routes/contacts/assignment.ts`
- `apps/api/src/routes/contacts/notes.ts`
- `apps/api/src/routes/contacts/chats.ts`
- `apps/api/src/routes/contacts/lifecycle.ts`
- `apps/api/src/routes/conversations/assignment.ts`
- `apps/api/src/routes/conversations/state.ts`
- `apps/api/src/routes/conversations/metadata.ts`
- `apps/api/src/routes/conversations/index.ts`
- `apps/api/src/routes/companies/members.ts`
- `apps/api/src/routes/companies/permissions.ts`
- `apps/api/src/routes/companies/invitations.ts`
- `apps/api/src/routes/mcp/tools/read.ts`
- `apps/api/src/routes/mcp/tools/write.ts`
- `apps/api/src/services/company/invitations.ts`

### الواجهة والاختبارات المرتبطة بالسلوك

- `apps/web/package.json`
- `apps/web/src/hooks/useInbox.ts`
- `apps/web/src/hooks/useContactAssignment.ts`
- `apps/web/src/hooks/useContactPrivateNotes.ts`
- `apps/web/src/hooks/useContactSharedNotes.ts`
- `apps/web/src/hooks/useConversationLifecycle.ts`
- `apps/web/src/hooks/useAudit.ts`
- `apps/web/src/components/chat/AssignmentGateBar.tsx`
- `apps/web/src/components/chat/contact-profile/AssignmentSection.tsx`
- `apps/web/src/components/chat/contact-profile/AssignmentHistorySection.tsx`
- `apps/web/src/components/chat/contact-profile/NotesPanel.tsx`
- `apps/web/src/components/chat/notes/NoteItem.tsx`
- `apps/web/src/components/chat/notes/NotesList.tsx`
- `apps/web/src/components/team/AuditLog.tsx`
- `apps/web/src/components/team/MemberPermissionsDialog.tsx`
- `apps/web/src/components/team/TeamManagement.tsx`
- `apps/web/src/lib/api/contacts.ts`
- `apps/web/src/lib/api/conversations.ts`
- `apps/web/src/lib/api/conversation-state.ts`
- `apps/web/src/lib/api/types.ts`
- `apps/web/src/stores/chat/conversation-slice.ts`
- `apps/web/src/contexts/realtime/event-handlers.ts`

### الحزم والمخططات والترحيلات

- `packages/database/package.json`
- `packages/database/src/client.ts`
- `packages/database/src/tenant-schema.ts`
- `packages/database/src/channel-spine-schema.ts`
- `packages/database/src/migrations/001_create_public_schema.ts`
- `packages/database/src/migrations/013_add_contact_query_indexes.ts`
- `packages/database/src/migrations/019_notes_system_enhancement.ts`
- `packages/database/src/migrations/045_add_invitation_role.ts`
- `packages/database/src/migrations/053_add_invitation_permissions.ts`
- `packages/database/src/migrations/061_add_conversation_cases.ts`
- `packages/database/src/migrations/096_add_conversation_notes.ts`
- `packages/shared/package.json`
- `packages/shared/src/types/company.ts`
- `packages/shared/src/types/user.ts`
- `packages/shared/src/websocket-types.ts`

## 4. صورة عامة عن المشروع والإصدارات والتبعيات

README يصف WATeamInbox كتطبيق team inbox متعدد المستخدمين ومتعدد القنوات، مع WhatsApp linked-device وTelegram Bot، وواجهة React، وHono API، وPostgreSQL tenant schemas، وRealtime، وMCP. النسخة المفحوصة ليست مشروع Node.js تقليديًا خالصًا: مدير الحزم هو `bun@1.2.18`، وAPI يعمل ضمن Bun، وهناك Go orchestrator وGo WhatsApp worker.

التبعيات المهمة في الجذر:

- `turbo ^2.11.10`
- `typescript ^5.7.2`
- `@biomejs/biome 2.6.6`
- `knip 6.44.2`
- override ثابت لـ `zod 4.6.7` و`esbuild 0.28.1`

تبعيات API التي ظهرت في `apps/api/package.json`:

- `hono ^4.13.17`، `zod 4.6.7`، `jose ^6.2.15`، `bcrypt ^6.0.0`
- `@wateaminbox/database` و`@wateaminbox/shared` و`@wateaminbox/adapter-telegram`
- `pino ^10.4.0`
- `nats ^2.29.3`
- `@aws-sdk/client-s3` و`@aws-sdk/s3-request-presigner`
- `web-push ^3.6.7`
- `dayjs ^1.11.23`
- `@modelcontextprotocol/sdk` و`@hono/mcp`
- `fflate`

تبعيات قاعدة البيانات:

- `kysely ^0.29.8`
- `pg ^8.23.1`
- `@wateaminbox/shared`

تبعيات الواجهة تشمل React 19 وVite وTanStack Query/Table/Virtual وZustand وRadix وTailwind وCentrifuge. هذه ليست مطلوبة لإعادة كتابة منطق الخادم في FLONA.

ملاحظة مهمة: المصدر لا يستخدم `lowdb`؛ يستخدم PostgreSQL عبر Kysely مع مخططات tenant وترحيلات كثيرة. لذلك لا ينبغي نقل طبقة قاعدة البيانات كما هي إلى FLONA. المطلوب هو نقل السلوك والعقود إلى repository/plugin layer فوق lowdb.

## 5. ما وجدته ضمن المجال المطلوب

### 5.1 Conversation inbox

الملف المركزي هو `apps/api/src/services/inbox.service.ts`، وتدعمه `contact.service.ts` و`inbox-cursor.ts` وواجهات `/api/inbox`.

المنطق المفيد:

1. توحيد مصدرين في قائمة واحدة: صفوف العملاء/جهات الاتصال، وخيوط conversations التي لا تملك contact row.
2. تطبيق search، account، tags، assignment، unread، وconversation status في الخادم/قاعدة البيانات **قبل** pagination.
3. ترتيب موحد حسب آخر نشاط، مع tie-breaker ثابت للنوع والمعرف.
4. استخدام keyset/cursor pagination بدل offset؛ cursor يتضمن النشاط بالميكروثانية والنوع والمعرف، مع دعم الرجوع `before`.
5. جلب `limit + 1` من كل مصدر لمعرفة وجود صفحة لاحقة ثم دمج النتائج وفرزها وأخذ الصفحة المطلوبة.
6. حماية visibility: العضو الذي لا يملك `can_view_all_chats` يرى ما هو assigned إليه فقط.
7. تضمين unread count وpreview وlast message وstatus وassignee في projection واحد قدر الإمكان.

هذا قابل لإعادة الكتابة في FLONA حتى مع lowdb، بشرط أن يكون الفهرس/الترتيب واضحًا وأن يُطبّق visibility قبل القص. يمكن البدء بـ in-memory filtering فوق lowdb، ثم إضافة materialized index أو read model إذا كبر الحجم.

### 5.2 Assignment

التعيين موجود في:

- `apps/api/src/routes/contacts/assignment.ts`
- `apps/api/src/routes/conversations/assignment.ts`
- `apps/api/src/services/contact.service.ts`
- `apps/api/src/services/send-access.service.ts`
- `packages/database/src/tenant-schema.ts`

النموذج هو سجل تاريخي `contact_assignments` يحوي `contact_id` أو `conversation_id`، `assigned_to`، `assigned_by`، `assigned_at`، و`unassigned_at`. التعيين النشط هو السجل ذو `unassigned_at IS NULL`، مع قيد/فهرس يمنع أكثر من active assignment.

السلوك المفيد:

- self-claim لعنصر غير معيّن مسموح.
- تعيين شخص آخر أو takeover يحتاج `can_assign_contacts`.
- يجب التحقق من أن الهدف عضو في workspace.
- التعيين/إلغاء التعيين يُسجّل في audit ويُبث كحدث realtime للمتأثرين.
- `getCurrentAssignment` وassignment history يفصلان projection الحالي عن التاريخ.
- visibility تُحسب من التعيين النشط مع استثناء أصحاب `can_view_all_chats`.

أقوى جزء قابل لإعادة الاستخدام هو `requireSendAccess` في `send-access.service.ts`: داخل transaction واحدة يتم قفل contact row، التحقق من block، التحقق من assignee، auto-claim اختياري، ثم التحقق من وجود active case. هذا يغلق TOCTOU بين claim وsend. في lowdb لا توجد row locks حقيقية؛ يلزم mutex/serialized write transaction أو queue per contact لتحقيق التكافؤ.

### 5.3 Notes

يوجد فصل واضح بين:

- `contact_notes_private`: ملاحظة لا يراها إلا صاحبها.
- `contact_notes_shared`: ملاحظة مشتركة، مع author identity وauthor-only update/delete في المسارات.
- `conversation_notes`: ملاحظات مرتبطة مباشرة بخيط channel-neutral conversation، مع `visibility` و`author_user_id` وtimestamps.

الترحيل `019_notes_system_enhancement.ts` يحول notes shared من عمود واحد إلى عدة سجلات، ويفصل private notes المتعددة لكل user. الترحيل `096_add_conversation_notes.ts` يضيف notes على مستوى conversation. هذا التصميم أفضل من تخزين note واحد داخل contact document.

المفيد في FLONA:

- اجعل note كيانًا مستقلًا بمعرف، author، visibility، content، created/updated timestamps.
- enforce visibility في repository وليس في UI فقط.
- لا تعتمد على `notes_shared` النصي كحقل canonical؛ إن احتاجت الواجهة preview يمكن اشتقاقه.
- سجل create/update/delete في audit.
- استخدم cursor أو limit للـ shared notes عند الحاجة.

### 5.4 Handoff history

لم يظهر كيان مستقل باسم `handoffs`؛ المنطق ممثل كسجل assignment history: كل takeover/unassign يسجل السابق واللاحق والفاعل والأزمنة. توجد أيضًا أحداث broadcast/assignment وأقسام واجهة باسم `AssignmentHistorySection`.

التكييف الآمن في FLONA هو تسمية projection أو adapter باسم `handoffHistory` فوق assignment events، لا اختراع نقل WhatsApp. كل handoff ينبغي أن يحوي `conversationId/contactId`, `fromUserId`, `toUserId|null`, `actorUserId`, `reason?`, `createdAt`، مع عدم حذف السجلات القديمة عند تغيير assignee.

### 5.5 Roles and permissions

في `001_create_public_schema.ts` يوجد enum أدوار `owner`, `admin`, `member`، وعضوية workspace تحمل `role` وJSON `permissions`. `045_add_invitation_role.ts` يحفظ الدور المختار داخل الدعوة، و`053_add_invitation_permissions.ts` يحفظ permissions المطلوبة عند الدعوة.

`apps/api/src/services/permission.service.ts` و`apps/api/src/middleware/tenant.ts` و`docs/api-authorization.md` توضحان نمطًا مهمًا:

- resolve membership والrole/permissions عند كل request.
- لا تجعل UI مصدر التفويض.
- افصل role defaults عن explicit permission overrides.
- visibility (`can_view_all_chats`) ليست مساوية لقدرة mutation (`can_assign_contacts` أو `can_send_messages`).
- كل route يعلن permission المطلوبة؛ والـ MCP يعيد التحقق من العضوية والصلاحيات الحية.

في FLONA يمكن تمثيل ذلك كـ policy plugin: `resolveActorContext`, `can(actor, action, resource)`, و`visibleConversationIds(actor)`. lowdb يجعل JSON permissions سهلًا، لكن يجب منع privilege escalation بتحديثات atomic والتحقق من owner/admin.

### 5.6 Audit

`apps/api/src/services/audit.service.ts` يقدم:

- action vocabulary typed مثل `contact.assigned`, `contact.unassigned`, `contact.note.created`, `conversation.resolved`, `member.role_changed` وغيرها.
- `entity_type` و`entity_id`.
- `details` JSON.
- actor user id، IP، وtimestamp.
- query filters حسب actor/action/entity/date مع pagination.
- actor resolution منفصلًا عن permission الخاصة بإدارة الفريق.

`routes/audit.ts` تقصر القراءة على `can_view_audit`، وتدعم actors/actions/export. هناك sanitation للتفاصيل يحذف مفاتيح token/password/secret/authorization/access-key، وCSV neutralization لمنع spreadsheet formula injection. هذه حماية جديرة بإعادة الكتابة، لا مجرد feature UI.

ملاحظة تصميمية: `createAuditLog` في المصدر يسجل الخطأ ولا يرميه حتى لا يكسر الوظيفة الأساسية. هذا قرار يحتاج تقييمًا في FLONA: للأفعال الأمنية الحرجة (تغيير role، handoff، حذف note) الأفضل جعل audit جزءًا من نفس atomic write أو على الأقل outbox durable، مع سياسة واضحة عند فشل التسجيل.

### 5.7 Contacts

`contacts` يحمل الهوية والاسم والرقم/username والحالة والصورة وblock status، مع tags وmerged contacts وchannel endpoints. `contact.service.ts` يشتق inbox projection مع last message/unread/assignment/status.

المنطق المفيد دون WhatsApp:

- contact هو customer aggregate، بينما conversation/thread منفصل.
- يمكن أن يمثل العميل عدة channel threads/accounts، ويُعرض كصف واحد مع roll-up للنشاط/unread.
- search يطابق الاسم والرقم والusername والملاحظات المشتركة، وتُطبّق visibility أثناء البحث.
- merge/unmerge يحتاجان سجلات alias/history وعدم إسقاط audit.
- block check يجب أن يكون في command guard، لا في الواجهة فقط.

## 6. ما لا ينبغي نقله

لا ينبغي نقل أو إعادة استخدام ما يلي داخل FLONA:

1. `services/whatsapp/**` و`services/orchestrator/**` و`services/shared/**` الخاصة بالـ Go worker/orchestrator.
2. أي ملفات أو جداول session/credential أو decryption أو `whatsmeow`/linked-device protocol.
3. `apps/api/src/services/whatsapp/**` و`apps/api/src/channel-spine/providers/whatsapp-linked-device/**` إلا إذا احتاج FLONA مجرد interface abstract لا implementation.
4. NATS JetStream وCentrifugo وHAProxy والبنية الإنتاجية الكاملة لمجرد الحصول على inbox semantics؛ هذه بنية تشغيلية ثقيلة وليست prerequisite للمنطق.
5. PostgreSQL tenant-schema/migration tree كاملًا؛ FLONA يستخدم lowdb، لذا تُعاد صياغة aggregate/repository والعقود فقط.
6. S3/Web Push/MCP/Telegram adapter وbulk broadcast وanalytics ما لم يطلبها نطاق FLONA صراحة.
7. أي secrets أو `.env` أو ملفات session أو بيانات تشغيلية من المستودع.
8. منطق provider-specific مثل JID، history sync، presence، receipts، remote history، أو WhatsApp account purge.

## 7. خطة تكييف آمنة مع FLONA

الخطة المقترحة، مرتبة من الأقل مخاطرة:

1. **تعريف عقود domain مستقلة عن القناة** في ESM TypeScript/Node 22: `Contact`, `Conversation`, `Assignment`, `Note`, `HandoffEvent`, `AuditEvent`, `WorkspaceMember`.
2. **إضافة plugin واحد منظم** مثل `conversation-inbox` ضمن نظام plugins الحالي، مع public commands/queries فقط: `listInbox`, `assign`, `unassign`, `listAssignmentHistory`, `addNote`, `updateNote`, `deleteNote`, `handoff`, `getAudit`.
3. **استعمال lowdb كـ repository خلف interface**، مع collections منفصلة بدل document متضخم: `contacts`, `conversations`, `assignments`, `notes`, `auditEvents`, `members`.
4. **استعمال ESM حقيقي** (`import`/`export`، امتدادات `.js` في imports عند البناء إن كان إعداد TypeScript يتطلب ذلك) وعدم إدخال Bun-specific APIs.
5. **تسلسل الكتابات** عبر mutex/queue لكل `contactId` أو `conversationId`. أي command يغير assignment أو handoff أو state يجب أن يكون atomic بالنسبة للقراءات والكتابات المتزامنة.
6. **تطبيق policy قبل query pagination**: احسب visibility أولًا، ثم filters، ثم sort، ثم cursor/limit. لا تُخفِ النتائج في UI بعد أخذ الصفحة.
7. **استخدام keyset cursor** بسيط قابل للتشفير/التوقيع: `{activityAt,id,kind}`. لا تعتمد على offset وحده لأن inbox يتغير أثناء التصفح.
8. **إعادة كتابة send guard** على مستوى command: block → assignment ownership/claim → lifecycle، داخل نفس serialized write. لا تنقل `SELECT FOR UPDATE` حرفيًا إلى lowdb.
9. **فصل private/shared/conversation notes** مع author checks في الخادم، وتسجيل كل mutation في audit.
10. **نموذج handoff تاريخي append-only** فوق assignment transitions. لا تحذف event عند unassign/takeover.
11. **Policy roles**: owner/admin/member أو أدوار FLONA الحالية، مع explicit permissions صغيرة (`view_all_chats`, `assign_contacts`, `send_messages`, `view_audit`, `manage_team`). resolve في كل command.
12. **Audit redaction وCSV safety**: sanitize recursive للحقول الحساسة، وعدم تسجيل tokens/passwords/message bodies افتراضيًا، ومعالجة قيم CSV التي تبدأ بـ `=`, `+`, `-`, `@`.
13. **اختبارات contract أولًا**: visibility matrix، self-claim، takeover، concurrent claim، note author access، handoff order، cursor no-duplicate/no-gap، audit redaction، وrole revocation.
14. **عدم ربط domain plugin بموصل WhatsApp**: موصل FLONA الحالي/المستقبلي يرسل normalized `message.received` و`message.sent` events، والـ inbox plugin يتعامل معها كمصدر channel-neutral.
15. **مراحل rollout**: ابدأ contacts + conversations + assignments، ثم notes، ثم lifecycle/handoff، ثم audit/roles، ثم realtime projection. لا تنقل whole WATeamInbox دفعة واحدة.

## 8. التبعيات المقترح عدم نقلها

لا تنقل هذه التبعيات لمجرد تقليد WATeamInbox:

- `nats`: مطلوب لبنية durable commands/events الخاصة بالمشروع الأصلي، وليس لمنطق inbox الأساسي.
- `centrifuge`/Centrifugo: استبدله بآلية realtime الحالية في FLONA أو event bus صغير.
- `@aws-sdk/*`, `web-push`, `fflate`: خارج المجال.
- `@modelcontextprotocol/sdk`, `@hono/mcp`: MCP ليس مطلوبًا في النطاق.
- `@wateaminbox/adapter-telegram`: provider-specific.
- `kysely`, `pg`: المصدر يعتمد PostgreSQL، بينما target lowdb.
- `bcrypt`, `jose`: لا تنقلها إذا كانت FLONA تملك auth/session primitives؛ استخدم primitives الموجودة لتجنب نسخ سياسة مصادقة كاملة.
- `react`, Radix, Tailwind, TanStack, Vite, Zustand: لا علاقة لها بمنطق Node plugin إلا إذا كانت واجهة FLONA تحتاج أجزاء UI.
- `turbo`, Bun-specific tooling، Go modules: لا تُدخلها في مشروع Node 22 ESM.
- `dayjs`: لا حاجة لنقلها إن كان FLONA يستخدم `Date`/`Temporal` polyfill أو utility موجودة.

تبعية صغيرة قد تكون قابلة للاستخدام فقط إن كانت موجودة أصلًا في FLONA وبمراجعة مستقلة: `zod` لعقود المدخلات، و`pino` للتسجيل. لا تُضاف تلقائيًا.

## 9. المخاطر والقيود

- **اختلاف التخزين**: PostgreSQL transactions/constraints/indexes في المصدر توفر guarantees لا يقدمها lowdb تلقائيًا؛ يجب بناء locking/atomic persistence واختبار crash consistency.
- **TOCTOU والتنافس**: self-claim وtakeover وsend قد يتصارعون. mutex على contact/conversation وحده لا يكفي إذا كان هناك أكثر من process؛ عند تعدد العمليات يلزم file lock أو single writer.
- **انكشاف البيانات**: notes وaudit details قد تحتوي PII أو secrets. يجب وجود redaction وretention policy، وعدم تسجيل message content افتراضيًا.
- **صلاحيات stale**: تخزين role/permissions في cache طويل العمر قد يبقي صلاحية ملغاة. أعد حل العضوية لكل command أو invalidation فوري.
- **pagination المتحركة**: offset قد يكرر/يسقط rows عندما تتحرك الرسائل. cursor مع tie-breaker ثابت هو الاختيار الآمن.
- **دمج contacts**: merge aliases قد يسبب duplicate visibility أو unread counts إن لم يكن هناك canonical contact mapping.
- **فصل contact عن conversation**: بعض القنوات لا تملك contact profile؛ لا تفترض أن كل thread يملك contact id.
- **فشل audit**: تجاهل فشل audit يسهل فقدان الدليل؛ جعل كل audit blocking قد يفشل عمليات user-facing. يلزم قرار FLONA واضح حسب حساسية الفعل، ويفضل durable outbox للأفعال الحرجة.
- **الاعتماد على provider semantics**: status/read/reopen/send restrictions لا تتطابق بين القنوات؛ يجب إبقاء domain adapter channel-neutral.
- **حجم lowdb**: inbox projection الكامل والبحث النصي سيضعفان مع نمو السجل؛ يلزم read model أو نقل storage لاحقًا إذا تجاوز الحجم حدود الملف.
- **توافق Node 22/ESM**: المصدر Bun/monorepo؛ بعض imports أو test/build scripts لن تعمل كما هي في Node. يجب إعادة كتابة الوحدات لا نسخها وتشغيلها.
- **ترخيص وتبعيات**: MIT يغطي المستودع، لكن التبعيات لها تراخيصها وإشعاراتها؛ أي نسخ فعلي يحتاج attribution وفحص dependency licenses.
- **مخاطر WhatsApp المستبعدة**: README يذكر unofficial linked-device client واحتمال account restriction/ban. عدم نقل whatsmeow لا يلغي مخاطر تشغيل موصل FLONA الخاص إن كان يتعامل مع WhatsApp.
- **نسخة beta متغيرة**: README يحذر من تغيّر migrations/interfaces دون backward compatibility، ولا توجد tags إصدار ظاهرة؛ يجب اعتبار commit الحالي snapshot بحثي لا API ثابتة.

## 10. الحكم النهائي

**قابل للتنفيذ: نعم، بشكل جزئي ومشروط.** يمكن إعادة كتابة منطق conversation inbox، assignment/handoff history، contact aggregate، notes، roles/permissions، وaudit في FLONA Node 22 ESM فوق lowdb ونظام plugins الحالي. أفضل ما يُعاد استخدامه هو العقود والسلوكيات والـ invariants واختبارات السياسة، وليس بنية WATeamInbox كاملة.

الحدود الحاسمة: لا يُنقل `whatsmeow` أو worker/session code، ولا تُنقل PostgreSQL/Kysely/NATS/Centrifugo stack. يجب تعويض row locks وunique partial indexes في lowdb بتسلسل كتابات مضبوط، وإضافة اختبارات تنافس وvisibility قبل اعتماد الميزة.

اقتراح الأولوية: (1) contacts/conversations + inbox cursor، (2) assignment + append-only handoff، (3) private/shared notes، (4) roles/visibility policy، (5) audit/redaction، ثم (6) realtime integration مع plugin system. هذه الخطة تحقق الهدف الوظيفي بأقل اقتران بمصدر WhatsApp وأقل خطر على مشروع FLONA.
