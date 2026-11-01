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

const DEFAULT_KICKER = 'Folio Engine — Management, Accountability & Systematic Collection of Data';
const DEFAULT_TITLE = 'Responsableng estudyante na may Galing, Husay, at Talino';
const DEFAULT_SUBTITLE =
  'A configurable multi-stage sequence.';

export const HeroWelcome: React.FC<HeroWelcomeProps> = ({
  kickerText,
  title,
  subtitle,
  onStartJourney,
  heroCtaRef,
  heroSlotRef,
}) => {
  const dynamicKicker = useContent('hero.kicker', DEFAULT_KICKER);
  const dynamicTitle = useContent('hero.title', DEFAULT_TITLE);
  const dynamicSubtitle = useContent('hero.subtitle', DEFAULT_SUBTITLE);
  const dynamicCta = useContent('hero.cta', 'Start Journey');

  const effectiveKickerText = kickerText ?? dynamicKicker.text;

  const renderKickerContent = () => {
    if (!effectiveKickerText) return null;

    if (
      typeof effectiveKickerText === 'string' &&
      effectiveKickerText.includes('Folio Engine — ')
    ) {
      const meaning = effectiveKickerText.replace('Folio Engine — ', '');
      return (
        <>
          <span className={styles.kickerPrefix}>Folio Engine — </span>
          <span className={styles.kickerMeaning}>{meaning}</span>
        </>
      );
    }

    return effectiveKickerText;
  };

  const renderTitleContent = () => {
    if (title) return title;
    if (dynamicTitle.text === DEFAULT_TITLE) {
      return (
        <>
          <span className={styles.titleLine}>
            Responsableng <span className={styles.bukasGradient}>estudyante</span>
          </span>
          <span className={styles.titleLine}>
            na may Galing, Husay, at Talino
          </span>
        </>
      );
    }
    return <span className={styles.titleLine}>{dynamicTitle.text}</span>;
  };

  const renderSubtitleContent = () => {
    if (subtitle) return subtitle;
    if (dynamicSubtitle.text === DEFAULT_SUBTITLE) {
      return (
        <>
          <span className={styles.subtitleLine}>
            A configurable multi-stage sequence.
          </span>
          <span className={styles.subtitleLine}>
            
          </span>
        </>
      );
    }
    return <span className={styles.subtitleLine}>{dynamicSubtitle.text}</span>;
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
              defaultValue={DEFAULT_KICKER}
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
          defaultValue={DEFAULT_TITLE}
          currentValue={dynamicTitle.text}
        >
          <h1 id="hero-title" className={styles.heroTitle}>
            {renderTitleContent()}
          </h1>
        </DevActionAffordance>

        {/* Narrative Subtitle */}
        <DevActionAffordance
          pointId="hero.subtitle"
          defaultValue={DEFAULT_SUBTITLE}
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
