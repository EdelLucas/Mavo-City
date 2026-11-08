/* ==========================================================
   Mavo City – Umfrage auf der Startseite
   Mit Supabase: aktuelle aktive Umfrage aus Tabelle "polls",
   abstimmen nur mit Discord-Login (1 Stimme pro Person).
   Ohne Supabase: DEMO_POLL aus js/data.js, Stimme nur lokal.
   ========================================================== */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const esc = window.escapeHtml;
  const LOCAL_KEY = "mavo_poll_votes";

  let poll = null;          // { id, question, options, ends_at }
  let counts = [];          // Stimmen pro Option
  let myVote = null;        // Index oder null

  const localVotes = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch { return {}; } };

  async function load() {
    const sb = await getSupabase();
    if (!sb) {
      poll = DEMO_POLL;
      myVote = localVotes()[poll.id] ?? null;
      counts = poll.options.map((_, i) => (i === myVote ? 1 : 0));
      return render();
    }
    await MavoAuth.ready;
    const { data, error } = await sb.from("polls").select("*").eq("active", true)
      .order("created_at", { ascending: false }).limit(5);
    if (error) throw error;
    poll = (data || []).find((p) => !p.ends_at || new Date(p.ends_at) > new Date()) || null;
    if (!poll) return render();

    const [res, mine] = await Promise.all([
      sb.rpc("poll_results", { p_poll: poll.id }),
      MavoAuth.user ? sb.from("poll_votes").select("option_index").eq("poll_id", poll.id).maybeSingle() : { data: null },
    ]);
    counts = poll.options.map(() => 0);
    (res.data || []).forEach((r) => (counts[r.option_index] = Number(r.votes)));
    myVote = mine.data ? mine.data.option_index : null;
    render();
  }

  function render() {
    const box = $("#pollBox");
    if (!poll) { box.innerHTML = `<div class="empty">${t("Gerade läuft keine Umfrage.")}</div>`; return; }
    const total = counts.reduce((a, b) => a + b, 0);
    const showResults = myVote !== null;
    const loggedOut = MavoAuth.enabled && !MavoAuth.user;

    box.innerHTML = `
      <div class="poll card">
        <h3>${esc(poll.question)}</h3>
        <div class="poll__options">
          ${poll.options.map((opt, i) => {
            const pct = total ? Math.round((counts[i] / total) * 100) : 0;
            return showResults
              ? `<div class="poll__result ${myVote === i ? "is-mine" : ""}">
                   <div class="poll__bar" style="width:${pct}%"></div>
                   <span>${esc(opt)}${myVote === i ? " ✓" : ""}</span><strong>${pct} %</strong>
                 </div>`
              : `<button class="poll__option" data-vote="${i}" ${loggedOut ? "disabled" : ""}>${esc(opt)}</button>`;
          }).join("")}
        </div>
        <p class="poll__meta">
          ${showResults ? (total === 1 ? t("1 Stimme") : t("{n} Stimmen", { n: total })) : ""}
          ${poll.ends_at ? ` · ${t("Endet am")} ${new Date(poll.ends_at).toLocaleDateString("de-DE")}` : ""}
          ${!MavoAuth.enabled ? ` · <em>${t("Demo – Stimme nur lokal gespeichert")}</em>` : ""}
        </p>
        ${loggedOut && !showResults ? `<button class="btn btn--discord btn--sm" data-poll-login>${t("Mit Discord anmelden, um abzustimmen")}</button>` : ""}
      </div>`;
  }

  $("#pollBox").addEventListener("click", async (e) => {
    if (e.target.closest("[data-poll-login]")) return MavoAuth.login().catch((err) => showToast(err.message));
    const btn = e.target.closest("[data-vote]");
    if (!btn) return;
    const idx = Number(btn.dataset.vote);
    const sb = await getSupabase();
    if (!sb) {
      const votes = localVotes();
      votes[poll.id] = idx;
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(votes)); } catch { /* egal */ }
      myVote = idx; counts = poll.options.map((_, i) => (i === idx ? 1 : 0));
      return render();
    }
    const { error } = await sb.from("poll_votes").insert({ poll_id: poll.id, option_index: idx });
    if (error) return showToast(t("Fehler") + ": " + error.message);
    showToast(t("Danke für deine Stimme!"));
    load().catch(console.error);
  });

  MavoAuth.onChange(() => load().catch(console.error));
  document.addEventListener("langchange", render);
  load().catch((err) => { console.error(err); $("#pollBox").innerHTML = ""; });
})();
