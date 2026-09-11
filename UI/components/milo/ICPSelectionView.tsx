"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCampaigns } from "@/lib/campaigns";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  activateProspectSelectionPrompt,
  fetchProspectSelectionPrompts,
  listImportCampaigns,
  saveProspectSelectionPrompt,
  setProspectSelectionDefault,
  type AgentPrompt,
  type ImportCampaignListItem,
} from "@/lib/leadFunnelApi";

type CampaignChoice = {
  id: string;
  name: string;
  kind: "hr" | "import";
  role?: "owner" | "collaborator";
  status?: string;
  dailyGoal?: number;
};
const AGENT_LABEL = "Prospect Selection";
const sourceFor = (kind?: "hr" | "import"): "hr" | "lead_funnel" =>
  kind === "hr" ? "hr" : "lead_funnel";

export function ICPSelectionView() {
  const router = useRouter();
  const params = useSearchParams();
  const { campaigns: hrCampaigns, loading: hrLoading } = useCampaigns();
  const [importCampaigns, setImportCampaigns] = React.useState<
    ImportCampaignListItem[]
  >([]);
  const [importLoading, setImportLoading] = React.useState(true);
  const [campaignId, setCampaignId] = React.useState(
    params.get("campaignId") || "",
  );
  const [prompts, setPrompts] = React.useState<AgentPrompt[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [setAsDefault, setSetAsDefault] = React.useState(false);
  const [defaultConfirmOpen, setDefaultConfirmOpen] = React.useState(false);
  const [settingDefault, setSettingDefault] = React.useState(false);
  const [activating, setActivating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Only campaigns this user actually works on, and only ones still running.
  //
  // A prompt edited here changes who gets contacted, so the list must not offer a
  // campaign the user has no relationship to, nor a paused one whose prompt has no
  // effect. Both list endpoints already scope to owner-or-collaborator, so `role`
  // being absent means the campaign is not the viewer's — belt and braces, since
  // this screen writes the targeting rules for real outreach.
  const isMine = (role?: string) => role === "owner" || role === "collaborator";
  const isActive = (status?: string) =>
    (status || "active").toLowerCase() === "active";

  const choices = React.useMemo<CampaignChoice[]>(
    () =>
      [
        ...hrCampaigns
          .filter((c) => !c.isLegacy)
          .map((c) => ({
            id: c.id,
            name: c.name,
            kind: "hr" as const,
            role: c.myRole,
            status: c.status,
            dailyGoal: c.dailyEmailGoal,
          })),
        ...importCampaigns.map((c) => ({
          id: c._id,
          name: c.name,
          kind: "import" as const,
          role: c.myRole,
          status: c.status,
          dailyGoal: c.dailyEmailGoal,
        })),
      ].filter((c) => isMine(c.role) && isActive(c.status)),
    [hrCampaigns, importCampaigns],
  );
  const campaign = choices.find((c) => c.id === campaignId);
  const source = sourceFor(campaign?.kind);
  const canEdit = !!campaign;
  // A ?campaignId= for something the filter removed (paused, or not yours) would
  // otherwise render the editor with no campaign behind it — read-only, titled
  // "Campaign", saving to nothing. Say why instead.
  const listsReady = !hrLoading && !importLoading;
  const unavailableId = listsReady && campaignId && !campaign ? campaignId : null;

  React.useEffect(() => {
    let alive = true;
    listImportCampaigns()
      .then((d) => {
        if (alive) setImportCampaigns(d.campaigns || []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setImportLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    if (!campaignId && choices[0]) {
      setCampaignId(choices[0].id);
      router.replace(
        `/icp-selection?campaignId=${encodeURIComponent(choices[0].id)}`,
      );
    }
  }, [campaignId, choices, router]);

  const loadPrompts = React.useCallback(async () => {
    if (!campaignId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetchProspectSelectionPrompts(campaignId, source);
      const all = response.versions?.length
        ? response.versions
        : response.prompts || [];
      const active =
        response.active_prompt_id ||
        response.prompts?.find((p) => p.is_active)?.id ||
        all.find((p) => p.is_active)?.id ||
        null;
      setPrompts(all.sort((a, b) => b.version - a.version));
      setActiveId(active);
      const current = all.find((p) => p.id === active) || all[0];
      setSelectedId(current?.id || null);
      setDraft(current?.prompt_text || "");
      setSetAsDefault(Boolean(current?.is_default));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not load the prospect selection prompt",
      );
      setPrompts([]);
      setDraft("");
    } finally {
      setLoading(false);
    }
  }, [campaignId, source]);

  React.useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  const selectCampaign = (next: string) => {
    setCampaignId(next);
    router.replace(`/icp-selection?campaignId=${encodeURIComponent(next)}`);
  };

  const save = async () => {
    if (!campaignId || !draft.trim() || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveProspectSelectionPrompt(
        campaignId,
        { prompt_text: draft.trim(), set_as_default: setAsDefault },
        source,
      );
      setNotice(
        setAsDefault
          ? "New prompt version saved, activated, and set as your default for new campaigns."
          : "New prompt version saved and made active.",
      );
      await loadPrompts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the prompt");
    } finally {
      setSaving(false);
    }
  };
  const activate = async () => {
    if (!campaignId || !selectedId || selectedId === activeId || activating)
      return;
    setActivating(true);
    setError(null);
    setNotice(null);
    try {
      await activateProspectSelectionPrompt(campaignId, selectedId, source);
      setActiveId(selectedId);
      setNotice("Prompt version is now active for this campaign.");
      await loadPrompts();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not activate this prompt version",
      );
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="prompt-page">
      <header className="prompt-header">
        <div>
          <div className="prompt-kicker">Outreach Hub / ICP Selection</div>
          <h1>ICP Selection</h1>
          <p>Shape the shortlist before it reaches your daily worklist.</p>
        </div>
      </header>

      <div className="prompt-layout">
        <aside className="campaign-rail" aria-label="Campaigns">
          <div className="campaign-rail-heading">
            <span>Campaigns</span>
            <b>{choices.length}</b>
          </div>
          {hrLoading || importLoading ? (
            <CampaignRailSkeleton />
          ) : choices.length === 0 ? (
            <div className="prompt-muted">
              No campaigns available for your account.
            </div>
          ) : (
            <>
              {(["hr", "import"] as const).map((kind) => {
                const items = choices.filter((c) => c.kind === kind);
                if (!items.length) return null;
                return (
                  <div className="campaign-branch" key={kind}>
                    <div className="campaign-branch-label">
                      <span className="campaign-branch-line" />
                      {kind === "hr" ? "HR campaigns" : "Import campaigns"}
                    </div>
                    {items.map((c) => (
                      <button
                        key={`${c.kind}-${c.id}`}
                        className={`campaign-node ${c.id === campaignId ? "is-selected" : ""}`}
                        onClick={() => selectCampaign(c.id)}
                        aria-current={c.id === campaignId ? "page" : undefined}
                      >
                        <span className="campaign-node-copy">
                          <b>{c.name}</b>
                          <small>
                            {c.kind === "hr" ? "HR" : "Import"}
                            {c.role ? ` · ${c.role}` : ""}
                          </small>
                        </span>
                        <span className="campaign-chevron">›</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </>
          )}
          <div className="campaign-rail-foot">
            Active campaigns you own or collaborate on. Paused campaigns are hidden
            — their prompt has no effect until they run again.
          </div>
        </aside>

        {unavailableId ? (
          <EmptyState
            title="That campaign isn't available here"
            body="It is paused, or you are not an owner or collaborator on it. Pick one from the list to edit its prompt."
          />
        ) : !campaignId ? (
          <EmptyState
            title="Select a campaign to begin"
            body="Your prompt is stored per campaign."
          />
        ) : (
          <main className="prompt-main">
            {loading ? <EditorSkeleton /> : <>
            <section className="prompt-editor-panel" aria-labelledby="prompt-editor-title">
              <div className="prompt-editor-toolbar">
                <div>
                  <span className="prompt-type">
                    {campaign?.kind === "hr"
                      ? "HR CAMPAIGN"
                      : "IMPORT CAMPAIGN"}
                  </span>
                  <h2 id="prompt-editor-title">{AGENT_LABEL}</h2>
                  <p>
                    {campaign?.name || "Campaign"} ·{" "}
                    {activeId
                      ? `Active version ${prompts.find((p) => p.id === activeId)?.version ?? "—"}`
                      : "Backend default"}
                  </p>
                </div>
                <div className="prompt-actions">
                  <label className="prompt-default-option">
                    <input
                      type="checkbox"
                      checked={setAsDefault}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setDefaultConfirmOpen(true);
                        } else {
                          setSetAsDefault(false);
                        }
                      }}
                      disabled={!canEdit || saving || loading || !draft.trim()}
                    />
                    <span>
                      <b>Set as Default</b>
                      <small>Use for campaigns I create</small>
                    </span>
                  </label>
                  <button
                    className="prompt-secondary"
                    onClick={activate}
                    disabled={
                      !selectedId || selectedId === activeId || activating
                    }
                  >
                    {activating ? "Activating…" : "Make active"}
                  </button>
                  <button
                    className="prompt-primary"
                    onClick={save}
                    disabled={!canEdit || !draft.trim() || saving}
                  >
                    {saving ? "Saving…" : "Save new version"}
                  </button>
                </div>
              </div>
              {error && (
                <div className="prompt-alert" role="alert">
                  {error}
                </div>
              )}
              {notice && (
                <div className="prompt-notice" role="status">
                  {notice}
                </div>
              )}
              <label className="prompt-textarea-label" htmlFor="icp-prompt">
                Prompt instructions
              </label>
              <textarea
                id="icp-prompt"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={!canEdit || loading}
                placeholder="The backend default prompt will load here…"
                spellCheck="true"
              />
              <div className="prompt-editor-footer">
                <span>{draft.length.toLocaleString()} characters</span>
                <span>
                  {canEdit
                    ? "Campaign access · editing enabled"
                    : "Campaign access required to edit"}
                </span>
              </div>
            </section>
            </>}
          </main>
        )}
      </div>
      <ConfirmDialog
        open={defaultConfirmOpen}
        title="Set this ICP as your default?"
        message="If you make it as default, your upcoming prompts are going to use this version."
        confirmLabel="Agree"
        cancelLabel="Cancel"
        loading={settingDefault}
        loadingLabel="Saving…"
        onConfirm={async () => {
          const selectedPrompt = prompts.find((prompt) => prompt.id === selectedId);
          const isExistingVersion = !!selectedPrompt &&
            draft.trim() === selectedPrompt.prompt_text.trim();
          if (isExistingVersion && selectedId) {
            setSettingDefault(true);
            setError(null);
            try {
              await setProspectSelectionDefault(campaignId, selectedId, source);
              setSetAsDefault(true);
              setNotice("This prompt version is now your default for new campaigns.");
              setDefaultConfirmOpen(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not save your default ICP");
            } finally {
              setSettingDefault(false);
            }
          } else {
            setSetAsDefault(true);
            setDefaultConfirmOpen(false);
          }
        }}
        onCancel={() => setDefaultConfirmOpen(false)}
      />
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="prompt-skeleton" aria-busy="true" aria-label="Loading ICP selection">
      <div className="prompt-skeleton-toolbar">
        <div className="prompt-skeleton-copy"><span /><span /><span /></div>
        <div className="prompt-skeleton-actions"><i /><i /><i /></div>
      </div>
      <div className="prompt-skeleton-label" />
      <div className="prompt-skeleton-editor">
        {Array.from({ length: 10 }, (_, index) => <span key={index} style={{ width: `${82 - (index % 4) * 12}%` }} />)}
      </div>
      <div className="prompt-skeleton-footer"><span /><span /></div>
    </div>
  );
}

function CampaignRailSkeleton() {
  return (
    <div className="campaign-rail-skeleton" aria-busy="true" aria-label="Loading campaigns">
      <span /><span /><span /><span /><span />
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="prompt-empty">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}
