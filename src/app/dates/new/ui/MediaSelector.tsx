'use client';

import { useState, useEffect } from 'react';
import MediaGridSelection from './MediaGridSelection';
import type { MediaEntry } from '@/lib/media';

type Props = {
    selectedIds: number[];
    onChange: (ids: number[]) => void;
};

export default function MediaSelector({ selectedIds, onChange }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedMedia, setSelectedMedia] = useState<MediaEntry[]>([]);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
    const [isTouchDragging, setIsTouchDragging] = useState(false);

    useEffect(() => {
        // Fetch total count from API
        async function fetchCount() {
            try {
                setLoading(true);
                const response = await fetch('/api/media/count');
                const data = await response.json();
                setTotalCount(data.count);
            } catch (error) {
                console.error('Failed to fetch media count:', error);
            } finally {
                setLoading(false);
            }
        }

        if (isOpen) {
            fetchCount();
        }
    }, [isOpen]);

    // Fetch selected media details when selectedIds change
    useEffect(() => {
        async function fetchSelectedMedia() {
            if (selectedIds.length === 0) {
                setSelectedMedia([]);
                return;
            }

            try {
                const response = await fetch('/api/media/by-ids', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: selectedIds }),
                });
                const data = await response.json();
                // Sort the media to match the order in selectedIds
                const orderedMedia = selectedIds
                    .map(id => data.media.find((m: MediaEntry) => m.media_id === id))
                    .filter((m): m is MediaEntry => m !== undefined);
                setSelectedMedia(orderedMedia);
            } catch (error) {
                console.error('Failed to fetch selected media:', error);
            }
        }

        fetchSelectedMedia();
    }, [selectedIds]);

    const toggleMedia = (mediaId: number) => {
        if (selectedIds.includes(mediaId)) {
            onChange(selectedIds.filter(id => id !== mediaId));
        } else {
            onChange([...selectedIds, mediaId]);
        }
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (index: number) => {
        if (draggedIndex === null || draggedIndex === index) return;
        setDragOverIndex(index);
    };

    const handleDragEnd = () => {
        if (draggedIndex === null || dragOverIndex === null) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }

        const newOrder = [...selectedIds];
        const [movedItem] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(dragOverIndex, 0, movedItem);

        onChange(newOrder);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    // Touch event handlers for mobile
    const handleTouchStart = (e: React.TouchEvent, index: number) => {
        const touch = e.touches[0];
        setTouchStartPos({ x: touch.clientX, y: touch.clientY });
        setTimeout(() => {
            if (touchStartPos) {
                setDraggedIndex(index);
                setIsTouchDragging(true);
            }
        }, 200); // Long press threshold
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isTouchDragging || draggedIndex === null) return;

        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const gridItem = element?.closest('[data-grid-index]');

        if (gridItem) {
            const index = parseInt(gridItem.getAttribute('data-grid-index') || '-1');
            if (index !== -1 && index !== draggedIndex) {
                setDragOverIndex(index);
            }
        }
    };

    const handleTouchEnd = () => {
        if (isTouchDragging && draggedIndex !== null && dragOverIndex !== null) {
            const newOrder = [...selectedIds];
            const [movedItem] = newOrder.splice(draggedIndex, 1);
            newOrder.splice(dragOverIndex, 0, movedItem);
            onChange(newOrder);
        }

        setTouchStartPos(null);
        setDraggedIndex(null);
        setDragOverIndex(null);
        setIsTouchDragging(false);
    };

    return (
        <div className="border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">
                    Media ({selectedIds.length} selected)
                </label>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="text-sm text-sky-400 hover:text-sky-300"
                >
                    {isOpen ? 'Close' : 'Select Media'}
                </button>
            </div>

            {/* Selected Media Preview (when closed) */}
            {!isOpen && selectedMedia.length > 0 && (
                <div>
                    <div className="text-xs text-slate-500 mb-2">
                        Click and hold to reorder
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {selectedMedia.map((item, index) => (
                            <div
                                key={item.media_id}
                                data-grid-index={index}
                                draggable
                                onDragStart={(e) => {
                                    // Don't start drag if clicking remove button
                                    if ((e.target as HTMLElement).closest('button[aria-label="Remove"]')) {
                                        e.preventDefault();
                                        return;
                                    }
                                    handleDragStart(index);
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    handleDragOver(index);
                                }}
                                onDragEnd={handleDragEnd}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    handleDragEnd();
                                }}
                                onTouchStart={(e) => {
                                    // Don't start touch drag if tapping remove button
                                    if ((e.target as HTMLElement).closest('button[aria-label="Remove"]')) {
                                        return;
                                    }
                                    handleTouchStart(e, index);
                                }}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                className={`relative aspect-square rounded overflow-hidden bg-slate-800 cursor-move transition-all ${
                                    draggedIndex === index
                                        ? 'opacity-50 scale-95'
                                        : dragOverIndex === index
                                        ? 'ring-2 ring-sky-500'
                                        : ''
                                }`}
                            >
                                {item.media_type === 'image' && item.file_path_thumb && (
                                    <img
                                        src={`/api/media/${item.file_path_thumb}`}
                                        alt=""
                                        className="w-full h-full object-cover pointer-events-none"
                                    />
                                )}
                                {item.media_type === 'video' && item.file_path_thumb && (
                                    <div className="relative w-full h-full">
                                        <img
                                            src={`/api/media/${item.file_path_thumb}`}
                                            alt=""
                                            className="w-full h-full object-cover pointer-events-none"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                                                <svg
                                                    className="w-4 h-4 text-white ml-0.5"
                                                    fill="currentColor"
                                                    viewBox="0 0 16 16"
                                                >
                                                    <path d="M4 3l8 5-8 5V3z" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* Order indicator */}
                                <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-slate-900/80 flex items-center justify-center">
                                    <span className="text-xs text-white font-medium">{index + 1}</span>
                                </div>
                                {/* Remove button */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onChange(selectedIds.filter(id => id !== item.media_id));
                                    }}
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center opacity-80 md:opacity-0 md:hover:opacity-100 transition-opacity"
                                    aria-label="Remove"
                                >
                                    <svg
                                        className="w-3 h-3 text-white"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Media Grid */}
            {isOpen && (
                <div className="mt-3">
                    {loading ? (
                        <div className="text-sm text-slate-400 py-4 text-center">
                            Loading media...
                        </div>
                    ) : totalCount === 0 ? (
                        <div className="text-sm text-slate-400 py-4 text-center">
                            No media available. Upload some media first.
                        </div>
                    ) : (
                        <MediaGridSelection
                            initialTotal={totalCount}
                            selectedIds={selectedIds}
                            onToggleSelection={toggleMedia}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
