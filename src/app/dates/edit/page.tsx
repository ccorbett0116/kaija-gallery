// src/app/dates/edit/page.tsx
import { redirect } from 'next/navigation';
import { getDateEntry } from '@/lib/dates';
import { updateDateAction } from './actions';
import NewDateForm from '../new/ui/NewDateForm';

type PageProps = {
    searchParams: Promise<{ title?: string; date?: string }>;
};

export default async function EditDatePage({ searchParams }: PageProps) {
    const params = await searchParams;
    const { title, date } = params;

    if (!title || !date) {
        redirect('/');
    }

    const dateEntry = getDateEntry(decodeURIComponent(title), decodeURIComponent(date));

    if (!dateEntry) {
        redirect('/');
    }

    // Create an update action that includes the original title and date
    const updateActionWithOriginal = async (formData: FormData) => {
        'use server';
        formData.append('originalTitle', dateEntry.title);
        formData.append('originalDate', dateEntry.date);
        await updateDateAction(formData);
    };

    return (
        <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <div className="max-w-2xl mx-auto py-8 px-4">
                <h1 className="text-2xl font-semibold mb-4">Edit Date</h1>
                <NewDateForm
                    action={updateActionWithOriginal}
                    initialTitle={dateEntry.title}
                    initialDate={dateEntry.date}
                    initialFields={dateEntry.fields.map(f => ({
                        name: f.field_name,
                        value: f.value,
                        type: f.field_type,
                    }))}
                    initialMediaIds={dateEntry.media.map(m => m.media_id)}
                    submitLabel="Update Date"
                />
            </div>
        </main>
    );
}
