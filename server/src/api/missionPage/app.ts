// The Mission Center console markup. Static shell only — every number is
// fetched from /api/mission/* by MISSION_APP_SCRIPT, so the same data is
// available to curl when the UI is the last thing you want to debug.

import { MISSION_CSS } from "./styles.js";
import { MISSION_APP_SCRIPT } from "./appScript.js";

export const MISSION_APP_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Mission Center — MetricBase World</title>
<style>${MISSION_CSS}</style>
</head>
<body>

<!-- Forced first-login password change. Blocks the console entirely: the
     bootstrap password is shared out of band and must not survive first use. -->
<div class="overlay hidden" id="pwGate">
  <form class="modal" id="pwForm" style="max-width:420px;">
    <h2>Set a new password</h2>
    <p class="muted small">The bootstrap password works once. Nothing else loads until this is done.</p>
    <label for="pwCurrent">Current password</label>
    <input id="pwCurrent" type="password" autocomplete="current-password" required />
    <label for="pwNext">New password</label>
    <input id="pwNext" type="password" autocomplete="new-password" required />
    <p class="muted small">At least 12 characters, upper and lower case, and a number.</p>
    <div class="row" style="margin-top:12px;">
      <button class="btn primary" type="submit">Save and continue</button>
    </div>
    <div class="err" id="pwErr"></div>
  </form>
</div>

<div class="wrap" id="app">
  <div class="topbar">
    <h1>🛰️ Mission Center</h1>
    <span class="badge info" id="verBadge">—</span>
    <span class="spacer"></span>
    <span class="muted small" id="whoami">—</span>
    <button class="btn tiny" id="changePw">Change password</button>
    <button class="btn tiny" id="logout">Sign out</button>
  </div>

  <div class="tabs">
    <button class="tab active" data-tab="ops">🚀 Ops</button>
    <button class="tab" data-tab="game">🎮 Game</button>
    <button class="tab" data-tab="x">𝕏 Growth</button>
    <button class="tab" data-tab="admin">🛡️ Admin</button>
  </div>

  <!-- ============================ OPS ============================ -->
  <section data-panel="ops">
    <div id="pauseNote"></div>
    <div id="opsBanners"></div>
    <div class="grid" id="opsTiles"></div>

    <div class="panel">
      <h2>Server deploys <span class="muted small" id="railwayHint"></span></h2>
      <div class="scroll-x"><table id="railwayTable"><tbody></tbody></table></div>
    </div>

    <div class="panel">
      <h2>Client deploys <span class="muted small" id="vercelHint"></span></h2>
      <div class="scroll-x"><table id="vercelTable"><tbody></tbody></table></div>
    </div>

    <div class="panel">
      <h2>Logs</h2>
      <div class="row" style="margin-bottom:10px;">
        <select id="logSource" style="width:auto;">
          <option value="local">In-process</option>
          <option value="railway">Railway tail</option>
        </select>
        <select id="logLevel" style="width:auto;">
          <option value="all">All levels</option>
          <option value="error">Errors</option>
          <option value="warn">Warnings</option>
          <option value="log">Info</option>
        </select>
        <input id="logSearch" placeholder="Filter text…" style="max-width:260px;" />
        <button class="btn" id="logRefresh">Refresh</button>
        <label class="row small" style="margin:0;text-transform:none;letter-spacing:0;">
          <input type="checkbox" id="logAuto" style="width:auto;" checked /> auto
        </label>
      </div>
      <div class="logbox mono" id="logBox"></div>
    </div>
  </section>

  <!-- ============================ GAME ============================ -->
  <section data-panel="game" class="hidden">
    <div class="grid" id="gameTiles"></div>
    <div class="panel">
      <h2>Retention</h2>
      <div id="retention" class="muted small">—</div>
    </div>
    <div class="panel">
      <h2>Economy</h2>
      <div class="grid" id="econTiles"></div>
    </div>
    <div class="panel">
      <h2>$BASE</h2>
      <div class="grid" id="baseTiles"></div>
    </div>
  </section>

  <!-- ============================ X ============================ -->
  <section data-panel="x" class="hidden">
    <div class="panel">
      <h2>Conversion <span class="muted small">— impressions are not the scoreboard</span></h2>
      <div class="grid" id="xTotals"></div>
      <div id="xThin" class="muted small" style="margin-top:8px;"></div>
    </div>

    <div class="panel">
      <h2>What actually works</h2>
      <div class="row" style="margin-bottom:8px;">
        <select id="evalGroup" style="width:auto;">
          <option value="byFormat">By format</option>
          <option value="bySlotKind">By slot</option>
          <option value="byWeekday">By weekday</option>
        </select>
      </div>
      <div class="scroll-x"><table id="evalTable"><tbody></tbody></table></div>
    </div>

    <div class="panel">
      <h2>Calendar</h2>
      <div class="row" style="margin-bottom:10px;">
        <select id="xFilter" style="width:auto;">
          <option value="all">All posts</option>
          <option value="pipeline">Pipeline (not posted)</option>
          <option value="idea">Ideas</option>
          <option value="drafted">Drafted</option>
          <option value="scheduled">Scheduled</option>
          <option value="posted">Posted</option>
        </select>
        <button class="btn" id="xNew">New post</button>
        <button class="btn" id="xCapture" title="Create idea rows for shipped versions with no post yet">Capture shipped stories</button>
      </div>
      <div class="board" id="xBoard"></div>
    </div>

    <div class="panel">
      <h2>Follower growth</h2>
      <div class="row">
        <input id="snapDay" type="date" style="max-width:170px;" />
        <input id="snapFollowers" type="number" placeholder="Followers" style="max-width:140px;" />
        <input id="snapFollowing" type="number" placeholder="Following" style="max-width:140px;" />
        <input id="snapPosts" type="number" placeholder="Posts" style="max-width:120px;" />
        <button class="btn" id="snapSave">Record</button>
      </div>
      <div id="snapChart" style="margin-top:12px;"></div>
    </div>

    <div class="panel">
      <h2>Engagement targets</h2>
      <div class="scroll-x"><table id="targetTable"><tbody></tbody></table></div>
    </div>
  </section>

  <!-- ============================ ADMIN ============================ -->
  <section data-panel="admin" class="hidden">
    <div class="panel">
      <h2>Bans</h2>
      <div class="row">
        <input id="banTarget" placeholder="Character name or wallet" style="max-width:280px;" />
        <input id="banReason" placeholder="Reason" style="max-width:280px;" />
        <label class="row small" style="margin:0;text-transform:none;letter-spacing:0;">
          <input type="checkbox" id="banDelete" style="width:auto;" /> delete character
        </label>
        <button class="btn danger" id="banGo">Ban</button>
      </div>
      <div id="banMsg" class="small" style="margin-top:8px;"></div>
      <div class="scroll-x" style="margin-top:10px;"><table id="banTable"><tbody></tbody></table></div>
    </div>

    <div class="panel">
      <h2>Season payout</h2>
      <p class="muted small">Dry run computes the full split and moves nothing. Executing pays real $BASE.</p>
      <div class="row">
        <input id="payoutSeason" type="number" placeholder="Season # (blank = last ended)" style="max-width:230px;" />
        <button class="btn" id="payoutDry">Dry run</button>
        <button class="btn danger" id="payoutExec">Execute…</button>
      </div>
      <pre class="mono small scroll-x" id="payoutOut" style="margin-top:10px;"></pre>
    </div>

    <div class="panel">
      <h2>X earn-tasks</h2>
      <div class="row">
        <input id="taskUrl" placeholder="Target tweet URL" style="max-width:300px;" />
        <input id="taskTitle" placeholder="Title" style="max-width:200px;" />
        <input id="taskHashtag" placeholder="#hashtag" style="max-width:150px;" />
        <input id="taskPoints" type="number" value="25" style="max-width:100px;" />
        <select id="taskType" style="width:auto;">
          <option value="reply">Reply</option>
          <option value="quote">Quote</option>
        </select>
        <button class="btn" id="taskCreate">Create</button>
      </div>
      <div class="scroll-x" style="margin-top:10px;"><table id="taskTable"><tbody></tbody></table></div>
    </div>

    <div class="panel">
      <h2>Audit log</h2>
      <div class="scroll-x"><table id="auditTable"><tbody></tbody></table></div>
    </div>
  </section>
</div>

<!-- Post editor -->
<div class="overlay hidden" id="postOverlay">
  <div class="modal">
    <div class="row"><h2 id="postTitle">Post</h2><span class="spacer"></span>
      <button class="btn tiny" id="postClose">Close</button></div>

    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));">
      <div><label for="pTitle">Title</label><input id="pTitle" /></div>
      <div><label for="pDate">Slot date</label><input id="pDate" type="date" /></div>
      <div><label for="pSlot">Slot</label><select id="pSlot"></select></div>
      <div><label for="pStatus">Status</label><select id="pStatus"></select></div>
      <div><label for="pFormat">Format</label><input id="pFormat" /></div>
    </div>

    <label for="pBody">Copy</label>
    <textarea id="pBody" style="min-height:180px;"></textarea>
    <div id="copyWarn" class="small"></div>

    <label for="pPrompt">Image prompt</label>
    <textarea id="pPrompt"></textarea>

    <label for="pUrl">Tweet URL</label>
    <div class="row">
      <input id="pUrl" style="max-width:420px;" />
      <button class="btn" id="pVerify">Verify via oEmbed</button>
    </div>
    <div id="verifyOut" class="small"></div>

    <h3 style="margin-top:16px;font-size:.85rem;">Results</h3>
    <p class="muted small">Paste a row straight out of X analytics, or fill the fields.</p>
    <input id="pBulk" placeholder="Paste tab-separated: impressions likes replies reposts bookmarks profileClicks linkClicks" />
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr));margin-top:8px;">
      <div><label for="mImpr">Impressions</label><input id="mImpr" type="number" /></div>
      <div><label for="mLikes">Likes</label><input id="mLikes" type="number" /></div>
      <div><label for="mReplies">Replies</label><input id="mReplies" type="number" /></div>
      <div><label for="mReposts">Reposts</label><input id="mReposts" type="number" /></div>
      <div><label for="mBook">Bookmarks</label><input id="mBook" type="number" /></div>
      <div><label for="mProfile">Profile clicks</label><input id="mProfile" type="number" /></div>
      <div><label for="mLink">Link clicks</label><input id="mLink" type="number" /></div>
    </div>

    <div class="row" style="margin-top:16px;">
      <button class="btn primary" id="pSave">Save</button>
      <button class="btn" id="pCheck">Check copy</button>
      <span class="spacer"></span>
      <button class="btn danger" id="pDelete">Delete</button>
    </div>
    <div class="err" id="postErr"></div>
  </div>
</div>

<script>${MISSION_APP_SCRIPT}</script>
</body>
</html>`;
