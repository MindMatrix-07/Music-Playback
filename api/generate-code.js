export default async function handler(req, res) {
    // Basic Admin Protection
    const ADMIN_SECRET = process.env.ADMIN_SECRET;

    // Only allow if ADMIN_SECRET is set and matches
    if (!ADMIN_SECRET || req.headers['x-admin-secret'] !== ADMIN_SECRET) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const KV_REST_API_URL = process.env.KV_REST_API_URL;
    const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

    if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
        return res.status(500).json({ error: 'KV not set up' });
    }

    // Generate 5-digit code
    const code = Math.floor(10000 + Math.random() * 90000).toString();

    try {
        // Store in Redis: SET <code> "valid"
        await fetch(`${KV_REST_API_URL}/set/${code}/valid`, {
            headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
        });

        return res.status(200).json({ code, message: 'Code generated. It will work exactly once.' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
