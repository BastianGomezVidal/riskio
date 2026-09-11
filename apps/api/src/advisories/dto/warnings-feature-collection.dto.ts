import { ApiProperty } from '@nestjs/swagger';

/** A GeoJSON LineString geometry. */
export class LineStringDto {
  @ApiProperty({ description: 'Geometry type', example: 'LineString' })
  type: 'LineString';

  @ApiProperty({
    description: 'Ordered [lon, lat] positions along the segment',
    example: [
      [-80.5, 25.9],
      [-80.4, 26.1],
    ],
  })
  coordinates: number[][];
}

/** A GeoJSON Polygon geometry (cone of uncertainty). */
export class PolygonDto {
  @ApiProperty({ description: 'Geometry type', example: 'Polygon' })
  type: 'Polygon';

  @ApiProperty({
    description: 'Linear rings; the first is the outer ring',
    example: [
      [
        [-120.5, 16.5],
        [-118.5, 15.5],
        [-120.5, 16.5],
      ],
    ],
  })
  coordinates: number[][][];
}

/** One coastal watch/warning GeoJSON feature. */
export class WarningFeatureDto {
  @ApiProperty({ description: 'Feature type', example: 'Feature' })
  type: 'Feature';

  @ApiProperty({
    description: 'Feature properties',
    example: { warningType: 'Hurricane Watch' },
  })
  properties: { warningType: string };

  @ApiProperty({ type: () => LineStringDto })
  geometry: LineStringDto;
}

/**
 * Coastal watch/warning segments of an advisory as a GeoJSON
 * FeatureCollection, ready for map overlays.
 */
export class WarningsFeatureCollectionDto {
  @ApiProperty({ description: 'Collection type', example: 'FeatureCollection' })
  type: 'FeatureCollection';

  @ApiProperty({ type: [WarningFeatureDto] })
  features: WarningFeatureDto[];
}
