// src/app/login/page.tsx
import { loginAction } from './actions';
import { redirect } from 'next/navigation';
import { isAuthenticatedFromCookies } from '@/lib/auth';

type LoginPageProps = {
    searchParams?: Promise<{ error?: string; from?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const authed = await isAuthenticatedFromCookies();
    if (authed) {
        redirect('/');
    }

    const params = await searchParams;
    const error = params?.error === '1';
    const from = params?.from ?? '/';

    return (
        <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <form
            className="w-full max-w-sm space-y-4 bg-slate-900 p-6 rounded-xl shadow-md"
    action={loginAction}
    >
    <input type="hidden" name="from" value={from} />
    <h1 className="text-xl font-semibold text-center">Kaija Gallery Login</h1>

    {error && (
        <p className="text-sm text-red-400">
            Incorrect password. Please try again.
    </p>
    )}

    <label className="block space-y-1">
    <span className="text-sm">Shared Password</span>
    <input
    name="password"
    type="password"
    className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-sky-500"
        />
        </label>

        <button
    type="submit"
    className="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500"
        >
        Log in
        </button>
        </form>
        </main>
);
}
