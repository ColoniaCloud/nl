'use client';

import { useEffect, useRef } from 'react';
import createGlobe from 'cobe';

const BUENOS_AIRES = { lat: -34.6, lng: -58.4 };

const capitals = [
  { name: 'Ottawa',           lat: 45.42,  lng: -75.70 },
  { name: 'Washington DC',    lat: 38.90,  lng: -77.04 },
  { name: 'Ciudad de México', lat: 19.43,  lng: -99.13 },
  { name: 'Guatemala City',   lat: 14.64,  lng: -90.51 },
  { name: 'San José CR',      lat:  9.93,  lng: -84.08 },
  { name: 'Bogotá',           lat:  4.71,  lng: -74.07 },
  { name: 'Quito',            lat: -0.23,  lng: -78.52 },
  { name: 'Lima',             lat: -12.04, lng: -77.03 },
  { name: 'La Paz',           lat: -16.50, lng: -68.15 },
  { name: 'Brasilia',         lat: -15.78, lng: -47.93 },
  { name: 'Santiago',         lat: -33.46, lng: -70.65 },
  { name: 'Montevideo',       lat: -34.90, lng: -56.19 },
];

export function AmericasGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let phi = 2.95; // centered on Buenos Aires approx
    let width = 0;

    const onResize = () => {
      if (canvasRef.current) {
        width = canvasRef.current.offsetWidth;
      }
    };
    window.addEventListener('resize', onResize);
    onResize();

    const arcs = capitals.map((cap) => ({
      startLat: BUENOS_AIRES.lat,
      startLng: BUENOS_AIRES.lng,
      endLat: cap.lat,
      endLng: cap.lng,
      arcAlt: 0.35,
      color: [0.05, 0.9, 0.5, 0.7] as [number, number, number, number],
    }));

    const markers = [
      { location: [BUENOS_AIRES.lat, BUENOS_AIRES.lng] as [number, number], size: 0.08 },
      ...capitals.map((c) => ({
        location: [c.lat, c.lng] as [number, number],
        size: 0.04,
      })),
    ];

    const options = {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi,
      theta: -0.3,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 4,
      baseColor: [0.05, 0.05, 0.05] as [number, number, number],
      markerColor: [0.1, 1, 0.5] as [number, number, number],
      glowColor: [0.1, 0.9, 0.5] as [number, number, number],
      markers,
      arcs,
      onRender(state: Record<string, number>) {
        state.phi = phi;
        phi += 0.003;
        state.width = width * 2;
        state.height = width * 2;
      },
    };

    const globe = createGlobe(
      canvasRef.current!,
      options as Parameters<typeof createGlobe>[1]
    );

    return () => {
      globe.destroy();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div style={{ width: 'clamp(300px, 40vw, 500px)', maxWidth: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', aspectRatio: '1 / 1' }}
      />
    </div>
  );
}

export default AmericasGlobe;
