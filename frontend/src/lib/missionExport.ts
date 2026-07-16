import type { LatLon } from './geo';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Builds a KML file (importable into Google Earth, QGroundControl, and
 * most GCS/GIS tools) with the route as a path plus a labeled placemark
 * per waypoint. `altitudeM`, if given, is applied to every waypoint (the
 * mission's assigned cruise altitude) so the route renders at height. */
export function buildKML(waypoints: LatLon[], missionType: string, altitudeM?: number): string {
  const alt = altitudeM ?? 0;
  const altitudeMode = altitudeM ? 'relativeToGround' : 'clampToGround';
  const coordsLine = waypoints.map((w) => `${w.lon},${w.lat},${alt}`).join(' ');
  const placemarks = waypoints
    .map((w, i) => `
    <Placemark>
      <name>WP${i + 1}</name>
      <Point>
        <altitudeMode>${altitudeMode}</altitudeMode>
        <coordinates>${w.lon},${w.lat},${alt}</coordinates>
      </Point>
    </Placemark>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(missionType)} Mission</name>
    <Style id="routeLine">
      <LineStyle><color>ffe0d14f</color><width>3</width></LineStyle>
    </Style>
    <Placemark>
      <name>Route</name>
      <styleUrl>#routeLine</styleUrl>
      <LineString>
        <altitudeMode>${altitudeMode}</altitudeMode>
        <coordinates>${coordsLine}</coordinates>
      </LineString>
    </Placemark>${placemarks}
  </Document>
</kml>`;
}

/** Builds a GPX 1.1 file (importable into most flight-planning and
 * GPS tools) as an ordered route (<rte>) of waypoints. */
export function buildGPX(waypoints: LatLon[], missionType: string, altitudeM?: number): string {
  const rtepts = waypoints
    .map((w, i) => `
    <rtept lat="${w.lat}" lon="${w.lon}">${altitudeM ? `<ele>${altitudeM}</ele>` : ''}
      <name>WP${i + 1}</name>
    </rtept>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="UAV Flight Envelope Platform" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <name>${escapeXml(missionType)} Mission</name>
    ${rtepts}
  </rte>
</gpx>`;
}
