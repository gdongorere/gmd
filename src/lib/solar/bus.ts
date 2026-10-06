// src/lib/solar/bus.ts
// Lets the page-level toolbar (which lives outside the 3D view) save whatever the Solar System scene is showing.

export const solarBus: { capture: (() => Promise<Blob | null>) | null } = { capture: null };
