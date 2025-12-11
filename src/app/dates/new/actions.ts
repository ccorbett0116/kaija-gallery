// src/app/dates/new/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { createDateEntry, type NewFieldInput, type FieldType } from '@/lib/dates';

export async function createDateAction(formData: FormData) {
    const title = formData.get('title') as string;
    const date = formData.get('date') as string;

    if (!title?.trim() || !date?.trim()) {
        throw new Error('Title and date are required');
    }

    // Collect custom fields from the form
    const fieldNames = formData.getAll('fieldName') as string[];
    const fieldTypes = formData.getAll('fieldType') as string[];
    const fieldValues = formData.getAll('fieldValue') as string[];

    const fields: NewFieldInput[] = [];
    for (let i = 0; i < fieldNames.length; i++) {
        const name = fieldNames[i]?.trim();
        const value = fieldValues[i]?.trim();
        const type = (fieldTypes[i] as FieldType) || 'text';
        if (name && value) {
            fields.push({ name, value, type });
        }
    }

    // Create the date entry in the database
    createDateEntry(title.trim(), date, fields);

    // Redirect to the home page after successful creation
    redirect('/');
}
