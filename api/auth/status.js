import { verifySession } from '../_utils/auth.js';
import { verifyToken } from '../_utils/auth.js';
import { connectToDatabase, SystemSettings } from '../_utils/mongodb.js';
import { parse } from 'cookie';

export default async function handler(req, res) {
    // Prevent Caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    await connectToDatabase();

    // 1. Check Maintenance Mode
    const settings = await SystemSettings.findOne({ key: 'maintenance' });
    if (settings && settings.value && settings.value.active) {
        return res.status(200).json({
            authenticated: false,
            maintenance: true,
            reason: settings.value.reason
        });
    }

    const cookies = parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    const discordSession = cookies.discord_session ? JSON.parse(cookies.discord_session) : null;

    if (!token) {
        return res.status(200).json({
            authenticated: false,
            discordUser: discordSession
        });
    }

    const payload = await verifySession(token);

    if (payload) {
        return res.status(200).json({ authenticated: true, user: payload });
    } else {
        return res.status(200).json({
            authenticated: false,
            discordUser: discordSession
        });
    }
}
