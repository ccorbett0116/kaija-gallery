// src/lib/dates.ts
import db from './db';

export type DateEntry = {
    title: string;
    date: string; // ISO
    created_at: string;
    updated_at: string;
};

export type FieldDefinition = {
    field_id: number;
    field_name: string;
};

export type DateFieldValue = {
    field_id: number;
    field_name: string;
    value: string;
};

// Fetch recent dates for index page
export function listDates(limit = 50): DateEntry[] {
    const stmt = db.prepare(`
    SELECT title, date, created_at, updated_at
    FROM date_entries
    ORDER BY date DESC, title ASC
    LIMIT ?
  `);
    return stmt.all(limit) as DateEntry[];
}

// Search field names for the "Add Field" UI (simple LIKE for now)
export function searchFields(query: string): FieldDefinition[] {
    const stmt = db.prepare(`
    SELECT field_id, field_name
    FROM fields
    WHERE field_name LIKE ?
    ORDER BY field_name ASC
    LIMIT 20
  `);
    return stmt.all(`%${query}%`) as FieldDefinition[];
}

// Insert a date + custom fields, creating missing field names in registry
export type NewFieldInput = { name: string; value: string };

export function createDateEntry(
    title: string,
    date: string,
    fields: NewFieldInput[]
) {
    const now = new Date().toISOString();

    const insertDate = db.prepare(`
    INSERT INTO date_entries (title, date, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);

    const selectField = db.prepare(`
    SELECT field_id FROM fields WHERE field_name = ?
  `);

    const insertField = db.prepare(`
    INSERT INTO fields (field_name) VALUES (?)
  `);

    const insertValue = db.prepare(`
    INSERT INTO date_field_values (title, date, field_id, value)
    VALUES (?, ?, ?, ?)
  `);

    const tx = db.transaction(() => {
        insertDate.run(title, date, now, now);

        for (const f of fields) {
            const name = f.name.trim();
            const value = f.value.trim();
            if (!name || !value) continue;

            let row = selectField.get(name) as { field_id: number } | undefined;
            let fieldId: number;

            if (!row) {
                const info = insertField.run(name);
                fieldId = Number(info.lastInsertRowid);
            } else {
                fieldId = row.field_id;
            }

            insertValue.run(title, date, fieldId, value);
        }
    });

    tx();
}
