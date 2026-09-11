'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  listCampaigns,
  getCampaign as apiGetCampaign,
  type Campaign,
} from './hrApi';

// Re-export the backend Campaign type as the canonical shape for the UI.
export type { Campaign } from './hrApi';

// Module-level cache so the campaign list survives component remounts on
// navigation (AppShell — and with it the Sidebar — is rendered per page, so it
// remounts every time you switch campaigns). We seed state from this cache on
// mount and only replace it when a fresh fetch actually differs, so the list
// stays put instead of vanishing and reappearing on every navigation.
let campaignsCache: Campaign[] | null = null;

/**
 * Load all campaigns (real backend campaigns + the synthetic "Ungrouped Runs"
 * legacy bucket). Replaces the old localStorage store.
 */
export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => campaignsCache ?? []);
  // Only "loading" on the very first fetch (nothing cached yet).
  const [loading, setLoading] = useState(campaignsCache === null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    // Keep showing cached data during background revalidation; only flip the
    // loading flag when we have nothing to display yet.
    if (campaignsCache === null) setLoading(true);
    setError(null);
    try {
      const next = await listCampaigns();
      // Stale-while-revalidate: only update state when the data changed, so an
      // identical response doesn't re-render / flicker the list.
      if (JSON.stringify(next) !== JSON.stringify(campaignsCache)) {
        campaignsCache = next;
        setCampaigns(next);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { campaigns, loading, error, reload };
}

export function useCampaign(id: string | undefined) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setCampaign(await apiGetCampaign(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaign');
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { campaign, loading, error, reload };
}
