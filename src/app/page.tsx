// src/app/page.tsx
import { Suspense } from 'react';
import Link from 'next/link';
import { listDates } from '@/lib/dates';
import TimelineView from './TimelineView';

export default function HomePage() {
  const dates = listDates(100);

  return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
          {/* Fixed Header */}
          <header
              className="fixed top-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
              <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                  <h1 className="text-2xl font-semibold">Dates</h1>

                  {/* Right side: Ideas, Gallery, Add Date */}
                  <nav className="flex items-center gap-2">
                      <Link
                          href="/ideas"
                          className="text-sm text-slate-400 hover:text-sky-400 px-3 py-2 leading-none"
                      >
                          Ideas
                      </Link>

                      <Link
                          href="/media"
                          className="text-sm text-slate-400 hover:text-sky-400 px-3 py-2 leading-none"
                      >
                          Gallery
                      </Link>

                      <Link
                          href="/dates/new"
                          className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 min-w-[110px] text-sm font-medium hover:bg-sky-500"
                      >
                          Add Date
                      </Link>
                  </nav>
              </div>
          </header>


          {/* Timeline (starts below fixed header) */}
          <div className="pt-16">
              {dates.length === 0 ? (
                  <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                      <p className="text-slate-400 text-sm">
                          No dates yet. Click &quot;Add Date&quot; to create the first one.
                      </p>
                  </div>
              ) : (
                  <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-64px)]"><p
                      className="text-slate-400">Loading...</p></div>}>
                      <TimelineView dates={dates}/>
                  </Suspense>
              )}
          </div>
      </main>
  );
}
