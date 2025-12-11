// src/app/ideas/page.tsx
import Link from 'next/link';
import { getIdeasCount, listIdeas } from '@/lib/ideas';
import IdeasGrid from './IdeasGrid';

export const dynamic = 'force-dynamic';

export default function IdeasPage() {
    const totalCount = getIdeasCount();
    const ideas = listIdeas();

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
                <header
                    className="fixed top-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
                    <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                        <h1 className="text-2xl font-semibold">Ideas</h1>

                        {/* Right side: Dates, Gallery, Add List */}
                        <nav className="flex items-center gap-2">
                            <Link
                                href="/"
                                className="text-sm text-slate-400 hover:text-sky-400 px-3 py-2 leading-none"
                            >
                                Dates
                            </Link>

                            <Link
                                href="/media"
                                className="text-sm text-slate-400 hover:text-sky-400 px-3 py-2 leading-none"
                            >
                                Gallery
                            </Link>

                            <Link
                                href="/ideas/new"
                                className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 min-w-[110px] text-sm font-medium hover:bg-sky-500"
                            >
                                Add List
                            </Link>
                        </nav>
                    </div>
                </header>

                <div className="pt-16"> {/* Add padding to offset the fixed header */}
                    <div className="space-y-2">
                        <h2 className="text-lg font-medium">
                            All Lists ({totalCount})
                        </h2>
                    </div>

                    {totalCount === 0 ? (
                        <p className="text-slate-400 text-sm">
                            No lists yet. Click &quot;Add List&quot; to create one.
                        </p>
                    ) : (
                        <IdeasGrid ideas={ideas} />
                    )}
                </div>
            </div>
        </main>
    );
}
