import { ApiProperty } from '@nestjs/swagger';

/**
 * GeoJSON LineString geometry.
 *
 * Coordinates are `[longitude, latitude]` pairs. Altitude is not exposed by
 * this API.
 */
export class LineStringDto {
  @ApiProperty({
    description: 'GeoJSON geometry type',
    enum: ['LineString'],
    example: 'LineString',
  })
  type: 'LineString';

  @ApiProperty({
    description: 'Ordered [longitude, latitude] positions along the segment',
    example: [
      [-80.5, 25.9],
      [-80.4, 26.1],
    ],
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
  })
  coordinates: number[][];
}

/**
 * GeoJSON Polygon geometry used for a cone of uncertainty.
 *
 * The first linear ring represents the exterior boundary. Additional rings,
 * when present, represent interior holes.
 */
export class PolygonDto {
  @ApiProperty({
    description: 'GeoJSON geometry type',
    enum: ['Polygon'],
    example: 'Polygon',
  })
  type: 'Polygon';

  @ApiProperty({
    description:
      'Linear rings; the first ring is the exterior boundary and subsequent rings are holes',
    example: [
      [
        [-120.5, 16.5],
        [-118.5, 15.5],
        [-120.5, 16.5],
      ],
    ],
    type: 'array',
    items: {
      type: 'array',
      items: { type: 'array', items: { type: 'number' } },
    },
  })
  coordinates: number[][][];
}

/**
 * Properties attached to a coastal watch/warning GeoJSON feature.
 */
export class WarningFeaturePropertiesDto {
  @ApiProperty({
    description: 'Coastal watch/warning type',
    example: 'Hurricane Watch',
  })
  warningType: string;
}

/**
 * One coastal watch/warning GeoJSON Feature.
 */
export class WarningFeatureDto {
  @ApiProperty({
    description: 'GeoJSON feature type',
    enum: ['Feature'],
    example: 'Feature',
  })
  type: 'Feature';

  @ApiProperty({
    description: 'Properties describing the coastal watch/warning',
    type: () => WarningFeaturePropertiesDto,
  })
  properties: WarningFeaturePropertiesDto;

  @ApiProperty({
    description: 'Warning geometry',
    type: () => LineStringDto,
  })
  geometry: LineStringDto;
}

/**
 * GeoJSON FeatureCollection containing an advisory's coastal
 * watch/warning segments.
 *
 * An advisory without active coastal watches or warnings is represented by
 * an empty `features` array.
 */
export class WarningsFeatureCollectionDto {
  @ApiProperty({
    description: 'GeoJSON collection type',
    enum: ['FeatureCollection'],
    example: 'FeatureCollection',
  })
  type: 'FeatureCollection';

  @ApiProperty({
    description: 'Coastal watch/warning features',
    type: () => [WarningFeatureDto],
  })
  features: WarningFeatureDto[];
}
