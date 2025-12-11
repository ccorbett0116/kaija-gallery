// src/app/ideas/new/ui/NewIdeaForm.tsx
'use client';

import { useState } from 'react';

type NewIdeaFormProps = {
    action: (formData: FormData) => Promise<void>;
    submitLabel?: string;
};

export default function NewIdeaForm({
    action,
    submitLabel = 'Save Idea',
}: NewIdeaFormProps) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        if (!title.trim()) {
            setError('Title is required.');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);

        await action(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="rounded-md bg-red-900/20 border border-red-800 px-4 py-3 text-sm text-red-400">
                    {error}
                </div>
            )}
            <div className="space-y-1">
                <label htmlFor="title" className="text-sm">Title</label>
                <input
                    id="title"
                    name="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-sky-500"
                    required
                />
            </div>

            <div className="space-y-1">
                <label htmlFor="content" className="text-sm">Content</label>
                <textarea
                    id="content"
                    name="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-sky-500"
                />
            </div>

            <button
                type="submit"
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500"
            >
                {submitLabel}
            </button>
        </form>
    );
}
