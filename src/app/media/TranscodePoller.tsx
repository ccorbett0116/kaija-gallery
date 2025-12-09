// src/app/media/TranscodePoller.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { revalidateMediaPage } from './actions';

export default function TranscodeListener() {
    const router = useRouter();

    useEffect(() => {
        // Connect to Server-Sent Events stream
        const eventSource = new EventSource('/api/transcode-events');

        eventSource.onmessage = async (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'status-change') {
                // Transcoding status changed, refresh the gallery
                await revalidateMediaPage();
                router.refresh();
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            // Reconnect automatically happens by default
        };

        // Cleanup on unmount
        return () => {
            eventSource.close();
        };
    }, [router]);

    return null; // This component doesn't render anything
}
