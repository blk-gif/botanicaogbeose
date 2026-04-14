const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;

  if (!CLOUD || !API_KEY || !API_SECRET) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing Cloudinary credentials' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { public_id, context } = body;

  if (!public_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing public_id' }) };
  }

  // Build context string from object
  const contextStr = Object.entries(context || {})
    .map(([k, v]) => `${k}=${v}`)
    .join('|');

  // Generate Cloudinary signature
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `context=${contextStr}&public_id=${public_id}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash('sha256')
    .update(paramsToSign + API_SECRET)
    .digest('hex');

  // Call Cloudinary API
  const formData = new URLSearchParams();
  formData.append('public_id', public_id);
  formData.append('context', contextStr);
  formData.append('timestamp', timestamp);
  formData.append('api_key', API_KEY);
  formData.append('signature', signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD}/image/context`,
    { method: 'POST', body: formData }
  );

  const result = await response.json();

  if (!response.ok) {
    return { statusCode: 500, body: JSON.stringify({ error: result }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, result })
  };
};
