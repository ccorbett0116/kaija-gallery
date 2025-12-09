// src/lib/auth.ts
'use server';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { COOKIE_NAME } from './constants';

function getSecrets() {
    const password = process.env.SHARED_PASSWORD;
    const secret = process.env.SESSION_SECRET;
    if (!password || !secret) {
        throw new Error('SHARED_PASSWORD and SESSION_SECRET must be set');
    }
    return { password, secret };
}

// HMAC-SHA256 → base64url
function sign(payload: string, secret: string): string {
    return crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('base64url');
}

// constant-time compare
function safeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

export async function createSessionValue(): Promise<string> {
    const { secret } = getSecrets();
    const payload = JSON.stringify({
        auth: true,
        iat: Date.now(),
    });
    const signature = sign(payload, secret);
    return `${payload}.${signature}`;
}

export async function verifySessionValue(raw: string | undefined): Promise<boolean> {
    if (!raw) return false;
    const { secret } = getSecrets();

    const lastDot = raw.lastIndexOf('.');
    if (lastDot === -1) return false;

    const payload = raw.slice(0, lastDot);
    const signature = raw.slice(lastDot + 1);

    const expectedSig = sign(payload, secret);
    if (!safeEquals(signature, expectedSig)) {
        return false;
    }

    try {
        const parsed = JSON.parse(payload);
        return parsed?.auth === true;
    } catch {
        return false;
    }
}

export async function setAuthCookie() {
    const cookieStore = await cookies();
    const value = await createSessionValue();
    cookieStore.set(COOKIE_NAME, value, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
    });
}

export async function clearAuthCookie() {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}

export async function isAuthenticatedFromCookies(): Promise<boolean> {
    const cookieStore = await cookies();
    const value = cookieStore.get(COOKIE_NAME)?.value;
    return await verifySessionValue(value);
}
