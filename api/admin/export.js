
import { connectToDatabase, AccessCode } from '../../_utils/mongodb.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { password } = req.body;
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        await connectToDatabase();

        // Fetch ONLY AccessCode data, selecting specific fields
        const data = await AccessCode.find({}, {
            _id: 0, // Exclude Mongo ID if preferred, but usually fine to keep
            code: 1,
            name: 1,
            spotifyId: 1,
            status: 1,
            isBlocked: 1,
            lastLogin: 1,
            createdAt: 1
        }).sort({ createdAt: -1 });

        res.status(200).json(data);

    } catch (e) {
        console.error('Export Error:', e);
        res.status(500).json({ error: 'Failed to export data' });
    }
}
