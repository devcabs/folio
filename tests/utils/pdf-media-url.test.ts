import { describe, it, expect } from 'vitest';
import {
  buildDrivePreviewUrl,
  buildDriveViewUrl,
  resolveSingleDrivePdfUrl,
} from '../../src/utils/mediaUrl';
import {
  isPdfElement,
  isDocumentsElement,
  isLeafElement,
  type PdfElement,
  type DocumentsElement,
  type NodeCanvasDocument,
} from '../../src/types/canvas';
import {
  createDefaultPdf,
  createDefaultDocuments,
  isAuthoringPlaceholder,
} from '../../src/utils/canvasDefaults';
import { PublicNodePayloadSchema } from '../../src/types/edge';
import { compilePublicNodePayload } from '../../src/services/edgePreBakeService';
import { computeMetricsSummary } from '../../src/services/historyService';
import type { PublishedSnapshot } from '../../src/types/history';

const SAMPLE_FILE_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';

describe('Google Drive PDF URL Resolvers', () => {
  const validVariants = [
    SAMPLE_FILE_ID,
    `https://drive.google.com/file/d/${SAMPLE_FILE_ID}/view`,
    `https://drive.google.com/file/d/${SAMPLE_FILE_ID}/preview`,
    `https://drive.google.com/u/1/file/d/${SAMPLE_FILE_ID}/view`,
    `https://drive.google.com/open?id=${SAMPLE_FILE_ID}`,
    `https://drive.google.com/uc?id=${SAMPLE_FILE_ID}&export=download`,
    `<https://drive.google.com/file/d/${SAMPLE_FILE_ID}/view>`,
  ];

  it('buildDrivePreviewUrl resolves all supported Drive file URL variants to /preview', () => {
    const expected = `https://drive.google.com/file/d/${SAMPLE_FILE_ID}/preview`;
    for (const variant of validVariants) {
      expect(buildDrivePreviewUrl(variant)).toBe(expected);
    }
  });

  it('buildDriveViewUrl resolves all supported Drive file URL variants to /view', () => {
    const expected = `https://drive.google.com/file/d/${SAMPLE_FILE_ID}/view`;
    for (const variant of validVariants) {
      expect(buildDriveViewUrl(variant)).toBe(expected);
    }
  });

  it('buildDrivePreviewUrl and buildDriveViewUrl return empty string for invalid inputs', () => {
    expect(buildDrivePreviewUrl('')).toBe('');
    expect(buildDriveViewUrl('')).toBe('');
    expect(buildDrivePreviewUrl('https://drive.google.com/drive/folders/1ABCdefGHIjklMNO')).toBe('');
    expect(buildDriveViewUrl('https://example.com/file.pdf')).toBe('');
  });

  it('resolveSingleDrivePdfUrl returns canonical previewUrl, viewUrl, fileId, and rawUrl', () => {
    const input = `  https://drive.google.com/file/d/${SAMPLE_FILE_ID}/view?usp=sharing  `;
    const resolved = resolveSingleDrivePdfUrl(input);

    expect(resolved).toEqual({
      fileId: SAMPLE_FILE_ID,
      previewUrl: `https://drive.google.com/file/d/${SAMPLE_FILE_ID}/preview`,
      viewUrl: `https://drive.google.com/file/d/${SAMPLE_FILE_ID}/view`,
      rawUrl: `https://drive.google.com/file/d/${SAMPLE_FILE_ID}/view?usp=sharing`,
    });
  });

  it('resolveSingleDrivePdfUrl rejects folder URLs, empty strings, and malformed URLs', () => {
    expect(
      resolveSingleDrivePdfUrl('https://drive.google.com/drive/folders/1ABCdefGHIjklMNOpqrSTU')
    ).toBeNull();
    expect(
      resolveSingleDrivePdfUrl('https://drive.google.com/drive/u/0/folders/1ABCdefGHIjklMNOpqrSTU')
    ).toBeNull();
    expect(resolveSingleDrivePdfUrl('')).toBeNull();
    expect(resolveSingleDrivePdfUrl('   ')).toBeNull();
    expect(resolveSingleDrivePdfUrl('not a valid url')).toBeNull();
    expect(resolveSingleDrivePdfUrl('https://')).toBeNull();
    expect(resolveSingleDrivePdfUrl('https://example.com/document.pdf')).toBeNull();
  });
});

describe('Canvas PDF & Documents Type Guards', () => {
  const pdfEl: PdfElement = {
    id: 'pdf-1',
    type: 'pdf',
    pointId: 'node.access.pdf.pdf-1',
    src: `https://drive.google.com/file/d/${SAMPLE_FILE_ID}/preview`,
    driveFileId: SAMPLE_FILE_ID,
    driveUrl: `https://drive.google.com/file/d/${SAMPLE_FILE_ID}/view`,
    title: 'Annual Report',
  };

  const docsEl: DocumentsElement = {
    id: 'documents-1',
    type: 'documents',
    pointId: 'node.access.documents.documents-1',
    title: 'Policy Documents',
  };

  it('identifies PdfElement with isPdfElement and isLeafElement', () => {
    expect(isPdfElement(pdfEl)).toBe(true);
    expect(isDocumentsElement(pdfEl)).toBe(false);
    expect(isLeafElement(pdfEl)).toBe(true);
  });

  it('identifies DocumentsElement with isDocumentsElement and isLeafElement', () => {
    expect(isDocumentsElement(docsEl)).toBe(true);
    expect(isPdfElement(docsEl)).toBe(false);
    expect(isLeafElement(docsEl)).toBe(true);
  });
});

describe('Canvas Default Factories for PDF & Documents', () => {
  it('createDefaultPdf creates a valid PdfElement with zero parentheses in default strings', () => {
    const pdf = createDefaultPdf('access');
    expect(pdf.type).toBe('pdf');
    expect(pdf.id).toMatch(/^pdf-/);
    expect(pdf.pointId).toBe(`node.access.pdf.${pdf.id}`);
    expect(pdf.title).not.toMatch(/[()]/);
    expect(pdf.caption).not.toMatch(/[()]/);
    if (pdf.title) expect(isAuthoringPlaceholder(pdf.title)).toBe(true);
    if (pdf.caption) expect(isAuthoringPlaceholder(pdf.caption)).toBe(true);
  });

  it('createDefaultDocuments creates a valid DocumentsElement with zero parentheses in default strings', () => {
    const docs = createDefaultDocuments('equity');
    expect(docs.type).toBe('documents');
    expect(docs.id).toMatch(/^documents-/);
    expect(docs.pointId).toBe(`node.equity.documents.${docs.id}`);
    expect(docs.titlePointId).toBe(`node.equity.documents.${docs.id}.title`);
    expect(docs.subtitlePointId).toBe(`node.equity.documents.${docs.id}.subtitle`);
    expect(docs.title).not.toMatch(/[()]/);
    expect(docs.subtitle).not.toMatch(/[()]/);
    if (docs.title) expect(isAuthoringPlaceholder(docs.title)).toBe(true);
    if (docs.subtitle) expect(isAuthoringPlaceholder(docs.subtitle)).toBe(true);
  });
});

describe('Edge Zod Schema & Pre-Bake Pipeline for PDF & Documents', () => {
  const canvasDoc: NodeCanvasDocument = {
    nodeId: 'access',
    version: 2,
    updatedAt: '2026-11-18T00:00:00.000Z',
    sections: [
      {
        id: 'sec-1',
        type: 'section',
        title: 'Governance',
        elements: [
          {
            id: 'pdf-1',
            type: 'pdf',
            pointId: 'node.access.pdf.pdf-1',
            src: `https://drive.google.com/file/d/${SAMPLE_FILE_ID}/preview`,
            driveFileId: SAMPLE_FILE_ID,
            driveUrl: `https://drive.google.com/file/d/${SAMPLE_FILE_ID}/view`,
            title: 'Strategic Plan',
            caption: 'Approved 2026',
            showCaption: true,
          },
          {
            id: 'documents-1',
            type: 'documents',
            pointId: 'node.access.documents.documents-1',
            title: 'Supporting Resolutions',
            driveUrl: 'https://drive.google.com/drive/folders/1ABCdefGHIjklMNOpqrSTU',
            syncedDocuments: [
              {
                id: 'doc-1',
                driveFileId: SAMPLE_FILE_ID,
                originalFileName: 'resolution-01.pdf',
                title: 'Resolution 01',
                previewUrl: `https://drive.google.com/file/d/${SAMPLE_FILE_ID}/preview`,
                viewUrl: `https://drive.google.com/file/d/${SAMPLE_FILE_ID}/view`,
                orderIndex: 0,
              },
            ],
          },
        ],
      },
    ],
  };

  it('PublicNodePayloadSchema validates canvas containing PdfElement and DocumentsElement', () => {
    const parsed = PublicNodePayloadSchema.parse({
      nodeId: 'access',
      snapshotId: 'snap-1',
      version: 2,
      updatedAt: '2026-11-18T00:00:00.000Z',
      canvas: canvasDoc,
    });

    expect(parsed.canvas.sections[0].elements).toHaveLength(2);
  });

  it('compilePublicNodePayload preserves PdfElement.src without rewriting to /api/media/drive/', () => {
    const snapshot: PublishedSnapshot = {
      id: 'snap-1',
      schemaVersion: 1,
      title: 'Test Snapshot',
      description: 'Test',
      createdAt: '2026-11-18T00:00:00.000Z',
      authorSessionId: 'session-1',
      isActive: true,
      canvases: { access: canvasDoc },
      contentOverrides: {},
      summary: computeMetricsSummary({ access: canvasDoc }),
    };

    expect(snapshot.summary.totalLeafElements).toBe(2);
    expect(snapshot.summary.totalPdfElements).toBe(1);
    expect(snapshot.summary.totalDocumentElements).toBe(1);

    const payload = compilePublicNodePayload('access', snapshot);
    const compiledPdf = payload.canvas.sections[0].elements[0] as PdfElement;
    const compiledDocs = payload.canvas.sections[0].elements[1] as DocumentsElement;

    expect(compiledPdf.src).toBe(`https://drive.google.com/file/d/${SAMPLE_FILE_ID}/preview`);
    expect(compiledPdf.src).not.toContain('/api/media/drive/');
    expect(compiledDocs.syncedDocuments).toHaveLength(1);
  });
});
