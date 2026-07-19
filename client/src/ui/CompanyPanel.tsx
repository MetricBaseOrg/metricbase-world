import {
  COMPANY_COLORS,
  COMPANY_CONTRACT_MAX_REWARD,
  COMPANY_CONTRACT_MIN_REWARD,
  COMPANY_CREATE_COST,
  COMPANY_EMBLEMS,
  COMPANY_MAX_DIVIDEND_RATE,
  COMPANY_MAX_REVENUE_SHARE,
  COMPANY_MAX_SALARY,
  COMPANY_NAME_MAX_LENGTH,
  COMPANY_TYPES,
  COMPANY_TYPE_INFO,
  COMPANY_TYPE_PERKS,
  COMPANY_WAREHOUSE_SLOTS,
  ITEMS,
  MAX_COMPANY_MEMBERS,
  companyCan,
  getItemBaseValue,
  getItemDefinition,
  getPipSellPrice,
  isSupplyItem,
  isValidCompanyName,
  sanitizeCompanyName,
  usedSlots,
  type CompanyContractKind,
  type CompanyDetail,
  type CompanyRank,
  type CompanyStatePayload,
  type CompanySummary,
  type CompanyType,
  type InventoryEntry,
} from "@metricbase/shared";
import { useEffect, useMemo, useState } from "react";
import { playSfx } from "../audio/soundEffects";
import { setUiTypingActive } from "../game/inputControl";
import { networkManager } from "../game/network";
import { useGameStore } from "../store/gameStore";
import { ItemIcon } from "./ItemIcon";

const RANK_LABEL: Record<CompanyRank, string> = {
  owner: "Owner",
  manager: "Manager",
  employee: "Employee",
  trainee: "Trainee",
};

const CONTRACT_KINDS: { kind: CompanyContractKind; label: string; emoji: string; needsItem: boolean }[] = [
  { kind: "supply", label: "Supply items", emoji: "📦", needsItem: true },
  { kind: "gather", label: "Gather", emoji: "🧺", needsItem: false },
  { kind: "harvest", label: "Harvest", emoji: "🌾", needsItem: false },
  { kind: "mobs", label: "Defeat mobs", emoji: "⚔️", needsItem: false },
];

function colorCss(color: number): string {
  return `#${(color >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
}

type Tab = "overview" | "roster" | "treasury" | "warehouse" | "contracts";

/**
 * Merchant Companies: player-owned businesses with a shared treasury + item
 * warehouse, ranks & salaries, automatic daily dividends, a revenue-share on
 * members' earnings, warehouse vendor sales, and an inbound contracts board.
 * Distinct from guilds — a player can belong to both. Opened from the ⚙️ menu.
 */
export function CompanyPanel() {
  const open = useGameStore((s) => s.companyOpen);
  const setOpen = useGameStore((s) => s.setCompanyOpen);
  const gold = useGameStore((s) => s.playerGold);
  const myName = useGameStore((s) => s.playerName);
  const [state, setState] = useState<CompanyStatePayload | null>(null);
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const offState = networkManager.onCompanyState((s) => {
      setState(s);
      setPending(false);
    });
    const offResult = networkManager.onCompanyResult((r) => {
      setPending(false);
      if (r.ok) {
        setError(null);
        setNotice(r.message ?? "Done!");
        playSfx("ui_open");
      } else {
        setError(r.error ?? "Something went wrong.");
      }
    });
    const offInv = networkManager.onInventoryState((inv) => setInventory(inv.items));
    return () => {
      offState();
      offResult();
      offInv();
    };
  }, []);

  useEffect(() => {
    if (open) {
      setNotice(null);
      setError(null);
      networkManager.requestCompanies();
    }
  }, [open]);

  const mine = state?.myCompany ?? null;
  const myRank = mine?.myRank ?? null;

  // Keep the active tab valid when membership changes.
  useEffect(() => {
    if (!mine && tab !== "overview" && tab !== "contracts") setTab("overview");
  }, [mine, tab]);

  if (!open) return null;

  const close = () => {
    playSfx("ui_close");
    setOpen(false);
  };

  const can = (perm: Parameters<typeof companyCan>[1]) => (myRank ? companyCan(myRank, perm) : false);

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "overview", label: "🏢 Overview", show: true },
    { id: "roster", label: "👥 Roster", show: !!mine },
    { id: "treasury", label: "🪙 Treasury", show: !!mine },
    { id: "warehouse", label: "📦 Warehouse", show: !!mine },
    { id: "contracts", label: "📋 Contracts", show: true },
  ];

  return (
    <div
      className="chibi-panel chibi-panel--floating chibi-anchor chibi-anchor--center"
      style={{ pointerEvents: "auto", maxWidth: 540, width: "94vw", maxHeight: "86vh", overflowY: "auto" }}
    >
      <div className="chibi-close-row">
        <div className="chibi-title chibi-title--sm chibi-sparkle-title">🏢 Merchant Companies</div>
        <button type="button" className="chibi-btn chibi-btn--ghost" onClick={close} aria-label="Close">
          ✕
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              className={`chibi-btn ${tab === t.id ? "chibi-btn--mint" : "chibi-btn--ghost"}`}
              style={{ flex: "1 1 auto", padding: "7px 8px", fontSize: "0.72rem" }}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
      </div>

      {notice && (
        <div className="chibi-card" style={{ marginTop: 8, padding: "8px 12px", fontSize: "0.78rem" }}>
          {notice}
        </div>
      )}
      {error && (
        <div className="chibi-card chibi-card--danger" style={{ marginTop: 8, padding: "8px 12px", fontSize: "0.78rem" }}>
          {error}
        </div>
      )}

      {!state && (
        <div className="chibi-text-muted" style={{ fontSize: "0.8rem", marginTop: 10 }}>
          Loading companies…
        </div>
      )}

      {state && tab === "overview" && (
        <OverviewTab
          state={state}
          myName={myName}
          gold={gold}
          pending={pending}
          setPending={setPending}
        />
      )}
      {state && mine && tab === "roster" && (
        <RosterTab company={mine} myName={myName} myRank={myRank!} can={can} pending={pending} setPending={setPending} />
      )}
      {state && mine && tab === "treasury" && (
        <TreasuryTab company={mine} myRank={myRank!} gold={gold} pending={pending} setPending={setPending} />
      )}
      {state && mine && tab === "warehouse" && (
        <WarehouseTab company={mine} inventory={inventory} can={can} pending={pending} setPending={setPending} />
      )}
      {state && tab === "contracts" && (
        <ContractsTab state={state} myName={myName} gold={gold} can={can} pending={pending} setPending={setPending} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview: header + stats when a member; directory + create form otherwise.
// ---------------------------------------------------------------------------

function CompanyBadge({ emblem, color, size = 34 }: { emblem: string; color: number; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        display: "grid",
        placeItems: "center",
        fontSize: size * 0.55,
        background: colorCss(color),
        border: "2px solid rgba(0,0,0,0.15)",
        flexShrink: 0,
      }}
    >
      {emblem}
    </div>
  );
}

function OverviewTab({
  state,
  myName,
  gold,
  pending,
  setPending,
}: {
  state: CompanyStatePayload;
  myName: string;
  gold: number;
  pending: boolean;
  setPending: (v: boolean) => void;
}) {
  const mine = state.myCompany;
  const [name, setName] = useState("");
  const [emblem, setEmblem] = useState<string>(COMPANY_EMBLEMS[0]);
  const [color, setColor] = useState<number>(COMPANY_COLORS[0]);
  const [type, setType] = useState<CompanyType>("merchant");

  if (mine) {
    const info = COMPANY_TYPE_INFO[mine.companyType];
    const rev = mine.stats.revenue;
    const totalRev = rev.skim + rev.vendor + rev.contracts + rev.deposits + rev.shares;
    const topContrib = Object.entries(mine.stats.contrib)
      .map(([n, c]) => ({ name: n, total: c.gold + c.itemsValue + c.skim }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    return (
      <div style={{ marginTop: 10 }}>
        <div className="chibi-card" style={{ padding: "12px", display: "flex", gap: 12, alignItems: "center" }}>
          <CompanyBadge emblem={mine.emblem} color={mine.color} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{mine.name}</div>
            <div className="chibi-text-muted" style={{ fontSize: "0.72rem" }}>
              {info.icon} {info.label} · {mine.memberCount}/{MAX_COMPANY_MEMBERS} members · ⭐ {mine.reputation} rep
            </div>
            <div style={{ fontSize: "0.68rem", marginTop: 3, color: "var(--chibi-gold-deep)" }}>
              {COMPANY_TYPE_PERKS[mine.companyType].blurb}
            </div>
          </div>
        </div>

        <div className="chibi-card" style={{ padding: "10px 12px", marginTop: 8 }}>
          <div className="chibi-label">📢 Announcement</div>
          <div style={{ fontSize: "0.8rem", marginTop: 4, whiteSpace: "pre-wrap" }}>
            {mine.motd || <span className="chibi-text-muted">No announcement set.</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <div className="chibi-card" style={{ flex: 1, padding: "10px 12px" }}>
            <div className="chibi-label">🪙 Treasury</div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#b8860b" }}>{mine.treasury.toLocaleString()}g</div>
          </div>
          <div className="chibi-card" style={{ flex: 1, padding: "10px 12px" }}>
            <div className="chibi-label">📈 Lifetime revenue</div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{totalRev.toLocaleString()}g</div>
          </div>
        </div>

        <div className="chibi-card" style={{ padding: "10px 12px", marginTop: 8 }}>
          <div className="chibi-label">Revenue by source</div>
          <div style={{ fontSize: "0.74rem", marginTop: 4, lineHeight: 1.7 }}>
            <div>Revenue-share skim: <b>{rev.skim.toLocaleString()}g</b></div>
            <div>Warehouse vendor sales: <b>{rev.vendor.toLocaleString()}g</b></div>
            <div>Completed contracts: <b>{rev.contracts.toLocaleString()}g</b></div>
            <div>Share-trade fees: <b>{rev.shares.toLocaleString()}g</b></div>
            <div>Member deposits: <b>{rev.deposits.toLocaleString()}g</b></div>
            <div style={{ marginTop: 4 }}>
              Paid out: <b>{mine.stats.paidOut.salaries.toLocaleString()}g</b> salaries ·{" "}
              <b>{mine.stats.paidOut.dividends.toLocaleString()}g</b> dividends
            </div>
            <div>Contracts completed: <b>{mine.stats.contractsCompleted}</b></div>
          </div>
        </div>

        {topContrib.length > 0 && (
          <div className="chibi-card" style={{ padding: "10px 12px", marginTop: 8 }}>
            <div className="chibi-label">🏆 Top contributors</div>
            <div style={{ fontSize: "0.74rem", marginTop: 4, lineHeight: 1.7 }}>
              {topContrib.map((c) => (
                <div key={c.name} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{c.name === myName ? `${c.name} (you)` : c.name}</span>
                  <b>{Math.round(c.total).toLocaleString()}g</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Companyless — create form + directory.
  const hasRequest = state.myRequestCompanyId !== null;
  const canAfford = gold >= COMPANY_CREATE_COST;
  const nameOk = isValidCompanyName(sanitizeCompanyName(name));
  const canCreate = canAfford && nameOk && !pending;

  const create = () => {
    playSfx("ui_click");
    setPending(true);
    networkManager.sendCompanyCreate(sanitizeCompanyName(name), emblem, color, type);
  };
  const apply = (id: string) => {
    playSfx("ui_click");
    setPending(true);
    networkManager.sendCompanyJoin(id);
  };
  const cancelReq = () => {
    playSfx("ui_click");
    setPending(true);
    networkManager.sendCompanyCancelRequest();
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div className="chibi-card" style={{ padding: "12px" }}>
        <div className="chibi-label">Found a company</div>
        <input
          className="chibi-input"
          style={{ width: "100%", marginTop: 6 }}
          placeholder="Company name"
          maxLength={COMPANY_NAME_MAX_LENGTH}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setUiTypingActive(true)}
          onBlur={() => setUiTypingActive(false)}
        />

        <div className="chibi-label" style={{ marginTop: 10 }}>Emblem</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          {COMPANY_EMBLEMS.map((e) => (
            <button
              key={e}
              type="button"
              className={`chibi-btn ${emblem === e ? "chibi-btn--mint" : "chibi-btn--ghost"}`}
              style={{ padding: "4px 8px", fontSize: "1.05rem" }}
              onClick={() => setEmblem(e)}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="chibi-label" style={{ marginTop: 10 }}>Colour</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {COMPANY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Colour ${colorCss(c)}`}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: colorCss(c),
                border: color === c ? "3px solid #2a1d12" : "2px solid rgba(0,0,0,0.15)",
                cursor: "pointer",
              }}
            />
          ))}
        </div>

        <div className="chibi-label" style={{ marginTop: 10 }}>Type</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          {COMPANY_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`chibi-btn ${type === t ? "chibi-btn--mint" : "chibi-btn--ghost"}`}
              style={{ padding: "6px 8px", fontSize: "0.7rem" }}
              onClick={() => setType(t)}
            >
              {COMPANY_TYPE_INFO[t].icon} {COMPANY_TYPE_INFO[t].label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <CompanyBadge emblem={emblem} color={color} />
          <div className="chibi-text-muted" style={{ fontSize: "0.7rem", flex: 1 }}>
            <b>Member perk:</b> {COMPANY_TYPE_PERKS[type].blurb}.
            <br />
            Focus: {COMPANY_TYPE_INFO[type].focusStat}. Founding costs {COMPANY_CREATE_COST.toLocaleString()}g (you have{" "}
            {gold.toLocaleString()}g).
          </div>
        </div>

        <button
          type="button"
          className="chibi-btn chibi-btn--gold"
          style={{ width: "100%", marginTop: 10, padding: "9px 10px" }}
          disabled={!canCreate}
          onClick={create}
        >
          Found · 🪙 {COMPANY_CREATE_COST.toLocaleString()}
        </button>
        {!canAfford && (
          <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 4 }}>
            You need {(COMPANY_CREATE_COST - gold).toLocaleString()} more gold.
          </div>
        )}
      </div>

      <div className="chibi-label" style={{ margin: "14px 0 4px" }}>Company directory</div>
      {state.companies.length === 0 && (
        <div className="chibi-text-muted" style={{ fontSize: "0.78rem" }}>
          No companies yet — found the first one!
        </div>
      )}
      {state.companies.map((c: CompanySummary) => {
        const requestedHere = state.myRequestCompanyId === c.id;
        return (
          <div key={c.id} className="chibi-card" style={{ padding: "10px 12px", marginTop: 6, display: "flex", gap: 10, alignItems: "center" }}>
            <CompanyBadge emblem={c.emblem} color={c.color} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{c.name}</div>
              <div className="chibi-text-muted" style={{ fontSize: "0.68rem" }}>
                {COMPANY_TYPE_INFO[c.companyType].label} · {c.memberCount}/{MAX_COMPANY_MEMBERS} · ⭐ {c.reputation}
              </div>
            </div>
            {requestedHere ? (
              <button type="button" className="chibi-btn chibi-btn--secondary" style={{ padding: "6px 10px", fontSize: "0.72rem" }} disabled={pending} onClick={cancelReq}>
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className="chibi-btn chibi-btn--mint"
                style={{ padding: "6px 10px", fontSize: "0.72rem" }}
                disabled={pending || hasRequest || c.memberCount >= MAX_COMPANY_MEMBERS}
                onClick={() => apply(c.id)}
              >
                {c.memberCount >= MAX_COMPANY_MEMBERS ? "Full" : "Apply"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

function RosterTab({
  company,
  myName,
  myRank,
  can,
  pending,
  setPending,
}: {
  company: CompanyDetail;
  myName: string;
  myRank: CompanyRank;
  can: (perm: Parameters<typeof companyCan>[1]) => boolean;
  pending: boolean;
  setPending: (v: boolean) => void;
}) {
  const rankOf = (name: string): CompanyRank =>
    name === company.ownerName
      ? "owner"
      : company.managers.includes(name)
        ? "manager"
        : company.trainees.includes(name)
          ? "trainee"
          : "employee";

  const act = (fn: () => void) => {
    playSfx("ui_click");
    setPending(true);
    fn();
  };

  const sorted = [...company.members].sort((a, b) => {
    const order: CompanyRank[] = ["owner", "manager", "employee", "trainee"];
    return order.indexOf(rankOf(a)) - order.indexOf(rankOf(b)) || a.localeCompare(b);
  });

  return (
    <div style={{ marginTop: 10 }}>
      {company.joinRequests.length > 0 && can("approveMembers") && (
        <>
          <div className="chibi-label">Pending applications</div>
          {company.joinRequests.map((applicant) => (
            <div key={applicant} className="chibi-card" style={{ padding: "8px 12px", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, fontSize: "0.8rem" }}>{applicant}</span>
              <button type="button" className="chibi-btn chibi-btn--mint" style={{ padding: "5px 9px", fontSize: "0.7rem" }} disabled={pending} onClick={() => act(() => networkManager.sendCompanyApprove(applicant))}>
                Approve
              </button>
              <button type="button" className="chibi-btn chibi-btn--secondary" style={{ padding: "5px 9px", fontSize: "0.7rem" }} disabled={pending} onClick={() => act(() => networkManager.sendCompanyDeny(applicant))}>
                Deny
              </button>
            </div>
          ))}
        </>
      )}

      <div className="chibi-label" style={{ margin: "12px 0 4px" }}>Members ({company.members.length})</div>
      {sorted.map((name) => {
        const rank = rankOf(name);
        const isMe = name === myName;
        const salary = company.salaries[name] ?? 0;
        // Managers can act on trainees/employees; owner can act on anyone but self.
        const canManage =
          !isMe &&
          rank !== "owner" &&
          (myRank === "owner" || (myRank === "manager" && rank !== "manager"));
        return (
          <div key={name} className="chibi-card" style={{ padding: "8px 12px", marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>
                  {name}
                  {isMe ? " (you)" : ""}
                </div>
                <div className="chibi-text-muted" style={{ fontSize: "0.68rem" }}>
                  {RANK_LABEL[rank]}
                  {salary > 0 ? ` · 🪙 ${salary}/day salary` : ""}
                </div>
              </div>
              {canManage && (
                <button type="button" className="chibi-btn chibi-btn--secondary" style={{ padding: "5px 8px", fontSize: "0.68rem" }} disabled={pending} onClick={() => act(() => networkManager.sendCompanyKick(name))}>
                  Kick
                </button>
              )}
            </div>
            {canManage && (
              <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                {(["manager", "employee", "trainee"] as CompanyRank[]).map((r) => {
                  // A manager may only toggle trainee<->employee.
                  const allowed = myRank === "owner" || r !== "manager";
                  if (!allowed) return null;
                  return (
                    <button
                      key={r}
                      type="button"
                      className={`chibi-btn ${rank === r ? "chibi-btn--mint" : "chibi-btn--ghost"}`}
                      style={{ padding: "4px 8px", fontSize: "0.66rem" }}
                      disabled={pending || rank === r}
                      onClick={() => act(() => networkManager.sendCompanySetRank(name, r))}
                    >
                      {RANK_LABEL[r]}
                    </button>
                  );
                })}
                {myRank === "owner" && <SalaryEditor name={name} current={salary} pending={pending} onSet={(g) => act(() => networkManager.sendCompanySetSalary(name, g))} />}
              </div>
            )}
          </div>
        );
      })}

      <button type="button" className="chibi-btn chibi-btn--danger" style={{ width: "100%", marginTop: 12, padding: "8px 10px" }} disabled={pending} onClick={() => act(() => networkManager.sendCompanyLeave())}>
        {myRank === "owner" ? "Leave (hands over ownership)" : "Leave company"}
      </button>
    </div>
  );
}

function SalaryEditor({ name, current, pending, onSet }: { name: string; current: number; pending: boolean; onSet: (g: number) => void }) {
  const [val, setVal] = useState(String(current));
  useEffect(() => setVal(String(current)), [current, name]);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input
        className="chibi-input"
        style={{ width: 64, padding: "3px 6px", fontSize: "0.66rem" }}
        inputMode="numeric"
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ""))}
        onFocus={() => setUiTypingActive(true)}
        onBlur={() => setUiTypingActive(false)}
      />
      <button
        type="button"
        className="chibi-btn chibi-btn--gold"
        style={{ padding: "4px 8px", fontSize: "0.66rem" }}
        disabled={pending}
        onClick={() => onSet(Math.min(COMPANY_MAX_SALARY, Math.floor(Number(val) || 0)))}
      >
        Set 🪙/day
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Treasury
// ---------------------------------------------------------------------------

function TreasuryTab({
  company,
  myRank,
  gold,
  pending,
  setPending,
}: {
  company: CompanyDetail;
  myRank: CompanyRank;
  gold: number;
  pending: boolean;
  setPending: (v: boolean) => void;
}) {
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [share, setShare] = useState(Math.round(company.revenueShare * 100));
  const [dividend, setDividend] = useState(Math.round(company.dividendRate * 100));
  const isOwner = myRank === "owner";

  useEffect(() => {
    setShare(Math.round(company.revenueShare * 100));
    setDividend(Math.round(company.dividendRate * 100));
  }, [company.revenueShare, company.dividendRate]);

  const act = (fn: () => void) => {
    playSfx("ui_click");
    setPending(true);
    fn();
  };

  const maxSharePct = Math.round(COMPANY_MAX_REVENUE_SHARE * 100);
  const maxDivPct = Math.round(COMPANY_MAX_DIVIDEND_RATE * 100);

  return (
    <div style={{ marginTop: 10 }}>
      <div className="chibi-card" style={{ padding: "12px" }}>
        <div className="chibi-label">🪙 Treasury balance</div>
        <div style={{ fontWeight: 800, fontSize: "1.3rem", color: "#b8860b" }}>{company.treasury.toLocaleString()}g</div>
        <div className="chibi-text-muted" style={{ fontSize: "0.68rem", marginTop: 2 }}>
          Last payout: {company.lastPayoutDay ?? "never"}
        </div>
      </div>

      <div className="chibi-card" style={{ padding: "10px 12px", marginTop: 8 }}>
        <div className="chibi-label">Deposit gold</div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input className="chibi-input" style={{ flex: 1 }} inputMode="numeric" placeholder="Amount" value={depositAmt}
            onChange={(e) => setDepositAmt(e.target.value.replace(/[^0-9]/g, ""))}
            onFocus={() => setUiTypingActive(true)} onBlur={() => setUiTypingActive(false)} />
          <button type="button" className="chibi-btn chibi-btn--gold" style={{ padding: "6px 12px" }} disabled={pending || !depositAmt}
            onClick={() => { act(() => networkManager.sendCompanyDeposit(Math.min(gold, Math.floor(Number(depositAmt) || 0)))); setDepositAmt(""); }}>
            Deposit
          </button>
        </div>
        <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 3 }}>You have {gold.toLocaleString()}g.</div>
      </div>

      {isOwner && (
        <div className="chibi-card" style={{ padding: "10px 12px", marginTop: 8 }}>
          <div className="chibi-label">Withdraw gold (owner)</div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input className="chibi-input" style={{ flex: 1 }} inputMode="numeric" placeholder="Amount" value={withdrawAmt}
              onChange={(e) => setWithdrawAmt(e.target.value.replace(/[^0-9]/g, ""))}
              onFocus={() => setUiTypingActive(true)} onBlur={() => setUiTypingActive(false)} />
            <button type="button" className="chibi-btn chibi-btn--secondary" style={{ padding: "6px 12px" }} disabled={pending || !withdrawAmt}
              onClick={() => { act(() => networkManager.sendCompanyWithdraw(Math.floor(Number(withdrawAmt) || 0))); setWithdrawAmt(""); }}>
              Withdraw
            </button>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="chibi-card" style={{ padding: "10px 12px", marginTop: 8 }}>
          <div className="chibi-label">Payout rates (owner)</div>
          <label style={{ display: "block", fontSize: "0.74rem", marginTop: 8 }}>
            Revenue share on members' earnings: <b>{share}%</b> (max {maxSharePct}%)
            <input type="range" min={0} max={maxSharePct} value={share} style={{ width: "100%" }} onChange={(e) => setShare(Number(e.target.value))} />
          </label>
          <label style={{ display: "block", fontSize: "0.74rem", marginTop: 6 }}>
            Daily dividend rate: <b>{dividend}%</b> of treasury (max {maxDivPct}%)
            <input type="range" min={0} max={maxDivPct} value={dividend} style={{ width: "100%" }} onChange={(e) => setDividend(Number(e.target.value))} />
          </label>
          <button type="button" className="chibi-btn chibi-btn--mint" style={{ width: "100%", marginTop: 8, padding: "7px 10px" }} disabled={pending}
            onClick={() => act(() => networkManager.sendCompanySetRates(share / 100, dividend / 100))}>
            Save rates
          </button>
          <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 6 }}>
            Salaries + dividends are paid automatically once per day. Members must have gathered, harvested or fought
            within the last few days to receive dividends.
          </div>
        </div>
      )}

      {isOwner && (
        <MotdEditor motd={company.motd} pending={pending} onSet={(m) => act(() => networkManager.sendCompanySetMotd(m))} />
      )}
    </div>
  );
}

function MotdEditor({ motd, pending, onSet }: { motd: string; pending: boolean; onSet: (m: string) => void }) {
  const [val, setVal] = useState(motd);
  useEffect(() => setVal(motd), [motd]);
  return (
    <div className="chibi-card" style={{ padding: "10px 12px", marginTop: 8 }}>
      <div className="chibi-label">📢 Announcement</div>
      <textarea
        className="chibi-input"
        style={{ width: "100%", marginTop: 4, minHeight: 56, resize: "vertical" }}
        maxLength={200}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onFocus={() => setUiTypingActive(true)}
        onBlur={() => setUiTypingActive(false)}
      />
      <button type="button" className="chibi-btn chibi-btn--gold" style={{ width: "100%", marginTop: 6, padding: "7px 10px" }} disabled={pending} onClick={() => onSet(val)}>
        Post announcement
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Warehouse
// ---------------------------------------------------------------------------

function WarehouseTab({
  company,
  inventory,
  can,
  pending,
  setPending,
}: {
  company: CompanyDetail;
  inventory: InventoryEntry[];
  can: (perm: Parameters<typeof companyCan>[1]) => boolean;
  pending: boolean;
  setPending: (v: boolean) => void;
}) {
  const [contribItem, setContribItem] = useState<string>("");
  const [contribQty, setContribQty] = useState("1");
  const slots = usedSlots(company.warehouse);

  const contributable = useMemo(
    () => inventory.filter((e) => ITEMS[e.itemId]).sort((a, b) => getItemDefinition(a.itemId).name.localeCompare(getItemDefinition(b.itemId).name)),
    [inventory],
  );
  useEffect(() => {
    if (!contribItem && contributable.length > 0) setContribItem(contributable[0].itemId);
  }, [contributable, contribItem]);

  const act = (fn: () => void) => {
    playSfx("ui_click");
    setPending(true);
    fn();
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div className="chibi-card" style={{ padding: "10px 12px" }}>
        <div className="chibi-label">Contribute from your bag</div>
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <select className="chibi-input" style={{ flex: 1 }} value={contribItem} onChange={(e) => setContribItem(e.target.value)}>
            {contributable.length === 0 && <option value="">Nothing to contribute</option>}
            {contributable.map((e) => (
              <option key={e.itemId} value={e.itemId}>
                {getItemDefinition(e.itemId).name} ×{e.quantity}
              </option>
            ))}
          </select>
          <input className="chibi-input" style={{ width: 64 }} inputMode="numeric" value={contribQty}
            onChange={(e) => setContribQty(e.target.value.replace(/[^0-9]/g, ""))}
            onFocus={() => setUiTypingActive(true)} onBlur={() => setUiTypingActive(false)} />
          <button type="button" className="chibi-btn chibi-btn--mint" style={{ padding: "6px 12px" }}
            disabled={pending || !contribItem}
            onClick={() => act(() => networkManager.sendCompanyContribute(contribItem, Math.max(1, Math.floor(Number(contribQty) || 0))))}>
            Add
          </button>
        </div>
      </div>

      <div className="chibi-label" style={{ margin: "12px 0 4px" }}>
        Warehouse ({slots}/{COMPANY_WAREHOUSE_SLOTS} slots)
      </div>
      {company.warehouse.length === 0 && (
        <div className="chibi-text-muted" style={{ fontSize: "0.78rem" }}>The warehouse is empty.</div>
      )}
      {company.warehouse.map((e) => {
        const pip = getPipSellPrice(e.itemId);
        return (
          <div key={e.itemId} className="chibi-card" style={{ padding: "8px 10px", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
            <ItemIcon itemId={e.itemId} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 700 }}>{getItemDefinition(e.itemId).name} ×{e.quantity}</div>
              <div className="chibi-text-muted" style={{ fontSize: "0.66rem" }}>
                base {Math.round(getItemBaseValue(e.itemId)).toLocaleString()}g{pip > 0 ? ` · Rudi ~${pip}g ea` : " · Rudi won't buy"}
              </div>
            </div>
            {can("withdrawItems") && (
              <button type="button" className="chibi-btn chibi-btn--ghost" style={{ padding: "5px 8px", fontSize: "0.66rem" }} disabled={pending}
                onClick={() => act(() => networkManager.sendCompanyTake(e.itemId, e.quantity))}>
                Take
              </button>
            )}
            {can("sellWarehouse") && pip > 0 && (
              <button type="button" className="chibi-btn chibi-btn--gold" style={{ padding: "5px 8px", fontSize: "0.66rem" }} disabled={pending}
                onClick={() => act(() => networkManager.sendCompanySell(e.itemId, e.quantity))}>
                Sell
              </button>
            )}
          </div>
        );
      })}
      {can("sellWarehouse") && (
        <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 6 }}>
          Selling sends items to Rudi at the current price — proceeds go straight to the treasury.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

function ContractsTab({
  state,
  myName: _,
  gold,
  can,
  pending,
  setPending,
}: {
  state: CompanyStatePayload;
  myName: string;
  gold: number;
  can: (perm: Parameters<typeof companyCan>[1]) => boolean;
  pending: boolean;
  setPending: (v: boolean) => void;
}) {
  const mine = state.myCompany;
  const [targetId, setTargetId] = useState("");
  const [kind, setKind] = useState<CompanyContractKind>("supply");
  const [itemId, setItemId] = useState<string>(() => Object.values(ITEMS).find((d) => isSupplyItem(d.id))?.id ?? "");
  const [qty, setQty] = useState("10");
  const [reward, setReward] = useState("200");

  const supplyItems = useMemo(
    () => Object.values(ITEMS).filter((d) => isSupplyItem(d.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  // Directory of companies you can post to (any but your own).
  const postable = state.companies.filter((c) => c.id !== mine?.id);
  useEffect(() => {
    if (!targetId && postable.length > 0) setTargetId(postable[0].id);
  }, [postable, targetId]);

  const act = (fn: () => void) => {
    playSfx("ui_click");
    setPending(true);
    fn();
  };
  const kindDef = CONTRACT_KINDS.find((k) => k.kind === kind)!;
  const rewardNum = Math.floor(Number(reward) || 0);
  const canPost = !!targetId && rewardNum >= COMPANY_CONTRACT_MIN_REWARD && rewardNum <= gold && !pending;

  const myContracts = mine?.contracts ?? [];
  const myPosted = state.myPostedContracts;

  return (
    <div style={{ marginTop: 10 }}>
      {mine && (
        <>
          <div className="chibi-label">Contracts for {mine.name}</div>
          {myContracts.length === 0 && (
            <div className="chibi-text-muted" style={{ fontSize: "0.78rem" }}>No contracts yet.</div>
          )}
          {myContracts.map((c) => {
            const pct = c.qty > 0 ? Math.round((c.progress / c.qty) * 100) : 0;
            const kd = CONTRACT_KINDS.find((k) => k.kind === c.kind)!;
            return (
              <div key={c.id} className="chibi-card" style={{ padding: "10px 12px", marginTop: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: "1.2rem" }}>{kd.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.8rem" }}>
                      {kd.label} {c.qty}× {c.itemId ? getItemDefinition(c.itemId).name : ""}
                    </div>
                    <div className="chibi-text-muted" style={{ fontSize: "0.66rem" }}>
                      by {c.posterName} · pays <b style={{ color: "#b8860b" }}>{c.rewardGold.toLocaleString()}g</b> · {c.status} · {c.progress}/{c.qty}
                    </div>
                    {c.status === "accepted" && (
                      <div style={{ marginTop: 4, height: 7, borderRadius: 999, background: "#f0e4c8", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "#e0a92e" }} />
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {c.status === "open" && can("acceptContracts") && (
                      <button type="button" className="chibi-btn chibi-btn--mint" style={{ padding: "5px 9px", fontSize: "0.68rem" }} disabled={pending} onClick={() => act(() => networkManager.sendCompanyContractAccept(c.id))}>
                        Accept
                      </button>
                    )}
                    {c.status === "accepted" && c.kind === "supply" && can("acceptContracts") && (
                      <button type="button" className="chibi-btn chibi-btn--gold" style={{ padding: "5px 9px", fontSize: "0.68rem" }} disabled={pending} onClick={() => act(() => networkManager.sendCompanyContractDeliver(c.id, c.qty - c.progress))}>
                        Deliver
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      <div className="chibi-label" style={{ margin: "14px 0 4px" }}>Post a contract to a company</div>
      <div className="chibi-card" style={{ padding: "10px 12px" }}>
        <select className="chibi-input" style={{ width: "100%" }} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          {postable.length === 0 && <option value="">No other companies to hire</option>}
          {postable.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {CONTRACT_KINDS.map((k) => (
            <button key={k.kind} type="button" className={`chibi-btn ${kind === k.kind ? "chibi-btn--mint" : "chibi-btn--ghost"}`} style={{ padding: "6px 9px", fontSize: "0.7rem" }} onClick={() => setKind(k.kind)}>
              {k.emoji} {k.label}
            </button>
          ))}
        </div>

        {kindDef.needsItem && (
          <select className="chibi-input" style={{ width: "100%", marginTop: 8 }} value={itemId} onChange={(e) => setItemId(e.target.value)}>
            {supplyItems.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <label style={{ flex: 1, fontSize: "0.72rem" }}>
            Quantity
            <input className="chibi-input" style={{ width: "100%", marginTop: 4 }} inputMode="numeric" value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))}
              onFocus={() => setUiTypingActive(true)} onBlur={() => setUiTypingActive(false)} />
          </label>
          <label style={{ flex: 1, fontSize: "0.72rem" }}>
            Reward (gold)
            <input className="chibi-input" style={{ width: "100%", marginTop: 4 }} inputMode="numeric" value={reward}
              onChange={(e) => setReward(e.target.value.replace(/[^0-9]/g, ""))}
              onFocus={() => setUiTypingActive(true)} onBlur={() => setUiTypingActive(false)} />
          </label>
        </div>

        <div className="chibi-text-muted" style={{ fontSize: "0.66rem", marginTop: 6 }}>
          The {rewardNum.toLocaleString()}g reward is escrowed from your gold now (refunded if you cancel) and paid to the
          company's treasury on completion. Reward {COMPANY_CONTRACT_MIN_REWARD}–{COMPANY_CONTRACT_MAX_REWARD.toLocaleString()}g. You have {gold.toLocaleString()}g.
        </div>
        <button type="button" className="chibi-btn chibi-btn--gold" style={{ width: "100%", marginTop: 8, padding: "8px 10px" }}
          disabled={!canPost}
          onClick={() => act(() => networkManager.sendCompanyContractPost(targetId, kind, kindDef.needsItem ? itemId : null, Math.max(1, Math.floor(Number(qty) || 0)), rewardNum))}>
          📋 Post contract ({rewardNum.toLocaleString()}g escrow)
        </button>
      </div>

      {myPosted.length > 0 && (
        <>
          <div className="chibi-label" style={{ margin: "14px 0 4px" }}>Your posted contracts</div>
          {myPosted.map((c) => (
            <div key={c.id} className="chibi-card" style={{ padding: "8px 12px", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: "0.74rem" }}>
                {CONTRACT_KINDS.find((k) => k.kind === c.kind)!.emoji} {c.qty}× {c.itemId ? getItemDefinition(c.itemId).name : c.kind} · {c.rewardGold.toLocaleString()}g · {c.status}
                {c.status === "accepted" ? ` · ${c.progress}/${c.qty}` : ""}
              </div>
              {(c.status === "open" || c.status === "accepted") && (
                <button type="button" className="chibi-btn chibi-btn--secondary" style={{ padding: "5px 9px", fontSize: "0.68rem" }} disabled={pending} onClick={() => act(() => networkManager.sendCompanyContractCancel(c.id))}>
                  Cancel
                </button>
              )}
              {c.status === "completed" && c.itemsToCollect > 0 && (
                <button type="button" className="chibi-btn chibi-btn--gold" style={{ padding: "5px 9px", fontSize: "0.68rem" }} disabled={pending} onClick={() => act(() => networkManager.sendCompanyContractCollect(c.id))}>
                  📦 Collect {c.itemsToCollect}
                </button>
              )}
              {c.status === "completed" && c.itemsToCollect <= 0 && (
                <button type="button" className="chibi-btn chibi-btn--ghost" style={{ padding: "5px 9px", fontSize: "0.68rem" }} disabled={pending} onClick={() => act(() => networkManager.sendCompanyContractDismiss(c.id))}>
                  ✓ Dismiss
                </button>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
