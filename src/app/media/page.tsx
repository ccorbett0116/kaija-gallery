// src/app/media/page.tsx
import Link from 'next/link';
import { getTotalMediaCount } from '@/lib/media';
import MediaGridVirtual from './MediaGridVirtual';

export const dynamic = 'force-dynamic';

export default function MediaGalleryPage() {
    const totalCount = getTotalMediaCount();

    return (
        <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
                <header
                    className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
                    <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                        <h1 className="text-2xl font-semibold">Gallery</h1>

                        {/* Right side: Ideas, Dates, Upload Media */}
                        <nav className="flex items-center gap-2">
                            <Link
                                href="/ideas"
                                className="text-sm text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 px-3 py-2 leading-none"
                            >
                                Ideas
                            </Link>

                            <Link
                                href="/"
                                className="text-sm text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 px-3 py-2 leading-none"
                            >
                                Dates
                            </Link>

                            <Link
                                href="/media/upload"
                                className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 min-w-[110px] text-sm font-medium text-slate-50 dark:text-slate-100 hover:bg-sky-500"
                            >
                                Upload Media
                            </Link>
                        </nav>
                    </div>
                </header>


                <div className="space-y-2">
                    <h2 className="text-lg font-medium">
                        All Media ({totalCount})
                    </h2>
                </div>

                {totalCount === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        No media yet. Click &quot;Upload Media&quot; to add photos or videos.
                    </p>
                ) : (
                    <MediaGridVirtual initialTotal={totalCount}/>
                )}
            </div>
        </main>
    );
}
