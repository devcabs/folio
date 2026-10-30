import React, { useCallback } from "react";
import type { NodeItem, NodeHeroImage } from "../../types/node";
import styles from "./HeroPhoto.module.css";

export interface HeroPhotoProps {
  node?: Partial<NodeItem>;
  heroImage?: NodeHeroImage;
  onExploreNode?: (nodeId: string) => void;
  className?: string;
  priority?: boolean;
  docked?: boolean;
  focalPoint?: { x: number; y: number };
  onClick?: () => void;
}

export const HeroPhoto: React.FC<HeroPhotoProps> = ({
  node,
  heroImage,
  onExploreNode,
  className,
  priority = false,
  docked = false,
  focalPoint = { x: 50, y: 50 },
  onClick,
}) => {
  const effectiveImage = heroImage ?? node?.heroImage ?? { src: "", alt: "", caption: "" };
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onClick) {
        onClick();
      } else if (node?.id && onExploreNode) {
        onExploreNode(node.id);
      }
    },
    [onClick, onExploreNode, node?.id]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (onClick) {
          onClick();
        } else if (node?.id && onExploreNode) {
          onExploreNode(node.id);
        }
      }
    },
    [onClick, onExploreNode, node?.id]
  );

  if (!effectiveImage.src && !node) return null;

  const cropFocalStyle = `${focalPoint.x}% ${focalPoint.y}%`;
  const ariaLabel = onClick
    ? `View photograph: ${effectiveImage.caption || effectiveImage.alt || node?.title || "Photograph"}`
    : `Explore ${node?.title || "Node"}`;

  return (
    <div
      className={`${styles.cardContainer} ${docked ? styles.docked : ""} ${className || ""}`}
      data-node-id={node?.id}
    >
      <button
        type="button"
        className={styles.cardInteractiveTarget}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
      >
        <div className={styles.imageWrapper}>
          <img
            src={effectiveImage.src}
            alt={effectiveImage.alt}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            className={styles.heroImage}
            style={{
              objectPosition: `var(--card-crop-focal, ${cropFocalStyle})`,
            }}
          />
        </div>
      </button>
    </div>
  );
};

export default HeroPhoto;
