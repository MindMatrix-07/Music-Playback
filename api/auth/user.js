import { verifySession } from '../_utils/auth.js';
import { connectToDatabase, AccessCode } from '../_utils/mongodb.js';
import { parse, serialize } from 'cookie';

export default async function handler(req, res) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const cookies = parse(req.headers.cookie || '');
        const token = cookies.auth_token;

        if (!token) {
            return res.status(401).json({ error: 'Not Authenticated' });
        }

        const payload = await verifySession(token);
        if (!payload || !payload.userId) {
            return res.status(401).json({ error: 'Invalid Session' });
        }

        await connectToDatabase();

        // Permanently delete the access code document
        const result = await AccessCode.deleteOne({ spotifyId: payload.userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'User data not found' });
        }

        // Clear Cookies
        res.setHeader('Set-Cookie', [
            serialize('auth_token', '', { path: '/', maxAge: -1 }),
            serialize('discord_session', '', { path: '/', maxAge: -1 })
        ]);

        return res.status(200).json({ message: 'Account data deleted successfully' });

    } catch (error) {
        console.error('Delete User Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
