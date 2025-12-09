// src/app/page.tsx
import Link from 'next/link';
import { listDates } from '@/lib/dates';

export default function HomePage() {
  const dates = listDates(100);

  return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Our Dates</h1>
            <div className="flex gap-2">
              <Link
                  href="/media"
                  className="text-sm text-slate-400 hover:text-sky-400 px-3 py-2"
              >
                Media Gallery
              </Link>
              <Link
                  href="/dates/new"
                  className="inline-flex items-center rounded-md bg-sky-600 px-3 py-2 text-sm font-medium hover:bg-sky-500"
              >
                + Add Date
              </Link>
            </div>
          </header>

          {dates.length === 0 ? (
              <p className="text-slate-400 text-sm">
                No dates yet. Click “Add Date” to create the first one.
              </p>
          ) : (
              <ul className="space-y-2">
                {dates.map((d) => (
                    <li key={`${d.title}-${d.date}`}>
                      <Link
                          href={`/dates/${encodeURIComponent(d.date)}/${encodeURIComponent(
                              d.title
                          )}`}
                          className="block rounded-md border border-slate-800 bg-slate-900 px-4 py-3 hover:border-sky-500"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{d.title}</span>
                          <span className="text-xs text-slate-400">
                      {new Date(d.date).toLocaleDateString()}
                    </span>
                        </div>
                      </Link>
                    </li>
                ))}
              </ul>
          )}
        </div>
      </main>
  );
}
