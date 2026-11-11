import { getEngineConfig, setEngineConfig, type EngineConfig } from "./config/engine.config";
import { verifyEngineWiring } from "./diagnostics/verifyEngineSetup";
import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import type { RoadmapSectionHandle, RoadmapScrollZone } from './components/roadmap/RoadmapSection';
import { AppHeader, type NavItem } from './components/layout/AppHeader';
import { HeroWelcome } from './components/layout/HeroWelcome';
import { RoadmapSection } from './components/roadmap/RoadmapSection';
import { PhotoFlightEngine } from './components/roadmap/PhotoFlightEngine';
import { AppFooter } from './components/layout/AppFooter';
import { FAB } from './components/ui/FAB';
import { Breadcrumb } from './components/ui/Breadcrumb';
import { PageTitle } from './components/ui/PageTitle';
import { EditorialSidebar } from './components/layout/EditorialSidebar';
import { DocumentCanvas } from './components/canvas/DocumentCanvas';
import { PageNotFound } from './components/feedback/PageNotFound';
import { useHashRoute } from './hooks/use-hash-route';
import { useDiscreteStepNavigation } from './hooks/use-discrete-step-navigation';
import { useAutoTableOfContents } from './hooks/use-auto-toc';
import { cinematicScrollTo } from './utils/smooth-scroll';
import rawNodes from './data/sample-nodes.json';
import type { NodeItem, NodeCode } from './types/node';

import { MigrationProvider } from './context/MigrationContext';
import { DeveloperModeProvider } from './context/DeveloperModeContext';
import { UndoRedoProvider } from './context/UndoRedoContext';
import {
  DevPinModal,
  DevModeBadge,
  DevLockBlockedModal,
  DevExitConfirmModal,
} from './components/dev';
import { hydrateHistoryFromIndexedDB } from './services/historyService';
import styles from './App.module.css';

const sampleNodes = rawNodes as NodeItem[];

const DEFAULT_NODE_SECTIONS: NavItem[] = [
  { id: 'node-overview', label: 'Overview', href: '#node-overview' },
  { id: 'node-canvas', label: 'Document Canvas', number: '01', href: '#node-canvas' },
];

const AppContent: React.FC = () => {
  const engineConfig = getEngineConfig();
  const nodes = engineConfig.nodes && engineConfig.nodes.length > 0 ? engineConfig.nodes : sampleNodes;
  const validNodeIds = useMemo(() => nodes.map((n: NodeItem) => n.id as NodeCode), [nodes]);

  const { route, nodeId, pageId, targetStage, navigateToNode, navigateToHome } =
    useHashRoute(validNodeIds, engineConfig.basePath);

  const [activeStage, setActiveStage] = useState<number>(1);
  const [scrollZone, setScrollZone] = useState<RoadmapScrollZone>('above');
  const [nodeSections, setNodeSections] = useState<NavItem[]>([]);
  const roadmapRef = useRef<RoadmapSectionHandle>(null);
  const heroCtaRef = useRef<HTMLDivElement>(null);

  const activeNodeCode = nodeId || pageId;
  const currentNode = activeNodeCode ? nodes.find((n: NodeItem) => n.id === activeNodeCode) : null;

  const handleStageChange = useCallback((stage: number, zone: RoadmapScrollZone) => {
    setActiveStage(stage);
    setScrollZone(zone);
  }, []);

  // When returning to home with a specific target stage, smoothly scroll to that milestone
  useEffect(() => {
    if (route === 'home' && targetStage) {
      const timer = setTimeout(() => {
        roadmapRef.current?.scrollToStage(targetStage);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [route, targetStage]);

  // Reset node sections when switching route or node
  useEffect(() => {
    setNodeSections([]);
  }, [route, activeNodeCode]);

  // Early IndexedDB History Hydration for undo/redo resilience
  useEffect(() => {
    hydrateHistoryFromIndexedDB().catch((err) => {
      console.warn('[App] History hydration notice:', err);
    });
  }, []);

  const isNodeRoute = route === 'node' || (route as string) === 'page';

  const autoTocItems = useAutoTableOfContents({
    containerId: 'node-content',
  });

  const effectiveNodeSections = useMemo<NavItem[]>(() => {
    if (autoTocItems && autoTocItems.length > 0) return autoTocItems;
    if (nodeSections && nodeSections.length > 0) return nodeSections;
    return DEFAULT_NODE_SECTIONS;
  }, [autoTocItems, nodeSections]);

  const navItems = useMemo<NavItem[]>(() => {
    if (isNodeRoute) {
      return effectiveNodeSections;
    }
    if (route === 'home') {
      if (scrollZone === 'above') {
        return [{ label: 'Roadmap', href: '#sequence-roadmap' }];
      }
      return [{ label: 'Overview', href: '#main-content' }];
    }
    return [];
  }, [isNodeRoute, effectiveNodeSections, route, scrollZone]);

  const handleScrollToTop = useCallback(() => {
    cinematicScrollTo({ top: 0, interruptible: false });
  }, []);

  const handleScrollToFooter = useCallback(() => {
    cinematicScrollTo({
      top: document.documentElement.scrollHeight,
      interruptible: false,
    });
  }, []);

  const handleHeaderStartJourney = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.preventDefault();
      if (route === 'home') {
        roadmapRef.current?.scrollToStage(1);
      } else {
        navigateToHome(1);
      }
    },
    [route, navigateToHome]
  );

  const handleHeaderOverview = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.preventDefault();
      if (route === 'home') {
        handleScrollToTop();
      } else {
        navigateToHome();
      }
    },
    [route, navigateToHome, handleScrollToTop]
  );

  const handleNextStage = useCallback(() => {
    if (scrollZone === 'above') {
      roadmapRef.current?.scrollToStage(1);
    } else if (activeStage < nodes.length) {
      roadmapRef.current?.scrollToStage(activeStage + 1);
    } else {
      handleScrollToFooter();
    }
  }, [scrollZone, activeStage, handleScrollToFooter]);

  const handlePrevStage = useCallback(() => {
    if (scrollZone === 'below') {
      roadmapRef.current?.scrollToStage(nodes.length);
    } else if (activeStage > 1) {
      roadmapRef.current?.scrollToStage(activeStage - 1);
    } else {
      handleScrollToTop();
    }
  }, [scrollZone, activeStage, handleScrollToTop]);

  // Discrete Step Navigation & Natural Scroll Lockdown
  useDiscreteStepNavigation({
    enabled: route === 'home',
    activeStage,
    scrollZone,
    onNextStage: handleNextStage,
    onPrevStage: handlePrevStage,
    onScrollToTop: handleScrollToTop,
    onScrollToFooter: handleScrollToFooter,
    onDirectStage: (stage) => roadmapRef.current?.scrollToStage(stage),
  });

  // Floating Action Button (FAB) state computation
  const isFloatingCtaVisible = useMemo(() => {
    if (route !== 'home') return false;
    return scrollZone !== 'above';
  }, [route, scrollZone]);

  const isPreviousCtaVisible = useMemo(() => {
    if (route !== 'home') return false;
    return scrollZone !== 'above';
  }, [route, scrollZone]);

  const floatingCtaLabel = useMemo(() => {
    if (scrollZone === 'below' || activeStage === nodes.length) return 'Top';
    return 'Next';
  }, [scrollZone, activeStage]);

  const floatingCtaDirection = useMemo<'down' | 'up'>(() => {
    if (scrollZone === 'below' || activeStage === nodes.length) return 'up';
    return 'down';
  }, [scrollZone, activeStage]);

  const handleFloatingCtaClick = useCallback(() => {
    if (scrollZone === 'below' || activeStage === nodes.length) {
      handleScrollToTop();
    } else {
      handleNextStage();
    }
  }, [scrollZone, activeStage, handleNextStage, handleScrollToTop]);

  const handlePreviousCtaClick = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      handlePrevStage();
    },
    [handlePrevStage]
  );

  const handleExploreNode = useCallback(
    (id: string) => {
      navigateToNode(id as NodeCode);
    },
    [navigateToNode]
  );

  const handleBackFromNode = useCallback(() => {
    if (currentNode) {
      const stageNum = currentNode.nodeNumber ?? currentNode.index + 1;
      navigateToHome(stageNum);
    } else {
      navigateToHome(1);
    }
  }, [currentNode, navigateToHome]);

  return (
    <div className={styles.appShell}>
      {/* 1. App Header: Restrained floating glass capsule */}
      <AppHeader
        brandTitle={engineConfig.branding.appName || "Folio"}
        brandLetter={engineConfig.branding.logoText || "F"}
        navItems={navItems}
        mobileOnlyNav={isNodeRoute}
        onRoadmapClick={handleHeaderStartJourney}
        onOverviewClick={handleHeaderOverview}
        onBrandClick={handleHeaderOverview}
      />

      {/* 2. Primary Route Switcher */}
      {isNodeRoute && currentNode ? (
        <div className={styles.nodePageShell}>
          {/* Breadcrumb Navigation Trail */}
          <div className={styles.breadcrumbContainer}>
            <Breadcrumb
              items={[
                { label: 'Overview', onClick: () => navigateToHome() },
                { label: 'Milestones', onClick: () => navigateToHome(currentNode.nodeNumber ?? 1) },
                { label: currentNode.title, isCurrent: true },
              ]}
            />
          </div>

          {/* 2-Column Desktop Grid: Sticky Sidebar + Reading Canvas */}
          <div className={styles.nodeLayout}>
            <div className={styles.sidebarColumn}>
              <EditorialSidebar
                title="Contents"
                items={effectiveNodeSections}
                accentColor={currentNode.accentColor}
                nodeNumber={currentNode.nodeNumber ?? 1}
                nodeTitle={currentNode.title}
                onBack={handleBackFromNode}
              />
            </div>

            <main id="node-content" className={styles.contentColumn}>
              {/* Node Overview & Page Title */}
              <section id="node-overview" className={styles.overviewSection} aria-label="Node Overview">
                <PageTitle
                  kicker={`Stage 0${currentNode.nodeNumber ?? 1}: ${currentNode.title}`}
                  kickerPointId={`node.${currentNode.id}.kicker`}
                  title={currentNode.subtitle ?? currentNode.title}
                  titlePointId={`node.${currentNode.id}.title`}
                  subtitle={currentNode.summary}
                  subtitlePointId={`node.${currentNode.id}.subtitle`}
                  accentColor={currentNode.accentColor}
                />
              </section>

              {/* Dynamic Document Canvas */}
              <section id="node-canvas" aria-label="Dynamic Document Canvas">
                <DocumentCanvas
                  nodeId={currentNode.id}
                  nodeTitle={currentNode.title}
                  accentColor={currentNode.accentColor}
                />
              </section>
            </main>
          </div>

          <AppFooter
            orgName={engineConfig.branding.orgName || "Folio Engine Open Sequence Architecture"}
            onRoadmapClick={handleHeaderStartJourney}
            onOverviewClick={handleHeaderOverview}
            onNodeClick={handleExploreNode}
          />
        </div>
      ) : route === 'not-found' ? (
        <>
          <div style={{ paddingTop: 'calc(var(--space-8) + 68px)', flex: 1 }}>
            <PageNotFound
              onReturn={() => navigateToHome(1)}
            />
          </div>
          <AppFooter
            orgName={engineConfig.branding.orgName || "Folio Engine Open Sequence Architecture"}
            onRoadmapClick={handleHeaderStartJourney}
            onOverviewClick={handleHeaderOverview}
            onNodeClick={handleExploreNode}
          />
        </>
      ) : (
        <>
          {/* Main Scrollytelling Sequence */}
          <main id="main-content" className={styles.mainContent}>
            <HeroWelcome
              heroCtaRef={heroCtaRef}
              onStartJourney={handleHeaderStartJourney}
              kickerText={engineConfig.branding.heroKicker}
              title={engineConfig.branding.heroTitle}
              subtitle={engineConfig.branding.heroSubtitle}
            />
            <RoadmapSection
              ref={roadmapRef}
              nodes={nodes}
              onStageChange={handleStageChange}
              onExploreNode={handleExploreNode}
            />
            {/* Photo Flight Engine: Real-Time Scrubbed Motion from Hero Edge to Roadmap Milestone Station */}
            <PhotoFlightEngine
              nodes={nodes}
              onSelectStage={(stage) => roadmapRef.current?.scrollToStage(stage)}
              onExploreNode={handleExploreNode}
            />
          </main>

          <AppFooter
            orgName={engineConfig.branding.orgName || "Folio Engine Open Sequence Architecture"}
            onRoadmapClick={handleHeaderStartJourney}
            onOverviewClick={handleHeaderOverview}
            onNodeClick={handleExploreNode}
          />

          {/* Floating Action Buttons (FABs) */}
          <FAB
            position="left"
            label="Previous"
            direction="up"
            revolving={true}
            pulse={false}
            isVisible={isPreviousCtaVisible}
            onClick={handlePreviousCtaClick}
            aria-label="Return to the previous milestone"
          />

          <FAB
            position="right"
            label={floatingCtaLabel}
            direction={floatingCtaDirection}
            revolving={true}
            isVisible={isFloatingCtaVisible}
            onClick={handleFloatingCtaClick}
          />
        </>
      )}

      {/* Coordinator Mode Dock & Administrative Modals */}
      <DevPinModal />
      <DevLockBlockedModal />
      <DevExitConfirmModal />
      <DevModeBadge />
    </div>
  );
};

export interface AppProps {
  config?: Partial<EngineConfig>;
}

export const App: React.FC<AppProps> = ({ config }) => {
  if (config) {
    setEngineConfig(config);
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDev =
        (import.meta as any).env?.DEV ??
        (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');
      if (isDev) {
        const result = verifyEngineWiring(config);
        if (!result.ok) {
          console.error('[Folio Engine] Integration error detected:\n' + result.errors.join('\n'));
        }
        if (result.warnings.length > 0) {
          result.warnings.forEach((warn) => console.warn(warn));
        }
      }
    }
  }, [config]);

  const activeConfig = config ? { ...getEngineConfig(), ...config } : getEngineConfig();

  return (
    <MigrationProvider engineConfig={activeConfig}>
      <DeveloperModeProvider>
        <UndoRedoProvider>
          <AppContent />
        </UndoRedoProvider>
      </DeveloperModeProvider>
    </MigrationProvider>
  );
};

export default App;
