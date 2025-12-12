// src/app/media/upload/UploadForm.tsx
'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { uploadMediaAction } from './actions';

type UploadProgress = {
    fileName: string;
    progress: number;
    status?: 'uploading' | 'waiting' | 'retrying';
};

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const CHUNK_THRESHOLD = 5 * 1024 * 1024; // Chunk files larger than 5MB
const MAX_RETRIES = 10;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Generate stable uploadId based on file properties
function generateUploadId(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}`.replace(/[^a-zA-Z0-9.-]/g, '_');
}

// Sleep for specified milliseconds
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Wait for network to come back online
async function waitForOnline(): Promise<void> {
    if (navigator.onLine) return;

    return new Promise<void>((resolve) => {
        const handleOnline = () => {
            window.removeEventListener('online', handleOnline);
            resolve();
        };
        window.addEventListener('online', handleOnline);
    });
}

async function uploadMediaInChunks(
    file: File,
    mediaType: 'image' | 'video',
    onProgress: (progress: number, status?: 'uploading' | 'waiting' | 'retrying') => void
): Promise<void> {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = generateUploadId(file);

    // Check which chunks have already been uploaded (for resume)
    let uploadedChunks: number[] = [];
    try {
        const checkResponse = await fetch(`/api/upload-chunk?uploadId=${encodeURIComponent(uploadId)}`);
        if (checkResponse.ok) {
            const data = await checkResponse.json();
            uploadedChunks = data.uploadedChunks || [];
            console.log(`Resuming upload: ${uploadedChunks.length}/${totalChunks} chunks already uploaded`);
        }
    } catch (error) {
        console.log('Could not check existing chunks, starting fresh upload');
    }

    // Upload each chunk with retry logic
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        // Skip already uploaded chunks
        if (uploadedChunks.includes(chunkIndex)) {
            const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
            onProgress(progress, 'uploading');
            continue;
        }

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        // Retry logic with exponential backoff
        let retryCount = 0;
        let uploaded = false;

        while (!uploaded && retryCount < MAX_RETRIES) {
            try {
                // Wait for network if offline
                if (!navigator.onLine) {
                    const currentProgress = Math.round((chunkIndex / totalChunks) * 100);
                    onProgress(currentProgress, 'waiting');
                    await waitForOnline();
                }

                const formData = new FormData();
                formData.append('chunk', chunk);
                formData.append('chunkIndex', chunkIndex.toString());
                formData.append('totalChunks', totalChunks.toString());
                formData.append('filename', file.name);
                formData.append('uploadId', uploadId);
                formData.append('mediaType', mediaType);

                const response = await fetch('/api/upload-chunk', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Chunk upload failed');
                }

                uploaded = true;

                // Update progress based on chunks uploaded
                const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
                onProgress(progress, 'uploading');

            } catch (error) {
                retryCount++;

                if (retryCount >= MAX_RETRIES) {
                    throw new Error(`Failed to upload chunk ${chunkIndex} after ${MAX_RETRIES} retries: ${error}`);
                }

                // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, ...
                const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1);
                console.log(`Chunk ${chunkIndex} failed, retrying in ${delay}ms (attempt ${retryCount}/${MAX_RETRIES})`);
                const currentProgress = Math.round((chunkIndex / totalChunks) * 100);
                onProgress(currentProgress, 'retrying');
                await sleep(delay);
            }
        }
    }
}

export default function UploadForm() {
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [totalSize, setTotalSize] = useState(0);
    const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
    const [wakeLockActive, setWakeLockActive] = useState(false);
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    // Request wake lock to prevent screen sleep during uploads
    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
                setWakeLockActive(true);

                wakeLockRef.current.addEventListener('release', () => {
                    setWakeLockActive(false);
                });
            }
        } catch (err) {
            console.warn('Wake Lock failed:', err);
            // Non-critical failure, continue without wake lock
        }
    };

    // Release wake lock
    const releaseWakeLock = async () => {
        try {
            if (wakeLockRef.current) {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
                setWakeLockActive(false);
            }
        } catch (err) {
            console.warn('Wake Lock release failed:', err);
        }
    };

    // Re-request wake lock when page becomes visible again
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && wakeLockActive && !wakeLockRef.current) {
                requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            releaseWakeLock();
        };
    }, [wakeLockActive]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setSelectedFiles(files);

        const size = files.reduce((sum, file) => sum + file.size, 0);
        setTotalSize(size);

        // Clear any previous errors when selecting new files
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        const formData = new FormData(e.currentTarget);
        const files = Array.from(formData.getAll('media') as File[]);

        // Note: No file size limit with chunked uploads!

        // Separate files by type and size
        const smallImages = files.filter(f => f.type.startsWith('image/') && f.size < CHUNK_THRESHOLD);
        const largeImages = files.filter(f => f.type.startsWith('image/') && f.size >= CHUNK_THRESHOLD);
        const videos = files.filter(f => f.type.startsWith('video/'));


        startTransition(async () => {
            try {
                // Request wake lock if uploading large files
                if (largeImages.length > 0 || videos.length > 0) {
                    await requestWakeLock();
                }

                // Upload small images via Server Action (fast path)
                if (smallImages.length > 0) {
                    const imageFormData = new FormData();
                    smallImages.forEach(img => imageFormData.append('media', img));

                    const result = await uploadMediaAction(imageFormData);
                    if (result && !result.success) {
                        setError(result.error);
                        await releaseWakeLock();
                        return;
                    }
                }

                // Upload large images via chunked upload
                for (const image of largeImages) {
                    await uploadMediaInChunks(image, 'image', (progress, status = 'uploading') => {
                        setUploadProgress(prev => {
                            const existing = prev.find(p => p.fileName === image.name);
                            if (existing) {
                                return prev.map(p =>
                                    p.fileName === image.name ? { ...p, progress, status } : p
                                );
                            } else {
                                return [...prev, { fileName: image.name, progress, status }];
                            }
                        });
                    });
                }

                // Upload videos via chunked upload
                for (const video of videos) {
                    await uploadMediaInChunks(video, 'video', (progress, status = 'uploading') => {
                        setUploadProgress(prev => {
                            const existing = prev.find(p => p.fileName === video.name);
                            if (existing) {
                                return prev.map(p =>
                                    p.fileName === video.name ? { ...p, progress, status } : p
                                );
                            } else {
                                return [...prev, { fileName: video.name, progress, status }];
                            }
                        });
                    });
                }

                // All uploads successful - release wake lock and redirect
                await releaseWakeLock();
                window.location.href = '/media';
            } catch (err: any) {
                setError(err?.message || 'Upload failed. Please try again.');
                await releaseWakeLock();
            }
        });
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 MB';
        const mb = bytes / (1024 * 1024);
        return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(2)} MB`;
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-4">
                    <p className="text-sm text-red-700 dark:text-red-300">
                        <strong>Error:</strong> {error}
                    </p>
                </div>
            )}

            {selectedFiles.length > 0 && (
                <div className="rounded-md border p-4 border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-sky-700 dark:text-sky-300">
                            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                        </p>
                        <p className="text-sm font-mono text-sky-700 dark:text-sky-300">
                            {formatSize(totalSize)}
                        </p>
                    </div>
                    {selectedFiles.length > 0 && (
                        <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                            {selectedFiles.map((file, idx) => (
                                <li key={idx} className="text-xs text-slate-600 dark:text-slate-400 flex justify-between">
                                    <span className="truncate flex-1">{file.name}</span>
                                    <span className="ml-2 font-mono text-slate-500 dark:text-slate-500">{formatSize(file.size)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {uploadProgress.length > 0 && (
                <div className="rounded-md border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-sky-700 dark:text-sky-300">Uploading...</p>
                        {wakeLockActive && (
                            <span className="text-xs text-green-700 dark:text-green-400">
                                Screen will stay awake
                            </span>
                        )}
                    </div>
                    {uploadProgress.map((item) => {
                        const statusText = item.status === 'waiting'
                            ? 'Waiting for connection...'
                            : item.status === 'retrying'
                            ? 'Retrying...'
                            : `${item.progress}%`;
                        const statusColor = item.status === 'waiting' || item.status === 'retrying'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-slate-600 dark:text-slate-400';

                        return (
                            <div key={item.fileName} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="truncate flex-1 text-slate-700 dark:text-slate-400">{item.fileName}</span>
                                    <span className={`ml-2 font-mono ${statusColor}`}>{statusText}</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-300 ${
                                            item.status === 'waiting' || item.status === 'retrying'
                                                ? 'bg-amber-500'
                                                : 'bg-sky-500'
                                        }`}
                                        style={{ width: `${item.progress}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="space-y-2">
                <label className="block text-sm font-medium">
                    Select Photos or Videos
                </label>
                <input
                    type="file"
                    name="media"
                    accept="image/*,video/*"
                    multiple
                    required
                    disabled={isPending}
                    onChange={handleFileChange}
                    className="block w-full text-sm text-slate-700 dark:text-slate-400
                             file:mr-4 file:py-2 file:px-4
                             file:rounded-md file:border-0
                             file:text-sm file:font-medium
                             file:bg-sky-600 file:text-slate-50 dark:file:text-slate-100
                             hover:file:bg-sky-500
                             disabled:opacity-50 disabled:cursor-not-allowed
                             cursor-pointer"
                />
                <p className="text-xs text-slate-600 dark:text-slate-500">
                    Supports: JPEG, PNG, HEIC, MP4, MOV, and other common formats.
                    Large files ({'>'}5MB) are uploaded in chunks - if connection is lost, upload will automatically resume.
                    Screen will stay awake during chunked uploads (you can lock your phone).
                </p>
            </div>

            <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
                <p className="text-sm text-slate-800 dark:text-slate-300">
                    <strong>What happens during upload:</strong>
                </p>
                <ul className="mt-2 text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                    <li><strong>Small images (&lt;5MB):</strong> Fast upload, WebP thumbnail created, full-res JPEG/PNG for display</li>
                    <li><strong>Large images (≥5MB):</strong> Chunked upload with resume support, same processing as small images</li>
                    <li><strong>Videos:</strong> Chunked upload, H.264 web version transcoded in background, poster frame generated</li>
                    <li>Media is uploaded to the gallery unlinked - you can associate it with dates later</li>
                </ul>
            </div>

            <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-slate-50 dark:text-slate-100 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isPending ? 'Uploading...' : 'Upload Media'}
            </button>
        </form>
    );
}
