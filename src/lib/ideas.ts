// src/lib/ideas.ts
import db from './db';

export type Idea = {
    idea_id: number;
    title: string;
    content: string | null;
    created_at: string;
    updated_at: string;
};

// Create a new idea
export function createIdea(title: string, content: string | null) {
    const now = new Date().toISOString();

    const stmt = db.prepare(`
        INSERT INTO ideas (title, content, created_at, updated_at)
        VALUES (?, ?, ?, ?)
    `);

    stmt.run(title, content, now, now);
}

// Fetch all ideas
export function listIdeas(): Idea[] {
    const stmt = db.prepare(`
        SELECT idea_id, title, content, created_at, updated_at
        FROM ideas
        ORDER BY created_at DESC
    `);
    return stmt.all() as Idea[];
}

// Get the total count of ideas
export function getIdeasCount(): number {
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM ideas`);
    const result = stmt.get() as { count: number };
    return result.count;
}

// Update an idea
export function updateIdea(idea_id: number, title: string, content: string | null) {
    const now = new Date().toISOString();
    db.prepare(`
        UPDATE ideas
        SET title = ?, content = ?, updated_at = ?
        WHERE idea_id = ?
    `).run(title, content, now, idea_id);
}

// Delete an idea
export function deleteIdea(idea_id: number) {
    db.prepare(`
        DELETE FROM ideas
        WHERE idea_id = ?
    `).run(idea_id);
}
