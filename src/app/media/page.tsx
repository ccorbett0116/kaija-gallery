// src/app/media/page.tsx
import Link from 'next/link';
import { getTotalMediaCount } from '@/lib/media';
import MediaGridVirtual from './MediaGridVirtual';

export const dynamic = 'force-dynamic';

export default function MediaGalleryPage() {
    const totalCount = getTotalMediaCount();

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
                <header className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold">Media Gallery</h1>
                    <div className="flex gap-2">
                        <Link
                            href="/"
                            className="text-sm text-slate-400 hover:text-sky-400"
                        >
                            Dates
                        </Link>
                        <span className="text-slate-600">|</span>
                        <Link
                            href="/media/upload"
                            className="inline-flex items-center rounded-md bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500"
                        >
                            + Upload Media
                        </Link>
                    </div>
                </header>

                <div className="space-y-2">
                    <h2 className="text-lg font-medium">
                        All Media ({totalCount})
                    </h2>
                </div>

                {totalCount === 0 ? (
                    <p className="text-slate-400 text-sm">
                        No media yet. Click &quot;Upload Media&quot; to add photos or videos.
                    </p>
                ) : (
                    <MediaGridVirtual initialTotal={totalCount} />
                )}
            </div>
        </main>
    );
}
