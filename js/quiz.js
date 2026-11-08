/* ==========================================================
   Mavo City – Regel-Quiz
   Fragen: CONTENT.quiz · Bestehensgrenze: CONFIG.quizPassPercent
   Mit Supabase + Discord-Login wird das Ergebnis gespeichert,
   damit das Team es im Admin-Bereich sehen kann.
   ========================================================== */
(() => {
  const $ = (sel) => document.querySelector(sel);
  const esc = window.escapeHtml;
  const PASS_KEY = "mavo_quiz_passed";

  let state = { step: -1, answers: [], saved: false };

  const questions = () => CONTENT.quiz.filter((q) => q.q && q.answers?.length > 1);

  function renderIntro() {
    let passed = null;
    try { passed = localStorage.getItem(PASS_KEY); } catch { /* egal */ }
    const n = questions().length;
    $("#quizBox").innerHTML = `
      <div class="quiz card">
        <div class="quiz__icon">${icon("clipboard")}</div>
        <h2>${t("{n} Fragen zum Regelwerk", { n })}</h2>
        <p>${t("Du brauchst mindestens {p} % richtige Antworten. Du kannst das Quiz beliebig oft wiederholen.", { p: CONFIG.quizPassPercent })}</p>
        ${passed ? `<p class="quiz__passed">${icon("check-circle")} ${t("Du hast das Quiz bereits bestanden.")}</p>` : ""}
        <div class="btn-row">
          <button class="btn btn--primary" data-quiz="start" ${n ? "" : "disabled"}>${t("Quiz starten")}</button>
          <a class="btn btn--ghost" href="#regeln">${t("Erst Regeln lesen")}</a>
        </div>
      </div>`;
  }

  function renderQuestion() {
    const qs = questions();
    const q = qs[state.step];
    $("#quizBox").innerHTML = `
      <div class="quiz card">
        <div class="quiz__progress"><span style="width:${(state.step / qs.length) * 100}%"></span></div>
        <span class="muted">${t("Frage {a} von {b}", { a: state.step + 1, b: qs.length })}</span>
        <h2>${esc(q.q)}</h2>
        <div class="quiz__answers">
          ${q.answers.map((a, i) => `<button class="quiz__answer" data-answer="${i}">${esc(a)}</button>`).join("")}
        </div>
      </div>`;
    $("#quizBox .quiz__answer")?.focus();
  }

  async function saveResult(score, total, passed) {
    if (!MavoAuth.enabled || !MavoAuth.user || state.saved) return;
    try {
      const sb = await getSupabase();
      const { error } = await sb.from("quiz_results").insert({ score, total, passed, user_name: "" });
      if (error) throw error;
      state.saved = true;
      showToast(t("Ergebnis gespeichert – das Team kann es jetzt sehen."));
      renderResult();
    } catch (err) {
      showToast(t("Fehler") + ": " + (err.message || err));
    }
  }

  function renderResult() {
    const qs = questions();
    const score = qs.filter((q, i) => state.answers[i] === Number(q.correct)).length;
    const percent = Math.round((score / qs.length) * 100);
    const passed = percent >= CONFIG.quizPassPercent;
    if (passed) { try { localStorage.setItem(PASS_KEY, new Date().toISOString()); } catch { /* egal */ } }

    const wrong = qs.map((q, i) => ({ q, i })).filter(({ q, i }) => state.answers[i] !== Number(q.correct));
    const saveBox = !MavoAuth.enabled ? "" : state.saved
      ? `<p class="quiz__passed">${icon("check-circle")} ${t("Ergebnis gespeichert.")}</p>`
      : MavoAuth.user
        ? `<button class="btn btn--ghost" data-quiz="save">${t("Ergebnis fürs Team speichern")}</button>`
        : `<button class="btn btn--discord" data-quiz="login">${t("Mit Discord anmelden & speichern")}</button>`;

    $("#quizBox").innerHTML = `
      <div class="quiz card quiz--${passed ? "pass" : "fail"}">
        <div class="quiz__icon">${icon(passed ? "trophy" : "x-circle")}</div>
        <h2>${passed ? t("Bestanden!") : t("Leider nicht bestanden")}</h2>
        <p class="quiz__score">${score} / ${qs.length} (${percent} %)</p>
        <p>${passed
          ? t("Super! Du kennst die wichtigsten Regeln. Stelle jetzt deinen Whitelist-Antrag im Discord.")
          : t("Lies dir das Regelwerk noch einmal durch und versuche es erneut.")}</p>
        ${wrong.length ? `
          <details class="quiz__review">
            <summary>${t("Falsche Antworten ansehen ({n})", { n: wrong.length })}</summary>
            <ul>${wrong.map(({ q, i }) => `
              <li><strong>${esc(q.q)}</strong><br>
                <span class="quiz__wrong">✗ ${esc(q.answers[state.answers[i]] ?? "–")}</span><br>
                <span class="quiz__right">✓ ${esc(q.answers[q.correct])}</span></li>`).join("")}
            </ul>
          </details>` : ""}
        <div class="btn-row">
          ${passed
            ? `<a class="btn btn--primary js-discord" href="${esc(CONFIG.discordUrl)}" target="_blank" rel="noopener">${t("Zum Whitelist-Antrag")}</a>`
            : `<a class="btn btn--primary" href="#regeln">${t("Regeln lesen")}</a>`}
          <button class="btn btn--ghost" data-quiz="start">${t("Nochmal")}</button>
          ${passed ? saveBox : ""}
        </div>
      </div>`;
    state.result = { score, total: qs.length, passed };
  }

  function render() {
    if (state.step < 0) renderIntro();
    else if (state.step < questions().length) renderQuestion();
    else renderResult();
  }

  $("#quizBox").addEventListener("click", async (e) => {
    const a = e.target.closest("[data-answer]");
    if (a) {
      state.answers[state.step] = Number(a.dataset.answer);
      state.step++;
      return render();
    }
    const action = e.target.closest("[data-quiz]")?.dataset.quiz;
    if (action === "start") { state = { step: 0, answers: [], saved: false }; render(); }
    if (action === "save") saveResult(state.result.score, state.result.total, state.result.passed);
    if (action === "login") MavoAuth.login().catch((err) => showToast(err.message));
  });

  MavoAuth.onChange(() => { if (state.step >= questions().length) render(); });
  contentReady.then(render);
  document.addEventListener("langchange", render);
})();
