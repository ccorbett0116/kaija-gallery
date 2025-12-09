// src/app/dates/new/page.tsx
import { createDateAction } from './actions';
import NewDateForm from './ui/NewDateForm';

export default function NewDatePage() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <div className="max-w-2xl mx-auto py-8 px-4">
                <h1 className="text-2xl font-semibold mb-4">Add a Date</h1>
                <NewDateForm />
            </div>
        </main>
    );
}
