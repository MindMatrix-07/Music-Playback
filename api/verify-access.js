
import { getGoogleSheetClient, findCodeRow, markCodeAsUsed } from './_utils/google-sheet.js';
import { signSession } from './_utils/auth.js';
import { serialize, parse } from 'cookie';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.body;

    // 1. Validate Discord Session
    const cookies = parse(req.headers.cookie || '');
    const discordSessionStr = cookies.discord_session;

    if (!discordSessionStr) {
        return res.status(401).json({
            error: 'Please login with Discord first.',
            debugCookies: Object.keys(cookies),
            debugHeaders: req.headers['content-type']
        });
    }

    let discordUser;
    try {
        discordUser = JSON.parse(discordSessionStr);
    } catch (e) {
        return res.status(401).json({ error: 'Invalid Discord session.' });
    }

    const discordId = discordUser.id;
    const discordName = discordUser.username;

    if (!code) return res.status(400).json({ error: 'Code required' });

    const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
    if (!GOOGLE_SHEET_ID) {
        console.error('Missing GOOGLE_SHEET_ID');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // 2. Check Sheet
        const sheets = await getGoogleSheetClient();
        const row = await findCodeRow(sheets, GOOGLE_SHEET_ID, code);

        // Debug info handling
        if (!row || row.error) {
            return res.status(401).json({
                error: 'Invalid access code',
                debug: row ? { rows: row.debugRows, first: row.debugFirst, code: row.debugCodeSeen } : 'No Row Return'
            });
        }

        // 3. Logic: Check Status & Binding
        // row.spotifyId checks Column C (we reuse this column for Discord ID now)
        const storedDiscordId = row.spotifyId;

        if (row.status === 'USED') {
            // Already Used: Check if it belongs to THIS Discord Account
            if (storedDiscordId === discordId) {
                // MATCH: Grant Access (Returning User)
            } else {
                // MISMATCH: Code linked to another account
                return res.status(403).json({
                    error: `This code is linked to another Discord account.`
                });
            }
        } else {
            // New Code: Bind it to THIS Discord ID
            // We use the Discord Username as the 'Name' for the sheet
            await markCodeAsUsed(sheets, GOOGLE_SHEET_ID, row.index, discordId, discordName);
        }

        // 4. Issue Lifetime Session
        const token = await signSession({
            code: row.code,
            discordId: discordId
        });

        const cookie = serialize('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 365 * 10, // 10 Years
            path: '/',
        });

        res.setHeader('Set-Cookie', cookie);
        return res.status(200).json({ success: true, message: 'Account authorized.' });

    } catch (error) {
        console.error('Auth Error:', error);
        return res.status(500).json({ error: 'Internal Authentication Error' });
    }
}
