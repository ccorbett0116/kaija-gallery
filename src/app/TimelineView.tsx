'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DateEntry } from '@/lib/dates';
import DateModal from './DateModal';

type Props = {
    dates: DateEntry[];
};

const formatDisplayDate = (isoDate: string) =>
    // Use noon UTC to avoid local timezone shifting the day backward/forward
    new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

export default function TimelineView({ dates }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [scrollY, setScrollY] = useState(0);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [showScrollBottom, setShowScrollBottom] = useState(false);

    // Derive selectedDate directly from URL search parameters
    const titleFromUrl = searchParams.get('title');
    const dateFromUrl = searchParams.get('date');
    const selectedDate = (titleFromUrl && dateFromUrl)
        ? { title: decodeURIComponent(titleFromUrl), date: decodeURIComponent(dateFromUrl) }
        : null;

    // Update URL when modal opens/closes
    const handleOpenDate = (title: string, date: string) => {
        const params = new URLSearchParams();
        params.set('title', title);
        params.set('date', date);
        router.push(`?${params.toString()}`, { scroll: false });
    };

    const handleCloseDate = () => {
        router.push('/', { scroll: false });
    };

    const scrollToTop = () => {
        containerRef.current?.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    };

    const scrollToBottom = () => {
        if (containerRef.current) {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    };

    // Track window size for responsive scaling
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

    useEffect(() => {
        const handleScroll = () => {
            if (containerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
                setScrollY(scrollTop);

                // Show scroll to top button when scrolled down more than 200px
                setShowScrollTop(scrollTop > 200);

                // Show scroll to bottom button when not at bottom (with 50px threshold)
                setShowScrollBottom(scrollTop + clientHeight < scrollHeight - 50);
            }
        };

        const container = containerRef.current;
        if (container) {
            handleScroll(); // Initial check
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, []);

    // S-curve parameters - scale based on screen size
    const BASE_WIDTH = 600;
    const SCALE = Math.min(1, Math.max(0.5, (dimensions.width - 40) / BASE_WIDTH)); // Scale between 50% and 100%
    const CURVE_WIDTH = BASE_WIDTH * SCALE;
    const CURVE_HEIGHT = 350 * SCALE; // Height of one full S loop
    const ITEM_SPACING = CURVE_HEIGHT; // Vertical space per date
    const TOP_PADDING = 120 * SCALE; // Space at the top before the curve starts

    // Scaled UI elements
    const PIN_SIZE = Math.max(12, 16 * SCALE); // Pin circle size (12px min)
    const CARD_PADDING_X = Math.max(12, 16 * SCALE); // Card horizontal padding
    const CARD_PADDING_Y = Math.max(6, 8 * SCALE); // Card vertical padding
    const TITLE_SIZE = Math.max(12, 14 * SCALE); // Title font size
    const DATE_SIZE = Math.max(10, 12 * SCALE); // Date font size
    const STROKE_WIDTH = Math.max(2, 4 * SCALE); // Path stroke width

    // On small screens, show cards on inside of bend instead of outside
    const isSmallScreen = dimensions.width < 740;
    const CARD_OFFSET = isSmallScreen ? Math.max(48, 60 * SCALE) : Math.max(8, 12 * SCALE); // More space when inside

    // Calculate position along S-curve for a given index
    const getPositionForIndex = (index: number) => {
        const y = index * ITEM_SPACING + TOP_PADDING;
        const isLeftBend = index % 2 === 0;

        // X position oscillates left-right
        const centerX = CURVE_WIDTH / 2;
        const amplitude = CURVE_WIDTH / 2.5;

        let x: number;
        if (isLeftBend) {
            x = centerX - amplitude;
        } else {
            x = centerX + amplitude;
        }

        return { x, y };
    };

    // Generate SVG path for the S-curve
    const generatePath = () => {
        if (dates.length === 0) return '';

        const segments: string[] = [];
        const numSegments = dates.length - 1; // Only need segments between points

        const centerX = CURVE_WIDTH / 2;
        const amplitude = CURVE_WIDTH / 2.5;

        // Start at the first point (left side)
        const startX = centerX - amplitude;
        segments.push(`M ${startX} ${TOP_PADDING}`);

        // Generate curves between each consecutive pair of points
        for (let i = 0; i < numSegments; i++) {
            const startY = i * CURVE_HEIGHT + TOP_PADDING;
            const endY = (i + 1) * CURVE_HEIGHT + TOP_PADDING;

            const isEven = i % 2 === 0;

            if (isEven) {
                // Currently at left, curve to right
                const fromX = centerX - amplitude;
                const toX = centerX + amplitude;

                const cp1X = fromX;
                const cp1Y = startY + CURVE_HEIGHT * 0.4;
                const cp2X = toX;
                const cp2Y = endY - CURVE_HEIGHT * 0.4;

                segments.push(
                    `C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${toX} ${endY}`
                );
            } else {
                // Currently at right, curve to left
                const fromX = centerX + amplitude;
                const toX = centerX - amplitude;

                const cp1X = fromX;
                const cp1Y = startY + CURVE_HEIGHT * 0.4;
                const cp2X = toX;
                const cp2Y = endY - CURVE_HEIGHT * 0.4;

                segments.push(
                    `C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${toX} ${endY}`
                );
            }
        }

        return segments.join(' ');
    };

    const totalHeight = (dates.length - 1) * ITEM_SPACING + TOP_PADDING + 150;

    return (
        <div
            ref={containerRef}
            className="relative overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden"
            style={{ height: 'calc(100vh - 64px)' }}
        >
            <div
                className="relative mx-auto"
                style={{
                    width: CURVE_WIDTH,
                    height: totalHeight,
                }}
            >
                {/* SVG Timeline Path */}
                <svg
                    className="absolute top-0 left-0 w-full pointer-events-none"
                    style={{ height: totalHeight }}
                    viewBox={`0 0 ${CURVE_WIDTH} ${totalHeight}`}
                    preserveAspectRatio="xMidYMin slice"
                >
                    <path
                        d={generatePath()}
                        className="text-slate-300 dark:text-slate-600"
                        stroke="currentColor"
                        strokeWidth={STROKE_WIDTH}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${STROKE_WIDTH * 2} ${STROKE_WIDTH * 3}`}
                    />
                </svg>

                {/* Date Pins */}
                {dates.map((date, index) => {
                    const pos = getPositionForIndex(index);
                    // On small screens, show cards on inside of bend; on large screens, outside
                    const isLeftSide = isSmallScreen ? (index % 2 === 1) : (index % 2 === 0);

                    return (
                        <div
                            key={`${date.title}-${date.date}`}
                            className="absolute"
                            style={{
                                left: pos.x,
                                top: pos.y,
                                transform: 'translate(-50%, -50%)',
                            }}
                        >
                            {/* Pin Circle */}
                            <div className="relative">
                                <div
                                    className="rounded-full bg-sky-500 border-2 border-slate-300 dark:border-slate-900 shadow-lg"
                                    style={{
                                        width: PIN_SIZE,
                                        height: PIN_SIZE,
                                    }}
                                />

                                {/* Date Card */}
                                <button
                                    onClick={() => handleOpenDate(date.title, date.date)}
                                    className="absolute whitespace-nowrap cursor-pointer"
                                    style={{
                                        top: '50%',
                                        left: isLeftSide ? `-${CARD_OFFSET}px` : `${PIN_SIZE + CARD_OFFSET}px`,
                                        transform: isLeftSide
                                            ? 'translate(-100%, -50%)'
                                            : 'translate(0, -50%)',
                                    }}
                                >
                                    <div
                                        className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl hover:border-sky-500 transition-colors overflow-hidden"
                                        style={{
                                            paddingLeft: CARD_PADDING_X,
                                            paddingRight: CARD_PADDING_X,
                                            paddingTop: CARD_PADDING_Y,
                                            paddingBottom: CARD_PADDING_Y,
                                        }}
                                    >
                                        {/* Media Thumbnail */}
                                        {date.first_media_thumb && (
                                            <div
                                                className="mb-2 rounded overflow-hidden bg-slate-200 dark:bg-slate-800 relative flex items-center justify-center"
                                                style={{
                                                    width: Math.max(80, 120 * SCALE),
                                                    height: Math.max(60, 90 * SCALE),
                                                }}
                                            >
                                                <img
                                                    src={`/api/media/${date.first_media_thumb}`}
                                                    alt=""
                                                    className="max-w-full max-h-full object-contain"
                                                    style={{
                                                        transform: `rotate(${date.first_media_rotation ?? 0}deg)`,
                                                        transformOrigin: 'center center',
                                                    }}
                                                />
                                                {date.first_media_type === 'video' && (
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                        <div className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                                                            <svg
                                                                className="w-3 h-3 text-white ml-0.5"
                                                                fill="currentColor"
                                                                viewBox="0 0 16 16"
                                                            >
                                                                <path d="M4 3l8 5-8 5V3z" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div
                                            className="font-medium text-slate-900 dark:text-slate-100"
                                            style={{ fontSize: TITLE_SIZE }}
                                        >
                                            {date.title}
                                        </div>
                                        <div
                                            className="text-slate-600 dark:text-slate-400"
                                            style={{
                                                fontSize: DATE_SIZE,
                                                marginTop: CARD_PADDING_Y / 2,
                                            }}
                                        >
                                            {formatDisplayDate(date.date)}
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Date Modal */}
            {selectedDate && (
                <DateModal
                    title={selectedDate.title}
                    date={selectedDate.date}
                    onClose={handleCloseDate}
                />
            )}

            {/* Scroll Buttons */}
            <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-10">
                {showScrollTop && (
                    <button
                        onClick={scrollToTop}
                        className="p-3 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-sky-500 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 hover:dark:bg-slate-700 transition-colors shadow-lg"
                        aria-label="Scroll to top"
                    >
                        <svg
                            className="w-5 h-5 text-sky-600 dark:text-sky-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 15l7-7 7 7"
                            />
                        </svg>
                    </button>
                )}
                {showScrollBottom && (
                    <button
                        onClick={scrollToBottom}
                        className="p-3 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-sky-500 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 hover:dark:bg-slate-700 transition-colors shadow-lg"
                        aria-label="Scroll to bottom"
                    >
                        <svg
                            className="w-5 h-5 text-sky-600 dark:text-sky-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}
