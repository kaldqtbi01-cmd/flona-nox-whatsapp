import axios from 'axios';

const handler = async (m, { text }) => {
  const username = typeof text === 'string' ? text.trim() : '';
  if (!username) return m.reply('اكتب اسم مستخدم GitHub. مثال: .githubuser octocat');
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(username)) {
    return m.reply('اسم المستخدم غير صالح. استخدم أحرفًا وأرقامًا وشرطة وسطية فقط.');
  }

  try {
    const { data } = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      timeout: 12_000,
      headers: { accept: 'application/vnd.github+json' }
    });
    const lines = [
      `🐙 *GitHub: ${data.login}*`,
      data.name ? `الاسم: ${data.name}` : null,
      data.bio ? `النبذة: ${data.bio}` : null,
      data.location ? `الموقع: ${data.location}` : null,
      `المستودعات العامة: ${data.public_repos}`,
      `المتابعون: ${data.followers} | يتابع: ${data.following}`,
      `الرابط: ${data.html_url}`
    ].filter(Boolean);
    await m.reply(lines.join('\n'));
  } catch (error) {
    if (error.response?.status === 404) return m.reply('لم أجد اسم المستخدم هذا على GitHub.');
    console.error('[GitHub user]', error);
    return m.reply('❌ تعذر جلب بيانات GitHub الآن؛ حاول لاحقًا.');
  }
};

handler.help = ['githubuser <اسم المستخدم>'];
handler.tags = ['tools'];
handler.command = /^(githubuser|ghuser|مستخدم_جيتهاب)$/i;

export default handler;
