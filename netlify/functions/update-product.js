const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;

  console.log('Env check - CLOUD:', CLOUD ? 'set' : 'missing', 'KEY:', API_KEY ? 'set' : 'missing', 'SECRET:', API_SECRET ? 'set' : 'missing');

  if (!CLOUD || !API_KEY || !API_SECRET) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing Cloudinary credentials' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON: ' + e.message }) };
  }

  const { public_id, context } = body;
  console.log('public_id:', public_id, 'context:', JSON.stringify(context));

  if (!public_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing public_id' }) };
  }

  const contextStr = Object.entries(context || {})
    .filter(([k, v]) => v !== '' && v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join('|');

  console.log('contextStr:', contextStr);

  const timestamp = Math.floor(Date.now() / 1000);
  const params = { context: contextStr, public_id, timestamp };
  const paramsToSign = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');

  const signature = crypto
    .createHash('sha1')
    .update(paramsToSign + API_SECRET)
    .digest('hex');

  const formData = new URLSearchParams();
  formData.append('public_id', public_id);
  formData.append('context', contextStr);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', API_KEY);
  formData.append('signature', signature);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD}/image/context`,
      { method: 'POST', body: formData }
    );

    const result = await response.json();
    console.log('Cloudinary response:', response.status, JSON.stringify(result));

    if (!response.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: result }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, result })
    };
  } catch(e) {
    console.log('Fetch error:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
