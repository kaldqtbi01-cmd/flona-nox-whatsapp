import test from 'node:test'
import assert from 'node:assert/strict'
import {
  answerFootballQuestion,
  createFootballGuessHandler,
  findFreePlayerPhoto,
  isFootballPlayerGuessCorrect,
} from '../lib/football-guess-game.js'

const players = [
  {
    id: 'test-forward', nameEn: 'Test Forward', nameAr: 'لاعب هجومي', aliasesAr: ['المهاجم'],
    clubEn: 'Test City', clubAr: 'نادي الاختبار', clubAliases: ['الاختبار'],
    leagueId: 'premier_league', nationalityEn: ['Testian'], nationalityAr: ['اختباري'],
    nationalityAliases: ['دولة الاختبار'], position: 'attack',
  },
  {
    id: 'test-goalkeeper', nameEn: 'Test Goalkeeper', nameAr: 'حارس تجريبي', aliasesAr: ['الحارس'],
    clubEn: 'Sample United', clubAr: 'يونايتد التجريبي', clubAliases: ['سامبل يونايتد'],
    leagueId: 'saudi_pro', nationalityEn: ['Sample'], nationalityAr: ['تجريبي'],
    nationalityAliases: ['دولة تجريبية'], position: 'goalkeeper',
  },
  {
    id: 'test-midfielder', nameEn: 'Test Midfielder', nameAr: 'لاعب وسط تجريبي', aliasesAr: ['الوسط'],
    clubEn: 'Test Madrid', clubAr: 'مدريد التجريبي', clubAliases: [],
    leagueId: 'la_liga', nationalityEn: ['Testian'], nationalityAr: ['اختباري'],
    nationalityAliases: ['دولة الاختبار'], position: 'midfield',
  },
]

function setup() {
  const sent = []
  const replies = []
  const handler = createFootballGuessHandler({
    players,
    random: () => 0,
    imageLookup: async player => ({
      url: `https://images.example/${player.id}.jpg`,
      credit: 'Photographer — CC BY 4.0',
      sourceUrl: `https://commons.wikimedia.org/wiki/File:${player.id}.jpg`,
    }),
  })
  const conn = {
    user: { jid: 'bot@s.whatsapp.net' },
    sendMessage: async (...payload) => { sent.push(payload); return payload },
  }
  const invoke = async ({ sender = 'alice@s.whatsapp.net', command, text = '', mention = false, isGroup = true } = {}) => {
    const m = {
      chat: 'test@g.us', sender, isGroup,
      mentionedJid: mention ? ['bob@s.whatsapp.net'] : [],
      reply: async value => { replies.push(value); return value },
    }
    const participants = [
      { id: 'alice@s.whatsapp.net' },
      { id: 'bob@s.whatsapp.net' },
      { id: 'charlie@s.whatsapp.net' },
    ]
    await handler(m, { conn, text, command, usedPrefix: '.', participants })
    return { sent, replies }
  }
  return { invoke, sent, replies }
}

test('الأسئلة المدعومة تجيب نعم/لا في الدوري والنادي والجنسية والمركز', () => {
  assert.deepEqual(answerFootballQuestion('هل يلعب في إحدى الدوريات الخمس الكبرى؟', players[0]), { supported: true, yes: true, kind: 'top-five' })
  assert.equal(answerFootballQuestion('هل يلعب في الدوري الإسباني؟', players[0], players).yes, false)
  assert.equal(answerFootballQuestion('هل يلعب في نادي الاختبار؟', players[0], players).yes, true)
  assert.equal(answerFootballQuestion('هل هو من دولة تجريبية؟', players[0], players).yes, false)
  assert.equal(answerFootballQuestion('هل هو حارس مرمى؟', players[0], players).yes, false)
  assert.equal(answerFootballQuestion('هل يلعب في الدوري السعودي؟', players[1], players).yes, true)
  assert.equal(answerFootballQuestion('هل هو حارس؟', players[1], players).yes, true)
  assert.equal(answerFootballQuestion('هل شعره طويل؟', players[0], players).supported, false)
})

test('يتعرف على الاسم العربي والإنجليزي والاسم المختصر من دون كشفه نصيًا قبل التخمين', () => {
  assert.equal(isFootballPlayerGuessCorrect('لاعب هجومي', players[0]), true)
  assert.equal(isFootballPlayerGuessCorrect('Test Forward', players[0]), true)
  assert.equal(isFootballPlayerGuessCorrect('المهاجم', players[0]), true)
  assert.equal(isFootballPlayerGuessCorrect('اسم خاطئ', players[0]), false)
})

test('بدء اللعبة يرسل صورة بلا اسم اللاعب في التعليق، ويقيدها بالمذكورين', async () => {
  const { invoke, sent } = setup()
  await invoke({ command: 'تخمين_لاعب', mention: true })
  assert.equal(sent.length, 1)
  const [, payload] = sent[0]
  assert.equal(payload.image.url, 'https://images.example/test-forward.jpg')
  assert.match(payload.caption, /Photographer — CC BY 4\.0/)
  assert.doesNotMatch(payload.caption, /لاعب هجومي|Test Forward/)
  assert.deepEqual(payload.mentions, ['alice@s.whatsapp.net'])
  const result = await invoke({ sender: 'charlie@s.whatsapp.net', command: 'لاعب_خمن', text: 'شيء' })
  assert.match(result.replies.at(-1), /فقط/)
})

test('إجابة نعم تبقي الدور، وإجابة لا تسلمه للمشارك الثاني وتعرض صورته', async () => {
  const { invoke, sent, replies } = setup()
  await invoke({ command: 'تخمين_لاعب', mention: true })
  await invoke({ command: 'لاعب_سؤال', text: 'هل يلعب في الدوري الإنجليزي؟' })
  assert.match(replies.at(-1), /نعم.*بقي الدور لك/s)
  await invoke({ sender: 'bob@s.whatsapp.net', command: 'لاعب_سؤال', text: 'هل يلعب في الدوري السعودي؟' })
  assert.match(replies.at(-1), /انتظر دورك/)
  await invoke({ command: 'لاعب_سؤال', text: 'هل يلعب في الدوري الإسباني؟' })
  assert.equal(sent.length, 2)
  assert.equal(sent[1][1].image.url, 'https://images.example/test-goalkeeper.jpg')
  assert.match(sent[1][1].caption, /@bob/)
})

test('التخمين الخاطئ ينقل الدور، والصحيح ينهي الجولة ويبدأ مرحلة الحكم', async () => {
  const { invoke, sent, replies } = setup()
  await invoke({ command: 'تخمين_لاعب', mention: true })
  await invoke({ command: 'لاعب_خمن', text: 'اسم غير صحيح' })
  assert.match(replies.at(-1), /غير صحيح/)
  assert.equal(sent.at(-1)[1].image.url, 'https://images.example/test-goalkeeper.jpg')
  await invoke({ sender: 'bob@s.whatsapp.net', command: 'لاعب_خمن', text: 'حارس تجريبي' })
  assert.match(replies.at(-1), /خمنت اللاعب بنجاح/)
  assert.match(replies.at(-1), /اللاعب كان: \*حارس تجريبي\*/)
  await invoke({ sender: 'bob@s.whatsapp.net', command: 'لاعب_حكم', text: 'غنِّ مقطعًا من أغنية.' })
  assert.match(replies.at(-1), /الحكم على الخاسر/)
  assert.match(replies.at(-1), /غنِّ مقطعًا/)
})

test('الفائز وحده يضع الحكم، ويمكن لصاحب الجولة إنهاؤها', async () => {
  const { invoke, replies } = setup()
  await invoke({ command: 'تخمين_لاعب', mention: true })
  await invoke({ command: 'لاعب_خمن', text: 'لاعب هجومي' })
  await invoke({ sender: 'bob@s.whatsapp.net', command: 'لاعب_حكم', text: 'حكم ما' })
  assert.match(replies.at(-1), /الفائز فقط/)
  await invoke({ command: 'لاعب_انهاء' })
  assert.match(replies.at(-1), /تم إنهاء/)
})

test('لا تبدأ الجولة خارج المجموعة أو إذا لم تتوفر صورتان', async () => {
  const privateChat = setup()
  await privateChat.invoke({ command: 'تخمين_لاعب', mention: true, isGroup: false })
  assert.match(privateChat.replies.at(-1), /داخل مجموعة/)

  const noPhoto = createFootballGuessHandler({ players, random: () => 0, imageLookup: async () => { throw new Error('no image') } })
  const replies = []
  await noPhoto({ chat: 'test@g.us', sender: 'alice@s.whatsapp.net', isGroup: true, mentionedJid: ['bob@s.whatsapp.net'], reply: async text => replies.push(text) }, {
    conn: { user: { jid: 'bot@s.whatsapp.net' }, sendMessage: async () => assert.fail('لا يجب إرسال صورة عند فشل التجهيز') },
    command: 'تخمين_لاعب', text: '', participants: [],
  })
  assert.match(replies.at(-1), /تعذر بدء اللعبة/)
})

test('جلب صورة Commons يرفض غير المرخص ويعيد رابط الصورة ونسبة المؤلف والترخيص', async () => {
  const mockGet = async () => ({ data: { query: { pages: {
    1: {
      title: 'File:Test Forward match.jpg',
      imageinfo: [{
        thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/example.jpg',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Test_Forward_match.jpg',
        extmetadata: {
          LicenseShortName: { value: 'CC BY-SA 4.0' },
          Artist: { value: '<a>Photographer</a>' },
          ImageDescription: { value: 'Test Forward playing football' },
        },
      }],
    },
  } } } })
  const result = await findFreePlayerPhoto(players[0], mockGet)
  assert.equal(result.url, 'https://upload.wikimedia.org/wikipedia/commons/thumb/example.jpg')
  assert.equal(result.credit, 'Photographer — CC BY-SA 4.0')
  assert.match(result.sourceUrl, /commons.wikimedia.org/)

  await assert.rejects(findFreePlayerPhoto(players[0], async () => ({ data: { query: { pages: {
    1: { title: 'File:Test Forward photo.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/photo.jpg', extmetadata: {
      LicenseShortName: { value: 'Fair use' }, ImageDescription: { value: 'Test Forward' },
    } }] },
  } } } })), /لم أجد صورة موثقة/)
})
