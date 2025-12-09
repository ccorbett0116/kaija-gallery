// src/app/media/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { deleteMedia } from '@/lib/media';

export async function deleteMediaAction(mediaId: number) {
    try {
        deleteMedia(mediaId);
        revalidatePath('/media');
        return { success: true };
    } catch (error) {
        console.error('Delete error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete media'
        };
    }
}

export async function revalidateMediaPage() {
    revalidatePath('/media');
}
