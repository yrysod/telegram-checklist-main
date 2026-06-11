/* app.js — bootstrap + routing (small & stable) */

(async function () {
  if (window.__APP_BOOTED__) return;
  window.__APP_BOOTED__ = true;

  function qs(name) {
    try {
      return new URLSearchParams(location.search).get(name);
    } catch {
      return null;
    }
  }

  function setLoading(text) {
    const root = document.getElementById("app") || document.body;
    root.innerHTML = `
      <div class="container">
        <div class="card">
          <div class="hint">${richTextHtml(String(text || UI_TEXT?.loading || "Загружаю…").replace(/\n/g, "<br>"))}</div>
        </div>
      </div>
    `;
  }

  function networkErrorText(err, context) {
    const msg = String(err?.message || err || "").toLowerCase();
    if (msg.includes("timeout")) {
      return `${context}\nСервер долго не отвечает. Проверь интернет и попробуй обновить страницу.`;
    }
    if (msg.includes("jsonp load")) {
      return `${context}\nНе удалось подключиться к Apps Script. Возможно, Telegram держит старый кэш или ссылка деплоя недоступна.`;
    }
    return `${context}\nПроверь интернет, обнови страницу и попробуй ещё раз.`;
  }

  function payloadErrorText(payload, fallback) {
    const err = String(payload?.error || "").trim();
    if (!err) return fallback;
    if (/unknown action/i.test(err)) return "Сервер Apps Script старой версии. Нужно развернуть новую версию.";
    if (/permission|разреш/i.test(err)) return "У Apps Script нет нужных прав. Открой редактор Apps Script и пройди авторизацию.";
    return `${fallback}\nОшибка сервера: ${err}`;
  }

  function hasTelegramUserInfo() {
    try {
      const user = window.getAuthTgUser ? window.getAuthTgUser() : null;
      const hasId = user?.id !== undefined && user?.id !== null && String(user?.id || "").trim() !== "";
      const hasDisplayName = String(user?.name || user?.username || "").trim() !== "";
      return hasId && hasDisplayName;
    } catch {
      return false;
    }
  }

  async function boot() {
    if (window.Telegram?.WebApp && !hasTelegramUserInfo()) {
    }

    setLoading((UI_TEXT?.loading || "Загружаю данные…") + (typeof APP_VERSION !== "undefined" ? ` (v${APP_VERSION})` : ""));

    let data;
    try {
      data = await api.getAll();
    } catch (e) {
      setLoading(networkErrorText(e, "Не получилось загрузить данные из таблицы 😕"));
      return;
    }
    if (data?.error) {
      setLoading(payloadErrorText(data, "Не получилось загрузить данные из таблицы 😕"));
      return;
    }

    const resultId = qs("result");
    const continueToken = qs("continue");

    if (continueToken) {
      try {
        setLoading("Открываю черновик…");
        const res = await api.resolveContinueToken(continueToken);
        if (res && res.ok && res.payload) {
          const draft = window.normalizeDraftPayloadForState
            ? window.normalizeDraftPayloadForState(res.payload)
            : res.payload;
          if (draft && window.applyDraftToState) {
            window.applyDraftToState(draft);
            try {
              const url = new URL(window.location.href);
              url.searchParams.delete("continue");
              window.history.replaceState(null, "", `${url.origin}${url.pathname}${url.search}${url.hash}`);
            } catch {}
            renderChecklist(data);
            return;
          }
        }
        const error = res?.error || "";
        setLoading(error === "continue_token_expired" ? "Ссылка истекла, войдите заново." : "Черновик не найден или ссылка устарела.");
        return;
      } catch (e) {
        setLoading(networkErrorText(e, "Не получилось открыть черновик 😕"));
        return;
      }
    }

    const hasAuth = hasTelegramUserInfo();
    if (!IS_TG && !hasAuth) {
      renderBrowserAuthScreen(data, { resultId });
      return;
    }

    // if opened by share link: ?result=SUBMISSION_ID
    if (FEATURE_PUBLIC_RESULT_VIEW && resultId) {
      try {
        setLoading("Открываю результат…");
        const res = await api.getSubmission(resultId);

        // Apps Script helper returns { ok:true, submission, answers, ... }
        if (res && res.ok) {
          renderReadonlyResult(data, res);
          return;
        }

        // fallback
        setLoading(payloadErrorText(res, "Результат не найден или ссылка устарела 😕"));
        return;

      } catch (e) {
        setLoading(networkErrorText(e, "Не получилось открыть результат 😕"));
        return;
      }
    }

    // normal flow
    renderStart(data);
  }

  // start
  try {
    await boot();
  } catch (e) {
    setLoading("Что-то пошло не так 😕");
  }
})();
