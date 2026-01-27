
import { createCodeCommon } from '../../_utils/db-service.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, password } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (!ADMIN_PASSWORD) {
        return res.status(500).json({ error: 'Admin password not configured on server' });
    }

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid password' });
    }

    if (!code || code.length < 3) {
        return res.status(400).json({ error: 'Invalid code format' });
    }

    try {
        await createCodeCommon(code);
        return res.status(200).json({ success: true, message: `Code '${code}' created successfully.` });
    } catch (error) {
        console.error('Admin Add Code Error:', error);
        return res.status(400).json({ error: error.message || 'Failed to create code' });
    }
}
