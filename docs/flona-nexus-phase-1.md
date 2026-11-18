# FLONA NEXUS — المرحلة الأولى

هذه المرحلة تعمل على الفرع `feature/flona-nexus` ولا تغيّر `main` أو Baileys أو جلسة WhatsApp.

## Nexus Core

`lib/nexus-core.js` يضيف سربًا محدودًا من الوكلاء: RESEARCH وANALYST وSECURITY وREVIEWER، مع سجل مهام وأحداث، مهلة، حد وكلاء، ومراجعة نهائية. لا يسمح بإدخال EXECUTOR إلى التشغيل التلقائي، ولا ينفذ أوامر نظام أو يرسل رسائل.

الشخصيات الأساسية: FLONA وNOVA وATHENA وSENTINEL وCREATOR وORACLE. لكل شخصية دور وصلاحيات أولية ويمكن اختيارها لكل مستخدم.

الأوامر الجديدة:

```text
.حالة_النكسس
.سرب <المهمة>
.الشخصية
.الشخصية اختيار <FLONA|NOVA|ATHENA|SENTINEL|CREATOR|ORACLE>
```

## FLONA MATRIX

`dashboard/` لوحة محلية RTL بواجهة dark holographic. `dashboard/server.js` يقرأ `database.json` وحالة العملية، ويقدم `/api/overview`, `/api/health`, و`/manus-routes.json`. الربط الافتراضي على `127.0.0.1` فقط، ويمكن تفعيل Bearer عبر `FLONA_MATRIX_TOKEN`. لا تعرض اللوحة مفاتيح API.

التشغيل اليدوي:

```bash
FLONA_MATRIX_TOKEN='ضع_رمزًا_محليًا_على_الخادم' node dashboard/server.js
```

لا تُضاف الخدمة إلى PM2 تلقائيًا ولا تغيّر اسم عملية FLONA.

## حدود المرحلة

الهولوغرام هنا تجربة CSS/واجهة، وليس هولوغرامًا حقيقيًا داخل WhatsApp. التحديث الحي يستخدم polling كل خمس ثوانٍ بدل WebSocket. تعريض اللوحة خارج localhost يحتاج reverse proxy ومصادقة قوية وCSRF policy قبل الإنتاج.
