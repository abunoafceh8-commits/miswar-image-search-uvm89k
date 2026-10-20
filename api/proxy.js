import { endpoint, json, isSafeUrl, rateLimit, HttpError } from './_lib/guard.js';

/**
 * /api/proxy — وسيط صور آمن (كان سابقًا SSRF مفتوحًا بالكامل).
 * الآن: قائمة نطاقات مسموحة، منع IPs الخاصة، تحقق Content-Type، حدّ حجم، وتحويلات مُتحقَّقة.
 */
const ALLOWED = [
  'wikimedia.org', 'wikipedia.org', 'openverse.org', 'flickr.com', 'staticflickr.com',
  'unsplash.com', 'pexels.com', 'pixabay.com', 'gstatic.com', 'twimg.com', 'pbs.twimg.com',
  'cdninstagram.com', 'fbcdn.net', 'tiktokcdn.com', 'tiktokcdn-us.com', 'ytimg.com',
  'ggpht.com', 'googleusercontent.com', 'pinimg.com', 'imgur.com', 'cloudfront.net',
  'archive.org', 'web.archive.org', 'bbc.co.uk', 'cnn.com', 'reuters.com',
];
const MAX = 8 * 1024 * 1024;

export default endpoint(async (req, res) => {
  if (!rateLimit(req, res, { max: 120, windowMs: 60_000, key: 'proxy' })) return;
  const raw = req.query?.url;
  if (!raw) return json(res, 400, { error: 'url مطلوب' });
  const check = isSafeUrl(raw, { allowedHosts: ALLOWED });
  if (!check.ok) return json(res, 403, { error: 'الرابط غير مسموح', reason: check.reason });

  let current = check.url.href;
  for (let hop = 0; hop < 3; hop++) {
    const c = isSafeUrl(current, { allowedHosts: ALLOWED });
    if (!c.ok) throw new HttpError(403, 'blocked');
    const r = await fetch(c.url.href, {
      redirect: 'manual',
      headers: { 'User-Agent': 'AbuNawaf-ImageProxy/2.0', Accept: 'image/*' },
      signal: AbortSignal.timeout(12_000),
    });
    if (r.status >= 300 && r.status < 400) {
      current = new URL(r.headers.get('location'), c.url).href;
      continue;
    }
    const ct = (r.headers.get('content-type') || '').split(';')[0].trim();
    if (!/^image\/(jpeg|png|webp|gif|avif|svg\+xml)$/.test(ct)) {
      return json(res, 415, { error: 'نوع المحتوى غير مسموح: ' + ct });
    }
    const len = Number(r.headers.get('content-length') || 0);
    if (len > MAX) return json(res, 413, { error: 'حجم الصورة يتجاوز الحد' });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX) return json(res, 413, { error: 'حجم الصورة يتجاوز الحد' });
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(buf);
  }
  return json(res, 508, { error: 'تحويلات كثيرة' });
}, { name: 'proxy', methods: ['GET'] });
