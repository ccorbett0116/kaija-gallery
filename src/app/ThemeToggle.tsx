// src/app/ThemeToggle.tsx
'use client';

import { useTheme } from './ThemeProvider';
import { usePathname } from 'next/navigation';

export default function ThemeToggle() {
    const { theme, toggleTheme, mounted } = useTheme();
    const pathname = usePathname();

    const hideOn = ['/dates/new', '/ideas/new', '/media/upload'];
    const shouldHide = hideOn.some((prefix) => pathname?.startsWith(prefix));

    if (!mounted || shouldHide) return null;


    return (
        <button
            onClick={toggleTheme}
            className="fixed bottom-6 left-6 z-50 p-3 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-500 shadow-lg transition-colors"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
            {theme === 'dark' ? (
                // Sun icon for light mode
                <svg
                    className="w-5 h-5 text-slate-700 dark:text-slate-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                </svg>
            ) : (
                // Moon icon for dark mode
                <svg
                    className="w-5 h-5 text-slate-700 dark:text-slate-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                </svg>
            )}
        </button>
    );
}
