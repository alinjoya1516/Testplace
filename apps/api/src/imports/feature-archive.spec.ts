import { strToU8, zipSync, type Zippable } from 'fflate';
import type { ArchiveLimits } from '../config/app-config';
import { readFeatureArchive } from './feature-archive';

const limits: ArchiveLimits = { maxArchiveBytes: 1024 * 1024, maxUncompressedBytes: 1024 * 1024, maxFiles: 50 };
const feature = 'Feature: F\n  @TC-1\n  Scenario: S\n    When I act\n';

function zip(entries: Record<string, string | Uint8Array>): Uint8Array {
  const zippable: Zippable = {};
  for (const [name, content] of Object.entries(entries)) {
    zippable[name] = typeof content === 'string' ? strToU8(content) : content;
  }
  return zipSync(zippable);
}

describe('readFeatureArchive', () => {
  it('extracts .feature files sorted by path and lists the other files', () => {
    const result = readFeatureArchive(
      zip({
        'features/b.feature': feature,
        'features/a.feature': feature,
        'features/README.md': '# Readme',
        '__MACOSX/features/._a.feature': 'resource fork',
        'features/.DS_Store': 'finder',
      }),
      'cases.zip',
      limits,
    );
    expect(result.errors).toEqual([]);
    expect(result.files.map((f) => f.path)).toEqual(['features/a.feature', 'features/b.feature']);
    expect(result.files[0].content).toBe(feature);
    expect(result.ignoredFiles).toEqual(['features/README.md']);
  });

  it('rejects a file that is not a zip archive', () => {
    const result = readFeatureArchive(strToU8('not a zip'), 'cases.zip', limits);
    expect(result.errors).toEqual([{ file: 'cases.zip', message: "Le fichier n'est pas une archive .zip." }]);
  });

  it('rejects a corrupted archive', () => {
    const data = zip({ 'a.feature': feature.repeat(20) });
    const truncated = data.slice(0, data.length - 30);
    expect(readFeatureArchive(truncated, 'cases.zip', limits).errors[0].message).toMatch(/corrompue/);
  });

  it('rejects an archive without .feature files', () => {
    const result = readFeatureArchive(zip({ 'README.md': 'x' }), 'cases.zip', limits);
    expect(result.errors).toEqual([
      { file: 'cases.zip', message: "L'archive ne contient aucun fichier .feature." },
    ]);
  });

  it('rejects paths escaping the archive', () => {
    const result = readFeatureArchive(zip({ '../evil.feature': feature, 'ok.feature': feature }), 'cases.zip', limits);
    expect(result.errors).toEqual([
      { file: '../evil.feature', message: expect.stringContaining('Chemin de fichier interdit') },
    ]);
  });

  it('rejects an archive with too many files', () => {
    const entries = Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`f${i}.feature`, feature]));
    const result = readFeatureArchive(zip(entries), 'cases.zip', { ...limits, maxFiles: 3 });
    expect(result.files).toEqual([]);
    expect(result.errors[0].message).toMatch(/plus de 3 fichiers/);
  });

  it('rejects an archive too large once uncompressed, before inflating it', () => {
    // 2 MB of zeros compress to a few kB: the classic zip bomb shape.
    const result = readFeatureArchive(zip({ 'big.feature': new Uint8Array(2 * 1024 * 1024) }), 'cases.zip', limits);
    expect(result.files).toEqual([]);
    expect(result.errors[0].message).toMatch(/dépasse 1 Mo une fois décompressée/);
  });

  it('rejects a file that is not UTF-8', () => {
    const result = readFeatureArchive(zip({ 'latin1.feature': new Uint8Array([0x46, 0xe9, 0x0a]) }), 'cases.zip', limits);
    expect(result.errors).toEqual([{ file: 'latin1.feature', message: "Le fichier n'est pas encodé en UTF-8." }]);
  });
});
