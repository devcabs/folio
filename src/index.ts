/**
 * @folio/engine
 * Standalone parametric scrollytelling & narrative canvas engine.
 */

// Styles
import './styles/tokens.css';
import './styles/reset.css';

// Types & Contracts
export * from './types/node';
export * from './types/canvas';
export * from './types/chart';
export * from './types/draft';

// Configuration
export * from './config/engine.config';

// Utilities
export * from './utils/scrollLock';
export * from './utils/modalActions';

// UI Primitives
export * from './components/ui/Button';
export * from './components/ui/Toast';
export * from './components/ui/DevHelpTooltip';
export * from './components/ui/Modal';
export * from './components/ui/Drawer';
export * from './components/ui/ParametricShape';

// Shell & Metadata
export { App } from './App';
export const VERSION = '0.1.0';
