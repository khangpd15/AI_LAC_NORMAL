/**
 * Vercel Serverless Function: RemiCare High-Fidelity Female TTS Proxy
 * Route: /api/tts?text=...
 *
 * Tác dụng:
 * 1. Đóng vai trò proxy trung gian giữa client và Google Translate TTS.
 * 2. Loại bỏ header Referer từ domain Vercel (nguyên nhân khiến Google chặn 404).
 * 3. Cache âm thanh tại Vercel Edge CDN trong 24h (max-age=86400) giúp các câu thoại
 *    phát lại tức thì (<20ms), tiết kiệm băng thông và mượt mà tuyệt đối.
 */
export default async function handler(req, res) {
  // CORS headers để tương thích mọi môi trường
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const text = (req.query && req.query.text) || '';
  if (!text || typeof text !== 'string') {
    return res.status(400).send('Missing text parameter');
  }

  const cleanText = text.trim();
  const primaryUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=vi&client=tw-ob`;
  const fallbackUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=vi&q=${encodeURIComponent(cleanText)}`;

  try {
    let upstreamRes = await fetch(primaryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'audio/mpeg, audio/*;q=0.9',
      },
    });

    if (!upstreamRes.ok) {
      console.warn(`[API/TTS] Primary upstream returned ${upstreamRes.status}, trying fallback...`);
      upstreamRes = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'audio/mpeg, audio/*;q=0.9',
        },
      });
    }

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send(`Upstream TTS failed with status ${upstreamRes.status}`);
    }

    const arrayBuffer = await upstreamRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('[API/TTS] Internal Error:', error);
    return res.status(500).send(error.message || 'TTS internal error');
  }
}
