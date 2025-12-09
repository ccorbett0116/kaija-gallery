// src/app/media/MediaGrid.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaEntry } from '@/lib/media';
import { deleteMediaAction } from './actions';

type Props = {
    media: MediaEntry[];
};

export default function MediaGrid({ media }: Props) {
    const [selectedMedia, setSelectedMedia] = useState<MediaEntry | null>(null);
    const [isPending, startTransition] = useTransition();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleDeleteConfirm = async () => {
        if (!selectedMedia) return;

        setShowDeleteConfirm(false);
        setError(null);

        startTransition(async () => {
            const result = await deleteMediaAction(selectedMedia.media_id);

            if (result.success) {
                setSelectedMedia(null);
                router.refresh();
            } else {
                setError(result.error || 'Failed to delete media');
            }
        });
    };

    return (
        <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {media.map((item) => (
                    <button
                        key={item.media_id}
                        onClick={() => setSelectedMedia(item)}
                        className="relative rounded-md overflow-hidden group cursor-pointer hover:opacity-90 transition-opacity"
                    >
                        {item.media_type === 'image' ? (
                            <img
                                src={`/api/media/${item.file_path_thumb}`}
                                alt=""
                                className="w-full h-auto"
                            />
                        ) : (
                            <div className="relative w-full">
                                {item.file_path_thumb ? (
                                    <img
                                        src={`/api/media/${item.file_path_thumb}`}
                                        alt=""
                                        className="w-full h-auto"
                                    />
                                ) : (
                                    <div className="w-full aspect-video bg-slate-800 flex items-center justify-center">
                                        <p className="text-slate-500 text-xs">Processing...</p>
                                    </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {item.transcoding_status === 'pending' || item.transcoding_status === 'processing' ? (
                                        <div className="rounded-full bg-amber-600/90 px-3 py-1">
                                            <p className="text-xs text-white font-medium">
                                                {item.transcoding_status === 'processing' ? 'Transcoding...' : 'Queued'}
                                            </p>
                                        </div>
                                    ) : item.transcoding_status === 'failed' ? (
                                        <div className="rounded-full bg-red-600/90 px-3 py-1">
                                            <p className="text-xs text-white font-medium">Failed</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-full bg-black/50 p-3">
                                            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {item.title && item.date && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                <p className="text-xs text-white truncate">
                                    {item.title}
                                </p>
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {selectedMedia && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedMedia(null)}
                >
                    <button
                        onClick={() => setSelectedMedia(null)}
                        className="absolute top-4 right-4 text-white hover:text-slate-300 text-4xl leading-none"
                        aria-label="Close"
                    >
                        &times;
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick();
                        }}
                        disabled={isPending}
                        className="absolute top-4 left-4 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
                    >
                        {isPending ? 'Deleting...' : 'Delete'}
                    </button>

                    {/* Delete Confirmation Dialog */}
                    {showDeleteConfirm && (
                        <div
                            className="absolute inset-0 bg-black/50 flex items-center justify-center z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(false);
                            }}
                        >
                            <div
                                className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md mx-4"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h3 className="text-lg font-semibold text-white mb-2">
                                    Delete Media?
                                </h3>
                                <p className="text-sm text-slate-300 mb-6">
                                    This will permanently delete the original, thumbnail, and all associated files. This action cannot be undone.
                                </p>
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-md transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDeleteConfirm}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-md transition-colors"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Dialog */}
                    {error && (
                        <div
                            className="absolute inset-0 bg-black/50 flex items-center justify-center z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                setError(null);
                            }}
                        >
                            <div
                                className="bg-slate-900 border border-red-800 rounded-lg p-6 max-w-md mx-4"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h3 className="text-lg font-semibold text-red-400 mb-2">
                                    Error
                                </h3>
                                <p className="text-sm text-slate-300 mb-6">
                                    {error}
                                </p>
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => setError(null)}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-md transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div
                        className="max-w-7xl max-h-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {selectedMedia.media_type === 'image' ? (
                            <img
                                src={`/api/media/${selectedMedia.file_path_display}`}
                                alt=""
                                className="max-w-full max-h-[90vh] object-contain"
                            />
                        ) : (
                            <video
                                controls
                                autoPlay
                                className="max-w-full max-h-[90vh]"
                                src={`/api/media/${selectedMedia.file_path_display}`}
                            />
                        )}

                        {selectedMedia.title && selectedMedia.date && (
                            <div className="mt-4 text-center text-white">
                                <p className="text-lg font-medium">{selectedMedia.title}</p>
                                <p className="text-sm text-slate-400">
                                    {new Date(selectedMedia.date).toLocaleDateString()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
