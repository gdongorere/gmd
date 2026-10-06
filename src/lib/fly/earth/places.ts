// src/lib/fly/earth/places.ts
// Starting points. Coordinates are public-domain geographic facts (to ~0.01°, i.e. about a kilometre); the real terrain supplies the height.
// Chosen to show different things: mountains, desert, ocean, cities, extremes, both hemispheres, near both poles.

export interface Place { id: string; name: string; lat: number; lon: number; heading: number; blurb: string }

export const PLACES: Place[] = [
	{ id: 'zurich', name: 'Zürich, Switzerland', lat: 47.3769, lon: 8.5417, heading: 180, blurb: 'A lake city below the Alps.' },
	{ id: 'matterhorn', name: 'Matterhorn, Switzerland/Italy', lat: 45.9763, lon: 7.6586, heading: 90, blurb: '4 478 m of pyramid; fly around it.' },
	{ id: 'everest', name: 'Mount Everest, Nepal/Tibet', lat: 27.9881, lon: 86.925, heading: 0, blurb: 'The highest ground on Earth, 8 849 m. Thin air.' },
	{ id: 'nyc', name: 'Manhattan, New York', lat: 40.758, lon: -73.9855, heading: 0, blurb: 'Dense towers on a narrow island.' },
	{ id: 'london', name: 'London, United Kingdom', lat: 51.5074, lon: -0.1278, heading: 90, blurb: 'The Thames and the city around it.' },
	{ id: 'tokyo', name: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503, heading: 270, blurb: 'Fuji on the horizon on a clear day.' },
	{ id: 'dubai', name: 'Dubai, UAE', lat: 25.1972, lon: 55.2744, heading: 0, blurb: 'The tallest tower (828 m) in a desert.' },
	{ id: 'sydney', name: 'Sydney, Australia', lat: -33.8568, lon: 151.2153, heading: 0, blurb: 'Harbour, bridge and opera house.' },
	{ id: 'rio', name: 'Rio de Janeiro, Brazil', lat: -22.9519, lon: -43.2105, heading: 90, blurb: 'Granite peaks rising out of the city.' },
	{ id: 'sf', name: 'San Francisco, USA', lat: 37.8199, lon: -122.4783, heading: 90, blurb: 'The Golden Gate and the bay.' },
	{ id: 'grandcanyon', name: 'Grand Canyon, USA', lat: 36.0544, lon: -112.1401, heading: 0, blurb: 'A 1.8 km deep gorge.' },
	{ id: 'deadsea', name: 'Dead Sea shore', lat: 31.5, lon: 35.45, heading: 0, blurb: 'The lowest land on Earth, about 430 m below sea level.' },
	{ id: 'kilimanjaro', name: 'Kilimanjaro, Tanzania', lat: -3.0674, lon: 37.3556, heading: 90, blurb: 'Africa’s highest, 5 895 m, on the equator.' },
	{ id: 'mcmurdo', name: 'McMurdo Sound, Antarctica', lat: -77.85, lon: 166.67, heading: 0, blurb: 'Ice at the bottom of the world.' },
	{ id: 'svalbard', name: 'Longyearbyen, Svalbard', lat: 78.2232, lon: 15.6267, heading: 90, blurb: 'Far north; the Sun can stay up or down for months.' },
	{ id: 'quito', name: 'Quito, Ecuador', lat: -0.1807, lon: -78.4678, heading: 90, blurb: 'A city at 2 850 m on the equator, among volcanoes.' },
	{ id: 'mauna-kea', name: 'Mauna Kea, Hawaii', lat: 19.8207, lon: -155.4681, heading: 0, blurb: 'Taller than Everest from its base on the sea floor.' },
	{ id: 'mid-pacific', name: 'Mid-Pacific, open ocean', lat: 0, lon: -160, heading: 90, blurb: 'Nothing for thousands of kilometres. Sea level is solid ground here.' },
];

export const placeById = (id: string) => PLACES.find((p) => p.id === id);
