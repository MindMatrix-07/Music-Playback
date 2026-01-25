export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Code required' });
    }

    // Vercel KV REST API Credentials (Automatically injected by Vercel)
    const KV_REST_API_URL = process.env.KV_REST_API_URL;
    const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

    if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
        return res.status(500).json({ error: 'Server configuration error: KV not set up' });
    }

    try {
        // 1. Check if Code Exists
        // Redis command: GET <code>
        const checkRes = await fetch(`${KV_REST_API_URL}/get/${code}`, {
            headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
        });

        const checkData = await checkRes.json();
        // Vercel KV returns { result: "value" } or { result: null }

        if (!checkData.result) {
            return res.status(401).json({ error: 'Invalid or expired code' });
        }

        // 2. Burning the Code (One-Time Use)
        // Redis command: DEL <code>
        await fetch(`${KV_REST_API_URL}/del/${code}`, {
            headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
        });

        // 3. Success
        return res.status(200).json({ success: true, token: 'device_verified_' + Date.now() });

    } catch (error) {
        console.error('KV Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
