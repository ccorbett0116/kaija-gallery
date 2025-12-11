// src/app/dates/new/ui/ConfirmationModal.tsx
'use client';

type Props = {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDestructive?: boolean;
};

export default function ConfirmationModal({
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    isDestructive = false,
}: Props) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={(e) => {
            e.stopPropagation();
            onCancel();
        }}>
            <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-slate-700">
                    <h3 className="text-lg font-medium">{title}</h3>
                </div>

                {/* Content */}
                <div className="p-4">
                    <p className="text-sm text-slate-300 whitespace-pre-line">{message}</p>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-slate-700 flex gap-2 justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-sm rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm rounded-md font-medium ${
                            isDestructive
                                ? 'bg-red-600 hover:bg-red-500 text-white'
                                : 'bg-sky-600 hover:bg-sky-500 text-white'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
