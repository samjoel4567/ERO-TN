// PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
// Road-Routing Service using OpenStreetMap OSRM API with graceful fallback

import { calculateHaversineKm, generateCurvedFallbackRoute } from '../data/scenarioData.js';

/**
 * Fetch a genuine road route between two geographic coordinates using OpenStreetMap OSRM.
 * If OSRM is unreachable or times out, safely falls back with an explicit transparency label.
 *
 * @param {{ lat: number, lng: number }} startCoords
 * @param {{ lat: number, lng: number }} endCoords
 * @returns {Promise<{
 *   coordinates: [number, number][],
 *   distanceKm: number,
 *   durationMins: number,
 *   isRealRoadRoute: boolean,
 *   isFallback: boolean,
 *   source: string,
 *   routingMessage: string
 * }>}
 */
export async function fetchRoadRoute(startCoords, endCoords) {
  if (
    !startCoords ||
    typeof startCoords.lat !== 'number' ||
    isNaN(startCoords.lat) ||
    typeof startCoords.lng !== 'number' ||
    isNaN(startCoords.lng) ||
    !endCoords ||
    typeof endCoords.lat !== 'number' ||
    isNaN(endCoords.lat) ||
    typeof endCoords.lng !== 'number' ||
    isNaN(endCoords.lng)
  ) {
    console.warn('Invalid coordinates provided to fetchRoadRoute:', { startCoords, endCoords });
    return {
      coordinates: [],
      distanceKm: 0,
      durationMins: 0,
      isRealRoadRoute: false,
      isFallback: true,
      source: 'Invalid Coordinates Guard',
      routingMessage: 'Invalid coordinates provided'
    };
  }

  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startCoords.lng},${startCoords.lat};${endCoords.lng},${endCoords.lat}?overview=full&geometries=geojson`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5s network timeout

  try {
    const response = await fetch(osrmUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // OSRM coordinates are in [longitude, latitude] -> convert to Leaflet [latitude, longitude]
        const leafCoords = route.geometry.coordinates.map((coord) => [coord[1], coord[0]]);

        const distanceKm = Number((route.distance / 1000).toFixed(2));
        const durationMins = Number((route.duration / 60).toFixed(1));

        return {
          coordinates: leafCoords,
          distanceKm,
          durationMins,
          isRealRoadRoute: true,
          isFallback: false,
          source: 'OpenStreetMap OSRM Driving Router',
          routingMessage: 'Verified road network route geometry from OpenStreetMap OSRM'
        };
      }
    }
    throw new Error('OSRM routing response was not OK or route not found');
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn('OSRM routing request failed or timed out. Engaging fallback:', error.message);

    // Fallback calculation: Haversine with 1.35x road circuity factor
    const directKm = calculateHaversineKm(startCoords.lat, startCoords.lng, endCoords.lat, endCoords.lng);
    const estimatedRoadKm = Number((directKm * 1.35).toFixed(2));
    // Average emergency vehicle speed in Tamil Nadu: ~50 km/h
    const estimatedDurationMins = Number(((estimatedRoadKm / 50) * 60).toFixed(1));
    const fallbackWaypoints = generateCurvedFallbackRoute(startCoords, endCoords, 16);

    return {
      coordinates: fallbackWaypoints,
      distanceKm: estimatedRoadKm,
      durationMins: Math.max(estimatedDurationMins, 1.5),
      isRealRoadRoute: false,
      isFallback: true,
      source: 'Fallback Geometric Model',
      routingMessage: 'Fallback straight-line estimate used due to routing service timeout'
    };
  }
}

/**
 * Calculates a complete two-leg emergency mission:
 * Leg 1: Ambulance Origin Base -> Incident Location
 * Leg 2: Incident Location -> Selected Mapped Hospital
 *
 * @param {{ lat: number, lng: number }} ambulanceCoords
 * @param {{ lat: number, lng: number }} incidentCoords
 * @param {{ lat: number, lng: number }} hospitalCoords
 */
export async function calculateTwoLegMission(ambulanceCoords, incidentCoords, hospitalCoords) {
  const [leg1, leg2] = await Promise.all([
    fetchRoadRoute(ambulanceCoords, incidentCoords),
    fetchRoadRoute(incidentCoords, hospitalCoords)
  ]);

  const totalDistanceKm = Number((leg1.distanceKm + leg2.distanceKm).toFixed(2));
  const totalDurationMins = Number((leg1.durationMins + leg2.durationMins).toFixed(1));

  return {
    leg1,
    leg2,
    totalDistanceKm,
    totalDurationMins,
    isRealRoadRoute: leg1.isRealRoadRoute && leg2.isRealRoadRoute,
    hasFallback: leg1.isFallback || leg2.isFallback
  };
}
