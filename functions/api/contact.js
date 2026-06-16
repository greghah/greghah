const MAX_BODY_BYTES = 10_000;
const MAX_FIELD_LENGTHS = {
  name: 120,
  contact: 180,
  need: 2_000,
  timing: 40
};

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers
    }
  });
}

function cleanField(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, maxLength);
}

function getClientIp(request) {
  const cfIp = request.headers.get('CF-Connecting-IP');
  const forwardedFor = request.headers.get('X-Forwarded-For');

  if (cfIp) {
    return cfIp;
  }

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return null;
}

function getCountry(request) {
  return request.cf?.country || request.headers.get('CF-IPCountry') || null;
}

async function parseJson(request) {
  const contentLength = Number(request.headers.get('Content-Length') || '0');

  if (contentLength > MAX_BODY_BYTES) {
    return { error: 'Request is too large', status: 413 };
  }

  const rawBody = await request.text();

  if (!rawBody || rawBody.length > MAX_BODY_BYTES) {
    return { error: 'Request is empty or too large', status: 400 };
  }

  try {
    return { data: JSON.parse(rawBody) };
  } catch (error) {
    return { error: 'Invalid JSON', status: 400 };
  }
}

function getWebhookUrl(env) {
  if (!env.NOTIFY_WEBHOOK_URL) {
    return null;
  }

  try {
    const url = new URL(env.NOTIFY_WEBHOOK_URL);

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }

    return url.toString();
  } catch (error) {
    return null;
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return jsonResponse(
      { ok: false, error: 'Method not allowed' },
      405,
      { Allow: 'POST' }
    );
  }

  const parsed = await parseJson(request);

  if (parsed.error) {
    return jsonResponse({ ok: false, error: parsed.error }, parsed.status);
  }

  const submission = parsed.data || {};

  if (cleanField(submission.company, 200)) {
    return jsonResponse({ ok: true });
  }

  const name = cleanField(submission.name, MAX_FIELD_LENGTHS.name);
  const contact = cleanField(submission.contact, MAX_FIELD_LENGTHS.contact);
  const need = cleanField(submission.need, MAX_FIELD_LENGTHS.need);
  const timing = cleanField(submission.timing, MAX_FIELD_LENGTHS.timing);

  if (!name || !contact || !need) {
    return jsonResponse({ ok: false, error: 'Missing required fields' }, 400);
  }

  const webhookUrl = getWebhookUrl(env);

  if (!webhookUrl) {
    console.error('NOTIFY_WEBHOOK_URL is missing or invalid');
    return jsonResponse({ ok: false, error: 'Notifications are not configured' }, 503);
  }

  const payload = {
    name,
    contact,
    need,
    timing,
    timestamp: new Date().toISOString(),
    country: getCountry(request),
    ip: getClientIp(request)
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('Notify webhook failed', response.status);
      return jsonResponse({ ok: false, error: 'Unable to send message' }, 502);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('Notify webhook request failed');
    return jsonResponse({ ok: false, error: 'Unable to send message' }, 502);
  }
}
