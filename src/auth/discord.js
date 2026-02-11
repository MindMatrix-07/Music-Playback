
export default function handler(req, res) {
    const { DISCORD_CLIENT_ID } = process.env;

    if (!DISCORD_CLIENT_ID) {
        return res.status(500).json({ error: 'Missing DISCORD_CLIENT_ID env var' });
    }

    const redirectUri = `https://${req.headers.host}/api/auth/callback/discord`;
    const scope = 'identify'; // We only need their ID/Username

    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scope,
    });

    res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
}
