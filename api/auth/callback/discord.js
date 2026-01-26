
import { serialize } from 'cookie';

export default async function handler(req, res) {
    const { code } = req.query;
    const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } = process.env;

    if (!code) {
        return res.status(400).json({ error: 'Missing code' });
    }

    const redirectUri = `https://${req.headers.host}/api/auth/callback/discord`;

    try {
        // 1. Exchange Code for Token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            console.error('Discord Token Error:', tokenData);
            return res.status(400).json({ error: 'Failed to authenticate with Discord' });
        }

        // 2. Get User Profile
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });

        const userData = await userResponse.json();

        // 3. Set Cookie strictly for Discord Info (Temporary, just for the Binding step)
        const cookieValue = JSON.stringify({
            id: userData.id,
            username: userData.username,
            avatar: userData.avatar
        });

        // Expires in 1 hour (plenty of time to enter the code)
        const cookie = serialize('discord_session', cookieValue, {
            httpOnly: false, // Accessible to JS so we can show "Logged in as X"
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 3600,
        });

        res.setHeader('Set-Cookie', cookie);

        // Redirect back to home
        res.redirect('/');

    } catch (error) {
        console.error('Discord Auth Error:', error);
        res.status(500).json({ error: 'Internal Server Error during Discord Auth' });
    }
}
