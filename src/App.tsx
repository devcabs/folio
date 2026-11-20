import { getEngineConfig, setEngineConfig, getActiveNodes, type EngineConfig } from "./config/engine.config";
import { verifyEngineWiring } from "./diagnostics/verifyEngineSetup";
import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import type { RoadmapSectionHandle, RoadmapScrollZone } from './components/roadmap/RoadmapSection';
import { AppHeader, type NavItem } from './components/layout/AppHeader';
import { HeroWelcome } from './components/layout/HeroWelcome';
import { HeroWelcomeGhostWireframe } from './components/layout/HeroWelcomeGhostWireframe';
import { RoadmapSection } from './components/roadmap/RoadmapSection';
import { PhotoFlightEngine } from './components/roadmap/PhotoFlightEngine';
import { AppFooter } from './components/layout/AppFooter';
import { FAB } from './components/ui/FAB';
import { Breadcrumb, type BreadcrumbItem } from './components/ui/Breadcrumb';
import { PageTitle } from './components/ui/PageTitle';
import { EditorialSidebar } from './components/layout/EditorialSidebar';
import { DocumentCanvas } from './components/canvas/DocumentCanvas';
import { CanvasGhostWireframe } from './components/canvas/CanvasGhostWireframe';
import { PageNotFound } from './components/feedback/PageNotFound';
import { useHashRoute } from './hooks/use-hash-route';
import {
  findSimilarPages,
  buildTwoLevelNavTree,
  countSummaryWords,
  MAX_PAGE_SUMMARY_WORDS,
  updatePageNodeMetadata,
} from './services/pageTreeService';
import { createWorkspaceUndoAction } from './services/undoRedoService';
import { resolveContent } from './utils/contentDb';
import { useDiscreteStepNavigation } from './hooks/use-discrete-step-navigation';
import { useAutoTableOfContents } from './hooks/use-auto-toc';
import { useContent } from './hooks/useContent';
import { useUndoRedo } from './hooks/useUndoRedo';
import { cinematicScrollTo } from './utils/smooth-scroll';
import type { NodeItem, NodeCode } from './types/node';

import { MigrationProvider } from './context/MigrationContext';
import { DeveloperModeProvider } from './context/DeveloperModeContext';
import { useDeveloperMode } from './hooks/useDeveloperMode';
import { PortalChromeProvider, usePortalChrome } from './context/PortalChromeContext';
import { UndoRedoProvider } from './context/UndoRedoContext';
import {
  DevPinModal,
  DevModeBadge,
  DevLockBlockedModal,
  DevExitConfirmModal,
  DevMigrationModal,
} from './components/dev';
import styles from './App.module.css';

const DEFAULT_NODE_SECTIONS: NavItem[] = [];

const AppContent: React.FC = () => {
  const engineConfig = getEngineConfig();
  const portalChrome = usePortalChrome();
  const { isDevMode, lockToken, setHasUnpublishedChanges, showToast } = useDeveloperMode();
  const { pushAction } = useUndoRedo();
  const nodes = getActiveNodes();
  const validNodeIds = useMemo(() => nodes.map((n: NodeItem) => n.id as NodeCode), [nodes]);

  const {
    route,
    nodeId,
    pageId,
    activePageId,
    rootNodeId,
    pageNode,
    ancestors,
    attemptedSegments,
    nearestValidAncestor,
    targetStage,
    navigateToNode,
    navigateToPage,
    navigateToHome,
  } = useHashRoute(validNodeIds, engineConfig.basePath, {
    pages: portalChrome?.pages,
    publishedPages: portalChrome?.publishedPages,
    isHydrating: portalChrome?.isHydrating ?? (portalChrome ? !portalChrome.hasHydrated : false),
    isDevMode,
    onDraftExitRedirect: (targetTitle) => {
      showToast(`Returned to ${targetTitle} after exiting edit mode.`, 'info');
    },
    onUndoRedirect: (parentTitle) => {
      showToast(`Returned to ${parentTitle} after undo.`, 'info');
    },
  });

  const [activeStage, setActiveStage] = useState<number>(1);
  const [scrollZone, setScrollZone] = useState<RoadmapScrollZone>('above');
  const [nodeSections, setNodeSections] = useState<NavItem[]>([]);
  const roadmapRef = useRef<RoadmapSectionHandle>(null);
  const heroCtaRef = useRef<HTMLDivElement>(null);

  const activeNodeCode = rootNodeId || nodeId || pageId;
  const activeRootNode = activeNodeCode ? nodes.find((n: NodeItem) => n.id === activeNodeCode) : null;
  const currentNode = activeRootNode;
  const isSubpage = Boolean(pageNode);
  const effectivePageId = activePageId || activeRootNode?.id || null;
  const effectiveAccentColor = activeRootNode?.accentColor;
  const { text: resolvedNodeTitle } = useContent(
    activeRootNode ? `node.${activeRootNode.id}.title` : '__inactive__.title',
    activeRootNode?.title ?? ''
  );
  const effectivePageTitle = pageNode ? pageNode.title : resolvedNodeTitle;

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

  // Reset node sections when switching route or page
  useEffect(() => {
    setNodeSections([]);
  }, [route, effectivePageId]);

  const notFoundSuggestions = useMemo(
    () =>
      route === 'not-found'
        ? findSimilarPages(attemptedSegments, nodes, portalChrome?.pages ?? {}, {
          limit: 5,
          basePath: engineConfig.basePath,
        })
        : [],
    [route, attemptedSegments, nodes, portalChrome?.pages, engineConfig.basePath]
  );

  const isNodeRoute = route === 'node' || (route as string) === 'page';

  const autoTocItems = useAutoTableOfContents({
    containerId: 'node-content',
  });

  const effectiveNodeSections = useMemo<NavItem[]>(() => {
    if (autoTocItems && autoTocItems.length > 0) return autoTocItems;
    if (nodeSections && nodeSections.length > 0) return nodeSections;
    return DEFAULT_NODE_SECTIONS;
  }, [autoTocItems, nodeSections]);

  const siteNavItems = useMemo<NavItem[]>(() => {
    return buildTwoLevelNavTree(
      nodes,
      portalChrome?.pages ?? {},
      activePageId,
      engineConfig.basePath,
      (node) => resolveContent(portalChrome?.contentOverrides ?? {}, `node.${node.id}.title`, node.title)
    );
  }, [nodes, portalChrome?.pages, portalChrome?.contentOverrides, activePageId, engineConfig.basePath]);

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
    enabled: route === 'home' && (!portalChrome || portalChrome.hasHydrated),
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

  const handleUpdateSubpageMetadata = useCallback(
    async (targetPageId: string, updates: { title?: string; summary?: string }) => {
      if (!portalChrome) return;
      const beforePages = portalChrome.pages;
      const currentPage = beforePages[targetPageId];
      if (!currentPage) return;

      const normalizedUpdates: { title?: string; summary?: string } = { ...updates };

      if (normalizedUpdates.title !== undefined) {
        const trimmedTitle = normalizedUpdates.title.trim();
        if (!trimmedTitle) {
          showToast('Page title cannot be empty.', 'error');
          return;
        }
        normalizedUpdates.title = trimmedTitle;
      }

      if (normalizedUpdates.summary !== undefined) {
        const trimmedSummary = normalizedUpdates.summary.trim();
        if (countSummaryWords(trimmedSummary) > MAX_PAGE_SUMMARY_WORDS) {
          showToast(
            `Keep page summary to ${MAX_PAGE_SUMMARY_WORDS} words or fewer.`,
            'error'
          );
          return;
        }
        normalizedUpdates.summary = trimmedSummary;
      }

      const noTitleChange =
        normalizedUpdates.title === undefined || normalizedUpdates.title === currentPage.title;
      const noSummaryChange =
        normalizedUpdates.summary === undefined ||
        normalizedUpdates.summary === (currentPage.summary ?? '');
      if (noTitleChange && noSummaryChange) {
        return;
      }

      const { pages: nextPages, page: updatedPage } = updatePageNodeMetadata(
        beforePages,
        targetPageId,
        normalizedUpdates
      );

      await portalChrome.commitWorkspaceMutation({ pages: nextPages });

      pushAction(
        createWorkspaceUndoAction({
          type: 'page_update_metadata',
          description: `Edit page "${updatedPage.title}"`,
          before: { pages: beforePages },
          after: { pages: nextPages },
          getLockToken: () => lockToken ?? null,
        })
      );

      setHasUnpublishedChanges(true);
    },
    [portalChrome, lockToken, pushAction, setHasUnpublishedChanges, showToast]
  );

  if (portalChrome && !portalChrome.hasHydrated && route !== 'hydrating') {
    return (
      <div className={styles.appShell} data-testid="portal-hydration-gate">
        <HeroWelcomeGhostWireframe />
      </div>
    );
  }

  const breadcrumbItems: BreadcrumbItem[] = isSubpage && ancestors.length > 0
    ? [
      { id: 'overview', label: 'Overview', onClick: () => navigateToHome() },
      ...ancestors.map((ancestor, idx) => ({
        id: ancestor.id,
        label: ancestor.isRootChapter ? resolvedNodeTitle : ancestor.title,
        isCurrent: idx === ancestors.length - 1,
        onClick: idx < ancestors.length - 1 ? () => navigateToPage(ancestor.id) : undefined,
      })),
    ]
    : [
      { label: 'Overview', onClick: () => navigateToHome() },
      { label: resolvedNodeTitle, isCurrent: true },
    ];

  const parentAncestor = ancestors.length >= 2 ? ancestors[ancestors.length - 2] : null;
  const sidebarBackLabel = isSubpage && parentAncestor
    ? (parentAncestor.isRootChapter ? resolvedNodeTitle : parentAncestor.title)
    : 'Roadmap';
  const sidebarOnBack = isSubpage && parentAncestor
    ? () => navigateToPage(parentAncestor.id)
    : handleBackFromNode;

  return (
    <div className={styles.appShell}>
      {/* 1. App Header: Restrained floating glass capsule */}
      <AppHeader
        brandTitle={engineConfig.branding.appName || "Folio"}
        brandLetter={engineConfig.branding.logoText}
        navItems={siteNavItems}
        mobileOnlyNav={true}
        onNavigatePage={navigateToPage}
        onRoadmapClick={handleHeaderStartJourney}
        onOverviewClick={handleHeaderOverview}
        onBrandClick={handleHeaderOverview}
      />

      {/* 2. Primary Route Switcher */}
      {route === 'hydrating' ? (
        <div className={styles.nodePageShell}>
          <div className={styles.nodeLayout}>
            <div className={styles.sidebarColumn} />
            <main id="node-content" className={styles.contentColumn}>
              <CanvasGhostWireframe nodeId={rootNodeId || 'hydrating'} />
            </main>
          </div>
          <AppFooter
            orgName={engineConfig.branding.orgName || "Folio Engine Open Sequence Architecture"}
            onRoadmapClick={handleHeaderStartJourney}
            onOverviewClick={handleHeaderOverview}
            onNodeClick={handleExploreNode}
          />
        </div>
      ) : isNodeRoute && effectivePageId && (activeRootNode || pageNode) ? (
        <div className={styles.nodePageShell}>
          {/* Breadcrumb Navigation Trail */}
          <div className={styles.breadcrumbContainer}>
            <Breadcrumb items={breadcrumbItems} />
          </div>

          {/* 2-Column Desktop Grid: Sticky Sidebar + Reading Canvas */}
          <div className={styles.nodeLayout}>
            <div className={styles.sidebarColumn}>
              <EditorialSidebar
                title="Contents"
                items={effectiveNodeSections}
                accentColor={effectiveAccentColor}
                nodeNumber={activeRootNode?.nodeNumber ?? 1}
                nodeTitle={effectivePageTitle}
                backLabel={sidebarBackLabel}
                onBack={sidebarOnBack}
              />
            </div>

            <main id="node-content" className={styles.contentColumn}>
              {/* Node Overview & Page Title */}
              <section id="node-overview" className={styles.overviewSection} aria-label="Node Overview">
                {isSubpage && pageNode ? (
                  <PageTitle
                    title={pageNode.title}
                    subtitle={pageNode.summary || undefined}
                    accentColor={effectiveAccentColor}
                    onSaveTitle={(newTitle) =>
                      handleUpdateSubpageMetadata(pageNode.id, { title: newTitle.trim() })
                    }
                    onSaveSubtitle={(newSummary) =>
                      handleUpdateSubpageMetadata(pageNode.id, { summary: newSummary.trim() })
                    }
                  />
                ) : currentNode ? (
                  <PageTitle
                    kicker={`Stage 0${currentNode.nodeNumber ?? 1}: ${resolvedNodeTitle}`}
                    kickerPointId={`node.${currentNode.id}.kicker`}
                    title={currentNode.subtitle ?? currentNode.title}
                    titlePointId={`node.${currentNode.id}.title`}
                    subtitle={currentNode.summary}
                    subtitlePointId={`node.${currentNode.id}.summary`}
                    accentColor={effectiveAccentColor}
                  />
                ) : null}
              </section>

              {/* Dynamic Document Canvas */}
              <div id="node-canvas" data-toc="false">
                <DocumentCanvas
                  nodeId={effectivePageId}
                  nodeTitle={effectivePageTitle}
                  accentColor={effectiveAccentColor}
                  onNavigateToPage={navigateToPage}
                />
              </div>
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
              nearestParent={
                nearestValidAncestor
                  ? {
                    id: nearestValidAncestor.id,
                    title: nearestValidAncestor.title,
                    path: nearestValidAncestor.path,
                  }
                  : null
              }
              onReturnToParent={(id) => navigateToPage(id)}
              suggestions={notFoundSuggestions}
              onSelectSuggestion={(id) => navigateToPage(id)}
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
      <DevMigrationModal />
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
        <PortalChromeProvider>
          <UndoRedoProvider>
            <AppContent />
          </UndoRedoProvider>
        </PortalChromeProvider>
      </DeveloperModeProvider>
    </MigrationProvider>
  );
};

export default App;
