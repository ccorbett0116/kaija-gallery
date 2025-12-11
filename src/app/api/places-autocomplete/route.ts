// src/app/api/places-autocomplete/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { input, locationBias } = body;

        console.log('[API] /api/places-autocomplete - input:', input);
        if (locationBias) {
            console.log('[API] /api/places-autocomplete - location bias:', locationBias);
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            console.error('[API] /api/places-autocomplete - ERROR: API key not configured');
            return NextResponse.json(
                { error: 'Google Maps API key not configured' },
                { status: 500 }
            );
        }

        const requestBody: {
            input: string;
            sessionToken: string;
            includeQueryPredictions?: boolean;
            locationBias?: {
                circle: {
                    center: { latitude: number; longitude: number };
                    radius: number;
                };
            };
        } = {
            input,
            sessionToken: body.sessionToken,
            includeQueryPredictions: true,
        };

        if (locationBias) {
            requestBody.locationBias = locationBias;
        }

        const response = await fetch(
            'https://places.googleapis.com/v1/places:autocomplete',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok) {
            console.error('[API] /api/places-autocomplete - ERROR:', response.status, response.statusText);
            throw new Error(`Google Places API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('[API] /api/places-autocomplete - found', data.suggestions?.length || 0, 'suggestions');

        return NextResponse.json(data);
    } catch (error) {
        console.error('[API] /api/places-autocomplete - ERROR:', error);
        return NextResponse.json(
            { error: 'Failed to fetch autocomplete suggestions' },
            { status: 500 }
        );
    }
}
