
import { connectToDatabase, AccessCode, Analytics } from '../../_utils/mongodb.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { password } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await connectToDatabase();

        // 1. User List
        const users = await AccessCode.find({}).sort({ createdAt: -1 });

        // 2. Active Users (Last 24h) - Based on lastLogin
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const activeUsersCount = await AccessCode.countDocuments({ lastLogin: { $gte: oneDayAgo } });

        // 3. Daily Visits (Last 24h)
        const dailyVisitsCount = await Analytics.countDocuments({
            type: 'VISIT',
            createdAt: { $gte: oneDayAgo }
        });

        // 4. Spam Reports (Last 24h)
        const spamReports = await Analytics.find({
            type: 'SPAM',
            createdAt: { $gte: oneDayAgo }
        }).limit(50).sort({ createdAt: -1 });

        res.status(200).json({
            users,
            stats: {
                activeUsers: activeUsersCount,
                dailyVisits: dailyVisitsCount
            },
            spamReports
        });

    } catch (e) {
        console.error('Admin Stats Error:', e);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
}
