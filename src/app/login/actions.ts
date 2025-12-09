// src/app/login/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { setAuthCookie } from '@/lib/auth';

export async function loginAction(formData: FormData) {
    const password = formData.get('password')?.toString() ?? '';
    const expected = process.env.SHARED_PASSWORD;
    if (!expected) {
        throw new Error('SHARED_PASSWORD not configured');
    }

    const from = formData.get('from')?.toString() || '/';

    if (password !== expected) {
        // Re-render with error via search param
        redirect(`/login?error=1&from=${encodeURIComponent(from)}`);
    }

    await setAuthCookie();
    redirect(from || '/');
}
