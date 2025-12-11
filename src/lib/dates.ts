// src/lib/dates.ts
import db from './db';

export type DateEntry = {
    title: string;
    date: string; // ISO
    created_at: string;
    updated_at: string;
};

export type FieldType = 'text' | 'time' | 'date' | 'datetime-local' | 'number' | 'address';

export type FieldDefinition = {
    field_id: number;
    field_name: string;
    field_type: FieldType;
};

export type DateFieldValue = {
    field_id: number;
    field_name: string;
    field_type: FieldType;
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

// Fetch a single date entry with all its custom fields
export type DateEntryWithFields = DateEntry & {
    fields: DateFieldValue[];
};

export function getDateEntry(title: string, date: string): DateEntryWithFields | null {
    const dateStmt = db.prepare(`
    SELECT title, date, created_at, updated_at
    FROM date_entries
    WHERE title = ? AND date = ?
  `);

    const dateEntry = dateStmt.get(title, date) as DateEntry | undefined;

    if (!dateEntry) return null;

    const fieldsStmt = db.prepare(`
    SELECT
      dfv.field_id,
      f.field_name,
      f.field_type,
      dfv.value
    FROM date_field_values dfv
    JOIN fields f ON f.field_id = dfv.field_id
    WHERE dfv.title = ? AND dfv.date = ?
    ORDER BY f.field_name ASC
  `);

    const fields = fieldsStmt.all(title, date) as DateFieldValue[];

    return {
        ...dateEntry,
        fields
    };
}

// Search field names for the "Add Field" UI (simple LIKE for now)
export function searchFields(query: string): FieldDefinition[] {
    const stmt = db.prepare(`
    SELECT field_id, field_name, field_type
    FROM fields
    WHERE field_name LIKE ?
    ORDER BY field_name ASC
    LIMIT 20
  `);
    return stmt.all(`%${query}%`) as FieldDefinition[];
}

// Insert a date + custom fields, creating missing field names in registry
export type NewFieldInput = { name: string; value: string; type: FieldType };

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
    SELECT field_id, field_type FROM fields WHERE field_name = ?
  `);

    const insertField = db.prepare(`
    INSERT INTO fields (field_name, field_type) VALUES (?, ?)
  `);

    const updateFieldType = db.prepare(`
    UPDATE fields SET field_type = ? WHERE field_id = ?
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
            const type = f.type || 'text';
            if (!name || !value) continue;

            let row = selectField.get(name) as { field_id: number; field_type: string } | undefined;
            let fieldId: number;

            if (!row) {
                // Create new field with type
                const info = insertField.run(name, type);
                fieldId = Number(info.lastInsertRowid);
            } else {
                fieldId = row.field_id;
                // Update field type if it changed (user may have changed the type)
                if (row.field_type !== type) {
                    updateFieldType.run(type, fieldId);
                }
            }

            insertValue.run(title, date, fieldId, value);
        }
    });

    tx();
}
