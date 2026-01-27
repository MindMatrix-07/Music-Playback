
import { connectToDatabase, AccessCode, Analytics } from '../../_utils/mongodb.js';
import { createCodeCommon } from '../../_utils/db-service.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Validate Password for ALL actions
    const { password } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { action } = req.query;

    try {
        await connectToDatabase();

        switch (action) {
            case 'stats':
                return await handleStats(req, res);
            case 'create':
                return await handleCreate(req, res);
            case 'action': // Block/Unblock
                return await handleUserAction(req, res);
            case 'export':
                return await handleExport(req, res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (e) {
        console.error('Admin Handler Error:', e);
        return res.status(500).json({ error: e.message || 'Server Error' });
    }
}

// --- 1. Stats ---
async function handleStats(req, res) {
    const users = await AccessCode.find({}).sort({ createdAt: -1 });

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsers = await AccessCode.countDocuments({ lastLogin: { $gte: oneDayAgo } });
    const dailyVisits = await Analytics.countDocuments({ type: 'VISIT', createdAt: { $gte: oneDayAgo } });
    const spamReports = await Analytics.find({ type: 'SPAM', createdAt: { $gte: oneDayAgo } }).limit(50).sort({ createdAt: -1 });

    return res.status(200).json({ users, stats: { activeUsers, dailyVisits }, spamReports });
}

// --- 2. Create Code ---
async function handleCreate(req, res) {
    const { code } = req.body;
    if (!code || code.length < 3) return res.status(400).json({ error: 'Invalid code format' });

    await createCodeCommon(code);
    return res.status(200).json({ success: true, message: `Code '${code}' created successfully.` });
}

// --- 3. User Action (Block/Unblock) ---
async function handleUserAction(req, res) {
    const { code, type } = req.body; // 'BLOCK' or 'UNBLOCK'
    if (!code || !['BLOCK', 'UNBLOCK'].includes(type)) return res.status(400).json({ error: 'Invalid Request' });

    const isBlocked = type === 'BLOCK';
    const result = await AccessCode.findOneAndUpdate({ code: code }, { isBlocked: isBlocked }, { new: true });

    if (!result) return res.status(404).json({ error: 'Code not found' });
    return res.status(200).json({ success: true, isBlocked: result.isBlocked, code: result.code });
}

// --- 4. Export ---
async function handleExport(req, res) {
    const data = await AccessCode.find({}, { _id: 0, code: 1, name: 1, spotifyId: 1, status: 1, isBlocked: 1, lastLogin: 1, createdAt: 1 }).sort({ createdAt: -1 });
    return res.status(200).json(data);
}
