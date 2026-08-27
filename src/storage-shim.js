// Полифил для window.storage.
//
// Оригинальный компонент HabitTracker был написан для среды Claude Artifacts,
// где window.storage — это встроенное постоянное хранилище (get/set/delete/list).
// Вне этой среды такого объекта не существует, поэтому здесь мы реализуем
// точно такой же API поверх обычного localStorage браузера. Логика самого
// HabitTracker при этом не меняется ни на строчку.

const NAMESPACE = "habit-tracker:storage:";

function keyFor(key, shared) {
  return `${NAMESPACE}${shared ? "shared:" : "private:"}${key}`;
}

if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key, shared = false) {
      try {
        const raw = window.localStorage.getItem(keyFor(key, shared));
        if (raw === null) return null;
        return { key, value: raw, shared: !!shared };
      } catch (e) {
        console.error("storage.get failed:", e);
        throw e;
      }
    },

    async set(key, value, shared = false) {
      try {
        window.localStorage.setItem(keyFor(key, shared), value);
        return { key, value, shared: !!shared };
      } catch (e) {
        console.error("storage.set failed:", e);
        return null;
      }
    },

    async delete(key, shared = false) {
      try {
        const existed = window.localStorage.getItem(keyFor(key, shared)) !== null;
        window.localStorage.removeItem(keyFor(key, shared));
        return { key, deleted: existed, shared: !!shared };
      } catch (e) {
        console.error("storage.delete failed:", e);
        return null;
      }
    },

    async list(prefix = "", shared = false) {
      try {
        const base = keyFor("", shared);
        const keys = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const fullKey = window.localStorage.key(i);
          if (fullKey && fullKey.startsWith(base)) {
            const shortKey = fullKey.slice(base.length);
            if (shortKey.startsWith(prefix)) keys.push(shortKey);
          }
        }
        return { keys, prefix, shared: !!shared };
      } catch (e) {
        console.error("storage.list failed:", e);
        return null;
      }
    },
  };
}
