import React from 'react';
import { StatusPill } from './StatusPill';
import { Button } from '../ui/Button';
import { DevActionAffordance } from '../dev/DevActionAffordance';
import { useContent } from '../../hooks/useContent';
import styles from './HeroWelcome.module.css';

export interface HeroWelcomeProps {
  kickerText?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  onStartJourney?: () => void;
  heroCtaRef?: React.RefObject<HTMLDivElement | null>;
  heroSlotRef?: React.RefObject<HTMLDivElement | null>;
}

const DEFAULT_KICKER = 'Folio Engine — Universal Scrollytelling & Dynamic Document Canvas';
const DEFAULT_TITLE = 'Autonomous Multi-Stage Sequence Platform';
const DEFAULT_SUBTITLE =
  'A configurable multi-stage sequence and dynamic document platform.';

export const HeroWelcome: React.FC<HeroWelcomeProps> = ({
  kickerText,
  title,
  subtitle,
  onStartJourney,
  heroCtaRef,
  heroSlotRef,
}) => {
  const fallbackKicker = typeof kickerText === 'string' ? kickerText : DEFAULT_KICKER;
  const fallbackTitle = typeof title === 'string' ? title : DEFAULT_TITLE;
  const fallbackSubtitle = typeof subtitle === 'string' ? subtitle : DEFAULT_SUBTITLE;

  const dynamicKicker = useContent('hero.kicker', fallbackKicker);
  const dynamicTitle = useContent('hero.title', fallbackTitle);
  const dynamicSubtitle = useContent('hero.subtitle', fallbackSubtitle);
  const dynamicCta = useContent('hero.cta', 'Start Journey');

  const effectiveKickerText = dynamicKicker.text || fallbackKicker;

  const renderKickerContent = () => {
    if (!effectiveKickerText) return null;

    if (
      typeof effectiveKickerText === 'string' &&
      effectiveKickerText.includes(' — ')
    ) {
      const idx = effectiveKickerText.indexOf(' — ');
      const prefix = effectiveKickerText.slice(0, idx + 3);
      const meaning = effectiveKickerText.slice(idx + 3);
      return (
        <>
          <span className={styles.kickerPrefix}>{prefix}</span>
          <span className={styles.kickerMeaning}>{meaning}</span>
        </>
      );
    }

    return effectiveKickerText;
  };

  const renderTitleContent = () => {
    const text = dynamicTitle.text || fallbackTitle;
    return <span className={styles.titleLine}>{text}</span>;
  };

  const renderSubtitleContent = () => {
    const text = dynamicSubtitle.text || fallbackSubtitle;
    return <span className={styles.subtitleLine}>{text}</span>;
  };

  return (
    <section
      id="hero"
      className={styles.heroSection}
      aria-labelledby="hero-title"
    >
      {/* Portrait.so Inspired Hero Background Card (Golden with a subtle hint of primary) */}
      <div className={styles.heroBackgroundCard} aria-hidden="true">
        {/* Ambient Multi-Stop Radial Mesh */}
        <div className={styles.ambientMesh} />
      </div>

      <div className={styles.heroContainer}>
        {/* Kicker Pill reusing StatusPill */}
        {effectiveKickerText && (
          <div className={styles.kickerWrap}>
            <DevActionAffordance
              pointId="hero.kicker"
              defaultValue={fallbackKicker}
              currentValue={dynamicKicker.text}
            >
              <div className={styles.kickerCenter}>
                <StatusPill
                  label={renderKickerContent()}
                  variant="white"
                  className={styles.kickerPill}
                  ariaLabel={typeof effectiveKickerText === 'string' ? effectiveKickerText : undefined}
                />
              </div>
            </DevActionAffordance>
          </div>
        )}

        {/* Hero Title */}
        <DevActionAffordance
          pointId="hero.title"
          defaultValue={fallbackTitle}
          currentValue={dynamicTitle.text}
        >
          <h1 id="hero-title" className={styles.heroTitle}>
            {renderTitleContent()}
          </h1>
        </DevActionAffordance>

        {/* Narrative Subtitle */}
        <DevActionAffordance
          pointId="hero.subtitle"
          defaultValue={fallbackSubtitle}
          currentValue={dynamicSubtitle.text}
        >
          <p className={styles.heroSubtitle}>
            {renderSubtitleContent()}
          </p>
        </DevActionAffordance>

        {/* Grounded Hero CTA Button (significantly bigger padding, scrolls naturally past the top) */}
        <div ref={heroSlotRef || heroCtaRef} className={styles.heroCtaWrap}>
          <DevActionAffordance
            pointId="hero.cta"
            defaultValue="Start Journey"
            currentValue={dynamicCta.text}
          >
            <div className={styles.ctaButtonCenter}>
              <Button
                as="button"
                type="button"
                variant="revolving-outline"
                outlineWidth={4}
                size="lg"
                revolving={true}
                pulse={true}
                onClick={onStartJourney}
                className={styles.heroStartButton}
                aria-label="Start Journey through the Plan"
              >
                {dynamicCta.text}
              </Button>
            </div>
          </DevActionAffordance>
        </div>
      </div>
    </section>
  );
};

export default HeroWelcome;
