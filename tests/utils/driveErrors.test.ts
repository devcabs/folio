import { describe, it, expect } from 'vitest';
import { formatDriveSyncError } from '../../src/utils/driveErrors';

describe('formatDriveSyncError', () => {
  it('formats API Key errors for photo and document kinds', () => {
    expect(formatDriveSyncError('Missing Google Drive API Key', 'photo')).toContain(
      'Public Google Drive photo synchronization requires an API key or pre-baked snapshot.'
    );
    expect(formatDriveSyncError('Missing Google Drive API Key', 'document')).toContain(
      'Public Google Drive document synchronization requires an API key or pre-baked snapshot.'
    );
  });

  it('formats 403 restricted folder errors consistently', () => {
    const msg = formatDriveSyncError('Drive API 403 Forbidden', 'photo');
    expect(msg).toContain('Access to this Google Drive folder is restricted.');
    expect(formatDriveSyncError('Drive API 403', 'document')).toBe(msg);
  });

  it('formats 404 not found errors consistently', () => {
    const msg = formatDriveSyncError('404 Not Found', 'document');
    expect(msg).toContain('The linked Google Drive folder could not be found.');
    expect(formatDriveSyncError('404', 'photo')).toBe(msg);
  });

  it('returns custom error strings verbatim when not matching known codes', () => {
    expect(formatDriveSyncError('Network timeout', 'photo')).toBe('Network timeout');
    expect(formatDriveSyncError('Rate limit exceeded', 'document')).toBe('Rate limit exceeded');
  });

  it('falls back to kind-specific generic error messages when error is empty/null/undefined', () => {
    expect(formatDriveSyncError(null, 'photo')).toContain('Photo synchronization failed for this gallery.');
    expect(formatDriveSyncError(undefined, 'document')).toContain('Document synchronization failed for this folder.');
    expect(formatDriveSyncError('', 'photo')).toContain('Photo synchronization failed for this gallery.');
  });
});
