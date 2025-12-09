// src/proxy.ts
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'kaija_session';

// base64url encoder for ArrayBuffer
function base64UrlFromArrayBuffer(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    let base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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

async function verifySessionToken(raw: string | undefined): Promise<boolean> {
    if (!raw) return false;

    const secret = process.env.SESSION_SECRET;
    if (!secret) return false;

    const lastDot = raw.lastIndexOf('.');
    if (lastDot === -1) return false;

    const payload = raw.slice(0, lastDot);
    const signature = raw.slice(lastDot + 1);

    const enc = new TextEncoder();

    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const computed = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const computedSig = base64UrlFromArrayBuffer(computed);

    if (!safeEquals(signature, computedSig)) {
        return false;
    }

    try {
        const parsed = JSON.parse(payload);
        return parsed?.auth === true;
    } catch {
        return false;
    }
}

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (
        pathname.startsWith('/login') ||
        pathname.startsWith('/_next') ||
        pathname === '/favicon.ico' ||
        pathname.startsWith('/api/public')
    ) {
        return NextResponse.next();
    }

    const cookieValue = req.cookies.get(COOKIE_NAME)?.value;
    const authed = await verifySessionToken(cookieValue);

    if (!authed) {
        const url = req.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('from', pathname);
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
