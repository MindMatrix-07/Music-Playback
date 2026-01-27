
import { serialize } from 'cookie';
import { findUserCommon } from '../../_utils/db-service.js';
import { signSession } from '../../_utils/auth.js';

export default async function handler(req, res) {
    const { code } = req.query;
    const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, GOOGLE_SHEET_ID } = process.env;

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

        // 3. Prepare Cookies List
        const cookiesToSet = [];

        // A. Discord Session Cookie (Always set this so UI shows name/avatar)
        const discordCookieValue = JSON.stringify({
            id: userData.id,
            username: userData.username,
            avatar: userData.avatar
        });

        cookiesToSet.push(serialize('discord_session', discordCookieValue, {
            httpOnly: false, // Accessible to JS
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 3600,
        }));

        // B. Check if User is Already Bound (Auto-Login)
        try {
            if (GOOGLE_SHEET_ID || process.env.MONGODB_URI) {
                console.log(`Checking existing binding for user: ${userData.id}`);
                // const sheets = await getGoogleSheetClient(); // Deprecated
                const existingBinding = await findUserCommon(userData.id);

                if (existingBinding) {
                    if (existingBinding.isBlocked) {
                        console.log(`Auto-login BLOCKED: User ${userData.username} is blocked.`);
                        // Do NOT issue token, just let them land on homepage as guest/unbound
                    } else {
                        // User is already bound! Issue auth token immediately.
                        console.log(`Auto-login SUCCESS: Found binding for ${userData.username} (${userData.id})`);

                        const token = await signSession({
                            code: existingBinding.code,
                            userId: userData.id,
                            authType: 'DISCORD'
                        });

                        cookiesToSet.push(serialize('auth_token', token, {
                            httpOnly: true,
                            secure: process.env.NODE_ENV === 'production',
                            sameSite: 'strict',
                            maxAge: 60 * 60 * 24 * 365 * 10, // 10 Years
                            path: '/',
                        }));
                    }
                } else {
                    console.log(`Auto-login: No binding found for ${userData.username} (${userData.id})`);
                }
            } else {
                console.warn('Auto-login skipped: GOOGLE_SHEET_ID missing in env');
            }
        } catch (checkError) {
            console.error('Error checking existing binding:', checkError);
            // Continue without auto-login if sheet check fails
        }

        // 4. Set All Cookies
        res.setHeader('Set-Cookie', cookiesToSet);

        // Redirect back to home
        res.redirect('/');

    } catch (error) {
        console.error('Discord Auth Error:', error);
        res.status(500).json({ error: 'Internal Server Error during Discord Auth' });
    }
}
