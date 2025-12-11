// src/app/dates/new/ui/NewDateForm.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FieldType, FieldDefinition } from '@/lib/dates';
import MediaSelector from './MediaSelector';

type PhotonFeature = {
    properties: {
        osm_id: number;
        name?: string;
        street?: string;
        housenumber?: string;
        postcode?: string;
        city?: string;
        state?: string;
        country?: string;
        osm_key?: string;
        osm_value?: string;
    };
};

// Address input component with autocomplete
function AddressInput({
    value,
    onChange,
    placeholder,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

    const formatAddress = (props: PhotonFeature['properties']): string => {
        const parts: string[] = [];

        // If it's a named place (restaurant, business, etc.)
        if (props.name) {
            parts.push(props.name);
        }

        // Add street address
        if (props.housenumber && props.street) {
            parts.push(`${props.housenumber} ${props.street}`);
        } else if (props.street) {
            parts.push(props.street);
        }

        // Add locality
        if (props.city) {
            parts.push(props.city);
        }

        if (props.state) {
            parts.push(props.state);
        }

        if (props.country) {
            parts.push(props.country);
        }

        return parts.join(', ');
    };

    // Get user's location on mount
    useEffect(() => {
        // Try browser geolocation first
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lon: position.coords.longitude,
                    });
                },
                async () => {
                    // Fallback to IP-based geolocation if permission denied
                    try {
                        const response = await fetch('https://ipapi.co/json/');
                        const data = await response.json();
                        if (data.latitude && data.longitude) {
                            setUserLocation({
                                lat: data.latitude,
                                lon: data.longitude,
                            });
                        }
                    } catch (err) {
                        console.error('IP geolocation failed:', err);
                    }
                }
            );
        }
    }, []);

    const searchAddress = useCallback(async (query: string) => {
        if (!query.trim() || query.length < 2) {
            setSuggestions([]);
            return;
        }

        setIsSearching(true);
        try {
            // Build URL with optional location biasing
            let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8`;

            if (userLocation) {
                url += `&lat=${userLocation.lat}&lon=${userLocation.lon}`;
            }

            const response = await fetch(url);
            const data = await response.json();

            const results = data.features
                .map((feature: PhotonFeature) => formatAddress(feature.properties))
                .filter((addr: string) => addr.length > 0);

            setSuggestions(results);
        } catch (err) {
            console.error('Address search failed:', err);
            setSuggestions([]);
        } finally {
            setIsSearching(false);
        }
    }, [userLocation]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            void searchAddress(value);
        }, 400);

        return () => clearTimeout(timer);
    }, [value, searchAddress]);

    return (
        <div className="relative">
            <input
                name="fieldValue"
                type="text"
                placeholder={placeholder || 'Address or place name...'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-xs focus:outline-none focus:ring focus:ring-sky-500"
            />
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((suggestion, idx) => (
                        <button
                            key={`${suggestion}-${idx}`}
                            type="button"
                            onClick={() => {
                                onChange(suggestion);
                                setSuggestions([]);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 border-b border-slate-800 last:border-b-0"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}
            {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-3 h-3 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    );
}

type FieldRow = {
    id: number;
    name: string;
    value: string;
    type: FieldType;
    isExisting: boolean; // Track if this field matches an existing field
};

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'time', label: 'Time' },
    { value: 'datetime-local', label: 'Date & Time' },
    { value: 'address', label: 'Address' },
];

type InitialField = {
    name: string;
    value: string;
    type: FieldType;
};

type NewDateFormProps = {
    action: (formData: FormData) => Promise<void>;
    initialTitle?: string;
    initialDate?: string;
    initialFields?: InitialField[];
    initialMediaIds?: number[];
    submitLabel?: string;
};

export default function NewDateForm({
    action,
    initialTitle = '',
    initialDate = '',
    initialFields = [],
    initialMediaIds = [],
    submitLabel = 'Save Date',
}: NewDateFormProps) {
    const [title, setTitle] = useState(initialTitle);
    const [date, setDate] = useState(initialDate);
    const [fields, setFields] = useState<FieldRow[]>(() => {
        if (initialFields.length > 0) {
            return initialFields.map((f, index) => ({
                id: index + 1,
                name: f.name,
                value: f.value,
                type: f.type,
                isExisting: true, // Fields from DB are considered existing
            }));
        }
        return [{ id: 1, name: '', value: '', type: 'text', isExisting: false }];
    });
    const [suggestions, setSuggestions] = useState<Map<number, FieldDefinition[]>>(new Map());
    const [activeSuggestions, setActiveSuggestions] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>(initialMediaIds);

    useEffect(() => {
        // Auto-resize any textareas on initial render and whenever fields change
        const autosizeElements = document.querySelectorAll<HTMLTextAreaElement>('[data-auto-resize="true"]');
        autosizeElements.forEach((el) => {
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        });
    }, [fields]);

    const addField = () => {
        setFields((prev) => [
            ...prev,
            { id: Date.now(), name: '', value: '', type: 'text', isExisting: false },
        ]);
    };

    const updateField = (id: number, key: 'name' | 'value' | 'type', val: string) => {
        setError(null); // Clear error when user makes changes
        setFields((prev) =>
            prev.map((f) => (f.id === id ? { ...f, [key]: val } : f))
        );
    };

    const removeField = (id: number) => {
        setError(null); // Clear error when user makes changes
        setFields((prev) => prev.filter((f) => f.id !== id));
        setSuggestions((prev) => {
            const newMap = new Map(prev);
            newMap.delete(id);
            return newMap;
        });
    };

    // Search for field suggestions
    const searchFieldSuggestions = useCallback(async (fieldId: number, query: string) => {
        if (!query.trim()) {
            setSuggestions((prev) => {
                const newMap = new Map(prev);
                newMap.delete(fieldId);
                return newMap;
            });
            setFields((prev) =>
                prev.map((f) => (f.id === fieldId ? { ...f, isExisting: false } : f))
            );
            return;
        }

        try {
            const response = await fetch(`/api/search-fields?q=${encodeURIComponent(query)}`);
            const results: FieldDefinition[] = await response.json();

            setSuggestions((prev) => {
                const newMap = new Map(prev);
                newMap.set(fieldId, results);
                return newMap;
            });

            // Check for exact match
            const exactMatch = results.find(
                (r) => r.field_name.toLowerCase() === query.toLowerCase()
            );

            if (exactMatch) {
                setFields((prev) =>
                    prev.map((f) =>
                        f.id === fieldId
                            ? { ...f, type: exactMatch.field_type, isExisting: true }
                            : f
                    )
                );
            } else {
                setFields((prev) =>
                    prev.map((f) => (f.id === fieldId ? { ...f, isExisting: false } : f))
                );
            }
        } catch (err) {
            console.error('Failed to search fields:', err);
        }
    }, []);

    // Debounced search - only search when field name changes
    useEffect(() => {
        const timers = new Map<number, NodeJS.Timeout>();

        fields.forEach((field) => {
            const timer = setTimeout(() => {
                void searchFieldSuggestions(field.id, field.name);
            }, 300);
            timers.set(field.id, timer);
        });

        return () => {
            timers.forEach((timer) => clearTimeout(timer));
        };
    }, [fields, searchFieldSuggestions]);

    const selectSuggestion = (fieldId: number, suggestion: FieldDefinition) => {
        setFields((prev) =>
            prev.map((f) =>
                f.id === fieldId
                    ? { ...f, name: suggestion.field_name, type: suggestion.field_type, isExisting: true }
                    : f
            )
        );
        setActiveSuggestions(null);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        setError(null);

        const trimmedDate = date.trim();
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!datePattern.test(trimmedDate)) {
            e.preventDefault();
            setError('Please enter a valid date in YYYY-MM-DD format.');
            return;
        }

        const [yearStr, monthStr, dayStr] = trimmedDate.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        const day = Number(dayStr);
        const MIN_YEAR = 2025;
        const MAX_YEAR = 2125;

        const utcDate = new Date(Date.UTC(year, month - 1, day));
        const isValidDate =
            !Number.isNaN(utcDate.getTime()) &&
            utcDate.getUTCFullYear() === year &&
            utcDate.getUTCMonth() === month - 1 &&
            utcDate.getUTCDate() === day;

        if (!isValidDate) {
            e.preventDefault();
            setError('Please enter a real calendar date.');
            return;
        }

        if (year < MIN_YEAR || year > MAX_YEAR) {
            e.preventDefault();
            setError(`Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`);
            return;
        }

        // Get all non-empty field names
        const fieldNames = fields
            .map((f) => f.name.trim().toLowerCase())
            .filter((name) => name !== '');

        // Check for duplicates
        const duplicates = fieldNames.filter(
            (name, index) => fieldNames.indexOf(name) !== index
        );

        if (duplicates.length > 0) {
            e.preventDefault();
            const uniqueDuplicates = Array.from(new Set(duplicates));
            setError(
                `Duplicate field name${uniqueDuplicates.length > 1 ? 's' : ''}: ${uniqueDuplicates.join(', ')}`
            );
            return;
        }
    };

    return (
        <form action={action} onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                    <span className="text-sm">Title</span>
                    <input
                        name="title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-sky-500"
                        required
                    />
                </label>

                <label className="space-y-1">
                    <span className="text-sm">Date</span>
                    <input
                        name="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-sky-500"
                        required
                    />
                </label>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Custom Fields</span>
                    <button
                        type="button"
                        onClick={addField}
                        className="text-xs rounded-md border border-slate-700 px-2 py-1 hover:border-sky-500"
                    >
                        + Add Field
                    </button>
                </div>

                <div className="space-y-3">
                    {fields.map((field) => {
                        const fieldSuggestions = suggestions.get(field.id) || [];
                        const showSuggestions = activeSuggestions === field.id && fieldSuggestions.length > 0;

                        return (
                            <div key={field.id} className="space-y-2">
                                <div
                                    className={`grid gap-2 items-start ${
                                        field.isExisting
                                            ? 'grid-cols-[1fr,1.5fr,auto]'
                                            : 'grid-cols-[1fr,1fr,1.5fr,auto]'
                                    }`}
                                >
                                    <div className="relative">
                                        <input
                                            name="fieldName"
                                            placeholder="Field name (e.g. Location)"
                                            value={field.name}
                                            onChange={(e) =>
                                                updateField(field.id, 'name', e.target.value)
                                            }
                                            onFocus={() => setActiveSuggestions(field.id)}
                                            onBlur={() => setTimeout(() => setActiveSuggestions(null), 200)}
                                            className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-xs focus:outline-none focus:ring focus:ring-sky-500"
                                        />
                                        {showSuggestions && (
                                            <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-lg max-h-40 overflow-y-auto">
                                                {fieldSuggestions.map((suggestion) => (
                                                    <button
                                                        key={suggestion.field_id}
                                                        type="button"
                                                        onClick={() => selectSuggestion(field.id, suggestion)}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 flex items-center justify-between"
                                                    >
                                                        <span>{suggestion.field_name}</span>
                                                        <span className="text-slate-500 text-[10px]">
                                                            {FIELD_TYPE_OPTIONS.find((o) => o.value === suggestion.field_type)?.label}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {!field.isExisting && (
                                        <select
                                            name="fieldType"
                                            value={field.type}
                                            onChange={(e) =>
                                                updateField(field.id, 'type', e.target.value)
                                            }
                                            className="rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-xs focus:outline-none focus:ring focus:ring-sky-500"
                                        >
                                            {FIELD_TYPE_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {field.isExisting && (
                                        <input type="hidden" name="fieldType" value={field.type} />
                                    )}

                                    {field.type === 'address' ? (
                                        <AddressInput
                                            value={field.value}
                                            onChange={(val) =>
                                                updateField(field.id, 'value', val)
                                            }
                                            placeholder="Start typing an address..."
                                        />
                                    ) : field.type === 'text' ? (
                                        <textarea
                                            name="fieldValue"
                                            placeholder="Value"
                                            value={field.value}
                                            onChange={(e) => {
                                                updateField(field.id, 'value', e.target.value);
                                                // Auto-resize
                                                e.target.style.height = 'auto';
                                                e.target.style.height = e.target.scrollHeight + 'px';
                                            }}
                                            onInput={(e) => {
                                                // Also handle on initial render
                                                const target = e.target as HTMLTextAreaElement;
                                                target.style.height = 'auto';
                                                target.style.height = target.scrollHeight + 'px';
                                            }}
                                            rows={1}
                                            data-auto-resize="true"
                                            className="rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-xs focus:outline-none focus:ring focus:ring-sky-500 resize-none overflow-hidden"
                                            style={{ minHeight: '34px' }}
                                        />
                                    ) : (
                                        <input
                                            name="fieldValue"
                                            type={field.type}
                                            placeholder="Value"
                                            value={field.value}
                                            onChange={(e) =>
                                                updateField(field.id, 'value', e.target.value)
                                            }
                                            className="rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-xs focus:outline-none focus:ring focus:ring-sky-500"
                                        />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeField(field.id)}
                                        className="text-xs text-slate-400 hover:text-red-400 pt-2"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <p className="text-xs text-slate-500">
                    Field names are saved with their types. Start typing to see existing fields,
                    or create a new one by choosing its type (e.g., text, number, time, date).
                </p>
            </div>

            {/* Media Selector */}
            <div className="space-y-2">
                <MediaSelector
                    selectedIds={selectedMediaIds}
                    onChange={setSelectedMediaIds}
                />
                {/* Hidden inputs for selected media IDs */}
                {selectedMediaIds.map((id) => (
                    <input key={id} type="hidden" name="mediaIds" value={id} />
                ))}
            </div>

            {error && (
                <div className="rounded-md bg-red-900/20 border border-red-800 px-4 py-3 text-sm text-red-400">
                    {error}
                </div>
            )}

            <button
                type="submit"
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500"
            >
                {submitLabel}
            </button>
        </form>
    );
}
