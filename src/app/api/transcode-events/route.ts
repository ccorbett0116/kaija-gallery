// src/app/api/transcode-events/route.ts
import { NextRequest } from 'next/server';
import { transcodeEvents } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection message
            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
            );

            // Listen for transcoding status changes
            const statusListener = (data: { mediaId: number; status: string }) => {
                controller.enqueue(
                    encoder.encode(
                        `data: ${JSON.stringify({ type: 'status-change', ...data })}\n\n`
                    )
                );
            };

            transcodeEvents.on('status-change', statusListener);

            // Cleanup on connection close
            request.signal.addEventListener('abort', () => {
                transcodeEvents.off('status-change', statusListener);
                controller.close();
            });

            // Keep connection alive with heartbeat every 30 seconds
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': heartbeat\n\n'));
                } catch {
                    clearInterval(heartbeat);
                }
            }, 30000);

            request.signal.addEventListener('abort', () => {
                clearInterval(heartbeat);
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
