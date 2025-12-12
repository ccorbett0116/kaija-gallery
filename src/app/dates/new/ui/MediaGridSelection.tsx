'use client';

import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
    useSyncExternalStore,
    memo,
} from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import type { MediaEntry } from '@/lib/media';

// ============================================================================
// EXTERNAL STORE
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

function useItem(store: ItemStore, index: number): MediaEntry | null {
    const getSnapshot = useCallback(() => getItem(store, index), [store, index]);
    const subscribe = useCallback((cb: () => void) => subscribeToStore(store, cb), [store]);

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ============================================================================
// COMPONENTS
// ============================================================================

type Props = {
    initialTotal: number;
    selectedIds: number[];
    onToggleSelection: (mediaId: number) => void;
};

const MediaItem = memo(function MediaItem({
    store,
    globalIndex,
    selectedIds,
    onToggle,
    onLongPress,
}: {
    store: ItemStore;
    globalIndex: number;
    selectedIds: number[];
    onToggle: (mediaId: number) => void;
    onLongPress: (item: MediaEntry) => void;
}) {
    const item = useItem(store, globalIndex);
    const [pressTimer, setPressTimer] = React.useState<NodeJS.Timeout | null>(null);

    if (!item) {
        return (
            <div className="relative rounded-md overflow-hidden bg-slate-800 flex items-center justify-center w-full h-full">
                <div className="animate-pulse w-full h-full bg-slate-700/50" />
            </div>
        );
    }

    const isSelected = selectedIds.includes(item.media_id);

    const handlePressStart = () => {
        if (item.media_type === 'video') {
            const timer = setTimeout(() => {
                onLongPress(item);
            }, 500); // 500ms long press
            setPressTimer(timer);
        }
    };

    const handlePressEnd = () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            setPressTimer(null);
        }
    };

    const handleClick = () => {
        handlePressEnd(); // Clear any pending long press
        onToggle(item.media_id);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            className={`relative rounded-md overflow-hidden border-2 transition-colors w-full h-full ${
                isSelected
                    ? 'border-sky-500'
                    : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
            }`}
        >
            {item.media_type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={`/api/media/${item.file_path_thumb}`}
                    alt=""
                    className="w-full h-full object-cover"
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
                            className="w-full h-full object-cover"
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
            {isSelected && (
                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center pointer-events-none">
                    <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                </div>
            )}
        </button>
    );
});

const MediaRow = memo(function MediaRow({
    rowIndex,
    store,
    totalCount,
    columns,
    itemHeight,
    rowGap,
    selectedIds,
    onToggle,
    onLongPress,
}: {
    rowIndex: number;
    store: ItemStore;
    totalCount: number;
    columns: number;
    itemHeight: number;
    rowGap: number;
    selectedIds: number[];
    onToggle: (mediaId: number) => void;
    onLongPress: (item: MediaEntry) => void;
}) {
    const startIndex = rowIndex * columns;
    const gridCols = columns === 2 ? 'grid-cols-2' : columns === 3 ? 'grid-cols-3' : 'grid-cols-4';

    return (
        <div style={{ height: itemHeight + rowGap, paddingBottom: rowGap }}>
            <div className={`grid ${gridCols} gap-2`} style={{ height: itemHeight }}>
                {Array.from({ length: columns }, (_, colIdx) => {
                    const globalIndex = startIndex + colIdx;
                    if (globalIndex >= totalCount) return <div key={colIdx} />;
                    return (
                        <MediaItem
                            key={globalIndex}
                            store={store}
                            globalIndex={globalIndex}
                            selectedIds={selectedIds}
                            onToggle={onToggle}
                            onLongPress={onLongPress}
                        />
                    );
                })}
            </div>
        </div>
    );
});

export default function MediaGridSelection({ initialTotal, selectedIds, onToggleSelection }: Props) {
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    const storeRef = useRef<ItemStore | null>(null);
    if (!storeRef.current) {
        storeRef.current = createItemStore(initialTotal);
    }
    const store = storeRef.current;

    const [totalCount] = useState(initialTotal);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [renderedCount, setRenderedCount] = useState(0);
    const [previewMedia, setPreviewMedia] = useState<MediaEntry | null>(null);
    const [mediaDimensions, setMediaDimensions] = useState<{ width: number; height: number } | null>(null);

    // Track DOM img count
    useEffect(() => {
        const updateCount = () => {
            const container = document.querySelector('[data-media-selector]');
            if (container) {
                const imgCount = container.querySelectorAll('img').length;
                setRenderedCount(imgCount);
            }
        };

        const interval = setInterval(updateCount, 500);
        return () => clearInterval(interval);
    }, []);

    const handleLongPress = useCallback((item: MediaEntry) => {
        setPreviewMedia(item);
        setMediaDimensions(null);
    }, []);

    // Calculate proper dimensions for rotated media
    const getDisplayDimensions = useCallback(() => {
        if (!previewMedia || !mediaDimensions) return {
            container: { maxWidth: '95vw', maxHeight: '85vh' },
            media: {}
        };

        const rotation = (previewMedia.rotation ?? 0) % 360;
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
    }, [previewMedia, mediaDimensions]);

    useEffect(() => {
        const updateDimensions = () => {
            setDimensions({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // Calculate columns based on screen width (2-4 columns)
    const COLUMNS = dimensions.width < 640 ? 2 : // mobile
                    dimensions.width < 768 ? 3 : // sm
                    4; // md and above

    // Scale item height with screen width for better proportions
    const itemHeight = dimensions.width < 640 ? 150 :
                       dimensions.width < 768 ? 150 :
                       150;
    const ROW_GAP = 8;
    const ROW_HEIGHT = itemHeight + ROW_GAP;
    const BATCH_SIZE = COLUMNS * 12;

    const loadingRangesRef = useRef<Set<string>>(new Set());
    const initialLoadDoneRef = useRef(false);

    const totalRows = Math.ceil(totalCount / COLUMNS);

    const checkAndLoad = useCallback(
        async (startIdx: number, endIdx: number) => {
            if (!initialLoadDoneRef.current) {
                initialLoadDoneRef.current = true;
                const start = startIdx * COLUMNS;
                const end = endIdx * COLUMNS;

                try {
                    const res = await fetch(`/api/media-batch?offset=${start}&limit=${BATCH_SIZE}`);
                    const data = await res.json();
                    setItems(store, start, data.media);
                } catch (err) {
                    console.error('Failed to load initial batch:', err);
                }
                return;
            }

            const firstRow = Math.floor(startIdx / BATCH_SIZE) * BATCH_SIZE;
            const lastRow = Math.floor(endIdx / BATCH_SIZE) * BATCH_SIZE;

            for (let rowStart = firstRow; rowStart <= lastRow; rowStart += BATCH_SIZE) {
                const rangeKey = `${rowStart}`;
                if (loadingRangesRef.current.has(rangeKey)) continue;

                const startItemIdx = rowStart * COLUMNS;
                const endItemIdx = Math.min(startItemIdx + BATCH_SIZE * COLUMNS, totalCount);

                let needsLoad = false;
                for (let i = startItemIdx; i < endItemIdx; i++) {
                    if (!store.items.has(i)) {
                        needsLoad = true;
                        break;
                    }
                }

                if (needsLoad) {
                    loadingRangesRef.current.add(rangeKey);

                    try {
                        const res = await fetch(
                            `/api/media-batch?offset=${startItemIdx}&limit=${BATCH_SIZE * COLUMNS}`
                        );
                        const data = await res.json();
                        setItems(store, startItemIdx, data.media);
                    } catch (err) {
                        console.error('Failed to load media batch:', err);
                    } finally {
                        loadingRangesRef.current.delete(rangeKey);
                    }
                }
            }
        },
        [BATCH_SIZE, COLUMNS, store, totalCount]
    );

    const rowContent = useCallback(
        (rowIndex: number) => (
            <MediaRow
                rowIndex={rowIndex}
                store={store}
                totalCount={totalCount}
                columns={COLUMNS}
                itemHeight={itemHeight}
                rowGap={ROW_GAP}
                selectedIds={selectedIds}
                onToggle={onToggleSelection}
                onLongPress={handleLongPress}
            />
        ),
        [store, totalCount, COLUMNS, itemHeight, ROW_GAP, selectedIds, onToggleSelection, handleLongPress]
    );

    const handleRangeChanged = useCallback(
        (range: { startIndex: number; endIndex: number }) => {
            requestAnimationFrame(() => {
                checkAndLoad(range.startIndex, range.endIndex);
            });
        },
        [checkAndLoad]
    );

    return (
        <>
            <div>

                <div style={{ height: '400px' }} data-media-selector>
                    <Virtuoso
                        key={`${COLUMNS}-${ROW_HEIGHT}`}
                        ref={virtuosoRef}
                        style={{ height: '100%' }}
                        totalCount={totalRows}
                        itemContent={rowContent}
                        fixedItemHeight={ROW_HEIGHT}
                        overscan={1000}
                        rangeChanged={handleRangeChanged}
                        className="[&::-webkit-scrollbar]:hidden"
                    />
                </div>
            </div>

            {/* Video Preview Modal */}
            {previewMedia && previewMedia.media_type === 'video' && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setPreviewMedia(null)}
                >
                    <div
                        className="relative flex flex-col items-center gap-4 max-w-full max-h-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setPreviewMedia(null)}
                            className="self-end text-white hover:text-slate-300 text-3xl leading-none cursor-pointer bg-black/50 rounded-full w-10 h-10 flex items-center justify-center"
                            aria-label="Close"
                        >
                            &times;
                        </button>

                        <div
                            className="flex items-center justify-center"
                            style={getDisplayDimensions().container}
                        >
                            <video
                                controls
                                autoPlay
                                className="block"
                                src={`/api/media/${previewMedia.file_path_display}`}
                                onLoadedMetadata={(e) => {
                                    const video = e.currentTarget;
                                    setMediaDimensions({
                                        width: video.videoWidth,
                                        height: video.videoHeight,
                                    });
                                }}
                                style={{
                                    ...getDisplayDimensions().media,
                                    objectFit: 'contain',
                                    transform: `rotate(${previewMedia.rotation ?? 0}deg)`,
                                    transformOrigin: 'center center',
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
