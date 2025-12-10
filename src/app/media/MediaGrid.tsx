// src/app/media/MediaGrid.tsx
'use client';

import { useState, useTransition, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaEntry } from '@/lib/media';
import { deleteMediaAction } from './actions';

type Props = {
    initialMedia: MediaEntry[];
    initialHasMoreOlder: boolean;
    initialHasMoreNewer: boolean;
};

export default function MediaGrid({ initialMedia, initialHasMoreOlder, initialHasMoreNewer }: Props) {
    const [media, setMedia] = useState<MediaEntry[]>(initialMedia);
    const [hasMoreOlder, setHasMoreOlder] = useState(initialHasMoreOlder);
    const [hasMoreNewer, setHasMoreNewer] = useState(initialHasMoreNewer);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [isLoadingNewer, setIsLoadingNewer] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState<MediaEntry | null>(null);
    const [isPending, startTransition] = useTransition();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showJumpPicker, setShowJumpPicker] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const topObserverTarget = useRef<HTMLDivElement>(null);
    const bottomObserverTarget = useRef<HTMLDivElement>(null);

    // Load older media (scroll down)
    const loadOlder = useCallback(async () => {
        if (isLoadingOlder || !hasMoreOlder || media.length === 0) return;

        setIsLoadingOlder(true);
        try {
            const oldestItem = media[media.length - 1];
            const response = await fetch(
                `/api/media-list?limit=50&olderThan=${encodeURIComponent(oldestItem.uploaded_at)}`
            );
            const data = await response.json();

            setMedia((prev) => [...prev, ...data.media]);
            setHasMoreOlder(data.hasMoreOlder);
            setHasMoreNewer(data.hasMoreNewer);
        } catch (err) {
            console.error('Failed to load older media:', err);
        } finally {
            setIsLoadingOlder(false);
        }
    }, [isLoadingOlder, hasMoreOlder, media]);

    // Load newer media (scroll up)
    const loadNewer = useCallback(async () => {
        if (isLoadingNewer || !hasMoreNewer || media.length === 0) return;

        setIsLoadingNewer(true);
        try {
            const newestItem = media[0];
            const response = await fetch(
                `/api/media-list?limit=50&newerThan=${encodeURIComponent(newestItem.uploaded_at)}`
            );
            const data = await response.json();

            setMedia((prev) => [...data.media, ...prev]);
            setHasMoreOlder(data.hasMoreOlder);
            setHasMoreNewer(data.hasMoreNewer);
        } catch (err) {
            console.error('Failed to load newer media:', err);
        } finally {
            setIsLoadingNewer(false);
        }
    }, [isLoadingNewer, hasMoreNewer, media]);

    // Jump to specific date
    const handleJumpToDate = async (date: string) => {
        setIsLoadingOlder(true);
        setShowJumpPicker(false);
        try {
            const response = await fetch(
                `/api/media-list?limit=50&jumpToDate=${encodeURIComponent(date)}`
            );
            const data = await response.json();

            setMedia(data.media);
            setHasMoreOlder(data.hasMoreOlder);
            setHasMoreNewer(data.hasMoreNewer);
        } catch (err) {
            console.error('Failed to jump to date:', err);
            setError('Failed to jump to date');
        } finally {
            setIsLoadingOlder(false);
        }
    };

    // Jump to bottom (oldest items)
    const handleJumpToBottom = async () => {
        setIsLoadingOlder(true);
        try {
            const response = await fetch(
                `/api/media-list?limit=50&jumpToBottom=true`
            );
            const data = await response.json();

            setMedia(data.media);
            setHasMoreOlder(data.hasMoreOlder);
            setHasMoreNewer(data.hasMoreNewer);

            // Scroll to bottom after React finishes rendering
            setTimeout(() => {
                window.scrollTo({
                    top: document.documentElement.scrollHeight,
                    behavior: 'smooth'
                });
            }, 100);
        } catch (err) {
            console.error('Failed to jump to bottom:', err);
            setError('Failed to jump to bottom');
        } finally {
            setIsLoadingOlder(false);
        }
    };

    // Jump to top (newest items) - just refresh
    const handleJumpToTop = () => {
        router.refresh();
    };

    // Bottom observer - load older items (scroll down)
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMoreOlder && !isLoadingOlder) {
                    loadOlder();
                }
            },
            { threshold: 0.5 }
        );

        const currentTarget = bottomObserverTarget.current;
        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        };
    }, [hasMoreOlder, isLoadingOlder, loadOlder]);

    // Top observer - load newer items (scroll up)
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMoreNewer && !isLoadingNewer) {
                    loadNewer();
                }
            },
            { threshold: 0.5 }
        );

        const currentTarget = topObserverTarget.current;
        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        };
    }, [hasMoreNewer, isLoadingNewer, loadNewer]);

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
                // Remove from local state
                setMedia((prev) => prev.filter((m) => m.media_id !== selectedMedia.media_id));
                setSelectedMedia(null);
            } else {
                setError(result.error || 'Failed to delete media');
            }
        });
    };

    return (
        <>
            {/* Floating Action Buttons */}
            <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
                {/* Jump to Date */}
                <button
                    onClick={() => setShowJumpPicker(true)}
                    className="px-4 py-3 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-full shadow-lg transition-colors flex items-center gap-2"
                    title="Jump to date"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="hidden sm:inline">Jump to Date</span>
                </button>

                {/* Jump to Top */}
                {hasMoreNewer && (
                    <button
                        onClick={handleJumpToTop}
                        className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-full shadow-lg transition-colors flex items-center gap-2"
                        title="Jump to top (newest)"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                        <span className="hidden sm:inline">Jump to Top</span>
                    </button>
                )}

                {/* Jump to Bottom */}
                {hasMoreOlder && (
                    <button
                        onClick={handleJumpToBottom}
                        className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-full shadow-lg transition-colors flex items-center gap-2"
                        title="Jump to bottom (oldest)"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                        <span className="hidden sm:inline">Jump to Bottom</span>
                    </button>
                )}
            </div>

            {/* Top loading indicator (for scrolling up to newer items) */}
            {hasMoreNewer && (
                <div ref={topObserverTarget} className="py-8 text-center">
                    {isLoadingNewer && (
                        <p className="text-slate-400 text-sm">Loading newer...</p>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {media.map((item) => (
                    <button
                        key={item.media_id}
                        onClick={() => setSelectedMedia(item)}
                        className="relative rounded-md overflow-hidden group cursor-pointer hover:opacity-90 transition-opacity"
                    >
                        {item.media_type === 'image' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={`/api/media/${item.file_path_thumb}`}
                                alt=""
                                className="w-full h-auto"
                                loading="lazy"
                            />
                        ) : (
                            <div className="relative w-full">
                                {item.file_path_thumb ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={`/api/media/${item.file_path_thumb}`}
                                        alt=""
                                        className="w-full h-auto"
                                        loading="lazy"
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

            {/* Bottom loading indicator (for scrolling down to older items) */}
            {hasMoreOlder && (
                <div ref={bottomObserverTarget} className="py-8 text-center">
                    {isLoadingOlder && (
                        <p className="text-slate-400 text-sm">Loading older...</p>
                    )}
                </div>
            )}

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
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={`/api/media/${selectedMedia.file_path_display}`}
                                alt=""
                                className="max-w-full max-h-[90vh] object-contain"
                                loading="lazy"
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

            {/* Jump to Date Picker */}
            {showJumpPicker && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
                    onClick={() => setShowJumpPicker(false)}
                >
                    <div
                        className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold text-white mb-4">
                            Jump to Date
                        </h3>
                        <p className="text-sm text-slate-400 mb-4">
                            Select a date to jump to photos from that time
                        </p>
                        <input
                            type="datetime-local"
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-sky-500 mb-4"
                            onChange={(e) => {
                                if (e.target.value) {
                                    handleJumpToDate(new Date(e.target.value).toISOString());
                                }
                            }}
                        />
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowJumpPicker(false)}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
