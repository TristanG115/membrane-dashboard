// Bundled list of places for search and the Public-view territory lookup (no geocoding API).
// Coordinates are approximate town centres.
export const PLACES: { name: string; state: 'IN' | 'OH'; lngLat: [number, number] }[] = [
  { name: 'Indianapolis', state: 'IN', lngLat: [-86.158, 39.768] }, { name: 'Martinsville', state: 'IN', lngLat: [-86.428, 39.428] },
  { name: 'Petersburg', state: 'IN', lngLat: [-87.279, 38.492] }, { name: 'Plainfield', state: 'IN', lngLat: [-86.399, 39.704] },
  { name: 'Greenwood', state: 'IN', lngLat: [-86.107, 39.613] }, { name: 'Carmel', state: 'IN', lngLat: [-86.118, 39.978] },
  { name: 'Fishers', state: 'IN', lngLat: [-86.014, 39.956] }, { name: 'Noblesville', state: 'IN', lngLat: [-86.008, 40.046] },
  { name: 'Zionsville', state: 'IN', lngLat: [-86.262, 39.951] }, { name: 'Lebanon', state: 'IN', lngLat: [-86.469, 40.048] },
  { name: 'Avon', state: 'IN', lngLat: [-86.397, 39.763] }, { name: 'Brownsburg', state: 'IN', lngLat: [-86.397, 39.843] },
  { name: 'Danville', state: 'IN', lngLat: [-86.526, 39.76] }, { name: 'Franklin', state: 'IN', lngLat: [-86.055, 39.481] },
  { name: 'Greenfield', state: 'IN', lngLat: [-85.769, 39.785] }, { name: 'Shelbyville', state: 'IN', lngLat: [-85.777, 39.521] },
  { name: 'Mooresville', state: 'IN', lngLat: [-86.374, 39.613] }, { name: 'Speedway', state: 'IN', lngLat: [-86.267, 39.795] },
  { name: 'Beech Grove', state: 'IN', lngLat: [-86.09, 39.722] }, { name: 'Bloomington', state: 'IN', lngLat: [-86.526, 39.165] },
  { name: 'Columbus', state: 'IN', lngLat: [-85.921, 39.201] }, { name: 'Muncie', state: 'IN', lngLat: [-85.386, 40.193] },
  { name: 'Lafayette', state: 'IN', lngLat: [-86.875, 40.417] }, { name: 'Terre Haute', state: 'IN', lngLat: [-87.414, 39.467] },
  { name: 'Fort Wayne', state: 'IN', lngLat: [-85.139, 41.079] }, { name: 'Evansville', state: 'IN', lngLat: [-87.571, 37.975] },
  { name: 'Dayton', state: 'OH', lngLat: [-84.192, 39.759] }, { name: 'Kettering', state: 'OH', lngLat: [-84.169, 39.689] },
  { name: 'Springfield', state: 'OH', lngLat: [-83.808, 39.924] }, { name: 'Xenia', state: 'OH', lngLat: [-83.929, 39.685] },
  { name: 'Troy', state: 'OH', lngLat: [-84.203, 40.04] }, { name: 'Cincinnati', state: 'OH', lngLat: [-84.512, 39.103] },
  { name: 'Columbus', state: 'OH', lngLat: [-82.999, 39.961] },
]
