// Re-derives every roll in the browser from the revealed seed.
//
// The verification runs locally with WebCrypto and the same shared mapping the
// server used. A green row is one the player's own browser reproduced — not a
// claim we are making about ourselves.

import { BOARD_FAIRNESS_SPEC } from "@metricbase/shared";
import { useEffect, useState } from "react";

import { getFairness, type FairnessPayload } from "../../board/boardClient";
import { verifyFairness, type FairnessVerdict } from "../../board/verifyFairness";

export function FairnessPanel({ tableId, onClose }: { tableId: string; onClose: () => void }) {
  const [payload, setPayload] = useState<FairnessPayload | null>(null);
  const [verdict, setVerdict] = useState<FairnessVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await getFairness(tableId);
      if (!res.ok || !res.data) {
        setError(res.error ?? "Couldn't load the roll log.");
        return;
      }
      setPayload(res.data);
      try {
        setVerdict(await verifyFairness(res.data));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Verification failed.");
      }
    })();
  }, [tableId]);

  return (
    <div className="dd-modal" role="dialog" aria-label="Dice fairness">
      <div className="dd-modal-body dd-modal-wide">
        <h2>Check the dice</h2>

        <ol className="dd-spec">
          {BOARD_FAIRNESS_SPEC.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>

        {error && <p className="dd-warn">{error}</p>}

        {payload && !payload.serverSeed && (
          <p className="dd-muted">
            The secret seed stays sealed until this table ends — publishing it now would let anyone still playing
            work out every remaining roll. The commitment below is already fixed and cannot be changed.
          </p>
        )}

        {payload && (
          <dl className="dd-kv">
            <dt>Commitment (published before play)</dt>
            <dd className="dd-mono">{payload.serverSeedHash}</dd>
            {payload.serverSeed && (
              <>
                <dt>Revealed seed</dt>
                <dd className="dd-mono">{payload.serverSeed}</dd>
              </>
            )}
            <dt>Player seeds</dt>
            <dd>{payload.clientSeeds.map((s) => `${s.name}: ${s.seed || "—"}`).join(" · ")}</dd>
          </dl>
        )}

        {verdict?.ready && (
          <>
            <p className={verdict.hashMatches ? "dd-ok" : "dd-warn"}>
              {verdict.hashMatches
                ? "✓ The revealed seed hashes to the commitment published before anyone played."
                : "✗ The revealed seed does NOT match the published commitment."}
            </p>
            <p className={verdict.allRollsMatch ? "dd-ok" : "dd-warn"}>
              {verdict.allRollsMatch
                ? `✓ All ${verdict.rolls.length} rolls recomputed exactly in your browser.`
                : "✗ Some rolls did not recompute. Please report this table."}
            </p>
            <div className="dd-rolltable">
              {verdict.rolls.map((r) => (
                <span key={r.nonce} className={r.matches ? "dd-roll-ok" : "dd-roll-bad"}>
                  #{r.nonce} {r.published[0]}+{r.published[1]}
                </span>
              ))}
            </div>
          </>
        )}

        <button className="dd-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
