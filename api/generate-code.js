import { createCodeCommon } from './_utils/db-service.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { secret } = req.body;
    const adminSecret = process.env.ADMIN_SECRET;

    if (!adminSecret || secret !== adminSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Generate a random 6-digit code (or similar)
    // Ensure it doesn't start with 0 to avoid confusion
    const min = 100000;
    const max = 999999;
    const code = Math.floor(Math.random() * (max - min + 1)) + min;
    const codeStr = code.toString();

    try {
        const result = await createCodeCommon(codeStr);
        return res.status(200).json({ success: true, code: result.code });
    } catch (error) {
        if (error.message === 'Code already exists') {
            // Retry once? or just fail
            return res.status(409).json({ error: 'Code collision, try again' });
        }
        console.error('Generate Code Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
