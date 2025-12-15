'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { DateEntryWithFields } from '@/lib/dates';
import type { MediaEntry } from '@/lib/media';

type Props = {
    title: string;
    date: string;
    onClose: () => void;
};

// Helper function for video time formatting
function formatTime(seconds: number): string {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

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
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const [dateEntry, setDateEntry] = useState<DateEntryWithFields | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState<MediaEntry | null>(null);
    const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
    const [mediaDimensions, setMediaDimensions] = useState<{ width: number; height: number } | null>(null);

    // Video controls state
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

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

    const handleMediaSelect = (media: MediaEntry, index: number) => {
        setSelectedMedia(media);
        setSelectedMediaIndex(index);
        setMediaDimensions(null);
    };

    const handleNavigate = (direction: 'prev' | 'next') => {
        if (!dateEntry || selectedMediaIndex === null) return;
        const delta = direction === 'next' ? 1 : -1;
        const nextIndex = selectedMediaIndex + delta;
        if (nextIndex < 0 || nextIndex >= dateEntry.media.length) return;

        const nextMedia = dateEntry.media[nextIndex];
        setSelectedMedia(nextMedia);
        setSelectedMediaIndex(nextIndex);
        setMediaDimensions(null);
    };

    // Video control handlers
    const togglePlayPause = useCallback(() => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            void videoRef.current.play();
        }
        setIsPlaying(!isPlaying);
    }, [isPlaying]);

    const handleSeek = useCallback((time: number) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = time;
        setCurrentTime(time);
    }, []);

    const handleVolumeChange = useCallback((newVolume: number) => {
        if (!videoRef.current) return;
        videoRef.current.volume = newVolume;
        setVolume(newVolume);
        if (newVolume === 0) {
            setIsMuted(true);
        } else if (isMuted) {
            setIsMuted(false);
        }
    }, [isMuted]);

    const toggleMute = useCallback(() => {
        if (!videoRef.current) return;
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    }, [isMuted]);

    const toggleFullscreen = useCallback(() => {
        if (!videoRef.current) return;
        if (!document.fullscreenElement) {
            void videoRef.current.requestFullscreen();
        } else {
            void document.exitFullscreen();
        }
    }, []);

    // Reset video state when media changes (but not on rotation change)
    const prevMediaIdRef = useRef<number | null>(null);
    useEffect(() => {
        const currentMediaId = selectedMedia?.media_id ?? null;
        if (currentMediaId !== prevMediaIdRef.current) {
            setIsPlaying(false);
            setCurrentTime(0);
            setDuration(0);
            prevMediaIdRef.current = currentMediaId;
        }
    }, [selectedMedia]);

    // Calculate proper dimensions for rotated media
    const getDisplayDimensions = () => {
        if (!selectedMedia || !mediaDimensions) return {
            container: { maxWidth: '90vw', maxHeight: '50vh' },
            media: { width: '100%', height: '100%' }
        };

        const rotation = (selectedMedia.rotation ?? 0) % 360;
        const isRotated = rotation === 90 || rotation === 270 || rotation === -90 || rotation === -270;

        // Calculate available space accounting for UI elements
        // Close button (~40px) + gaps (~16px) + custom controls (~100px for video) + extra padding (~50px)
        // No rotate/delete/date controls in DateModal
        const uiReservedHeight = selectedMedia.media_type === 'video' ? 220 : 120;

        // Account for navigation arrows + gaps on both sides
        // Each arrow is ~24-48px + padding, with gaps of 4-12px
        // Total: ~100-150px depending on screen size
        const arrowsWidth = window.innerWidth < 640 ? 80 : window.innerWidth < 768 ? 100 : 120;

        const maxWidth = window.innerWidth - arrowsWidth;
        const maxHeight = Math.max(window.innerHeight - uiReservedHeight, 200);

        const { width, height } = mediaDimensions;

        // Calculate what size the rotated bounds will be
        let rotatedWidth, rotatedHeight;
        if (isRotated) {
            // After rotation, the bounding box dimensions swap
            rotatedWidth = height;
            rotatedHeight = width;
        } else {
            rotatedWidth = width;
            rotatedHeight = height;
        }

        // Calculate scale to fit the ROTATED bounds into available space
        const scaleX = maxWidth / rotatedWidth;
        const scaleY = maxHeight / rotatedHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up

        // Container size needs to accommodate the rotated image
        const containerWidth = rotatedWidth * scale;
        const containerHeight = rotatedHeight * scale;

        // Image dimensions need to be swapped when rotated
        let mediaWidth, mediaHeight;
        if (isRotated) {
            // Image needs opposite dimensions to fill container after rotation
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
                                        {dateEntry.media.map((item, index) => (
                                            <button
                                                key={item.media_id}
                                                onClick={() => handleMediaSelect(item, index)}
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
                        setSelectedMediaIndex(null);
                        setMediaDimensions(null);
                    }}
                >
                    <div
                        className="relative flex flex-col items-center gap-1 sm:gap-2 md:gap-4 max-w-full max-h-full"
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMedia(null);
                                setSelectedMediaIndex(null);
                                setMediaDimensions(null);
                            }}
                            className="self-end text-white hover:text-slate-300 text-2xl sm:text-3xl leading-none cursor-pointer bg-black/50 rounded-full w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center"
                            aria-label="Close"
                        >
                            &times;
                        </button>

                        {(() => {
                            const display = getDisplayDimensions();
                            const navHeight = display.container.height || display.container.maxHeight;
                            const isFirst = selectedMediaIndex === 0;
                            const isLast = dateEntry ? selectedMediaIndex === dateEntry.media.length - 1 : false;

                            return (
                                <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
                                    {!isFirst && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleNavigate('prev');
                                            }}
                                            className="text-white bg-black/50 hover:bg-black/70 rounded-md px-1 sm:px-2 md:px-3"
                                            style={{ height: navHeight }}
                                            aria-label="Previous media"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5 sm:h-6 sm:w-6"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                    )}

                                    <div
                                        className="flex items-center justify-center"
                                        style={display.container}
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
                                                    ...display.media,
                                                    objectFit: 'contain',
                                                    transform: `rotate(${selectedMedia.rotation ?? 0}deg)`,
                                                    transformOrigin: 'center center',
                                                }}
                                            />
                                        ) : (
                                            <video
                                                ref={videoRef}
                                                controls={false}
                                                autoPlay
                                                className="block"
                                                src={`/api/media/${selectedMedia.file_path_display}`}
                                                onLoadedMetadata={(e) => {
                                                    const video = e.currentTarget;
                                                    setMediaDimensions({
                                                        width: video.videoWidth,
                                                        height: video.videoHeight,
                                                    });
                                                    setDuration(video.duration);
                                                }}
                                                onTimeUpdate={(e) => {
                                                    setCurrentTime(e.currentTarget.currentTime);
                                                }}
                                                onPlay={() => setIsPlaying(true)}
                                                onPause={() => setIsPlaying(false)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    togglePlayPause();
                                                }}
                                                style={{
                                                    ...display.media,
                                                    objectFit: 'contain',
                                                    transform: `rotate(${selectedMedia.rotation ?? 0}deg)`,
                                                    transformOrigin: 'center center',
                                                }}
                                            />
                                        )}
                                    </div>

                                    {!isLast && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleNavigate('next');
                                            }}
                                            className="text-white bg-black/50 hover:bg-black/70 rounded-md px-1 sm:px-2 md:px-3"
                                            style={{ height: navHeight }}
                                            aria-label="Next media"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5 sm:h-6 sm:w-6"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Custom video controls */}
                        {selectedMedia.media_type === 'video' && (
                            <div
                                className="bg-black/80 rounded-lg p-2 sm:p-3 w-full max-w-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Play/Pause and Time Display */}
                                <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                                    <button
                                        onClick={togglePlayPause}
                                        className="text-white hover:text-slate-300 transition-colors"
                                        aria-label={isPlaying ? 'Pause' : 'Play'}
                                    >
                                        {isPlaying ? (
                                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>

                                    <div className="text-white text-xs sm:text-sm">
                                        {formatTime(currentTime)} / {formatTime(duration)}
                                    </div>
                                </div>

                                {/* Seek bar */}
                                <div className="mb-1 sm:mb-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max={duration || 0}
                                        value={currentTime}
                                        onChange={(e) => handleSeek(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
                                    />
                                </div>

                                {/* Volume and Fullscreen */}
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <button
                                        onClick={toggleMute}
                                        className="text-white hover:text-slate-300 transition-colors"
                                        aria-label={isMuted ? 'Unmute' : 'Mute'}
                                    >
                                        {isMuted || volume === 0 ? (
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>

                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={isMuted ? 0 : volume}
                                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                        className="w-16 sm:w-24 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
                                    />

                                    <button
                                        onClick={toggleFullscreen}
                                        className="text-white hover:text-slate-300 transition-colors ml-auto"
                                        aria-label="Fullscreen"
                                    >
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}
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
