/* Заглушка window.storage для локального запуска MirStudy (Vite, localhost).
   В claude.ai артефакт получает window.storage от платформы; локально его нет — эта заглушка
   повторяет тот же API поверх localStorage. Подключить ДО рендера приложения (в main.jsx: import "./storage-shim.js").
   API: get(key, shared?) → {key, value, shared} | null; set(key, value, shared?) → {key, value, shared};
        delete(key, shared?) → {key, deleted, shared}; list(prefix?, shared?) → {keys, prefix, shared}. */
(function () {
  if (typeof window === "undefined" || window.storage) return;
  const NS = "mirstudy:";
  const full = (key, shared) => NS + (shared ? "shared:" : "own:") + key;
  const ok = (v) => Promise.resolve(v);
  window.storage = {
    get(key, shared = false) {
      try { const v = localStorage.getItem(full(key, shared)); return ok(v == null ? null : { key, value: v, shared }); }
      catch (e) { return Promise.reject(e); }
    },
    set(key, value, shared = false) {
      try { localStorage.setItem(full(key, shared), String(value)); return ok({ key, value, shared }); }
      catch (e) { return Promise.reject(e); }
    },
    delete(key, shared = false) {
      try { localStorage.removeItem(full(key, shared)); return ok({ key, deleted: true, shared }); }
      catch (e) { return Promise.reject(e); }
    },
    list(prefix = "", shared = false) {
      try {
        const head = NS + (shared ? "shared:" : "own:");
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(head + prefix)) keys.push(k.slice(head.length));
        }
        return ok({ keys, prefix, shared });
      } catch (e) { return Promise.reject(e); }
    },
  };
})();
