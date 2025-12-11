// src/app/ideas/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { updateIdea, deleteIdea } from '@/lib/ideas';

export async function updateIdeaAction(
    idea_id: number,
    formData: FormData
) {
    const title = formData.get('title') as string;
    const content = formData.get('content') as string | null;

    if (!title?.trim()) {
        throw new Error('Title is required');
    }

    updateIdea(idea_id, title.trim(), content);
    revalidatePath('/ideas');
}

export async function deleteIdeaAction(idea_id: number) {
    deleteIdea(idea_id);
    revalidatePath('/ideas');
}
