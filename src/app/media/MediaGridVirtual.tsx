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

function deleteItem(store: ItemStore, mediaId: MediaEntry['media_id']) {
    for (const [key, item] of store.items) {
        if (item.media_id === mediaId) {
            store.items.delete(key);
            break;
        }
    }
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

function useStoreSize(store: ItemStore): number {
    const getSnapshot = useCallback(() => store.items.size, [store]);
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
                className="relative rounded-md overflow-hidden bg-slate-800 flex items-center justify-center h-[180px]"
            >
                <div className="animate-pulse w-full h-full bg-slate-700/50" />
            </div>
        );
    }

    return (
        <button
            onClick={() => onSelect(item)}
            className="relative rounded-md overflow-hidden group cursor-pointer hover:opacity-90 transition-opacity w-full h-[180px]"
        >
            {item.media_type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={`/api/media/${item.file_path_thumb}`}
                    alt=""
                    className="w-full h-full object-contain"
                    loading="lazy"
                    decoding="async"
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

// Row component - renders 4 MediaItems
// Does NOT re-render when items load - only MediaItem does
const MediaRow = memo(function MediaRow({
                                            rowIndex,
                                            store,
                                            totalCount,
                                            columns,
                                            onSelect,
                                        }: {
    rowIndex: number;
    store: ItemStore;
    totalCount: number;
    columns: number;
    onSelect: (item: MediaEntry) => void;
}) {
    const startIndex = rowIndex * columns;

    return (
        <div style={{ height: 196, paddingBottom: 16 }}>
            <div className="grid grid-cols-4 gap-4 h-[180px]">
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

    // Create store once
    const storeRef = useRef<ItemStore | null>(null);
    if (!storeRef.current) {
        storeRef.current = createItemStore(initialTotal);
    }
    const store = storeRef.current;

    const [totalCount, setTotalCount] = useState(initialTotal);
    const [selectedMedia, setSelectedMedia] = useState<MediaEntry | null>(null);
    const [isPending, startTransition] = useTransition();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showJumpPicker, setShowJumpPicker] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });

    const COLUMNS = 4;
    const BATCH_SIZE = 48;
    const ROW_HEIGHT = 196; // 180px item + 16px gap

    const loadingRangesRef = useRef<Set<string>>(new Set());
    const initialLoadDoneRef = useRef(false);

    const totalRows = Math.ceil(totalCount / COLUMNS);

    // For debug display
    const storeSize = useStoreSize(store);
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

                console.log('[MediaGridVirtual] SSE received:', data);

                // Find the index of this media item in the store
                let foundIndex = -1;
                for (const [index, item] of store.items) {
                    if (item.media_id === mediaId) {
                        foundIndex = index;
                        console.log('[MediaGridVirtual] Found item at index:', foundIndex);
                        break;
                    }
                }

                if (foundIndex !== -1) {
                    // Fetch the updated item by its media_id
                    try {
                        const response = await fetch(`/api/media-by-id?id=${mediaId}`);
                        const result = await response.json();

                        if (result.media) {
                            console.log('[MediaGridVirtual] Updating item:', result.media);
                            updateItem(store, foundIndex, result.media);
                        }
                    } catch (err) {
                        console.error('Failed to update transcoded item:', err);
                    }
                } else {
                    console.log('[MediaGridVirtual] Item not in cache, media_id:', mediaId);
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
    }, []);

    // Row renderer - store reference is stable, no re-renders from data loading
    const rowContent = useCallback(
        (rowIndex: number) => (
            <MediaRow
                rowIndex={rowIndex}
                store={store}
                totalCount={totalCount}
                columns={COLUMNS}
                onSelect={handleSelect}
            />
        ),
        [store, totalCount, COLUMNS, handleSelect]
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
                setTotalCount((prev) => Math.max(0, prev - 1));
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
            setVisibleRange({ start: range.startIndex, end: range.endIndex });

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
                    className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-full shadow-lg transition-colors flex items-center gap-2"
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
                    className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-full shadow-lg transition-colors flex items-center gap-2"
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

            {/* Debug panel */}
            <div className="fixed bottom-6 left-6 z-40 bg-black/70 text-slate-200 text-xs px-3 py-2 rounded-md border border-slate-700">
                <div>
                    Cached items: <span className="font-mono">{storeSize}</span> /{' '}
                    <span className="font-mono">{totalCount}</span>
                </div>
                <div>
                    Total rows: <span className="font-mono">{totalRows}</span>
                </div>
                <div>
                    Visible rows: <span className="font-mono">{visibleRange.start}</span>–
                    <span className="font-mono">{visibleRange.end}</span>
                </div>
            </div>

            {/* Virtual Scrolling with FIXED row heights */}
            <div style={{ height: 'calc(100vh - 160px)' }}>
                <Virtuoso
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
                                    This will permanently delete the original, thumbnail, and all
                                    associated files. This action cannot be undone.
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
                                <h3 className="text-lg font-semibold text-red-400 mb-2">Error</h3>
                                <p className="text-sm text-slate-300 mb-6">{error}</p>
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

                    <div className="max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
                        {selectedMedia.media_type === 'image' ? (
                            // eslint-disable-next-line @next/next/no-img-element
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