import { useEffect } from "react";
import { useMap } from "react-leaflet";
import AutoGraticule from "leaflet-auto-graticule";

/**
 * React-Leaflet wrapper for the leaflet-auto-graticule plugin.
 * Adds a latitude/longitude grid that auto-adjusts to the map's zoom level.
 */
export function GraticuleLayer() {
  const map = useMap();

  useEffect(() => {
    // Instantiate the graticule with optional styling
    const graticule = new AutoGraticule({
      redraw: "moveend",
      minDistance: 100,
      // You can try adding style options here if supported by the plugin,
      // for example: style: { color: '#ccc', weight: 0.5 }
    });

    // Add it to the map
    graticule.addTo(map);

    // Cleanup function to remove the graticule when the component unmounts
    return () => {
      graticule.remove();
    };
  }, [map]); // Re-run if the map instance changes

  return null; // This component does not render any DOM
}
