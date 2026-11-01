import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import nodeData from '../src/data/node-nodes.json';

const PageSchema = z.object({
  id: z.enum(['access', 'equity', 'quality', 'resiliency', 'governance']),
  chapterNumber: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  title: z.string().min(3),
  subtitle: z.string().min(3),
  tagline: z.string().min(5),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentTint: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  heroImage: z.object({
    src: z.string().startsWith('/images/'),
    alt: z.string().min(5),
    caption: z.string().min(5)
  }),
  summary: z.string().min(10),
  annotation: z.string().min(10),
  stages: z.array(z.object({
    step: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    stageName: z.enum([
      'Where We Are',
      'What We Need',
      'What We Are Doing',
      'What We Are Achieving',
      'How We Serve Our Community'
    ]),
    narrative: z.string().min(10)
  })).length(5),
  hasPendingData: z.literal(false),
  pendingDataMessage: z.string().min(10),
  sourceItems: z.array(z.object({
    id: z.string(),
    title: z.string(),
    dateStamp: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    photo: z.object({
      src: z.string().startsWith('/images/'),
      alt: z.string().min(3),
      caption: z.string().optional(),
      showCaption: z.boolean().optional()
    }),
    imageSrc: z.string().startsWith('/images/').optional(),
    depedReference: z.string().optional()
  }))
});

const RootSchema = z.array(PageSchema).length(5);

// Run validation
try {
  console.log('--- Data Contract & Schema Verification ---');
  
  // 1. Zod Schema Verification
  const parsedData = RootSchema.parse(nodeData);
  console.log('✅ Zod schema validation passed for all 5 pages.');

  // 2. Critical Invariant Check: Verify strict sequence of page numbers 1 to 5
  parsedData.forEach((page, index) => {
    const expectedNum = (index + 1) as 1 | 2 | 3 | 4 | 5;
    if (page.chapterNumber !== expectedNum) {
      throw new Error(`Chapter index ${index} expected chapterNumber ${expectedNum}, got ${page.chapterNumber}`);
    }

    // Verify stage sequence 1..5
    page.stages.forEach((stage, sIdx) => {
      const expectedStep = (sIdx + 1) as 1 | 2 | 3 | 4 | 5;
      if (stage.step !== expectedStep) {
        throw new Error(`Chapter ${page.id} stage ${sIdx} expected step ${expectedStep}, got ${stage.step}`);
      }
    });

    // Verify file existence on disk in public directory
    const publicDir = path.resolve(process.cwd(), 'public');
    const heroFilePath = path.join(publicDir, page.heroImage.src);
    if (!fs.existsSync(heroFilePath)) {
      throw new Error(`Hero image file does not exist on disk: ${heroFilePath}`);
    }

    page.sourceItems.forEach((ev) => {
      const sourceFilePath = path.join(publicDir, ev.photo.src);
      if (!fs.existsSync(sourceFilePath)) {
        throw new Error(`Evidence photo file does not exist on disk: ${sourceFilePath}`);
      }
      if (ev.imageSrc) {
        const legacySourceFilePath = path.join(publicDir, ev.imageSrc);
        if (!fs.existsSync(legacySourceFilePath)) {
          throw new Error(`Legacy source image file does not exist on disk: ${legacySourceFilePath}`);
        }
      }
    });

    // Verify invariant: hasPendingData must be strictly false
    if (page.hasPendingData !== false) {
      throw new Error(`CRITICAL INVARIANT VIOLATION: page ${page.id} hasPendingData is not false`);
    }
  });

  console.log('✅ All image references exist on disk in public/images/.');
  console.log('✅ Sequential numbering and stages 1-5 verified.');
  console.log('✅ Invariant confirmed: hasPendingData is strictly false across all 5 pages.');
  console.log('✅ [PASSED] nodes.json strictly satisfies all Phase 3 data contract invariants.');
  process.exit(0);
} catch (error) {
  console.error('❌ [FAILED] Schema validation errors:', error);
  process.exit(1);
}
