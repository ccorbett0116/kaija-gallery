// src/app/ideas/new/page.tsx
import Link from 'next/link';
import { createIdeaAction } from './actions';
import NewIdeaForm from './ui/NewIdeaForm';

export default function NewIdeaPage() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <div className="max-w-2xl mx-auto py-8 px-4">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-semibold">Add an Idea</h1>
                    <Link href="/ideas" className="text-sm text-slate-400 hover:text-sky-400">
                        Back to Ideas
                    </Link>
                </div>
                <NewIdeaForm action={createIdeaAction} />
            </div>
        </main>
    );
}
