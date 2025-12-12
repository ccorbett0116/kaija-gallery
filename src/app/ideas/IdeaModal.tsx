// src/app/ideas/IdeaModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Idea } from '@/lib/ideas';
import { updateIdeaAction, deleteIdeaAction } from './actions';

type Props = {
    idea: Idea;
    onClose: () => void;
};

export default function IdeaModal({ idea, onClose }: Props) {
    const router = useRouter();
    const [title, setTitle] = useState(idea.title);
    const [content, setContent] = useState(idea.content || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    // Prevent body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSaving(true);
        const formData = new FormData(e.currentTarget);
        await updateIdeaAction(idea.idea_id, formData);
        router.refresh();
        onClose();
        setIsSaving(false);
    };

    const handleDeleteConfirm = async () => {
        try {
            setIsDeleting(true);
            await deleteIdeaAction(idea.idea_id);
            // Close first so the modal doesn't linger in a deleting state if the refresh is slow.
            setShowDeleteConfirm(false);
            onClose();
            router.refresh();
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl text-slate-900 dark:text-slate-100"
                onClick={(e) => e.stopPropagation()}
            >
                <form onSubmit={handleSave} className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label htmlFor="title" className="text-sm">Title</label>
                        <input
                            id="title"
                            name="title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring focus:ring-sky-500"
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
                            rows={10}
                            className="w-full rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring focus:ring-sky-500"
                        />
                    </div>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isDeleting || isSaving}
                                className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-md disabled:opacity-50"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        <div className="flex gap-2">
                             <button
                                type="button"
                                onClick={onClose}
                                disabled={isSaving}
                                className="px-4 py-2 text-sm font-medium bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 rounded-md"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving || isDeleting}
                                className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 text-slate-50 dark:text-slate-100 rounded-md disabled:opacity-50"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {showDeleteConfirm && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setShowDeleteConfirm(false)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6 max-w-sm w-full text-slate-900 dark:text-slate-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold mb-2">Delete list?</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                            This will permanently delete this list and its content. This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 text-sm font-medium bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 rounded-md"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={isDeleting}
                                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-slate-50 dark:text-slate-100 rounded-md disabled:opacity-50"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
