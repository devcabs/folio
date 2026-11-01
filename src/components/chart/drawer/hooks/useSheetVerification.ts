import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { SheetChartConfig } from '../../../../types/chart';
import {
  extractSpreadsheetId,
  verifySheetAccess,
  fetchSheetTabs,
  type SheetMetadataTab,
} from '../../../../services/sheetsVerificationService';

export type AccessStatus = 'idle' | 'checking' | 'public' | 'restricted' | 'invalid';

interface UseSheetVerificationProps {
  sheetUrl: string;
  tabName: string;
  sheetGid: string;
  initialConfig?: SheetChartConfig;
  setTabName: (name: string) => void;
  setSheetGid: (gid: string) => void;
  setLastModifiedTime: (time?: string) => void;
  onAutoSelectTab?: (tabTitle: string, gid: string) => void;
}

export function useSheetVerification({
  sheetUrl,
  tabName,
  sheetGid,
  initialConfig,
  setTabName,
  setSheetGid,
  setLastModifiedTime,
  onAutoSelectTab,
}: UseSheetVerificationProps) {
  const [accessStatus, setAccessStatus] = useState<AccessStatus>(() =>
    initialConfig?.sheetUrl ? 'public' : 'idle'
  );
  const [statusMessage, setStatusMessage] = useState<string>(() =>
    initialConfig?.sheetUrl ? 'Public Access Verified' : ''
  );
  const [discoveredTabs, setDiscoveredTabs] = useState<SheetMetadataTab[]>(() =>
    initialConfig?.tabName
      ? [{ title: initialConfig.tabName, sheetId: Number(initialConfig.sheetGid) || 0, index: 0 }]
      : []
  );

  const tabNameRef = useRef(tabName);
  tabNameRef.current = tabName;
  const sheetGidRef = useRef(sheetGid);
  sheetGidRef.current = sheetGid;
  const lastVerifiedUrlRef = useRef<string | null>(initialConfig?.sheetUrl?.trim() || null);

  const executeVerification = useCallback(
    async (urlToVerify: string) => {
      const trimmed = urlToVerify.trim();
      if (!trimmed) {
        lastVerifiedUrlRef.current = null;
        setAccessStatus('idle');
        setStatusMessage('');
        setDiscoveredTabs([]);
        return;
      }

      const spreadsheetId = extractSpreadsheetId(trimmed);
      if (!spreadsheetId) {
        lastVerifiedUrlRef.current = trimmed;
        setAccessStatus('invalid');
        setStatusMessage('Invalid Google Sheet link');
        setDiscoveredTabs([]);
        return;
      }

      setAccessStatus('checking');
      setStatusMessage('Verifying link access…');

      try {
        const [accessRes, tabs] = await Promise.all([
          verifySheetAccess(trimmed),
          fetchSheetTabs(trimmed),
        ]);

        lastVerifiedUrlRef.current = trimmed;

        if (accessRes.accessible) {
          setAccessStatus('public');
          setStatusMessage('Public Access Verified');
          if (accessRes.sheetGid && !sheetGidRef.current) {
            setSheetGid(accessRes.sheetGid);
          }
          if (accessRes.modifiedTime) {
            setLastModifiedTime(accessRes.modifiedTime);
          }
        } else {
          setAccessStatus('restricted');
          setStatusMessage('Link Sharing Restricted');
        }

        const resolvedTabs: SheetMetadataTab[] = (tabs && tabs.length > 0 ? tabs : accessRes.tabs) || [];

        if (resolvedTabs.length > 0) {
          setDiscoveredTabs(resolvedTabs);

          // Priority 1: keep currently selected tabName if present in resolvedTabs
          const matchingByName = tabNameRef.current
            ? resolvedTabs.find((t: SheetMetadataTab) => t.title === tabNameRef.current)
            : null;

          if (matchingByName) {
            setTabName(matchingByName.title);
            setSheetGid(String(matchingByName.sheetId));
          } else {
            // Priority 2: match by GID
            const currentGid = accessRes.sheetGid || sheetGidRef.current;
            const matchingByGid = currentGid
              ? resolvedTabs.find((t: SheetMetadataTab) => String(t.sheetId) === currentGid)
              : null;

            if (matchingByGid) {
              setTabName(matchingByGid.title);
              setSheetGid(String(matchingByGid.sheetId));
              onAutoSelectTab?.(matchingByGid.title, String(matchingByGid.sheetId));
            } else {
              // Priority 3: fallback to first discovered tab
              const firstTab = resolvedTabs[0];
              setTabName(firstTab.title);
              setSheetGid(String(firstTab.sheetId));
              onAutoSelectTab?.(firstTab.title, String(firstTab.sheetId));
            }
          }
        } else if (!tabNameRef.current) {
          setTabName('Sheet1');
        }
      } catch {
        lastVerifiedUrlRef.current = trimmed;
        setAccessStatus('restricted');
        setStatusMessage('Link Sharing Restricted');
      }
    },
    [setTabName, setSheetGid, setLastModifiedTime, onAutoSelectTab]
  );

  // Local-only status reset on URL change (no API call)
  useEffect(() => {
    const trimmed = sheetUrl.trim();
    if (!trimmed) {
      setAccessStatus('idle');
      setStatusMessage('');
      setDiscoveredTabs([]);
      lastVerifiedUrlRef.current = null;
      return;
    }
    const spreadsheetId = extractSpreadsheetId(trimmed);
    if (!spreadsheetId) {
      setAccessStatus('invalid');
      setStatusMessage('Invalid Google Sheet link');
      setDiscoveredTabs([]);
      return;
    }
    // If URL changed from last verified URL, reset to idle to prompt re-verification
    if (lastVerifiedUrlRef.current && lastVerifiedUrlRef.current !== trimmed) {
      setAccessStatus('idle');
      setStatusMessage('');
      setDiscoveredTabs([]);
    }
  }, [sheetUrl]);

  const handleTabChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedTitle = e.target.value;
      setTabName(selectedTitle);
      const tab = discoveredTabs.find((t: SheetMetadataTab) => t.title === selectedTitle);
      if (tab) {
        setSheetGid(String(tab.sheetId));
      }
    },
    [discoveredTabs, setTabName, setSheetGid]
  );

  const isStep1Valid = useMemo(() => {
    const hasSpreadsheetId = Boolean(extractSpreadsheetId(sheetUrl));
    if (!hasSpreadsheetId) return false;

    const isUnmodifiedInitial =
      Boolean(initialConfig?.sheetUrl) && sheetUrl.trim() === initialConfig?.sheetUrl?.trim();
    if (isUnmodifiedInitial) return true;

    return accessStatus === 'public';
  }, [sheetUrl, accessStatus, initialConfig]);

  const resetVerification = useCallback(
    (newUrl?: string, newTabName?: string, newGid?: string) => {
      setAccessStatus(newUrl ? 'public' : 'idle');
      setStatusMessage(newUrl ? 'Public Access Verified' : '');
      lastVerifiedUrlRef.current = newUrl?.trim() || null;
      if (newTabName) {
        setDiscoveredTabs([
          { title: newTabName, sheetId: Number(newGid) || 0, index: 0 },
        ]);
      } else {
        setDiscoveredTabs([]);
      }
    },
    []
  );

  return {
    accessStatus,
    setAccessStatus,
    statusMessage,
    setStatusMessage,
    discoveredTabs,
    setDiscoveredTabs,
    isStep1Valid,
    executeVerification,
    handleTabChange,
    resetVerification,
  };
}
