// src/app/media/upload/page.tsx
import Link from 'next/link';
import UploadForm from './UploadForm';

export default function UploadMediaPage() {
    return (
        <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
                <header className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold">Upload Media</h1>
                    <Link
                        href="/media"
                        className="text-sm text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"
                    >
                        Back to Gallery
                    </Link>
                </header>

                <UploadForm />
            </div>
        </main>
    );
}
