'use client';

import React, {
    useState,
    useTransition,
    useRef,
    useEffect,
    useCallback,
    useSyncExternalStore,
    memo,
} from 'react';
import { useRouter } from 'next/navigation';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import type { MediaEntry } from '@/lib/media';
import { deleteMediaAction } from './actions';

// ============================================================================
// EXTERNAL STORE - No React re-renders when cache updates
// ============================================================================

type ItemStore = {
    items: Map<number, MediaEntry>;
    subscribers: Set<() => void>;
    totalCount: number;
};

function createItemStore(initialTotal: number): ItemStore {
    return {
        items: new Map(),
        subscribers: new Set(),
        totalCount: initialTotal,
    };
}

function subscribeToStore(store: ItemStore, callback: () => void) {
    store.subscribers.add(callback);
    return () => store.subscribers.delete(callback);
}

function notifySubscribers(store: ItemStore) {
    store.subscribers.forEach((cb) => cb());
}

function getItem(store: ItemStore, index: number): MediaEntry | null {
    return store.items.get(index) ?? null;
}

function setItems(store: ItemStore, startIndex: number, items: MediaEntry[]) {
    items.forEach((item, idx) => {
        store.items.set(startIndex + idx, item);
    });
    notifySubscribers(store);
}

function updateItem(store: ItemStore, index: number, item: MediaEntry) {
    store.items.set(index, item);
    notifySubscribers(store);
}

function updateRotation(store: ItemStore, mediaId: number, rotation: number) {
    store.items.forEach((item, key) => {
        if (item.media_id === mediaId) {
            store.items.set(key, { ...item, rotation });
        }
    });
    notifySubscribers(store);
}

function updateMediaDate(store: ItemStore, mediaId: number, date: string | null) {
    store.items.forEach((item, key) => {
        if (item.media_id === mediaId) {
            store.items.set(key, { ...item, date });
        }
    });
    notifySubscribers(store);
}

function deleteItem(store: ItemStore, mediaId: MediaEntry['media_id']) {
    // Find the index to delete
    let deleteIndex = -1;
    for (const [key, item] of store.items) {
        if (item.media_id === mediaId) {
            deleteIndex = key;
            break;
        }
    }

    if (deleteIndex === -1) return;

    // Create new map with shifted indices
    const newItems = new Map<number, MediaEntry>();
    for (const [key, item] of store.items) {
        if (key < deleteIndex) {
            // Items before deletion stay at same index
            newItems.set(key, item);
        } else if (key > deleteIndex) {
            // Items after deletion shift down by 1
            newItems.set(key - 1, item);
        }
        // Skip the deleted item (key === deleteIndex)
    }

    store.items = newItems;
    store.totalCount--;
    notifySubscribers(store);
}

// ============================================================================
// HOOKS
// ============================================================================

function useItem(store: ItemStore, index: number): MediaEntry | null {
    // Create a stable snapshot function for this specific index
    const getSnapshot = useCallback(() => getItem(store, index), [store, index]);
    const subscribe = useCallback((cb: () => void) => subscribeToStore(store, cb), [store]);

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function usePendingTranscodes(store: ItemStore): number {
    const getSnapshot = useCallback(() => {
        let count = 0;
        for (const item of store.items.values()) {
            if (item.transcoding_status === 'pending' || item.transcoding_status === 'processing') {
                count++;
            }
        }
        return count;
    }, [store]);
    const subscribe = useCallback((cb: () => void) => subscribeToStore(store, cb), [store]);

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ============================================================================
// COMPONENTS
// ============================================================================

type Props = {
    initialTotal: number;
};

// Individual media item - only re-renders when THIS item changes
const MediaItem = memo(function MediaItem({
                                              store,
                                              globalIndex,
                                              onSelect,
                                          }: {
    store: ItemStore;
    globalIndex: number;
    onSelect: (item: MediaEntry) => void;
}) {
    const item = useItem(store, globalIndex);

    if (!item) {
        return (
            <div
                className="relative rounded-md overflow-hidden bg-slate-800 flex items-center justify-center w-full h-full"
            >
                <div className="animate-pulse w-full h-full bg-slate-700/50" />
            </div>
        );
    }

    return (
        <button
            onClick={() => onSelect(item)}
            className="relative rounded-md overflow-hidden group cursor-pointer hover:opacity-90 transition-opacity w-full h-full"
        >
            {item.media_type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={`/api/media/${item.file_path_thumb}`}
                    alt=""
                    className="w-full h-full object-contain"
                    loading="lazy"
                    decoding="async"
                    style={{
                        transform: `rotate(${item.rotation ?? 0}deg)`,
                        transformOrigin: 'center center',
                    }}
                />
            ) : (
                <div className="relative w-full h-full">
                    {item.file_path_thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={`/api/media/${item.file_path_thumb}`}
                            alt=""
                            className="w-full h-full object-contain"
                            loading="lazy"
                            decoding="async"
                            style={{
                                transform: `rotate(${item.rotation ?? 0}deg)`,
                                transformOrigin: 'center center',
                            }}
                        />
                    ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                            <p className="text-slate-500 text-xs">Processing...</p>
                        </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                        {item.transcoding_status === 'pending' ||
                        item.transcoding_status === 'processing' ? (
                            <div className="rounded-full bg-amber-600/90 px-3 py-1">
                                <p className="text-xs text-white font-medium">
                                    {item.transcoding_status === 'processing'
                                        ? 'Transcoding...'
                                        : 'Queued'}
                                </p>
                            </div>
                        ) : item.transcoding_status === 'failed' ? (
                            <div className="rounded-full bg-red-600/90 px-3 py-1">
                                <p className="text-xs text-white font-medium">Failed</p>
                            </div>
                        ) : (
                            <div className="rounded-full bg-black/50 p-3">
                                <svg
                                    className="w-8 h-8 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                </svg>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {item.title && item.date && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <p className="text-xs text-white truncate">{item.title}</p>
                </div>
            )}
        </button>
    );
});

// Row component - renders N MediaItems (dynamic columns)
// Does NOT re-render when items load - only MediaItem does
const MediaRow = memo(function MediaRow({
                                            rowIndex,
                                            store,
                                            totalCount,
                                            columns,
                                            itemHeight,
                                            rowGap,
                                            onSelect,
                                        }: {
    rowIndex: number;
    store: ItemStore;
    totalCount: number;
    columns: number;
    itemHeight: number;
    rowGap: number;
    onSelect: (item: MediaEntry) => void;
}) {
    const startIndex = rowIndex * columns;

    // Dynamic grid column class
    const gridCols = columns === 2 ? 'grid-cols-2' : columns === 3 ? 'grid-cols-3' : 'grid-cols-4';

    return (
        <div style={{ height: itemHeight + rowGap, paddingBottom: rowGap }}>
            <div className={`grid ${gridCols} gap-4`} style={{ height: itemHeight }}>
                {Array.from({ length: columns }, (_, colIdx) => {
                    const globalIndex = startIndex + colIdx;
                    if (globalIndex >= totalCount) return <div key={colIdx} />;
                    return (
                        <MediaItem
                            key={globalIndex}
                            store={store}
                            globalIndex={globalIndex}
                            onSelect={onSelect}
                        />
                    );
                })}
            </div>
        </div>
    );
});

export default function MediaGridVirtual({ initialTotal }: Props) {
    const router = useRouter();
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const dateInputRef = useRef<HTMLInputElement | null>(null);

    // Create store once
    const storeRef = useRef<ItemStore | null>(null);
    if (!storeRef.current) {
        storeRef.current = createItemStore(initialTotal);
    }
    const store = storeRef.current;

    const [totalCount, setTotalCount] = useState(initialTotal);
    const [selectedMedia, setSelectedMedia] = useState<MediaEntry | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isUpdatingDate, setIsUpdatingDate] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showJumpPicker, setShowJumpPicker] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
    // Dynamic layout based on window size
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const updateDimensions = () => {
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        // Set initial dimensions
        updateDimensions();

        // Update on resize
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // Calculate columns based on width (2-4 columns)
    const COLUMNS = dimensions.width < 640 ? 2 : dimensions.width < 1024 ? 3 : 4;

    // Calculate row height based on screen height
    // Use viewport height to determine item height: smaller screens = smaller items
    const itemHeight = dimensions.height < 600 ? 120 : dimensions.height < 800 ? 150 : 180;
    const ROW_GAP = 16;
    const ROW_HEIGHT = itemHeight + ROW_GAP;

    const BATCH_SIZE = COLUMNS * 12; // Always load 12 rows at a time

    const loadingRangesRef = useRef<Set<string>>(new Set());
    const initialLoadDoneRef = useRef(false);
    const lastVisibleRangeRef = useRef<{ startRow: number; endRow: number }>({ startRow: 0, endRow: 0 });

    const totalRows = Math.ceil(totalCount / COLUMNS);

    const pendingTranscodes = usePendingTranscodes(store);

    // Load items into store (not React state)
    const loadRange = useCallback(
        async (startIndex: number, endIndex: number) => {
            const rangeKey = `${startIndex}-${endIndex}`;

            if (loadingRangesRef.current.has(rangeKey)) return;
            loadingRangesRef.current.add(rangeKey);

            try {
                const response = await fetch(
                    `/api/media-virtual?offset=${startIndex}&limit=${endIndex - startIndex + 1}`
                );
                const data = await response.json();

                // Update store directly - only subscribed components re-render
                setItems(store, startIndex, data.media);

                if (data.total !== totalCount) {
                    setTotalCount(data.total);
                    store.totalCount = data.total;
                }
            } catch (err) {
                console.error('Failed to load media range:', err);
            } finally {
                loadingRangesRef.current.delete(rangeKey);
            }
        },
        [store, totalCount]
    );

    const rotateImage = useCallback(
        (direction: 'cw' | 'ccw') => {
            if (!selectedMedia) return;
            const delta = direction === 'cw' ? 90 : -90;
            startTransition(async () => {
                try {
                    const res = await fetch('/api/media/rotate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mediaId: selectedMedia.media_id, delta }),
                    });
                    if (!res.ok) throw new Error('Rotate failed');
                    const data = (await res.json()) as { rotation: number };
                    setSelectedMedia((prev) => (prev ? { ...prev, rotation: data.rotation } : prev));
                    updateRotation(store, selectedMedia.media_id, data.rotation);
                } catch (err) {
                    console.error(err);
                    setError('Failed to rotate media');
                }
            });
        },
        [selectedMedia, startTransition, store]
    );

    const formatDateForInput = useCallback((value: string | null) => {
        if (!value) return '';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return '';
        const offsetMinutes = parsed.getTimezoneOffset();
        const local = new Date(parsed.getTime() - offsetMinutes * 60000);
        return local.toISOString().slice(0, 16);
    }, []);

    const openDatePicker = useCallback(
        (event?: React.MouseEvent) => {
            event?.stopPropagation();
            if (!selectedMedia || !dateInputRef.current) return;
            const defaultValue = selectedMedia.date || selectedMedia.uploaded_at;
            const input = dateInputRef.current as HTMLInputElement & { showPicker?: () => void };
            input.value = formatDateForInput(defaultValue) || '';
            if (typeof input.showPicker === 'function') {
                input.showPicker();
            } else {
                input.focus();
                input.click();
            }
        },
        [selectedMedia, formatDateForInput]
    );

    const handleDateChange = useCallback(
        async (value: string) => {
            if (!selectedMedia) return;
            setIsUpdatingDate(true);
            setError(null);

            try {
                const parsed = new Date(value);
                if (Number.isNaN(parsed.getTime())) {
                    throw new Error('Invalid date');
                }

                const isoDate = parsed.toISOString();
                const res = await fetch('/api/media/date', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mediaId: selectedMedia.media_id, date: isoDate }),
                });
                const data = (await res.json()) as { date?: string; error?: string };

                if (!res.ok || !data.date) {
                    throw new Error(data.error || 'Failed to update date');
                }

                setSelectedMedia((prev) => (prev ? { ...prev, date: data.date } : prev));
                updateMediaDate(store, selectedMedia.media_id, data.date);

                // Reload currently visible range to reflect updated ordering
                const { startRow, endRow } = lastVisibleRangeRef.current;
                const startIndex = startRow * COLUMNS;
                const endIndex = Math.min(totalCount - 1, (endRow + 1) * COLUMNS - 1);
                if (startIndex <= endIndex) {
                    await loadRange(startIndex, endIndex);
                }
            } catch (err) {
                console.error(err);
                setError('Failed to update date');
            } finally {
                setIsUpdatingDate(false);
            }
        },
        [selectedMedia, store, COLUMNS, totalCount, loadRange]
    );
    // Check what needs loading
    const checkAndLoad = useCallback(
        (startRow: number, endRow: number) => {
            const startIndex = Math.max(0, (startRow - 3) * COLUMNS);
            const endIndex = Math.min(totalCount - 1, (endRow + 4) * COLUMNS - 1);

            // Find gaps
            let gapStart = -1;
            const gaps: Array<{ start: number; end: number }> = [];

            for (let i = startIndex; i <= endIndex + 1; i++) {
                const hasItem = i <= endIndex && store.items.has(i);

                if (!hasItem && gapStart === -1 && i <= endIndex) {
                    gapStart = i;
                } else if ((hasItem || i > endIndex) && gapStart !== -1) {
                    gaps.push({ start: gapStart, end: i - 1 });
                    gapStart = -1;
                }
            }

            // Load gaps
            gaps.forEach(({ start, end }) => {
                const batchStart = Math.floor(start / BATCH_SIZE) * BATCH_SIZE;
                const batchEnd = Math.min(
                    Math.ceil((end + 1) / BATCH_SIZE) * BATCH_SIZE - 1,
                    totalCount - 1
                );
                void loadRange(batchStart, batchEnd);
            });
        },
        [store, totalCount, loadRange, COLUMNS, BATCH_SIZE]
    );

    // Clear cache when columns change (indices are now invalid)
    const prevColumnsRef = useRef(COLUMNS);
    useEffect(() => {
        if (prevColumnsRef.current !== COLUMNS && prevColumnsRef.current !== 0) {
            store.items.clear();
            notifySubscribers(store);
            initialLoadDoneRef.current = false;
        }
        prevColumnsRef.current = COLUMNS;
    }, [COLUMNS, store]);

    // Initial load
    useEffect(() => {
        if (!initialLoadDoneRef.current && totalCount > 0) {
            initialLoadDoneRef.current = true;
            void loadRange(0, Math.min(BATCH_SIZE - 1, totalCount - 1));
        }
    }, [totalCount, loadRange, BATCH_SIZE]);

    // SSE listener for transcoding updates
    useEffect(() => {
        const eventSource = new EventSource('/api/transcode-events');

        eventSource.onmessage = async (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'status-change') {
                const { mediaId } = data;


                // Find the index of this media item in the store
                let foundIndex = -1;
                for (const [index, item] of store.items) {
                    if (item.media_id === mediaId) {
                        foundIndex = index;
                        break;
                    }
                }

                if (foundIndex !== -1) {
                    // Fetch the updated item by its media_id
                    try {
                        const response = await fetch(`/api/media-by-id?id=${mediaId}`);
                        const result = await response.json();

                        if (result.media) {
                            updateItem(store, foundIndex, result.media);
                        }
                    } catch (err) {
                        console.error('Failed to update transcoded item:', err);
                    }
                } else {
                }
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE error:', error);
        };

        return () => {
            eventSource.close();
        };
    }, [store]);

    // Stable select handler
    const handleSelect = useCallback((item: MediaEntry) => {
        setSelectedMedia(item);
        setImageDimensions(null); // Reset dimensions when selecting new media
    }, []);

    // Calculate proper dimensions for rotated images
    const getDisplayDimensions = useCallback(() => {
        if (!selectedMedia || !imageDimensions) return {
            container: { maxWidth: '90vw', maxHeight: '75vh' },
            image: { width: '100%', height: '100%' }
        };

        const rotation = (selectedMedia.rotation ?? 0) % 360;
        const isRotated = rotation === 90 || rotation === 270 || rotation === -90 || rotation === -270;

        // Available space
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.75;

        const { width, height } = imageDimensions;

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
        let imageWidth, imageHeight;
        if (isRotated) {
            // Image needs opposite dimensions to fill container after rotation
            imageWidth = containerHeight;
            imageHeight = containerWidth;
        } else {
            imageWidth = containerWidth;
            imageHeight = containerHeight;
        }

        return {
            container: {
                width: `${containerWidth}px`,
                height: `${containerHeight}px`,
            },
            image: {
                maxWidth: `${imageWidth}px`,
                maxHeight: `${imageHeight}px`,
            }
        };
    }, [selectedMedia, imageDimensions]);

    // Row renderer - store reference is stable, no re-renders from data loading
    const rowContent = useCallback(
        (rowIndex: number) => (
            <MediaRow
                rowIndex={rowIndex}
                store={store}
                totalCount={totalCount}
                columns={COLUMNS}
                itemHeight={itemHeight}
                rowGap={ROW_GAP}
                onSelect={handleSelect}
            />
        ),
        [store, totalCount, COLUMNS, itemHeight, ROW_GAP, handleSelect]
    );

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
                deleteItem(store, selectedMedia.media_id);
                // Update total count from store (deleteItem already decremented it)
                setTotalCount(store.totalCount);
                setSelectedMedia(null);
                router.refresh();
            } else {
                setError(result.error || 'Failed to delete media');
            }
        });
    };

    const handleJumpToDate = async (date: string) => {
        setShowJumpPicker(false);
        virtuosoRef.current?.scrollToIndex({ index: 0, behavior: 'smooth' });
    };

    const handleJumpToBottom = () => {
        const bottomRow = Math.max(0, totalRows - 1);
        virtuosoRef.current?.scrollToIndex({
            index: bottomRow,
            behavior: 'smooth',
        });
    };

    const handleJumpToTop = () => {
        virtuosoRef.current?.scrollToIndex({ index: 0, behavior: 'smooth' });
    };

    // Range change handler - no state updates during scroll
    const handleRangeChanged = useCallback(
        (range: { startIndex: number; endIndex: number }) => {
            lastVisibleRangeRef.current = { startRow: range.startIndex, endRow: range.endIndex };
            // Schedule loading outside of scroll handler
            requestAnimationFrame(() => {
                checkAndLoad(range.startIndex, range.endIndex);
            });
        },
        [checkAndLoad]
    );

    return (
        <>
            {/* Transcoding status */}
            {pendingTranscodes > 0 && (
                <div className="mb-4">
                    <p className="text-sm text-amber-400">
                        {pendingTranscodes} video{pendingTranscodes !== 1 ? 's' : ''} transcoding...
                    </p>
                </div>
            )}

            {/* Floating Action Buttons */}
            <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
                <button
                    onClick={() => setShowJumpPicker(true)}
                    className="px-4 py-3 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-full shadow-lg transition-colors flex items-center gap-2"
                    title="Jump to date"
                >
                    <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                    </svg>
                    <span className="hidden sm:inline">Jump to Date</span>
                </button>

                <button
                    onClick={handleJumpToTop}
                    className="px-4 py-3 bg-white text-slate-700 border border-slate-200 hover:border-sky-500 hover:bg-slate-100 dark:bg-slate-700 dark:text-white dark:border-slate-600 dark:hover:bg-slate-600 text-sm font-medium rounded-full shadow-lg transition-colors flex items-center gap-2"
                    title="Jump to top (newest)"
                >
                    <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 10l7-7m0 0l7 7m-7-7v18"
                        />
                    </svg>
                    <span className="hidden sm:inline">Jump to Top</span>
                </button>

                <button
                    onClick={handleJumpToBottom}
                    className="px-4 py-3 bg-white text-slate-700 border border-slate-200 hover:border-sky-500 hover:bg-slate-100 dark:bg-slate-700 dark:text-white dark:border-slate-600 dark:hover:bg-slate-600 text-sm font-medium rounded-full shadow-lg transition-colors flex items-center gap-2"
                    title="Jump to bottom (oldest)"
                >
                    <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                    </svg>
                    <span className="hidden sm:inline">Jump to Bottom</span>
                </button>
            </div>

            {/* Virtual Scrolling with FIXED row heights */}
            <div style={{ height: 'calc(100vh - 160px)' }}>
                <Virtuoso
                    key={`${COLUMNS}-${ROW_HEIGHT}`}
                    ref={virtuosoRef}
                    style={{ height: '100%' }}
                    totalCount={totalRows}
                    itemContent={rowContent}
                    fixedItemHeight={ROW_HEIGHT}
                    overscan={2000}
                    rangeChanged={handleRangeChanged}
                    className="[&::-webkit-scrollbar]:hidden"
                />
            </div>

            {/* Modal for selected media */}
            {selectedMedia && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedMedia(null)}
                >
                    {/* DELETE CONFIRM OVERLAY */}
                    {showDeleteConfirm && (
                        <div
                            className="absolute inset-0 bg-black/50 flex items-center justify-center z-40"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(false);
                            }}
                        >
                            <div
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6 max-w-md mx-4"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                    Delete Media?
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                                    This will permanently delete the original, thumbnail, and all
                                    associated files. This action cannot be undone.
                                </p>
                                <div className="flex gap-3 justify-beginning">
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-sm font-medium rounded-md transition-colors"
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

                    {/* ERROR OVERLAY */}
                    {error && (
                        <div
                            className="absolute inset-0 bg-black/50 flex items-center justify-center z-40"
                            onClick={(e) => {
                                e.stopPropagation();
                                setError(null);
                            }}
                        >
                            <div
                                className="bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 rounded-lg p-6 max-w-md mx-4"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Error</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{error}</p>
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => setError(null)}
                                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-sm font-medium rounded-md transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Content wrapper - prevents backdrop click */}
                    <div
                        className="relative flex flex-col items-center gap-4 max-w-full max-h-full"
                    >
                        {/* Close button - positioned relative to content wrapper */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMedia(null);
                            }}
                            className="self-end text-white hover:text-slate-300 text-3xl leading-none cursor-pointer bg-black/50 rounded-full w-10 h-10 flex items-center justify-center"
                            aria-label="Close"
                        >
                            &times;
                        </button>

                        {/* Media container with proper size constraints */}
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
                                        setImageDimensions({
                                            width: img.naturalWidth,
                                            height: img.naturalHeight,
                                        });
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        ...getDisplayDimensions().image,
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
                                        setImageDimensions({
                                            width: video.videoWidth,
                                            height: video.videoHeight,
                                        });
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        ...getDisplayDimensions().image,
                                        objectFit: 'contain',
                                        transform: `rotate(${selectedMedia.rotation ?? 0}deg)`,
                                        transformOrigin: 'center center',
                                    }}
                                />
                            )}
                        </div>

                        {/* Control buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick();
                                }}
                                disabled={isPending}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors cursor-pointer"
                            >
                                {isPending ? 'Deleting...' : 'Delete'}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    rotateImage('cw');
                                }}
                                disabled={isPending}
                                className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-sm font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50"
                                title="Rotate clockwise"
                            >
                                ↷
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    rotateImage('ccw');
                                }}
                                disabled={isPending}
                                className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-sm font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50"
                                title="Rotate counter-clockwise"
                            >
                                ↶
                            </button>
                        </div>

                        {/* Media info */}
                        {(selectedMedia.title || selectedMedia.date || selectedMedia.uploaded_at) && (
                            <div className="text-center text-white space-y-1">
                                {selectedMedia.title && (
                                    <p className="text-lg font-medium">{selectedMedia.title}</p>
                                )}
                                {(selectedMedia.date || selectedMedia.uploaded_at) && (
                                    <button
                                        type="button"
                                        onClick={(e) => openDatePicker(e)}
                                        disabled={isUpdatingDate}
                                        className="text-sm text-slate-200 underline decoration-dotted hover:text-white disabled:opacity-70"
                                    >
                                        {isUpdatingDate
                                            ? 'Updating date...'
                                            : selectedMedia.date
                                                ? new Date(selectedMedia.date).toLocaleString()
                                                : new Date(selectedMedia.uploaded_at).toLocaleString()}
                                    </button>
                                )}
                                <input
                                    ref={dateInputRef}
                                    type="datetime-local"
                                    className="sr-only"
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        if (!e.target.value) return;
                                        void handleDateChange(e.target.value);
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showJumpPicker && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
                    onClick={() => setShowJumpPicker(false)}
                >
                    <div
                        className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-md mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold text-white mb-4">Jump to Date</h3>
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
