import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Camera as MapCamera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { LocateFixed, MapPin, MapPinned, Navigation } from 'lucide-react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { fetchDrivingRoute, type RouteInfo } from '@/lib/pickup/routing';

const MAP_STYLE = process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim() || 'https://tiles.openfreemap.org/styles/liberty';

export interface RoutePreviewMapProps {
  destination: {
    latitude: number;
    longitude: number;
    street?: string;
  };
  onNavigateNative: () => void;
}

export function RoutePreviewMap({ destination, onNavigateNative }: RoutePreviewMapProps) {
  const camera = useRef<React.ElementRef<typeof MapCamera>>(null);
  const [collectorPos, setCollectorPos] = useState<[number, number] | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const destPoint: [number, number] = useMemo(
    () => [destination.longitude, destination.latitude],
    [destination.longitude, destination.latitude]
  );

  useEffect(() => {
    let cancelled = false;

    async function initRoute() {
      let startCoords: [number, number] | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (!cancelled) {
            startCoords = [pos.coords.longitude, pos.coords.latitude];
            setCollectorPos(startCoords);
          }
        }
      } catch {
        // Location permission denied or sensor unavailable
      }

      if (startCoords && !cancelled) {
        const [startLng, startLat] = startCoords;
        const route = await fetchDrivingRoute(startLat, startLng, destination.latitude, destination.longitude);
        if (!cancelled) {
          setRouteInfo(route);
        }
      }
      if (!cancelled) {
        setLoading(false);
      }
    }

    void initRoute();
    return () => {
      cancelled = true;
    };
  }, [destination.latitude, destination.longitude]);

  const fitRouteBounds = useCallback(() => {
    if (!collectorPos) {
      camera.current?.easeTo({ center: destPoint, zoom: 14.5, duration: 500 });
      return;
    }
    const [cLng, cLat] = collectorPos;
    const [dLng, dLat] = destPoint;
    const minLng = Math.min(cLng, dLng);
    const maxLng = Math.max(cLng, dLng);
    const minLat = Math.min(cLat, dLat);
    const maxLat = Math.max(cLat, dLat);

    camera.current?.fitBounds([minLng, minLat, maxLng, maxLat], {
      padding: { top: 40, bottom: 40, left: 40, right: 40 },
      duration: 600,
    });
  }, [collectorPos, destPoint]);

  useEffect(() => {
    if (mapReady) {
      fitRouteBounds();
    }
  }, [mapReady, fitRouteBounds]);

  const routeGeoJson = useMemo(() => {
    if (!routeInfo || routeInfo.coordinates.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: routeInfo.coordinates,
      },
    };
  }, [routeInfo]);

  return (
    <View className="rounded-2xl border border-border bg-card overflow-hidden mt-3 shadow-sm">
      {/* Route Info Header */}
      <View className="p-3.5 bg-secondary/30 border-b border-border flex-row items-center justify-between">
        <View className="flex-1">
          {loading ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#19806d" />
              <Text className="text-xs font-medium text-muted-foreground">Calculating route...</Text>
            </View>
          ) : routeInfo ? (
            <View>
              <Text className="text-sm font-bold text-foreground">
                {routeInfo.distanceFormatted} · ~{routeInfo.durationFormatted}
              </Text>
              <Text className="text-[11px] text-muted-foreground">
                {routeInfo.isDrivingRoute ? 'Driving route' : 'Direct distance'}
              </Text>
            </View>
          ) : (
            <Text className="text-xs text-muted-foreground">Destination coordinates ready</Text>
          )}
        </View>
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel="Recenter route view"
          onPress={fitRouteBounds}
          className="h-8 w-8 rounded-full bg-card border border-border items-center justify-center shadow-sm"
        >
          <LocateFixed size={15} color="#19806d" />
        </AnimatedPressable>
      </View>

      {/* Embedded MapLibre Preview */}
      <View className="h-48 bg-muted relative">
        <Map
          mapStyle={MAP_STYLE}
          style={{ flex: 1 }}
          attribution={false}
          onDidFinishLoadingMap={() => setMapReady(true)}
        >
          <MapCamera
            ref={camera}
            initialViewState={{ center: destPoint, zoom: 14 }}
            minZoom={4}
            maxZoom={19}
          />

          {/* Route polyline */}
          {routeGeoJson && (
            <GeoJSONSource id="route-source" data={routeGeoJson}>
              <Layer
                id="route-line"
                type="line"
                paint={{
                  'line-color': '#19806d',
                  'line-width': 4.5,
                  'line-opacity': 0.85,
                }}
                layout={{
                  'line-cap': 'round',
                  'line-join': 'round',
                }}
              />
            </GeoJSONSource>
          )}

          {/* Collector marker */}
          {collectorPos && (
            <Marker id="collector-marker" lngLat={collectorPos}>
              <View className="h-6 w-6 rounded-full bg-blue-600 border-2 border-white shadow-md items-center justify-center">
                <Navigation size={12} color="#ffffff" fill="#ffffff" />
              </View>
            </Marker>
          )}

          {/* Destination marker */}
          <Marker id="destination-marker" lngLat={destPoint}>
            <View className="items-center justify-center">
              <MapPin size={28} color="#dc2626" fill="#ef4444" strokeWidth={2} />
            </View>
          </Marker>
        </Map>
      </View>

      {/* Action button to launch native navigation */}
      <View className="p-3 bg-card border-t border-border">
        <Button
          onPress={onNavigateNative}
          className="w-full h-12 rounded-2xl flex-row items-center justify-center gap-2 bg-primary"
        >
          <MapPinned size={18} color="#ffffff" />
          <Text className="text-sm font-bold text-white">Navigate with Google Maps</Text>
        </Button>
      </View>
    </View>
  );
}

