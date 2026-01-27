
import { connectToDatabase, AccessCode } from '../../_utils/mongodb.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { password, code, action } = req.body; // action: 'BLOCK' or 'UNBLOCK'

    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!code || !['BLOCK', 'UNBLOCK'].includes(action)) {
        return res.status(400).json({ error: 'Invalid Request' });
    }

    try {
        await connectToDatabase();

        const isBlocked = action === 'BLOCK';
        const result = await AccessCode.findOneAndUpdate(
            { code: code },
            { isBlocked: isBlocked },
            { new: true }
        );

        if (!result) {
            return res.status(404).json({ error: 'Code not found' });
        }

        res.status(200).json({ success: true, isBlocked: result.isBlocked, code: result.code });

    } catch (e) {
        console.error('User Action Error:', e);
        res.status(500).json({ error: 'Failed to update user status' });
    }
}
