export interface ReferenceCity {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

/**
 * Coastal reference points for describing a storm's position.
 *
 * Names are in English to match NHC/NOAA phrasing. Coverage: North
 * Atlantic + Caribbean + Gulf of Mexico, Eastern Pacific, Central
 * Pacific, Western Pacific.
 */
export const REFERENCE_CITIES: ReferenceCity[] = [
  // --- North Atlantic ---
  { name: "Iqaluit", country: "Canada", lat: 63.7467, lon: -68.517 },
  { name: "Halifax", country: "Canada", lat: 44.6488, lon: -63.5752 },
  { name: "Boston", country: "United States", lat: 42.3601, lon: -71.0589 },
  { name: "New York", country: "United States", lat: 40.7128, lon: -74.006 },
  { name: "Norfolk", country: "United States", lat: 36.8508, lon: -76.2859 },
  { name: "Charleston", country: "United States", lat: 32.7765, lon: -79.9311 },
  { name: "Bermuda", country: "Bermuda", lat: 32.2949, lon: -64.7833 },
  { name: "Houston", country: "United States", lat: 29.7604, lon: -95.3698 },
  {
    name: "New Orleans",
    country: "United States",
    lat: 29.9511,
    lon: -90.0715,
  },
  { name: "Tampa", country: "United States", lat: 27.9506, lon: -82.4572 },
  { name: "Miami", country: "United States", lat: 25.7617, lon: -80.1918 },
  { name: "Nassau", country: "Bahamas", lat: 25.0443, lon: -77.3504 },
  { name: "Havana", country: "Cuba", lat: 23.1136, lon: -82.3666 },
  { name: "Cancun", country: "Mexico", lat: 21.1619, lon: -86.8515 },
  {
    name: "Santo Domingo",
    country: "Dominican Republic",
    lat: 18.4861,
    lon: -69.9312,
  },
  { name: "San Juan", country: "Puerto Rico", lat: 18.4655, lon: -66.1057 },
  { name: "Kingston", country: "Jamaica", lat: 17.9714, lon: -76.7924 },
  { name: "San Andres", country: "Colombia", lat: 12.5795, lon: -81.7004 },
  { name: "Cartagena", country: "Colombia", lat: 10.391, lon: -75.4794 },
  { name: "Georgetown", country: "Guyana", lat: 6.8013, lon: -58.1551 },
  { name: "Paramaribo", country: "Suriname", lat: 5.852, lon: -55.2038 },
  { name: "Belem", country: "Brazil", lat: -1.4558, lon: -48.4902 },
  { name: "Recife", country: "Brazil", lat: -8.0476, lon: -34.877 },
  { name: "Salvador", country: "Brazil", lat: -12.9777, lon: -38.5016 },
  { name: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lon: -43.1729 },
  { name: "Porto Alegre", country: "Brazil", lat: -30.0346, lon: -51.2177 },
  { name: "Montevideo", country: "Uruguay", lat: -34.9011, lon: -56.1645 },
  { name: "Buenos Aires", country: "Argentina", lat: -34.6037, lon: -58.3816 },
  { name: "Mar del Plata", country: "Argentina", lat: -38.0055, lon: -57.5426 },
  { name: "Ushuaia", country: "Argentina", lat: -54.8019, lon: -68.303 },

  // --- North Pacific (Americas) ---
  { name: "Anchorage", country: "United States", lat: 61.2181, lon: -149.9003 },
  { name: "Vancouver", country: "Canada", lat: 49.2827, lon: -123.1207 },
  { name: "Seattle", country: "United States", lat: 47.6062, lon: -122.3321 },
  {
    name: "San Francisco",
    country: "United States",
    lat: 37.7749,
    lon: -122.4194,
  },
  {
    name: "Los Angeles",
    country: "United States",
    lat: 34.0522,
    lon: -118.2437,
  },
  { name: "San Diego", country: "United States", lat: 32.7157, lon: -117.1611 },
  { name: "Tijuana", country: "Mexico", lat: 32.5149, lon: -117.0382 },
  { name: "Cabo San Lucas", country: "Mexico", lat: 22.8905, lon: -109.9167 },
  { name: "Mazatlan", country: "Mexico", lat: 23.2494, lon: -106.4111 },
  { name: "Puerto Vallarta", country: "Mexico", lat: 20.6534, lon: -105.2253 },
  { name: "Manzanillo", country: "Mexico", lat: 19.0522, lon: -104.3159 },
  { name: "Acapulco", country: "Mexico", lat: 16.8531, lon: -99.8237 },
  { name: "Panama City", country: "Panama", lat: 8.9824, lon: -79.5199 },
  { name: "Guayaquil", country: "Ecuador", lat: -2.1894, lon: -79.8891 },
  { name: "Lima", country: "Peru", lat: -12.0464, lon: -77.0428 },
  { name: "Antofagasta", country: "Chile", lat: -23.6509, lon: -70.3975 },
  { name: "Valparaiso", country: "Chile", lat: -33.0472, lon: -71.6127 },
  { name: "Concepcion", country: "Chile", lat: -36.8201, lon: -73.0444 },
  { name: "Puerto Montt", country: "Chile", lat: -41.4689, lon: -72.9411 },
  { name: "Punta Arenas", country: "Chile", lat: -53.1638, lon: -70.9171 },

  // --- Central Pacific / Oceania ---
  { name: "Honolulu", country: "United States", lat: 21.3099, lon: -157.8581 },
  { name: "Hilo", country: "United States", lat: 19.7074, lon: -155.0885 },
  { name: "Darwin", country: "Australia", lat: -12.4381, lon: 130.8411 },
  { name: "Cairns", country: "Australia", lat: -16.92, lon: 145.78 },
  { name: "Townsville", country: "Australia", lat: -19.25, lon: 146.8167 },
  { name: "Nadi", country: "Fiji", lat: -17.8, lon: 177.4167 },
  { name: "Suva", country: "Fiji", lat: -18.1333, lon: 178.4333 },
  { name: "Noumea", country: "New Caledonia", lat: -22.2625, lon: 166.4443 },
  { name: "Brisbane", country: "Australia", lat: -27.4679, lon: 153.0281 },
  { name: "Sydney", country: "Australia", lat: -33.8678, lon: 151.2073 },
  { name: "Auckland", country: "New Zealand", lat: -36.8485, lon: 174.7635 },
  { name: "Wellington", country: "New Zealand", lat: -41.2866, lon: 174.7756 },

  // --- West Pacific ---
  { name: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503 },
  { name: "Shanghai", country: "China", lat: 31.2304, lon: 121.4737 },
  { name: "Taipei", country: "Taiwan", lat: 25.033, lon: 121.5654 },
  { name: "Hong Kong", country: "China", lat: 22.3193, lon: 114.1694 },
  { name: "Manila", country: "Philippines", lat: 14.5995, lon: 120.9842 },
  { name: "Davao", country: "Philippines", lat: 7.1907, lon: 125.4553 },
  {
    name: "Port Moresby",
    country: "Papua New Guinea",
    lat: -9.4789,
    lon: 147.1494,
  },
];
