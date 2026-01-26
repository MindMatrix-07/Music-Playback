
import { verifySession } from '../_utils/auth.js';
import { parse } from 'cookie';

export default async function handler(req, res) {
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
