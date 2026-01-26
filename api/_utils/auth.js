
import { SignJWT, jwtVerify } from 'jose';

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET || 'default-dev-secret-change-me');

export async function signSession(payload) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('30d') // 30 Day Session
        .sign(SECRET_KEY);
}

export async function verifySession(token) {
    try {
        const { payload } = await jwtVerify(token, SECRET_KEY);
        return payload;
    } catch (e) {
        return null;
    }
}
