import { type CSSProperties, useState } from "react";
import "../index.css";
import { useCallTool, useToolInfo } from "../helpers.js";
import { useDisplayMode, useLayout } from "skybridge/web";

type Tx = {
  id: number;
  date: string;
  name: string;
  value: number;
  currency: string;
  marked: boolean;
  includeInAnalysis: boolean;
  categoryId: number | null;
  category: string | null;
  account: string | null;
};

const fmt = (value: number, currency: string) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency || "EUR" }).format(value);

// Built-in Finary categories are slugs (food_and_beverage); custom ones are
// real user-entered names — only humanize the slugs.
const pretty = (name: string) =>
  /^[a-z0-9_]+$/.test(name)
    ? name
        .split("_")
        .map((w) => (w === "and" ? "&" : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(" ")
    : name;

export default function ListTransactions() {
  const { output, input, isPending } = useToolInfo<"list-transactions">();
  const { callTool } = useCallTool("update-transactions");
  const cats = useCallTool("list-categories");
  const more = useCallTool("list-transactions");
  const [displayMode, setDisplayMode] = useDisplayMode();
  const { theme } = useLayout();
  const dark = theme === "dark";

  // The view's data comes from the original tool call and never refetches, so
  // edits are applied optimistically here, then synced from the update
  // response (or rolled back if the call fails).
  const [overrides, setOverrides] = useState<Record<number, Partial<Tx>>>({});
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pickerId, setPickerId] = useState<number | null>(null);
  // Pages fetched after the initial tool call ("show more"); undefined means
  // no extra page loaded yet, so the next page comes from the original output.
  const [extra, setExtra] = useState<Tx[]>([]);
  const [nextPageOverride, setNextPageOverride] = useState<number | null | undefined>(undefined);

  const patch = (id: number, fields: Partial<Tx>) =>
    setOverrides((o) => ({ ...o, [id]: { ...o[id], ...fields } }));

  const save = (
    id: number,
    send: { marked?: boolean; name?: string; categoryId?: number; includeInAnalysis?: boolean },
    optimistic: Partial<Tx>,
    previous: Partial<Tx>,
  ) => {
    setBusy((b) => ({ ...b, [id]: true }));
    patch(id, optimistic);
    callTool(
      { updates: [{ transactionId: id, ...send }] },
      {
        onSuccess: (res) => {
          const r = res.structuredContent?.results?.[0];
          if (!r?.ok) return patch(id, previous);
          patch(id, {
            name: r.name ?? undefined,
            category: r.category,
            categoryId: r.categoryId,
            marked: r.marked ?? undefined,
            includeInAnalysis: r.includeInAnalysis ?? undefined,
          });
        },
        onError: () => patch(id, previous),
        onSettled: () => setBusy((b) => ({ ...b, [id]: false })),
      },
    );
  };

  // Palette lifted from app.finary.com (dark): #131314 cards, #EDF0F5 text,
  // #969BA3 muted, gold #F1C086 accent, pill buttons on #1D1D1F.
  const c = dark
    ? {
        fg: "#EDF0F5",
        sub: "#969BA3",
        line: "rgba(255,255,255,0.07)",
        card: "#131314",
        btn: "#1D1D1F",
        hover: "rgba(255,255,255,0.04)",
        pos: "#7DC983",
        gold: "#F1C086",
      }
    : {
        fg: "#16181D",
        sub: "#6E747D",
        line: "rgba(0,0,0,0.08)",
        card: "#FFFFFF",
        btn: "#F0F1F3",
        hover: "rgba(0,0,0,0.04)",
        pos: "#2E9E4F",
        gold: "#9A6A28",
      };

  if (isPending) return <div style={{ padding: 16, color: c.sub }}>Loading transactions…</div>;

  const nextPage = nextPageOverride === undefined ? (output?.nextPage ?? null) : nextPageOverride;
  const loadMore = () => {
    if (!nextPage) return;
    more.callTool(
      { ...input, page: nextPage, perPage: output?.perPage },
      {
        onSuccess: (res) => {
          const sc = res.structuredContent;
          setExtra((e) => [...e, ...((sc?.transactions ?? []) as Tx[])]);
          setNextPageOverride(sc?.nextPage ?? null);
        },
      },
    );
  };

  const seen = new Set<number>();
  const txs: Tx[] = [];
  for (const t of [...(output?.transactions ?? []), ...extra] as Tx[]) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      txs.push({ ...t, ...overrides[t.id] });
    }
  }
  const income = txs.filter((t) => t.value > 0).reduce((s, t) => s + t.value, 0);
  const expenses = txs.filter((t) => t.value < 0).reduce((s, t) => s + t.value, 0);
  const isFull = displayMode === "fullscreen";
  const shown = isFull ? txs : txs.slice(0, 8);
  const markedCount = txs.filter((t) => t.marked).length;
  const categories = cats.data?.structuredContent?.categories ?? [];
  const mains = categories.filter((cat) => !cat.isSubcategory);

  const iconBtn = {
    flexShrink: 0,
    padding: 0,
    background: "transparent",
    border: "none",
    color: c.sub,
    cursor: "pointer",
    fontSize: 12,
  } as const;

  const pillBtn = {
    padding: "8px 14px",
    background: c.btn,
    color: c.fg,
    border: "none",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
  } as const;

  return (
    <div
      data-llm={`Showing ${txs.length} loaded transactions${nextPage ? " (more pages available via the Charger plus button)" : ""}, ${markedCount} ticked/pointées and ${txs.length - markedCount} not. Income ${Math.round(income * 100) / 100}, expenses ${Math.round(expenses * 100) / 100}. The user can tick/untick a transaction by clicking its dot, rename it via the pencil on hover, change its category by clicking the category label, and exclude/re-include it from budget analysis via the ✕/↩ button on hover.`}
      style={{
        background: c.card,
        color: c.fg,
        padding: 20,
        borderRadius: 12,
        fontSize: 14,
        "--row-hover": c.hover,
      } as CSSProperties}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span>
          <strong style={{ fontSize: 16, fontWeight: 600 }}>{txs.length} transactions</strong>
          <span style={{ color: c.sub, fontSize: 12, marginLeft: 8 }}>{markedCount} ticked</span>
        </span>
        <span style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ color: c.pos }}>+{fmt(income, txs[0]?.currency ?? "EUR")}</span>
          {"  "}
          <span style={{ color: c.gold }}>{fmt(expenses, txs[0]?.currency ?? "EUR")}</span>
        </span>
      </div>

      {txs.length === 0 && <div style={{ color: c.sub }}>No transactions in this range.</div>}

      <div>
        {shown.map((t) => (
          <div
            key={t.id}
            className="tx-row"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "9px 8px",
              opacity: busy[t.id] ? 0.5 : 1,
            }}
          >
            <div style={{ display: "flex", gap: 10, minWidth: 0, flex: 1 }}>
              <button
                type="button"
                onClick={() => save(t.id, { marked: !t.marked }, { marked: !t.marked }, { marked: t.marked })}
                disabled={!!busy[t.id]}
                title={t.marked ? "Pointée — cliquer pour dépointer" : "Non pointée — cliquer pour pointer"}
                aria-label={t.marked ? "ticked" : "not ticked"}
                style={{
                  marginTop: 5,
                  flexShrink: 0,
                  width: 11,
                  height: 11,
                  padding: 0,
                  borderRadius: "50%",
                  background: t.marked ? c.gold : "transparent",
                  border: `1.5px solid ${t.marked ? c.gold : c.sub}`,
                  cursor: busy[t.id] ? "default" : "pointer",
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                {editingId === t.id ? (
                  <input
                    autoFocus
                    defaultValue={t.name}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") {
                        e.currentTarget.value = t.name;
                        e.currentTarget.blur();
                      }
                    }}
                    onBlur={(e) => {
                      setEditingId(null);
                      const name = e.currentTarget.value.trim();
                      if (name && name !== t.name) save(t.id, { name }, { name }, { name: t.name });
                    }}
                    style={{
                      font: "inherit",
                      color: c.fg,
                      background: "transparent",
                      border: `1px solid ${c.line}`,
                      borderRadius: 4,
                      padding: "0 4px",
                      width: "100%",
                    }}
                  />
                ) : (
                  <div style={{ display: "flex", gap: 6, alignItems: "baseline", minWidth: 0 }}>
                    <div
                      title={t.includeInAnalysis ? undefined : "Exclue de l'analyse budgétaire"}
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        textDecoration: t.includeInAnalysis ? undefined : "line-through",
                        color: t.includeInAnalysis ? undefined : c.sub,
                      }}
                    >
                      {t.name}
                    </div>
                    <button
                      type="button"
                      className="tx-edit"
                      onClick={() => setEditingId(t.id)}
                      disabled={!!busy[t.id]}
                      title="Renommer"
                      aria-label={`Rename ${t.name}`}
                      style={iconBtn}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="tx-edit"
                      onClick={() =>
                        save(
                          t.id,
                          { includeInAnalysis: !t.includeInAnalysis },
                          { includeInAnalysis: !t.includeInAnalysis },
                          { includeInAnalysis: t.includeInAnalysis },
                        )
                      }
                      disabled={!!busy[t.id]}
                      title={
                        t.includeInAnalysis
                          ? "Exclure de l'analyse budgétaire"
                          : "Réinclure dans l'analyse budgétaire"
                      }
                      aria-label={
                        t.includeInAnalysis
                          ? `Exclude ${t.name} from budget analysis`
                          : `Re-include ${t.name} in budget analysis`
                      }
                      style={iconBtn}
                    >
                      {t.includeInAnalysis ? "✕" : "↩"}
                    </button>
                  </div>
                )}
                <div style={{ color: c.sub, fontSize: 12 }}>
                  {t.date}
                  {" · "}
                  {pickerId === t.id ? (
                    <select
                      autoFocus
                      value={t.categoryId ?? ""}
                      disabled={!!busy[t.id]}
                      onBlur={() => setPickerId(null)}
                      onChange={(e) => {
                        setPickerId(null);
                        const categoryId = Number(e.currentTarget.value);
                        if (!categoryId || categoryId === t.categoryId) return;
                        const picked = categories.find((cat) => cat.id === categoryId);
                        save(
                          t.id,
                          { categoryId },
                          // categorizing also ticks, mirroring the tool's default
                          { categoryId, category: picked?.name ?? t.category, marked: true },
                          { categoryId: t.categoryId, category: t.category, marked: t.marked },
                        );
                      }}
                      style={{
                        font: "inherit",
                        fontSize: 12,
                        color: c.fg,
                        background: c.card,
                        border: `1px solid ${c.line}`,
                        borderRadius: 4,
                        maxWidth: 220,
                      }}
                    >
                      <option value="">
                        {categories.length
                          ? "Choisir…"
                          : cats.isError
                            ? "Erreur — rouvrir pour réessayer"
                            : "Chargement…"}
                      </option>
                      {mains.map((m) => {
                        const subs = categories.filter((cat) => cat.parentId === m.id);
                        return subs.length ? (
                          <optgroup key={m.id} label={pretty(m.name)}>
                            <option value={m.id}>{pretty(m.name)}</option>
                            {subs.map((s) => (
                              <option key={s.id} value={s.id}>
                                {pretty(s.name)}
                              </option>
                            ))}
                          </optgroup>
                        ) : (
                          <option key={m.id} value={m.id}>
                            {pretty(m.name)}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        // Explicit {} — omitting arguments entirely fails the
                        // server's z.object({}) input validation.
                        if (cats.isIdle || cats.isError) cats.callTool({});
                        setPickerId(t.id);
                      }}
                      disabled={!!busy[t.id]}
                      title="Changer la catégorie"
                      aria-label={`Change category of ${t.name}`}
                      style={{
                        ...iconBtn,
                        font: "inherit",
                        fontSize: 12,
                        textDecoration: "underline dotted",
                      }}
                    >
                      {t.category ? pretty(t.category) : "Catégoriser"}
                    </button>
                  )}
                  {t.account ? ` · ${t.account}` : ""}
                </div>
              </div>
            </div>
            <div
              style={{
                whiteSpace: "nowrap",
                color: t.value < 0 ? c.fg : c.pos,
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fmt(t.value, t.currency)}
            </div>
          </div>
        ))}
      </div>

      {!isFull && txs.length > shown.length && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <button onClick={() => setDisplayMode("fullscreen")} style={pillBtn}>
            Tout voir ({txs.length})
          </button>
        </div>
      )}
      {isFull && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {nextPage && (
            <button
              onClick={loadMore}
              disabled={more.isPending}
              style={{ ...pillBtn, cursor: more.isPending ? "default" : "pointer" }}
            >
              {more.isPending ? "Chargement…" : "Charger plus"}
            </button>
          )}
          <button onClick={() => setDisplayMode("inline")} style={pillBtn}>
            Réduire
          </button>
        </div>
      )}
    </div>
  );
}
