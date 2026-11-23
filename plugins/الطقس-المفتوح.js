const fetchJson = async (url, timeout = 20_000) => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; FlonaWhatsAppBot/1.0)' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
  return response.json();
};

const handler = async (m, { text }) => {
  const place = typeof text === 'string' ? text.trim() : '';
  if (!place) return m.reply('اكتب اسم المدينة. مثال: .الطقس صنعاء');
  if (place.length > 100) return m.reply('اسم المدينة طويل جدًا.');

  let openMeteoError;
  try {
    const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
    geoUrl.search = new URLSearchParams({ name: place, count: '1', language: 'ar', format: 'json' });
    const geo = await fetchJson(geoUrl.toString());
    const location = geo?.results?.[0];
    if (!location) throw new Error('Open-Meteo did not find this city');

    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
    forecastUrl.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
      timezone: 'auto'
    });
    const weather = await fetchJson(forecastUrl.toString());
    const current = weather?.current;
    if (!current) throw new Error('Open-Meteo returned no current conditions');

    const descriptions = {
      0: 'صحو', 1: 'غالبًا صحو', 2: 'غائم جزئيًا', 3: 'غائم',
      45: 'ضباب', 48: 'ضباب متجمد', 51: 'رذاذ خفيف', 53: 'رذاذ', 55: 'رذاذ كثيف',
      61: 'مطر خفيف', 63: 'مطر', 65: 'مطر غزير', 71: 'ثلج خفيف', 73: 'ثلج', 75: 'ثلج كثيف',
      80: 'زخات مطر', 81: 'زخات مطر', 82: 'زخات مطر غزيرة', 95: 'عاصفة رعدية', 96: 'عاصفة رعدية مع برد', 99: 'عاصفة رعدية قوية'
    };
    const label = [location.name, location.admin1, location.country].filter(Boolean).join('، ');
    return m.reply(`🌤️ *الطقس الآن في ${label}*\nالحالة: ${descriptions[current.weather_code] || 'غير محددة'}\nالحرارة: ${current.temperature_2m}°م (المحسوسة ${current.apparent_temperature}°م)\nالرطوبة: ${current.relative_humidity_2m}%\nسرعة الرياح: ${current.wind_speed_10m} كم/ساعة`);
  } catch (error) {
    openMeteoError = error;
    console.error('[الطقس: Open-Meteo]', error?.cause?.code || error?.message || error);
  }

  try {
    const url = `https://wttr.in/${encodeURIComponent(place)}?format=j1&lang=ar`;
    const data = await fetchJson(url, 25_000);
    const current = data?.current_condition?.[0];
    if (!current) throw new Error('wttr.in returned no current conditions');
    const location = data?.nearest_area?.[0];
    const city = location?.areaName?.[0]?.value || place;
    const country = location?.country?.[0]?.value || '';
    const condition = current.lang_ar?.[0]?.value || current.weatherDesc?.[0]?.value || 'غير محددة';
    return m.reply(`🌤️ *الطقس الآن في ${[city, country].filter(Boolean).join('، ')}*\nالحالة: ${condition}\nالحرارة: ${current.temp_C}°م (المحسوسة ${current.FeelsLikeC}°م)\nالرطوبة: ${current.humidity}%\nسرعة الرياح: ${current.windspeedKmph} كم/ساعة`);
  } catch (fallbackError) {
    console.error('[الطقس: wttr.in]', fallbackError?.cause?.code || fallbackError?.message || fallbackError);
    console.error('[الطقس: Open-Meteo النهائي]', openMeteoError?.message || 'unknown');
    return m.reply('❌ تعذر جلب الطقس من الخدمتين الآن. تحقق من اتصال الـVPS وحاول لاحقًا.');
  }
};

handler.help = ['الطقس <اسم المدينة>'];
handler.tags = ['tools'];
handler.command = /^(الطقس|weather)$/i;

export default handler;
