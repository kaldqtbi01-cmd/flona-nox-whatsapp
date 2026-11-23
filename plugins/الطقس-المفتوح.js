import axios from 'axios';

const handler = async (m, { text }) => {
  const place = typeof text === 'string' ? text.trim() : '';
  if (!place) return m.reply('اكتب اسم المدينة. مثال: .الطقس الرياض');
  if (place.length > 100) return m.reply('اسم المدينة طويل جدًا.');

  try {
    const geo = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
      params: { name: place, count: 1, language: 'ar', format: 'json' },
      timeout: 12_000
    });
    const location = geo.data?.results?.[0];
    if (!location) return m.reply('لم أجد المدينة. جرّب كتابة اسمها بالإنجليزية.');

    const weather = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: location.latitude,
        longitude: location.longitude,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
        timezone: 'auto'
      },
      timeout: 12_000
    });
    const current = weather.data?.current;
    if (!current) throw new Error('لا توجد بيانات طقس حالية');
    const descriptions = {
      0: 'صحو', 1: 'غالبًا صحو', 2: 'غائم جزئيًا', 3: 'غائم',
      45: 'ضباب', 48: 'ضباب متجمد', 51: 'رذاذ خفيف', 53: 'رذاذ', 55: 'رذاذ كثيف',
      61: 'مطر خفيف', 63: 'مطر', 65: 'مطر غزير', 71: 'ثلج خفيف', 73: 'ثلج', 75: 'ثلج كثيف',
      80: 'زخات مطر', 81: 'زخات مطر', 82: 'زخات مطر غزيرة', 95: 'عاصفة رعدية', 96: 'عاصفة رعدية مع برد', 99: 'عاصفة رعدية قوية'
    };
    const label = [location.name, location.admin1, location.country].filter(Boolean).join('، ');
    return m.reply(`🌤️ *الطقس الآن في ${label}*\nالحالة: ${descriptions[current.weather_code] || 'غير محددة'}\nالحرارة: ${current.temperature_2m}°م (المحسوسة ${current.apparent_temperature}°م)\nالرطوبة: ${current.relative_humidity_2m}%\nسرعة الرياح: ${current.wind_speed_10m} كم/ساعة`);
  } catch (error) {
    console.error('[الطقس]', error);
    return m.reply('❌ تعذر جلب الطقس الآن؛ حاول لاحقًا.');
  }
};

handler.help = ['الطقس <اسم المدينة>'];
handler.tags = ['tools'];
handler.command = /^(الطقس|weather)$/i;

export default handler;
