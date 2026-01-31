
import { findCodeCommon, markCodeAsUsedCommon } from './_utils/db-service.js';
import { getGoogleSheetClient } from './_utils/google-sheet.js'; // Keep for other uses if any, or remove if unused. verified: verify-access only needs db-service now.
import { signSession } from './_utils/auth.js';
import { serialize, parse } from 'cookie';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, name, deviceId } = req.body;

    // 1. Identify User (Discord OR Device)
    const cookies = parse(req.headers.cookie || '');
    const discordSessionStr = cookies.discord_session;

    let discordUser = null;
    let userId = null;
    let authType = null; // 'DISCORD' or 'DEVICE'

    // A. Check Discord
    if (discordSessionStr) {
        try {
            discordUser = JSON.parse(discordSessionStr);
            userId = discordUser.id;
            authType = 'DISCORD';
        } catch (e) { console.error('Invalid Discord Session'); }
    }

    // B. Check Device ID (Fallback)
    if (!userId && deviceId) {
        userId = deviceId;
        authType = 'DEVICE';
    }

    // BYPASS FOR LOCAL TESTING
    if (code === '852852258') {
        const token = await signSession({
            code: '852852258',
            userId: 'local-tester',
            authType: 'TEST'
        });

        const cookie = serialize('auth_token', token, {
            httpOnly: true,
            secure: false, // Localhost isn't https usually
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30, // 30 Days
            path: '/',
        });

        res.setHeader('Set-Cookie', cookie);
        return res.status(200).json({ success: true, message: 'Test Account authorized.' });
    }

    if (!userId) {
        return res.status(401).json({
            error: 'Authentication failed. Please Login with Discord OR enable cookies.',
            debug: 'No Discord Session and No Device ID provided.'
        });
    }

    // Determine Name
    const discordName = discordUser ? discordUser.username : null;
    const finalName = name && name.trim() ? name.trim() : (discordName || 'Anonymous Device');

    if (!code) return res.status(400).json({ error: 'Code required' });

    const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || 'local-placeholder';
    if (!GOOGLE_SHEET_ID) {
        console.error('Missing GOOGLE_SHEET_ID');
        // return res.status(500).json({ error: 'Server configuration error' }); // Allow partial run
    }

    try {
        // 2. Check Database (Mongo -> Sheet Fallback)
        // const sheets = await getGoogleSheetClient(); // Deprecated direct call
        const row = await findCodeCommon(code);

        if (!row || row.error) {
            return res.status(401).json({
                error: 'Invalid access code',
                debug: row ? { rows: row.debugRows, first: row.debugFirst, code: row.debugCodeSeen } : 'No Row Return'
            });
        }

        // Check Blocked Status
        if (row.isBlocked) {
            return res.status(403).json({ error: 'This access code has been blocked by an administrator.' });
        }

        // 3. Logic: Check Status & Binding
        const storedId = row.spotifyId; // Column C

        if (row.status === 'USED') {
            // Already Used: Check if it matches OUR userId
            if (storedId === userId) {
                // MATCH: Grant Access (Re-entry allowed for original owner)
                // "The code once used cannot be used again" (by others)
                // "in the case of discord ... allow to enter" (by owner)
            } else {
                // MISMATCH
                return res.status(403).json({
                    error: `This code is linked to another ${authType === 'DISCORD' ? 'Discord Account' : 'Browser/Device'}.`
                });
            }
        } else {
            // New Code: Bind to this User ID
            await markCodeAsUsedCommon(row, userId, finalName);
        }

        // 4. Issue Session
        const token = await signSession({
            code: row.code,
            userId: userId,
            authType: authType
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
