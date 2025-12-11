'use server';

import { redirect } from 'next/navigation';
import { createIdea } from '@/lib/ideas';

export async function createIdeaAction(formData: FormData) {
    const title = formData.get('title') as string;
    const content = formData.get('content') as string | null;

    if (!title?.trim()) {
        throw new Error('Title is required');
    }

    createIdea(title.trim(), content);

    // After successfully creating the idea, redirect to the ideas list
    redirect('/ideas');
}
