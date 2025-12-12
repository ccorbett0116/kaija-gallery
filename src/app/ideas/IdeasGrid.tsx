// src/app/ideas/IdeasGrid.tsx
'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Idea } from '@/lib/ideas';
import IdeaModal from './IdeaModal';

type Props = {
    ideas: Idea[];
};

// Helper to get column count based on window width
const getColumnCount = () => {
    if (typeof window === 'undefined') return 1;
    if (window.innerWidth >= 1024) return 4;
    if (window.innerWidth >= 768) return 3;
    if (window.innerWidth >= 640) return 2;
    return 1;
};

export default function IdeasGrid({ ideas }: Props) {
    const [numColumns, setNumColumns] = useState(1); // keep SSR/CSR consistent; update after mount
    const [columns, setColumns] = useState<Idea[][]>([]);
    const [itemHeights, setItemHeights] = useState<Map<number, number>>(new Map());
    const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);

    // Effect to update column count on resize
    useEffect(() => {
        const updateColumns = () => {
            const next = getColumnCount();
            setNumColumns((prev) => (prev === next ? prev : next));
        };
        updateColumns();
        window.addEventListener('resize', updateColumns);
        return () => window.removeEventListener('resize', updateColumns);
    }, []);

    // Effect to reset layout when ideas change
    useEffect(() => {
        // When the list of ideas changes, we need to reset the calculated layout
        // and heights to trigger a full re-measurement and re-distribution.
        setColumns([]);
        setItemHeights(new Map());
        itemRefs.current.clear();
    }, [ideas]);

    // Layout effect to measure item heights after they are rendered
    useLayoutEffect(() => {
        const newHeights = new Map<number, number>();
        let allMeasured = true;

        itemRefs.current.forEach((el, id) => {
            if (el) {
                newHeights.set(id, el.offsetHeight);
            } else {
                allMeasured = false;
            }
        });

        // Only update if all refs were measured and heights have changed
        if (allMeasured && newHeights.size === ideas.length) {
            // Basic check to see if heights are different to avoid infinite loops
            let changed = false;
            if (itemHeights.size !== newHeights.size) {
                changed = true;
            } else {
                for (const [id, height] of newHeights) {
                    if (itemHeights.get(id) !== height) {
                        changed = true;
                        break;
                    }
                }
            }

            if (changed) {
                setItemHeights(newHeights);
            }
        }
    }, [ideas, itemHeights]); // Rerun if ideas change

    // Effect to distribute items into columns once heights are known
    useEffect(() => {
        if (ideas.length === 0 || itemHeights.size < ideas.length) {
            setColumns([]);
            return;
        }

        const newColumns: Idea[][] = Array.from({ length: numColumns }, () => []);
        const columnHeights = Array(numColumns).fill(0);

        // The 'ideas' prop is already sorted reverse-chronologically.
        const initialFillCount = Math.min(ideas.length, numColumns);

        // 1. Initial Fill (First Row)
        for (let i = 0; i < initialFillCount; i++) {
            const idea = ideas[i];
            const height = itemHeights.get(idea.idea_id) || 100;

            newColumns[i].push(idea);
            columnHeights[i] += height;
        }

        // 2. Subsequent Fill (Remaining Items)
        for (let i = initialFillCount; i < ideas.length; i++) {
            const idea = ideas[i];
            const height = itemHeights.get(idea.idea_id) || 100;

            // Find the shortest column among the current column heights
            let shortestColumnIndex = 0;
            for (let j = 1; j < numColumns; j++) {
                if (columnHeights[j] < columnHeights[shortestColumnIndex]) {
                    shortestColumnIndex = j;
                }
            }

            // Add the idea to the shortest column
            newColumns[shortestColumnIndex].push(idea);
            columnHeights[shortestColumnIndex] += height;
        }

        setColumns(newColumns);
    }, [ideas, numColumns, itemHeights]);

    const shouldMeasure = columns.length === 0 || itemHeights.size < ideas.length;
    const displayColumns = useMemo(() => {
        if (columns.length > 0) return columns;

        const safeColumns = Math.max(1, numColumns);
        const fallback: Idea[][] = Array.from({ length: safeColumns }, () => []);
        ideas.forEach((idea, index) => {
            fallback[index % safeColumns].push(idea);
        });
        return fallback;
    }, [columns, ideas, numColumns]);

    return (
        <>
            {shouldMeasure && ideas.length > 0 && (
                <div
                    style={{
                        opacity: 0,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        zIndex: -1,
                        pointerEvents: 'none',
                    }}
                >
                    {ideas.map((idea) => (
                        <div
                            key={idea.idea_id}
                            ref={el => {
                                if (el) itemRefs.current.set(idea.idea_id, el);
                                else itemRefs.current.delete(idea.idea_id);
                            }}
                            className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2"
                            // This max-width should roughly match the column width
                            style={{ maxWidth: '300px' }}
                        >
                            <h3 className="font-semibold text-slate-900 dark:text-sky-400">{idea.title}</h3>
                            {idea.content && (
                                <p className="text-sm text-slate-700 dark:text-slate-400 whitespace-pre-wrap">{idea.content}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-4 items-start">
                {displayColumns.map((column, colIndex) => (
                    <div key={colIndex} className="flex flex-col gap-4 w-full">
                        {column.map((idea) => (
                            <button
                                key={idea.idea_id}
                                onClick={() => setSelectedIdea(idea)}
                                className="text-left bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 break-inside-avoid hover:border-sky-500 transition-colors"
                            >
                                <h3 className="font-semibold text-slate-900 dark:text-sky-400">{idea.title}</h3>
                                {idea.content && (
                                    <p className="text-sm text-slate-700 dark:text-slate-400 whitespace-pre-wrap">{idea.content}</p>
                                )}
                            </button>
                        ))}
                    </div>
                ))}
            </div>

            {selectedIdea && (
                <IdeaModal
                    idea={selectedIdea}
                    onClose={() => setSelectedIdea(null)}
                />
            )}
        </>
    );
}
