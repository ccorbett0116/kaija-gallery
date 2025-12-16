// src/app/ThemeProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

type ThemeContextType = {
    theme: Theme;
    toggleTheme: () => void;
    mounted: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // Start null to keep server and client markup identical; hydrate with real theme in effect.
    const [theme, setTheme] = useState<Theme | null>(null);
    const [mounted, setMounted] = useState(false);

    const applyTheme = (next: Theme) => {
        const root = document.documentElement;
        root.classList.toggle('dark', next === 'dark');
        root.style.setProperty('color-scheme', next);
    };

    useEffect(() => {
        // Sync with saved preference or system default once client is ready
        const savedTheme = localStorage.getItem('theme');
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const initialTheme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : systemTheme;

        setTheme(initialTheme);
        localStorage.setItem('theme', initialTheme);
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted || !theme) return;

        // Update document class, color scheme, and localStorage
        applyTheme(theme);
        localStorage.setItem('theme', theme);
    }, [theme, mounted]);

    const toggleTheme = () => {
        setTheme((prev) => {
            const next = prev === 'dark' ? 'light' : 'dark';
            return next ?? 'dark';
        });
    };

    const resolvedTheme: Theme = theme ?? 'light';

    return (
        <ThemeContext.Provider value={{ theme: resolvedTheme, toggleTheme, mounted }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
