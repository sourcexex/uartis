import { describe, expect, it } from 'vitest';

import {
  appendChecksum,
  calculateADD8,
  calculateCRC8,
  calculateCRC16,
  calculateCRC32,
  calculateChecksum,
  calculateCCITTCRC16,
  calculateModbusCRC16,
  calculateXOR,
  getChecksumLength,
  getChecksumRange,
} from './checksum';

const ASCII_123456789 = new TextEncoder().encode('123456789');

describe('checksum algorithms', () => {
  it('computes XOR and ADD8', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03]);
    expect(calculateXOR(data)).toEqual([0x00]);
    expect(calculateADD8(data)).toEqual([0x06]);
  });

  it('computes CRC-16 (IBM/Modbus) low byte first', () => {
    expect(calculateCRC16(ASCII_123456789)).toEqual([0x37, 0x4b]);
    expect(calculateModbusCRC16(ASCII_123456789)).toEqual([0x37, 0x4b]);
  });

  it('computes CRC-16/CCITT big endian', () => {
    expect(calculateCCITTCRC16(ASCII_123456789)).toEqual([0x29, 0xb1]);
  });

  it('computes CRC-32/ISO-HDLC big endian', () => {
    expect(calculateCRC32(ASCII_123456789)).toEqual([0xcb, 0xf4, 0x39, 0x26]);
  });

  it('computes CRC-8/ATM', () => {
    // CRC-8 poly 0x07, init 0x00 for "123456789" is 0xF4.
    expect(calculateCRC8(ASCII_123456789)).toEqual([0xf4]);
  });

  it('reports checksum lengths', () => {
    expect(getChecksumLength('None')).toBe(0);
    expect(getChecksumLength('CRC32')).toBe(4);
    expect(getChecksumLength('MODBUS-CRC16')).toBe(2);
    expect(getChecksumLength('CCITT-CRC16')).toBe(2);
  });
});

describe('checksum ranges', () => {
  it('supports negative end indexes', () => {
    const data = new Uint8Array([0, 1, 2, 3, 4]);
    expect(Array.from(getChecksumRange(data, 1, -2))).toEqual([1, 2, 3]);
    expect(Array.from(getChecksumRange(data, 0, -1))).toEqual([0, 1, 2, 3, 4]);
  });

  it('appends the configured checksum', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03]);
    const config = { type: 'ADD8' as const, startIndex: 0, endIndex: -1 };
    expect(Array.from(appendChecksum(data, config))).toEqual([1, 2, 3, 6]);
    expect(calculateChecksum(data, config)).toEqual([6]);
  });
});
