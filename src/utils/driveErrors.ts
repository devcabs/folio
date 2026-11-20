export type DriveSyncKind = 'photo' | 'document';

/**
 * Formats Google Drive folder synchronization error messages consistently
 * across SourceGallery ('photo') and SourceDocuments ('document').
 */
export function formatDriveSyncError(
  error: string | null | undefined,
  kind: DriveSyncKind
): string {
  const kindLabel = kind === 'photo' ? 'photo' : 'document';

  if (error?.includes('API Key')) {
    return `Public Google Drive ${kindLabel} synchronization requires an API key or pre-baked snapshot. You can open and view the verified folder directly in Google Drive.`;
  }
  if (error?.includes('403')) {
    return 'Access to this Google Drive folder is restricted. Ensure folder General Access is set to "Anyone with the link can view", or view directly in Google Drive.';
  }
  if (error?.includes('404')) {
    return 'The linked Google Drive folder could not be found. Check if the folder was moved or deleted.';
  }
  if (error) {
    return error;
  }

  return kind === 'photo'
    ? 'Photo synchronization failed for this gallery. Check Google Drive folder permissions or connectivity.'
    : 'Document synchronization failed for this folder. Check Google Drive folder permissions or connectivity.';
}
