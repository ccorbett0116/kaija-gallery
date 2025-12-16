// src/app/media/upload/actions.ts
'use server';

import { processImage, processVideo, createMediaEntry } from '@/lib/media';

type UploadResult =
    | { success: true }
    | { success: false; error: string };

export async function uploadMediaAction(formData: FormData): Promise<UploadResult> {
    const files = formData.getAll('media') as File[];

    if (files.length === 0 || !files[0].name) {
        return { success: false, error: 'No files uploaded' };
    }

    // Check total size of all files
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const maxSize = 500 * 1024 * 1024; // 500MB in bytes

    if (totalSize > maxSize) {
        const sizeMB = Math.round(totalSize / (1024 * 1024));
        return {
            success: false,
            error: `Upload size (${sizeMB}MB) exceeds the 500MB limit. Try uploading fewer files or compress your videos.`
        };
    }

    try {
        for (const file of files) {
            if (!file.name) continue;

            const isVideo = file.type.startsWith('video/');
            // Check both MIME type and extension for images (HEIC files often have wrong MIME type)
            const ext = file.name.toLowerCase().split('.').pop();
            const isImage = file.type.startsWith('image/') || ext === 'heic' || ext === 'heif';

            if (!isVideo && !isImage) {
                return { success: false, error: `Unsupported file type: ${file.type}` };
            }

            let result;
            if (isImage) {
                result = await processImage(file, file.name);
                createMediaEntry(
                    result.original,
                    result.display,
                    result.thumbnail,
                    'image',
                    undefined,
                    result.captureDate || undefined
                );
            } else {
                result = await processVideo(file, file.name);
                createMediaEntry(
                    result.original,
                    result.display,
                    result.thumbnail,
                    'video',
                    undefined,
                    result.captureDate || undefined
                );
            }
        }
    } catch (error) {
        console.error('Upload processing error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Upload failed. Please try again.'
        };
    }

    return { success: true };
}
