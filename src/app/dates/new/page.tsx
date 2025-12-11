// src/app/dates/new/page.tsx
import Link from 'next/link';
import { createDateAction } from './actions';
import NewDateForm from './ui/NewDateForm';

export default function NewDatePage() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <div className="max-w-2xl mx-auto py-8 px-4">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-semibold">Add a Date</h1>
                    <Link
                        href="/"
                        className="text-sm text-slate-400 hover:text-sky-400"
                    >
                        Back to Dates
                    </Link>
                </div>
                <NewDateForm action={createDateAction} />
            </div>
        </main>
    );
}
