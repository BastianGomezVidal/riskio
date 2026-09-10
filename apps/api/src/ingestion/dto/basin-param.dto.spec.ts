import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { BasinParamDto } from '../dto/basin-param.dto.js';

describe('BasinParamDto', () => {
  it('accepts valid basins', async () => {
    for (const basin of ['at', 'ep', 'cp']) {
      const dto = new BasinParamDto();
      dto.basin = basin as BasinParamDto['basin'];
      const errors = await validate(dto);
      expect(errors, `basin=${basin}`).toHaveLength(0);
    }
  });

  it('rejects unknown basins', async () => {
    const dto = new BasinParamDto();
    dto.basin = 'zz' as BasinParamDto['basin'];
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('basin');
  });

  it('rejects missing basin', async () => {
    const dto = new BasinParamDto();
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});