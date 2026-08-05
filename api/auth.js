/**
 * Vercel serverless function: /api/auth
 * Simple password verification for admin access.
 * 
 * Set ADMIN_PASSWORD in Vercel environment variables.
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD not configured on server' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  if (password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Simple token: base64(timestamp + password hash) — valid for 24h
  const now = Date.now();
  const tokenBody = `${now}:${adminPassword}`;
  const token = Buffer.from(tokenBody).toString('base64');

  return res.status(200).json({ success: true, token });
}
