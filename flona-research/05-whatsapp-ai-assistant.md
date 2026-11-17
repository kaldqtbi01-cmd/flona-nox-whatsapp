# بحث: WhatsApp AI Assistant

## 1. نطاق الفحص ونتيجته

تم فحص مستودع واحد فقط:

- **المستودع:** https://github.com/karimulislambd/whatsapp-ai-assistant
- **مسار النسخة المستنسخة:** `/home/ubuntu/work/flona/research-src/whatsapp-ai-assistant`
- **الفرع/الحالة:** `main`، نظيف، متتبع لـ `origin/main`
- **آخر commit مفحوص:** `5f66d228b1f2415d5ef505efbf0e77cc7ca560d4`
- **تاريخ آخر commit:** `2026-10-24T21:17:44+06:00`
- **الوسوم (tags):** لا توجد وسوم Git منشورة في النسخة المستنسخة.
- **نوع المشروع الفعلي:** Python 3.11+/FastAPI، وليس Node.js ولا Baileys.
- **الهدف من هذا التقرير:** استخراج أفكار قابلة لإعادة الكتابة داخل FLONA فقط؛ لم يتم نسخ اتصال WhatsApp Cloud API أو ملفات جلسات، ولم يتم تعديل كود FLONA أو ملفات جلسته.

النتيجة العامة: المشروع مفيد كمصدر تصميم لمنطق multimodal، واجهة handler مستقلة عن النقل، سياسة retry، الذاكرة المقيدة، والـrate limit. لكنه لا يقدم PDF processing ولا multi-model fallback حقيقيًا؛ لديه اختيار نموذج منفصل حسب نوع الإدخال وإعادة محاولة واحدة للمزود نفسه فقط.

## 2. الترخيص والامتثال

`LICENSE` يعلن **MIT License**، وحقوق النشر في الملف:

> Copyright (c) 2026 Md Karimul Islam

الترخيص يسمح بالنسخ والتعديل وإعادة التوزيع، بشرط إبقاء إشعار حقوق النشر ونص MIT في النسخ أو الأجزاء الجوهرية، مع عدم وجود ضمان. لذلك يمكن الاستفادة من الأفكار وإعادة كتابة التنفيذ في FLONA، لكن إذا نُقلت أجزاء كود فعلية أو أجزاء جوهرية فيجب الاحتفاظ بإشعار MIT في ملف notices/third-party مناسب داخل FLONA. التوصية العملية: لا تنسخ ملفات المصدر حرفيًا؛ أعد تصميم المنطق بلغة JavaScript/ESM، وسجل المصدر والترخيص في سجل المصادر الخاص بـ FLONA.

ترخيص FLONA في `package.json` هو MIT أيضًا، لكن هذا لا يلغي واجب حفظ إشعار المؤلف الأصلي عند نقل كود فعلي.

## 3. الملفات الفعلية التي تم فحصها

### ملفات المصدر والتشغيل

- `README.md`
- `LICENSE`
- `pyproject.toml`
- `requirements.txt`
- `requirements-dev.txt`
- `.env.example`
- `Dockerfile`
- `render.yaml`
- `app/__init__.py`
- `app/config.py`
- `app/handlers.py`
- `app/llm.py`
- `app/main.py`
- `app/memory.py`
- `app/whatsapp.py`
- `app/static/demo.html`
- `data/profile.md`
- `docs/demo-screenshot.png`

### ملفات الاختبار

- `tests/__init__.py`
- `tests/conftest.py`
- `tests/test_api.py`
- `tests/test_handlers.py`
- `tests/test_llm.py`
- `tests/test_memory.py`
- `tests/test_webhook.py`
- `tests/test_whatsapp.py`

### ملفات المستودع والبنية

- `.gitignore`
- `.github/workflows/ci.yml`

تم أيضًا استخدام `git ls-files` لتسجيل القائمة الفعلية أعلاه. لا يوجد `package.json` أو `package-lock.json` أو `pnpm-lock.yaml` أو `yarn.lock` داخل المستودع المصدر. الملفات الوحيدة التي تحمل اسم package في هذا الفحص تخص FLONA أو `node_modules` خارج المستودع المصدر وليست جزءًا من المصدر المدروس.

## 4. الإصدارات والتبعيات المسجلة

### إصدار التطبيق وبيئة Python

من `app/__init__.py`:

- `__version__ = "1.0.0"`

من `pyproject.toml`:

- Python: `>=3.11`
- Ruff target: `py311`
- pytest asyncio mode: `auto`
- الترخيص: MIT

### تبعيات الإنتاج (`requirements.txt`)

- `fastapi==0.142.2`
- `uvicorn[standard]==0.54.0`
- `httpx==0.28.1`
- `groq==1.7.0`
- `pydantic-settings==2.15.0`
- `python-multipart==0.0.32`

### تبعيات التطوير والاختبار (`requirements-dev.txt`)

- كل `requirements.txt`
- `pytest==9.1.1`
- `pytest-asyncio==1.4.0`
- `respx==0.23.1`
- `ruff==0.16.10`

### نماذج Groq الافتراضية

من `app/config.py` و`.env.example`:

- النص/المحادثة: `openai/gpt-oss-120b`
- الرؤية: `qwen/qwen3.8-27b`
- التفريغ الصوتي: `whisper-large-v3`
- مهلة LLM: 60 ثانية
- حد الصورة: 4 MiB تقريبًا (تعليق الكود يربطه بحد base64 الخاص بـGroq)
- حد الصوت: 16 MiB
- الذاكرة: 10 turns
- الحد الافتراضي: 20 رسالة لكل 600 ثانية
- قاعدة البيانات: `data/assistant.db`

ملاحظة زمنية: هذه هي الإصدارات والقيم المثبتة في commit المفحوص، ولا ينبغي اعتبارها توصية لتثبيت نفس إصدارات Python داخل FLONA.

## 5. ما يقدمه المشروع فعليًا

### 5.1 مسار transport-agnostic قابل لإعادة الكتابة

`app/handlers.py` يفصل نواة المعالجة عن WhatsApp/HTTP عبر نماذج بيانات واضحة:

- `IncomingMessage`: `user_id`, `kind`, `text`, و`load_media` lazy loader.
- `Media`: bytes و`mime_type`.
- `HandlerResult`: قائمة replies وmode.
- `Assistant.handle()` يطبق rate limit، أوامر، routing بحسب `text/image/audio/unsupported`، ثم يحول أخطاء LLM إلى رد اعتذار.

هذا هو أهم جزء قابل للتكييف مع FLONA. بدل ربط plugin بمفاتيح Baileys، يمكن جعل plugin يحول رسالة FLONA إلى كائن داخلي موحد، ثم يعيد replies عبر `m.reply` أو `conn.sendMessage` في طبقة adapter رقيقة.

ميزة التصميم المهمة: تنزيل الوسائط lazy؛ لا يتم تنزيل الملف قبل اجتياز rate limit واختيار المسار المناسب.

### 5.2 معالجة الصور

في `handlers.py`:

- يقبل MIME يبدأ بـ `image/`.
- يرفض الصورة التي تتجاوز `max_media_bytes` قبل استدعاء النموذج.
- يقتطع caption إلى `MAX_INPUT_CHARS = 4000`.
- يستخدم prompt افتراضيًا يطلب الوصف، استخراج النص المهم، وشرح مشكلة إن ظهرت في الصورة.
- يرسل bytes كـ data URL بصيغة base64 إلى chat completion متعدد الوسائط.
- يخزن نتيجة تحليل الصورة في الذاكرة العامة كرسالة اصطناعية `[Sent an image] ...` حتى يمكن طرح سؤال متابعة.

في `llm.py`:

- يستخدم `vision_model` منفصلًا.
- يرسل system prompt ونص المستخدم و`image_url` في رسالة واحدة.
- يحدد `max_tokens=900` وtemperature منخفضة.
- يرسل `reasoning_effort: none` عند استخدام نموذج Qwen لتقليل التكلفة/الزمن.

### 5.3 معالجة الصوت والتفريغ

في `handlers.py` و`llm.py`:

- ينزل الصوت lazy.
- يرفض ملفًا أكبر من `max_audio_bytes`.
- يحول MIME إلى اسم ملف مناسب لـWhisper (`ogg`, `mp3`, `m4a`, `wav` وغيرها).
- يستدعي transcription ثم يرد برسالتين: `Transcript: ...` ثم إجابة chat مبنية على التفريغ.
- إذا كان التفريغ فارغًا يرسل ردًا وديًا ولا يستدعي chat.

### 5.4 PDF والوثائق

لا يوجد PDF processing في المصدر.

- لا توجد تبعية PDF مثل `pypdf`, `PyMuPDF/fitz`, OCR أو extractor.
- `app/whatsapp.py` لا يفسر نوع `document` كمسار مدعوم؛ الأنواع الأخرى تصبح `unsupported`.
- `tests/test_api.py` يختبر صراحة أن رفع `doc.pdf` مع `application/pdf` يعيد HTTP 415.
- README يذكر أن documents غير مدعومة حاليًا.

بالتالي لا يجوز نسب دعم PDF إلى هذا المشروع أو نقله منه. دعم PDF في FLONA سيكون امتدادًا جديدًا يحتاج حد حجم، فحص MIME/توقيع الملف، استخراج نص، صفحات/صور اختيارية، وتنظيف الملفات المؤقتة.

### 5.5 النماذج المتعددة وfallback

يوجد فصل بين ثلاثة نماذج بحسب modality، لكنه ليس multi-model fallback:

- نموذج chat للنص.
- نموذج vision للصورة.
- نموذج Whisper للتفريغ.

`GroqLLM._call()` يعطل retries الخاصة بـSDK ويعيد المحاولة مرة واحدة فقط عند:

- أخطاء الاتصال/timeout.
- HTTP 429.
- HTTP 5xx.

لا يوجد انتقال إلى مزود ثانٍ أو نموذج بديل إذا فشل النموذج الأساسي، ولا ترتيب providers، ولا circuit breaker، ولا ميزانية token/cost. بعد المحاولة الثانية يرفع `LLMError` ويتحول إلى اعتذار عام.

### 5.6 الحصص والحدود

يوجد rate limiter sliding-window لكل مستخدم:

- 20 حدثًا لكل 600 ثانية افتراضيًا.
- قابل للضبط من environment.
- التخزين في جدول `rate_events`.
- حذف الأحداث الأقدم من النافذة ثم العد والإدراج تحت lock واحد.

هذه quota على عدد الطلبات فقط، وليست quota على tokens أو bytes أو تكلفة المزود. كما أن handler يستهلك quota قبل تنفيذ command أو تنزيل الوسائط، وهو قرار يمكن الإبقاء عليه أو تغييره حسب سياسة FLONA.

### 5.7 الذاكرة

`app/memory.py` يبني SQLite schema فيها:

- `messages`: user hash، mode، role، content، created_at.
- `users`: mode الحالي لكل مستخدم.
- `processed_messages`: idempotency للرسائل الواردة مع TTL سبعة أيام.
- `rate_events`: أحداث الحد الزمني.

الذاكرة تحفظ آخر 10 turns فعليًا (20 رسالة: user + assistant) لكل user/mode، وتحذف الأقدم من قاعدة البيانات لا من نتيجة القراءة فقط. `/reset` يحذف تاريخ المستخدم، و`/about` و`/chat` يفصلان السياق حسب mode.

معالجة الخصوصية الحالية:

- user id يمر عبر SHA-256 قبل التخزين.
- namespace مثل `wa:` و`web:` يفصل نوع المصدر.
- لكن README نفسه ينبه إلى أن hash الهاتف pseudonymisation وليس anonymisation، ويوصي في الإنتاج بـHMAC مع pepper سري.

### 5.8 سلوك تشغيلي واختبارات

- webhook يحقق HMAC-SHA256 على raw body باستخدام constant-time compare.
- يرد 200 فورًا ويشغل العمل في `BackgroundTasks`.
- idempotency عبر message id قبل تشغيل المهمة.
- تقسيم الردود الطويلة على paragraph/line/word قبل hard cut، بحد 4096 حرفًا.
- اختبارات الشبكة تستخدم `FakeLLM` و`respx` ولا تتصل بمزود حقيقي.

تمت محاولة تشغيل الاختبارات من خلال `python3 -m pytest -q`، لكنها لم تبدأ لأن بيئة sandbox لا تحتوي على pytest (`/usr/bin/python3: No module named pytest`). لذلك لا أبلغ عن نجاح الاختبارات؛ النتيجة الصحيحة هي **تعذر التحقق التنفيذي بسبب غياب pytest**.

## 6. ما لا ينبغي نقله إلى FLONA

1. `app/whatsapp.py` و`process_whatsapp_message()` و`main.py` المتعلق بـMeta Graph API: هذا اتصال WhatsApp Cloud API وليس Baileys، وخارج النطاق صراحة.
2. أي منطق webhook signature أو verify token الخاص بـMeta Cloud API.
3. `BackgroundTasks` الخاصة بـFastAPI؛ في FLONA يجب استخدام دورة الرسائل وqueue/worker مناسبين إذا احتاج العمل الطويل إلى durability.
4. `requirements.txt` وFastAPI/Uvicorn/Pydantic settings؛ FLONA مشروع Node 22 ESM ولا يحتاج هذه التبعيات.
5. `groq==1.7.0` كحزمة Python؛ استخدم عميل HTTP/SDK Node الموجود أو adapter موحدًا في FLONA بعد فحص توافقه.
6. SQLite مباشرة؛ FLONA لديه `lowdb` حاليًا. لا تضف قاعدة ثانية لمجرد نسخ التصميم، إلا إذا كانت هناك حاجة واضحة للمعاملات/التوازي.
7. `docs/demo-screenshot.png` وواجهة FastAPI demo؛ ليست منطقًا مطلوبًا.
8. مفاتيح/أسرار البيئة أو أي ملفات session؛ لا توجد حاجة لها في منطق plugin.
9. سياسة hash الخام كما هي؛ في FLONA استخدم HMAC-SHA256 مع secret pepper، ولا تسجل JID أو رقم الهاتف الخام.
10. فكرة أن retry الواحد هو fallback؛ يجب عدم تقديمه للمستخدم كـmulti-model fallback.

## 7. خطة تكييف آمنة مع FLONA

1. أنشئ module ESM معزولًا، مثل `lib/ai-media/`، وplugin رقيق داخل `plugins/`، بدل إدخال منطق كبير داخل `plugins/ai.js` أو نسخ ملفات المصدر.
2. عرّف عقدًا داخليًا TypeScript-like في JavaScript: `{ chatId, userId, kind, text, mimeType, loadMedia }`، مع adapter من Baileys يستخرج النص/الـcaption والوسائط فقط. لا تلمس نظام الاتصال أو مجلد الجلسة.
3. اجعل `loadMedia()` lazy، وبعد تحقق quota وsupported MIME فقط. استخدم دوال FLONA الحالية لتنزيل media من Baileys، وحدد `maxBytes` أثناء القراءة/stream وليس بعد تحميل ملف ضخم كاملًا.
4. أضف image path: تحقق MIME وتوقيع bytes والحجم، ثم مرر Buffer إلى provider adapter بصيغة base64/data URL أو upload حسب مزود FLONA. لا تفترض أن كل نموذج يقبل نفس صيغة vision.
5. أضف audio path: تحقق MIME، حد الحجم/المدة، وحول الامتداد فقط عند الحاجة. استعمل transcription adapter مستقلًا، ثم مرر transcript إلى chat adapter مع وسم واضح بأنه transcript.
6. أضف PDF path جديدًا مستقلًا (لأن المصدر لا يقدمه): حد الحجم والصفحات، استخراج text من Buffer، سقف النص قبل prompt، optional OCR/صور صفحات، ثم أرسل ملخصًا أو سؤالًا بحسب طلب المستخدم. تعامل مع PDF المشفر/المشوّه برسالة آمنة.
7. صمّم `ModelRouter` بترتيب providers/config قابل للضبط لكل modality: primary ثم secondary فقط عند أخطاء مصنفة retryable، مع timeout وbackoff وcircuit breaker وتسجيل provider/model دون محتوى حساس. هذا يحقق fallback الحقيقي الذي لا يوجد في المصدر.
8. أضف `QuotaStore` باستخدام lowdb الحالي: counters منفصلة للرسائل، bytes، transcription seconds/pages، واحتياطي token/cost إن أمكن. استخدم bucket زمني أو sliding-window مع تنظيف دوري، وطبّق atomic-ish serialized updates لأن lowdb ليس transaction store متعدد العمليات.
9. أضف `MemoryStore` فوق lowdb الحالي بدل SQLite: key مركب من `chatId/userId + mode + thread`، آخر N turns، وحقول timestamp/type/provider. خزّن ملخصًا قصيرًا اختياريًا عند تجاوز حد السياق بدل رفع N بلا حدود.
10. افصل ذاكرة الوسائط: خزّن وصفًا/نتيجة/metadata محدودة لا Buffer الخام، واحذف الملفات المؤقتة في `finally`. لا تحفظ transcript أو PDF كاملًا إلا إذا كانت سياسة FLONA تتطلب ذلك.
11. طبّق privacy key من HMAC secret لا SHA-256 عارٍ، ونظّف logs من JID والـprompts والـtranscripts، وأضف سياسة retention واضحة.
12. استخدم plugin الحالي فقط كـcommand/event adapter: ردود progress قصيرة، منع duplicate execution إن كان event delivery يعيد الرسالة، ورسائل خطأ user-friendly دون كشف provider details.
13. اكتب اختبارات Node `node --test` أو نظام الاختبار الحالي في FLONA لـ: MIME routing، الحجم، PDF rejection/acceptance بعد الإضافة، transcript ثم chat، provider fallback، quota boundary، memory trim، وcleanup عند الفشل. استخدم fake providers ولا تتصل بالشبكة.
14. ثبّت Node 22/ESM في الخطة؛ `package.json` FLONA يعلن `"type":"module"` و`node >=20` حاليًا، لذا يلزم اختبار فعلي على Node 22 قبل اعتماد أي dependency native.

## 8. التبعيات الحالية في FLONA ذات الصلة فقط

من `package.json` الجذر لـFLONA، وليس من المستودع المصدر:

- `"type": "module"`
- `"lowdb": "^3.0.0"`
- `"pdf-lib": "^1.17.1"` و`"pdfkit": "^0.13.0"` موجودتان، لكن وجودهما لا يثبت أن `pdf-lib` يستخرج نص PDF؛ يلزم اختبار/إضافة extractor مناسب.
- `"file-type": "^21.3.0"` للتحقق من نوع bytes يمكن أن يخدم media validation.
- `"ffmpeg-static"`, `"fluent-ffmpeg"`, و`"ffmpeg"` موجودة، وقد تساعد في audio normalization، مع ضرورة اختبار Node 22 وبيئة التشغيل.
- `"axios"` و`"node-fetch"` موجودتان لعمل HTTP، لكن يفضّل توحيد client وعدم إضافة SDK Python-equivalent.
- `"@whiskeysockets/baileys"` موجود كـGit dependency، ويجب إبقاء استخدامه في adapter الموجود وعدم استخراج Cloud API منه.
- `"better-sqlite3"` موجود أيضًا، لكن نطاق الخطة هو lowdb الحالي؛ لا تخلط مخازن متعددة بلا قرار معماري.

هذه ليست توصية بإضافة أي تبعية جديدة تلقائيًا. خصوصًا PDF text extraction وOCR وaudio conversion تحتاج اختيارًا مستقلًا وفحص رخص/حجم/توافق.

## 9. المخاطر والقيود

- **اختلاف المنصة:** المصدر Python/FastAPI؛ لا يمكن تطبيقه كـdrop-in Node plugin.
- **غياب PDF:** المطلوب يشمل PDF، لكن المصدر يرفضه صراحة؛ أي دعم PDF في FLONA تطوير جديد.
- **لا يوجد fallback حقيقي:** retry مرة واحدة مع Groq ليس انتقالًا إلى نموذج/مزود بديل.
- **حدود المزود:** حدود 4 MiB للصورة و16 MiB للصوت مرتبطة بهذا التطبيق/المزود، وليست قواعد عامة لـFLONA.
- **فقدان المهام:** FastAPI `BackgroundTasks` in-process؛ crash قد يفقد رسالة. في FLONA لا تنسخ هذا السلوك بلا queue أو idempotency ملائمة.
- **lowdb والتوازي:** lowdb مناسب للبساطة، لكنه ليس SQLite WAL ولا يوفر نفس ضمانات atomic concurrent updates؛ يجب serializing writes وقياس الأداء.
- **الخصوصية:** hash بلا pepper قابل للتخمين لأن أرقام الهاتف مساحة صغيرة؛ استخدم HMAC.
- **ذاكرة volatile:** المصدر يخزن تاريخًا محدودًا لكن FLONA الحالي قد تكون له مسارات ذاكرة مختلفة؛ يلزم دمج موحد حتى لا تتضارب schemas أو تتسرب بيانات بين chat/user.
- **Prompt injection:** وضع `/about` لديه عزل profile وتعليمات أساسية فقط؛ لا يعد نظام sandbox أو RAG آمنًا بالكامل.
- **أمان الملفات:** Buffer/data URL وPDF/OCR قد يسببان ضغط ذاكرة أو decompression bombs؛ يجب stream limits، page limits، timeouts، cleanup، وفحص signature.
- **تكلفة/حصص:** quota المصدر على عدد الرسائل فقط ولا تمنع استهلاك bytes/tokens أو fallback cascade؛ يلزم budget per request وper user.
- **تبعيات native:** ffmpeg/sharp/PDF/OCR قد تحتاج binaries أو build tools؛ اختبر على Node 22 وبيئة نشر FLONA قبل إدخالها.
- **اختبار غير مكتمل محليًا:** لم يمكن تشغيل pytest لغيابه في البيئة؛ الاعتماد على قراءة الاختبارات وCI المسجل في README لا يساوي تحققًا تنفيذيًا محليًا.

## 10. قرار الجدوى

**قابل لإعادة الكتابة جزئيًا (feasible = true):** نعم، منطق routing، lazy media loader، image/audio orchestration، فصل provider interface، memory trimming، mode isolation، quota sliding-window، response splitting، والاختبارات الوهمية قابل للتكييف مع FLONA.

**غير قابل للنقل كما هو:** اتصال Meta WhatsApp Cloud API، FastAPI، Python dependencies، SQLite implementation، وملفات الجلسة (ولا توجد ملفات جلسة في المصدر أصلًا). PDF وmulti-model fallback غير موجودين ويجب بناؤهما في FLONA بصورة مستقلة.

**التوصية:** استخرج design patterns فقط، واكتب تنفيذًا جديدًا ESM/Node 22 فوق plugin system وlowdb وBaileys adapter الحاليين، مع إبقاء اتصال WhatsApp خارج طبقة المعالجة، وإضافة PDF/fallback/quotas الموسعة كميزات FLONA أصلية لا كنسخ من هذا المستودع.
