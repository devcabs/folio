/**
 * Folio Engine — Cloudflare Pages Function: Edge Media Proxy & Stream Transcoder
 * Location: functions/api/media/drive/[fileId].ts
 *
 * Delegated to Folio Engine edge media handler.
 */

import type { PagesFunctionEventContext } from '../../../../src/types/edge';
import { handleDriveMediaRoute } from '../../../../src/edge/handlers/mediaHandler';

export async function onRequestGet(
  context: PagesFunctionEventContext<unknown, 'fileId'>
): Promise<Response> {
  const { params, request } = context;
  const fileId =
    (typeof params.fileId === 'string'
      ? params.fileId
      : Array.isArray(params.fileId)
      ? params.fileId[0]
      : '') || '';

  return handleDriveMediaRoute(request, fileId, context);
}
