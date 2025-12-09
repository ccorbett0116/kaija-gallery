// src/app/dates/new/ui/NewDateForm.tsx
'use client';

import { useState } from 'react';
import { createDateAction } from '../actions';

type FieldRow = {
    id: number;
    name: string;
    value: string;
};

export default function NewDateForm() {
    const [fields, setFields] = useState<FieldRow[]>([
        { id: 1, name: '', value: '' },
    ]);

    const addField = () => {
        setFields((prev) => [
            ...prev,
            { id: Date.now(), name: '', value: '' },
        ]);
    };

    const updateField = (id: number, key: 'name' | 'value', val: string) => {
        setFields((prev) =>
            prev.map((f) => (f.id === id ? { ...f, [key]: val } : f))
        );
    };

    const removeField = (id: number) => {
        setFields((prev) => prev.filter((f) => f.id !== id));
    };

    return (
        <form action={createDateAction} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                    <span className="text-sm">Title</span>
                    <input
                        name="title"
                        type="text"
                        className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-sky-500"
                        required
                    />
                </label>

                <label className="space-y-1">
                    <span className="text-sm">Date</span>
                    <input
                        name="date"
                        type="date"
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

                <div className="space-y-2">
                    {fields.map((field) => (
                        <div
                            key={field.id}
                            className="grid grid-cols-[1.2fr,1.8fr,auto] gap-2 items-center"
                        >
                            <input
                                name="fieldName"
                                placeholder="Field name (e.g. Location)"
                                value={field.name}
                                onChange={(e) =>
                                    updateField(field.id, 'name', e.target.value)
                                }
                                className="rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-xs focus:outline-none focus:ring focus:ring-sky-500"
                            />
                            <input
                                name="fieldValue"
                                placeholder="Value"
                                value={field.value}
                                onChange={(e) =>
                                    updateField(field.id, 'value', e.target.value)
                                }
                                className="rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-xs focus:outline-none focus:ring focus:ring-sky-500"
                            />
                            <button
                                type="button"
                                onClick={() => removeField(field.id)}
                                className="text-xs text-slate-400 hover:text-red-400"
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                </div>

                <p className="text-xs text-slate-500">
                    Field names are saved in a global registry. Reusing a field name
                    (e.g., “Location”, “Restaurant”, “Mood”) across dates lets you
                    search by that field later.
                </p>
            </div>

            <button
                type="submit"
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500"
            >
                Save Date
            </button>
        </form>
    );
}
