'use client';

import { useEffect, useState } from 'react';
import type { DateEntryWithFields } from '@/lib/dates';

type Props = {
    title: string;
    date: string;
    onClose: () => void;
};

export default function DateModal({ title, date, onClose }: Props) {
    const [dateEntry, setDateEntry] = useState<DateEntryWithFields | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
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
                            <div className="text-slate-400">Loading...</div>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-red-400">Error: {error}</div>
                        </div>
                    )}

                    {dateEntry && (
                        <div>
                            {/* Header */}
                            <div className="mb-6">
                                <h2 className="text-2xl font-semibold mb-2">{dateEntry.title}</h2>
                                <div className="text-slate-400 text-sm">
                                    {new Date(dateEntry.date).toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </div>
                            </div>

                            {/* Custom Fields */}
                            {dateEntry.fields.length > 0 && (
                                <div className="space-y-4">
                                    {dateEntry.fields.map((field) => (
                                        <div
                                            key={field.field_id}
                                            className="border border-slate-700 rounded-lg p-4"
                                        >
                                            <div className="text-sm font-medium text-slate-400 mb-1">
                                                {field.field_name}
                                            </div>
                                            <div className="text-slate-100">
                                                {formatFieldValue(field.value, field.field_type)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {dateEntry.fields.length === 0 && (
                                <div className="text-slate-500 text-sm italic">
                                    No additional details for this date.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper to format field values based on type
function formatFieldValue(value: string, type: string): string {
    switch (type) {
        case 'date':
            return new Date(value).toLocaleDateString('en-US', {
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
