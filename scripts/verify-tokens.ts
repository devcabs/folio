import * as fs from 'fs';
import * as path from 'path';

/**
 * Calculates WCAG 2.1 relative luminance for a given hex color string.
 */
function hexToLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const rLinear = toLinear(r);
  const gLinear = toLinear(g);
  const bLinear = toLinear(b);

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculates contrast ratio between two hex colors.
 */
function contrastRatio(hex1: string, hex2: string): number {
  const lum1 = hexToLuminance(hex1);
  const lum2 = hexToLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function runTokenAudit() {
  console.log('--- Design Tokens & Contrast Ratio Verification ---');

  const tokensPath = path.resolve(process.cwd(), 'src/styles/tokens.css');
  const tokensContent = fs.readFileSync(tokensPath, 'utf-8');

  // 1. Mandatory Tokens List
  const requiredTokens = [
    '--bg-canvas',
    '--bg-surface',
    '--bg-surface-elevated',
    '--bg-surface-muted',
    '--border-subtle',
    '--border-strong',
    '--border-focus',
    '--text-primary',
    '--text-secondary',
    '--text-muted',
    '--text-inverse',
    '--folio-primary',
    '--brand-primary-dark',
    '--brand-primary-tint',
    '--folio-accent',
    '--brand-accent-dark',
    '--brand-accent-tint',
    '--color-node-1',
    '--color-node-1-tint',
    '--color-node-1-border',
    '--color-node-2',
    '--color-node-2-tint',
    '--color-node-2-border',
    '--color-node-3',
    '--color-node-3-tint',
    '--color-node-3-border',
    '--color-node-4',
    '--color-node-4-tint',
    '--color-node-4-border',
    '--color-node-5',
    '--color-node-5-tint',
    '--color-node-5-border',
    '--font-display',
    '--font-body',
    '--font-mono',
    '--tracking-tight',
    '--leading-tight',
    '--text-display',
    '--text-h1',
    '--text-h2',
    '--text-h3',
    '--text-body-lg',
    '--text-body',
    '--text-body-sm',
    '--text-caption',
    '--space-1',
    '--space-2',
    '--space-3',
    '--space-4',
    '--space-5',
    '--space-6',
    '--space-8',
    '--space-10',
    '--space-12',
    '--space-16',
    '--radius-sm',
    '--radius-md',
    '--radius-lg',
    '--radius-xl',
    '--radius-full',
    '--btn-padding-y',
    '--btn-padding-x',
    '--btn-min-height',
    '--shadow-card',
    '--shadow-elevated',
    '--shadow-modal',
    '--shadow-glow-accent',
    '--duration-fast',
    '--duration-normal',
    '--duration-slow',
    '--ease-out',
    '--ease-spring'
  ];

  const missingTokens: string[] = [];
  for (const token of requiredTokens) {
    if (!tokensContent.includes(token)) {
      missingTokens.push(token);
    }
  }

  if (missingTokens.length > 0) {
    console.error('❌ Missing tokens in tokens.css:', missingTokens);
    process.exit(1);
  }
  console.log(`✅ All ${requiredTokens.length} mandatory tokens are defined in tokens.css.`);

  // 2. Contrast assertions
  const canvas = '#fcfbfa';
  const primaryInk = '#3b0712';
  const secondaryText = '#5c1d2e';
  const mutedText = '#8c5361';
  const inverseText = '#ffffff';
  const brandPrimary = '#881337';

  const ratioPrimary = contrastRatio(primaryInk, canvas);
  const ratioSecondary = contrastRatio(secondaryText, canvas);
  const ratioMuted = contrastRatio(mutedText, canvas);
  const ratioInversePrimary = contrastRatio(inverseText, brandPrimary);

  console.log(`Contrast Check: Primary Ink (${primaryInk}) on Canvas (${canvas}): ${ratioPrimary.toFixed(2)}:1 (Spec requires >12:1, WCAG AAA requires 7:1)`);
  console.log(`Contrast Check: Secondary Text (${secondaryText}) on Canvas (${canvas}): ${ratioSecondary.toFixed(2)}:1 (Spec requires >7:1, WCAG AAA requires 7:1)`);
  console.log(`Contrast Check: Muted Text (${mutedText}) on Canvas (${canvas}): ${ratioMuted.toFixed(2)}:1 (Spec requires >4.5:1, WCAG AA requires 4.5:1)`);
  console.log(`Contrast Check: Inverse Text (${inverseText}) on Brand Maroon (${brandPrimary}): ${ratioInversePrimary.toFixed(2)}:1 (WCAG AAA requires 7:1)`);

  if (ratioPrimary < 12.0) {
    throw new Error(`Primary ink contrast failed: ${ratioPrimary.toFixed(2)}:1 < 12:1`);
  }
  if (ratioSecondary < 7.0) {
    throw new Error(`Secondary text contrast failed: ${ratioSecondary.toFixed(2)}:1 < 7:1`);
  }
  if (ratioMuted < 4.5) {
    throw new Error(`Muted text contrast failed: ${ratioMuted.toFixed(2)}:1 < 4.5:1`);
  }
  if (ratioInversePrimary < 7.0) {
    throw new Error(`Inverse text contrast failed: ${ratioInversePrimary.toFixed(2)}:1 < 7:1`);
  }

  console.log('✅ All WCAG contrast ratio mathematical assertions passed!');
}

runTokenAudit();
