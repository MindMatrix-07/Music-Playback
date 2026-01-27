
import { connectToDatabase, Analytics } from '../../_utils/mongodb.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { type, userId, details } = req.body;

    // Simple spam protection for the analytics endpoint itself? 
    // Maybe later. For now, just log.

    try {
        await connectToDatabase();

        await Analytics.create({
            type: type || 'UNKNOWN',
            userId: userId || null,
            details: details || {}
        });

        res.status(200).json({ ok: true });
    } catch (e) {
        // Fail silently to not impact frontend
        console.error('Analytics Error:', e);
        res.status(200).json({ ok: true });
    }
}
