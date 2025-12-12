'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DateEntryWithFields } from '@/lib/dates';
import type { MediaEntry } from '@/lib/media';

type Props = {
    title: string;
    date: string;
    onClose: () => void;
};

const formatDisplayDate = (isoDate: string) =>
    // Use noon UTC to avoid local timezone shifting the day
    new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

export default function DateModal({ title, date, onClose }: Props) {
    const router = useRouter();
    const [dateEntry, setDateEntry] = useState<DateEntryWithFields | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState<MediaEntry | null>(null);
    const [mediaDimensions, setMediaDimensions] = useState<{ width: number; height: number } | null>(null);

    useEffect(() => {
        async function fetchDate() {
            try {
                setLoading(true);
                setError(null);
                const response = await fetch(
                    `/api/dates?title=${encodeURIComponent(title)}&date=${encodeURIComponent(date)}`
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch date');
                }

                const data = await response.json();
                setDateEntry(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }

        fetchDate();
    }, [title, date]);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    const handleEdit = () => {
        router.push(`/dates/edit?title=${encodeURIComponent(title)}&date=${encodeURIComponent(date)}`);
    };

    const handleDelete = async () => {
        if (!showDeleteConfirm) {
            setShowDeleteConfirm(true);
            return;
        }

        try {
            setDeleting(true);
            const response = await fetch('/api/dates', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, date }),
            });

            if (!response.ok) {
                throw new Error('Failed to delete date');
            }

            // Close modal and refresh page
            onClose();
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    // Calculate proper dimensions for rotated media
    const getDisplayDimensions = () => {
        if (!selectedMedia || !mediaDimensions) return {
            container: { maxWidth: '95vw', maxHeight: '85vh' },
            media: {}
        };

        const rotation = (selectedMedia.rotation ?? 0) % 360;
        const isRotated = rotation === 90 || rotation === 270 || rotation === -90 || rotation === -270;

        const maxWidth = window.innerWidth * 0.95;
        const maxHeight = window.innerHeight * 0.85;

        const { width, height } = mediaDimensions;

        let rotatedWidth, rotatedHeight;
        if (isRotated) {
            rotatedWidth = height;
            rotatedHeight = width;
        } else {
            rotatedWidth = width;
            rotatedHeight = height;
        }

        const scaleX = maxWidth / rotatedWidth;
        const scaleY = maxHeight / rotatedHeight;
        const scale = Math.min(scaleX, scaleY, 1);

        const containerWidth = rotatedWidth * scale;
        const containerHeight = rotatedHeight * scale;

        let mediaWidth, mediaHeight;
        if (isRotated) {
            mediaWidth = containerHeight;
            mediaHeight = containerWidth;
        } else {
            mediaWidth = containerWidth;
            mediaHeight = containerHeight;
        }

        return {
            container: {
                width: `${containerWidth}px`,
                height: `${containerHeight}px`,
            },
            media: {
                maxWidth: `${mediaWidth}px`,
                maxHeight: `${mediaHeight}px`,
            }
        };
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl text-slate-900 dark:text-slate-100 [&::-webkit-scrollbar]:hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Close modal"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M12 4L4 12M4 4L12 12"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>

                <div className="p-6">
                    {loading && (
                            <div className="flex items-center justify-center py-12">
                                <div className="text-slate-500 dark:text-slate-400">Loading...</div>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center justify-center py-12">
                                <div className="text-red-600 dark:text-red-400">Error: {error}</div>
                            </div>
                        )}

                    {dateEntry && (
                        <div>
                            {/* Header */}
                            <div className="mb-6">
                                <h2 className="text-2xl font-semibold mb-2">{dateEntry.title}</h2>
                                <div className="text-slate-600 dark:text-slate-400 text-sm">
                                    {formatDisplayDate(dateEntry.date)}
                                </div>
                            </div>

                            {/* Custom Fields */}
                            {dateEntry.fields.length > 0 && (
                                <div className="space-y-4">
                                    {dateEntry.fields.map((field) => (
                                        <div
                                            key={field.field_id}
                                            className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-transparent"
                                        >
                                            <div className="text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                                                {field.field_name}
                                            </div>
                                            <div className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                                                {formatFieldValue(field.value, field.field_type)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {dateEntry.fields.length === 0 && (
                                <div className="text-slate-600 dark:text-slate-500 text-sm italic">
                                    No additional details for this date.
                                </div>
                            )}

                            {/* Associated Media */}
                            {dateEntry.media && dateEntry.media.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="text-lg font-medium mb-3">Media</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {dateEntry.media.map((item) => (
                                            <button
                                                key={item.media_id}
                                                onClick={() => setSelectedMedia(item)}
                                                className="relative aspect-square rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 hover:opacity-90 transition-opacity cursor-pointer"
                                            >
                                                {item.media_type === 'image' && item.file_path_thumb && (
                                                    <img
                                                        src={`/api/media/${item.file_path_thumb}`}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                        style={{
                                                            transform: `rotate(${item.rotation ?? 0}deg)`,
                                                            transformOrigin: 'center center',
                                                        }}
                                                    />
                                                )}
                                                {item.media_type === 'video' && item.file_path_thumb && (
                                                    <div className="relative w-full h-full">
                                                        <img
                                                            src={`/api/media/${item.file_path_thumb}`}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                            style={{
                                                                transform: `rotate(${item.rotation ?? 0}deg)`,
                                                                transformOrigin: 'center center',
                                                            }}
                                                        />
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                            <div className="rounded-full bg-black/50 p-3">
                                                                <svg
                                                                    className="w-8 h-8 text-white"
                                                                    fill="currentColor"
                                                                    viewBox="0 0 20 20"
                                                                >
                                                                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                                <button
                                    onClick={handleEdit}
                                    className="flex-1 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-slate-50 dark:text-slate-100 rounded-lg font-medium transition-colors"
                                    disabled={deleting}
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                                        showDeleteConfirm
                                            ? 'bg-red-600 hover:bg-red-500 text-slate-50'
                                            : 'bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100'
                                    }`}
                                    disabled={deleting}
                                >
                                    {deleting ? 'Deleting...' : showDeleteConfirm ? 'Confirm Delete?' : 'Delete'}
                                </button>
                                {showDeleteConfirm && (
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 rounded-lg font-medium transition-colors"
                                        disabled={deleting}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Media Modal */}
            {selectedMedia && (
                <div
                    className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMedia(null);
                    }}
                >
                    <div
                        className="relative flex flex-col items-center gap-4 max-w-full max-h-full"
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMedia(null);
                                setMediaDimensions(null);
                            }}
                            className="self-end text-white hover:text-slate-300 text-3xl leading-none cursor-pointer bg-black/50 rounded-full w-10 h-10 flex items-center justify-center"
                            aria-label="Close"
                        >
                            &times;
                        </button>

                        <div
                            className="flex items-center justify-center"
                            style={getDisplayDimensions().container}
                        >
                            {selectedMedia.media_type === 'image' ? (
                                <img
                                    src={`/api/media/${selectedMedia.file_path_display}`}
                                    alt=""
                                    className="block"
                                    onLoad={(e) => {
                                        const img = e.currentTarget;
                                        setMediaDimensions({
                                            width: img.naturalWidth,
                                            height: img.naturalHeight,
                                        });
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        ...getDisplayDimensions().media,
                                        objectFit: 'contain',
                                        transform: `rotate(${selectedMedia.rotation ?? 0}deg)`,
                                        transformOrigin: 'center center',
                                    }}
                                />
                            ) : (
                                <video
                                    controls
                                    autoPlay
                                    className="block"
                                    src={`/api/media/${selectedMedia.file_path_display}`}
                                    onLoadedMetadata={(e) => {
                                        const video = e.currentTarget;
                                        setMediaDimensions({
                                            width: video.videoWidth,
                                            height: video.videoHeight,
                                        });
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        ...getDisplayDimensions().media,
                                        objectFit: 'contain',
                                        transform: `rotate(${selectedMedia.rotation ?? 0}deg)`,
                                        transformOrigin: 'center center',
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper to format field values based on type
function formatFieldValue(value: string, type: string): string {
    switch (type) {
        case 'date':
            return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        case 'time':
            return new Date(`2000-01-01T${value}`).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
            });
        case 'datetime-local':
            return new Date(value).toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            });
        default:
            return value;
    }
}
