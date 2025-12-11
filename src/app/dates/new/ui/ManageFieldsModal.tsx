// src/app/dates/new/ui/ManageFieldsModal.tsx
'use client';

import { useState, useEffect } from 'react';
import type { FieldDefinition } from '@/lib/dates';
import ConfirmationModal from './ConfirmationModal';

type FieldWithUsage = FieldDefinition & {
    usage_count: number;
};

type Props = {
    onClose: () => void;
};

export default function ManageFieldsModal({ onClose }: Props) {
    const [fields, setFields] = useState<FieldWithUsage[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{
        fieldId: number;
        fieldName: string;
        usageCount: number;
    } | null>(null);

    const fetchFields = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const query = searchQuery.trim();
            const url = query
                ? `/api/fields?q=${encodeURIComponent(query)}`
                : '/api/fields';
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch fields');
            }
            const data = await response.json();
            setFields(data);
        } catch (err) {
            console.error('Failed to fetch fields:', err);
            setError('Failed to load fields');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            void fetchFields();
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleDeleteClick = (fieldId: number, fieldName: string, usageCount: number) => {
        setDeleteConfirm({ fieldId, fieldName, usageCount });
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirm) return;

        const { fieldId } = deleteConfirm;
        setDeleteConfirm(null);

        try {
            const response = await fetch(`/api/fields/${fieldId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete field');
            }

            // Refresh the list
            await fetchFields();
        } catch (err) {
            console.error('Failed to delete field:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete field');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 className="text-lg font-medium">Manage Fields</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-700">
                    <input
                        type="text"
                        placeholder="Search fields..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-sky-500"
                        autoFocus
                    />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading && (
                        <div className="text-center text-slate-400 py-8">Loading...</div>
                    )}

                    {error && (
                        <div className="text-center text-red-400 py-8">{error}</div>
                    )}

                    {!isLoading && !error && fields.length === 0 && (
                        <div className="text-center text-slate-400 py-8">
                            {searchQuery ? 'No fields found' : 'No fields created yet'}
                        </div>
                    )}

                    {!isLoading && !error && fields.length > 0 && (
                        <div className="space-y-2">
                            {fields.map((field) => (
                                <div
                                    key={field.field_id}
                                    className="flex items-center justify-between p-3 bg-slate-800 border border-slate-700 rounded-md"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{field.field_name}</span>
                                            <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-700 rounded">
                                                {field.field_type}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            Used in {field.usage_count} date{field.usage_count !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteClick(field.field_id, field.field_name, field.usage_count);
                                        }}
                                        className="text-xs px-3 py-1 rounded text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                        title="Remove from autocomplete (preserves existing data)"
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-md bg-slate-800 border border-slate-700 px-4 py-2 text-sm hover:bg-slate-700"
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <ConfirmationModal
                    title="Delete Field"
                    message={
                        deleteConfirm.usageCount > 0
                            ? `Delete field "${deleteConfirm.fieldName}"?\n\nThis will remove it from autocomplete, but existing data in ${deleteConfirm.usageCount} date${deleteConfirm.usageCount !== 1 ? 's' : ''} will be preserved.`
                            : `Delete field "${deleteConfirm.fieldName}"?\n\nThis will remove it from autocomplete suggestions.`
                    }
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setDeleteConfirm(null)}
                    isDestructive
                />
            )}
        </div>
    );
}
