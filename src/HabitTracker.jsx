import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Home, BarChart3, Trophy, Settings, Plus, X, Check, Trash2, Pencil,
  Flame, Sun, Moon, Bell, BellOff, Palette, RotateCcw, AlertTriangle,
  ChevronLeft, Sparkles, User
} from "lucide-react";

/* ============================== ДАННЫЕ / КОНСТАНТЫ ============================== */

const STORAGE_KEY = "habit-tracker-state-v1";

const PALETTE = {
  purple: { name: "Фиолетовый", c: "#8B6FF0", soft: "rgba(139,111,240,0.16)" },
  blue: { name: "Синий", c: "#4C8DF6", soft: "rgba(76,141,246,0.16)" },
  green: { name: "Зелёный", c: "#28C39A", soft: "rgba(40,195,154,0.16)" },
  pink: { name: "Розовый", c: "#F2568F", soft: "rgba(242,86,143,0.16)" },
  amber: { name: "Янтарный", c: "#F0A93B", soft: "rgba(240,169,59,0.16)" },
};

const ICONS = ["💧","🏃","📚","🧘","💪","🥗","😴","✍️","🎨","🎯","🚭","💰","🎵","🌱","☀️","🧹"];

const THEMES = {
  dark: {
    bg: "#0A0C11", panelBg: "#12141C", surface: "#161925", surface2: "#1E2230",
    border: "#272B3B", text: "#EDEEF4", textDim: "#8C92A6", textFaint: "#565C70",
    shadow: "0 20px 60px rgba(0,0,0,0.55)",
  },
  light: {
    bg: "#E9EAF2", panelBg: "#F6F6FB", surface: "#FFFFFF", surface2: "#F0F1F7",
    border: "#E2E3EE", text: "#181A22", textDim: "#666B80", textFaint: "#9A9EB0",
    shadow: "0 20px 60px rgba(30,30,60,0.18)",
  },
};

const MOTIVATIONS = [
  "Отлично! 🔥", "Ещё один шаг!", "Так держать!",
  "Ты становишься дисциплинированнее!", "Красавчик! 💪", "Ещё чуть-чуть до цели!",
];

const WEEKDAYS = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];

const DEFAULT_USER = { name: "Друг", theme: "dark", notifications: true, accent: "purple" };

/* ============================== ХЕЛПЕРЫ ============================== */

function fmt(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function todayKey() { return fmt(new Date()); }
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return fmt(d);
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function getStreak(completedDates) {
  const set = new Set(completedDates);
  let cursor = new Date();
  if (!set.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (set.has(fmt(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}
function getBestStreak(completedDates) {
  if (!completedDates.length) return 0;
  const days = [...new Set(completedDates)].map(d => new Date(d + "T00:00:00").getTime()).sort((a,b)=>a-b);
  let best = 1, cur = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] - days[i-1] === 86400000) { cur++; best = Math.max(best, cur); }
    else if (days[i] - days[i-1] !== 0) { cur = 1; }
  }
  return best;
}
function getPerfectDays(habits) {
  const allDates = new Set();
  habits.forEach(h => h.completedDates.forEach(d => allDates.add(d)));
  let count = 0;
  allDates.forEach(date => {
    const active = habits.filter(h => h.createdAt <= date);
    if (active.length > 0 && active.every(h => h.completedDates.includes(date))) count++;
  });
  return count;
}
function getTotalCompletions(habits) { return habits.reduce((s,h)=>s+h.completedDates.length,0); }
function getXP(habits) { return getTotalCompletions(habits) * 10 + getPerfectDays(habits) * 20; }
function getLevel(xp) { return Math.floor(xp / 100) + 1; }

/* ============================== ДОСТИЖЕНИЯ ============================== */

function computeAchievements(habits) {
  const total = getTotalCompletions(habits);
  const maxBest = habits.reduce((m,h)=>Math.max(m, getBestStreak(h.completedDates)), 0);
  const perfectDays = getPerfectDays(habits);
  const xp = getXP(habits);
  const level = getLevel(xp);
  return [
    { id: "first", icon: "🌱", title: "Первый шаг", desc: "Создай свою первую привычку", done: habits.length >= 1 },
    { id: "week", icon: "🔥", title: "Неделя силы", desc: "Держи серию 7 дней подряд", done: maxBest >= 7 },
    { id: "month", icon: "🏔️", title: "Месяц дисциплины", desc: "Держи серию 30 дней подряд", done: maxBest >= 30 },
    { id: "collector", icon: "🗂️", title: "Коллекционер", desc: "Веди 5 привычек одновременно", done: habits.length >= 5 },
    { id: "level5", icon: "⭐", title: "Пятый уровень", desc: "Достигни 5 уровня", done: level >= 5 },
    { id: "hundred", icon: "💯", title: "Сотня", desc: "Сделай 100 отметок о выполнении", done: total >= 100 },
    { id: "perfect", icon: "🎉", title: "Идеальный день", desc: "Выполни все привычки за один день", done: perfectDays >= 1 },
    { id: "perfectweek", icon: "👑", title: "Идеальная неделя", desc: "7 идеальных дней подряд", done: perfectDays >= 7 },
  ];
}

/* ============================== МЕЛКИЕ UI-КОМПОНЕНТЫ ============================== */

function RingProgress({ size = 96, stroke = 9, pct, color, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - Math.min(Math.max(pct, 0), 1) * c;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

function WeekDots({ completedDates, color }) {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(addDays(todayKey(), -i));
  return (
    <div className="flex gap-1.5">
      {days.map(d => {
        const done = completedDates.includes(d);
        const isToday = d === todayKey();
        return (
          <div key={d} className="flex flex-col items-center gap-1">
            <div
              style={{
                width: 9, height: 9, borderRadius: 999,
                background: done ? color : "var(--surface2)",
                border: isToday && !done ? `1.5px solid ${color}` : "1.5px solid transparent",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function ConfirmModal({ open, title, message, confirmLabel = "Удалить", onConfirm, onCancel, danger = true }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }} onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center rounded-full"
            style={{ width: 40, height: 40, background: danger ? "rgba(242,86,86,0.15)" : "var(--surface2)" }}>
            <AlertTriangle size={20} color={danger ? "#F25656" : "var(--text)"} />
          </div>
          <h3 style={{ color: "var(--text)", fontFamily: "var(--font-display)" }} className="text-lg font-semibold">{title}</h3>
        </div>
        <p style={{ color: "var(--text-dim)" }} className="text-sm mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "var(--surface2)", color: "var(--text)" }}>Отмена</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: danger ? "#F25656" : "var(--accent)", color: "#fff" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 px-4 py-2.5 rounded-full text-sm font-medium shadow-lg"
      style={{ background: "var(--text)", color: "var(--panel-bg)", animation: "toastIn 0.25s ease" }}>
      {message}
    </div>
  );
}

function Confetti({ show }) {
  const pieces = useMemo(() => {
    const colors = Object.values(PALETTE).map(p => p.c);
    return Array.from({ length: 46 }).map((_, i) => ({
      id: i, left: Math.random() * 100, delay: Math.random() * 0.4,
      duration: 1.8 + Math.random() * 1.2, color: colors[i % colors.length],
      rotate: Math.random() * 360, size: 6 + Math.random() * 6,
    }));
  }, [show]);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      {pieces.map(p => (
        <span key={p.id} style={{
          position: "absolute", top: -20, left: `${p.left}%`,
          width: p.size, height: p.size * 0.4, background: p.color,
          transform: `rotate(${p.rotate}deg)`,
          animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
          borderRadius: 2,
        }} />
      ))}
    </div>
  );
}

/* ============================== ОСНОВНОЙ КОМПОНЕНТ ============================== */

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [user, setUser] = useState(DEFAULT_USER);
  const [habits, setHabits] = useState([]);
  const [view, setView] = useState("home");
  const [editingHabit, setEditingHabit] = useState(null); // null | {} (new) | habit
  const [confirm, setConfirm] = useState(null); // {type, habitId?}
  const [toast, setToast] = useState("");
  const [confettiKey, setConfettiKey] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const toastTimer = useRef(null);
  const confettiTimer = useRef(null);
  const firedPerfectDay = useRef(null);

  /* ---------- загрузка ---------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setUser({ ...DEFAULT_USER, ...(parsed.user || {}) });
          setHabits(Array.isArray(parsed.habits) ? parsed.habits : []);
          firedPerfectDay.current = parsed.lastPerfectDayFired || null;
        }
      } catch (e) {
        // ключа ещё нет, либо хранилище недоступно — начинаем с чистого состояния
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  /* ---------- сохранение ---------- */
  const persist = useCallback(async (nextUser, nextHabits) => {
    try {
      const payload = JSON.stringify({
        user: nextUser, habits: nextHabits, lastPerfectDayFired: firedPerfectDay.current,
      });
      const res = await window.storage.set(STORAGE_KEY, payload, false);
      if (!res) setStorageOk(false); else setStorageOk(true);
    } catch (e) {
      setStorageOk(false);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    persist(user, habits);
  }, [user, habits, loaded, persist]);

  /* ---------- тема / переменные ---------- */
  const t = THEMES[user.theme] || THEMES.dark;
  const accent = PALETTE[user.accent]?.c || PALETTE.purple.c;
  const rootVars = {
    "--bg": t.bg, "--panel-bg": t.panelBg, "--surface": t.surface, "--surface2": t.surface2,
    "--border": t.border, "--text": t.text, "--text-dim": t.textDim, "--text-faint": t.textFaint,
    "--accent": accent, "--font-display": "'Sora', 'Segoe UI', sans-serif",
    "--font-body": "'Inter', 'Segoe UI', sans-serif",
  };

  /* ---------- производные данные ---------- */
  const xp = getXP(habits);
  const level = getLevel(xp);
  const xpIntoLevel = xp % 100;
  const totalCompletions = getTotalCompletions(habits);
  const bestStreakEver = habits.reduce((m,h)=>Math.max(m, getBestStreak(h.completedDates)), 0);
  const todayDoneCount = habits.filter(h => h.completedDates.includes(todayKey())).length;
  const allDoneToday = habits.length > 0 && todayDoneCount === habits.length;
  const achievements = useMemo(() => computeAchievements(habits), [habits]);
  const unlockedCount = achievements.filter(a => a.done).length;

  /* ---------- уведомления / тост ---------- */
  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }
  function triggerConfetti() {
    setConfettiKey(k => k + 1);
    setShowConfetti(true);
    clearTimeout(confettiTimer.current);
    confettiTimer.current = setTimeout(() => setShowConfetti(false), 2600);
  }

  /* ---------- действия с привычками ---------- */
  function addHabit(name, icon, color) {
    const h = { id: genId(), name: name.trim(), icon, color, createdAt: todayKey(), completedDates: [] };
    setHabits(prev => [...prev, h]);
    setEditingHabit(null);
    showToast("Привычка создана 🌱");
  }
  function saveHabitEdit(id, name, icon, color) {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, name: name.trim(), icon, color } : h));
    setEditingHabit(null);
  }
  function deleteHabit(id) {
    setHabits(prev => prev.filter(h => h.id !== id));
    setConfirm(null);
    setEditingHabit(null);
    showToast("Привычка удалена");
  }
  function toggleComplete(id) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    const key = todayKey();
    const wasDone = habit.completedDates.includes(key);
    const nextHabits = habits.map(h => h.id === id
      ? { ...h, completedDates: wasDone ? h.completedDates.filter(d => d !== key) : [...h.completedDates, key] }
      : h);
    setHabits(nextHabits);
    if (!wasDone) {
      const nowAllDone = nextHabits.length > 0 && nextHabits.every(h => h.completedDates.includes(key));
      if (nowAllDone && firedPerfectDay.current !== key) {
        firedPerfectDay.current = key;
        showToast("День закрыт! 🎉");
        triggerConfetti();
      } else {
        showToast(MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)]);
      }
    }
  }

  /* ---------- настройки ---------- */
  function updateUser(patch) { setUser(prev => ({ ...prev, ...patch })); }
  function resetProgress() {
    setHabits(prev => prev.map(h => ({ ...h, completedDates: [] })));
    firedPerfectDay.current = null;
    setConfirm(null);
    showToast("Прогресс сброшен");
  }
  function deleteAllData() {
    setHabits([]);
    setUser(DEFAULT_USER);
    firedPerfectDay.current = null;
    setConfirm(null);
    showToast("Данные удалены");
  }

  if (!loaded) {
    return (
      <div style={{ ...rootVars, background: "var(--bg)" }} className="min-h-screen flex items-center justify-center">
        <div style={{ color: t.textDim, fontFamily: "var(--font-body)" }} className="text-sm">Загрузка…</div>
      </div>
    );
  }

  return (
    <div style={{ ...rootVars, background: user.theme === "dark"
      ? "radial-gradient(circle at 20% -10%, rgba(139,111,240,0.16), transparent 45%), var(--bg)"
      : "radial-gradient(circle at 20% -10%, rgba(139,111,240,0.10), transparent 45%), var(--bg)"
    }} className="min-h-screen w-full flex justify-center">
      <GlobalStyle />
      <div className="w-full max-w-md sm:my-8 sm:rounded-3xl sm:shadow-2xl overflow-hidden relative"
        style={{ background: "var(--panel-bg)", minHeight: "100vh", boxShadow: t.shadow, fontFamily: "var(--font-body)" }}>

        <Toast message={toast} />
        <Confetti key={confettiKey} show={showConfetti} />

        {/* ---------- HEADER ---------- */}
        <header className="flex items-center justify-between px-5 pt-6 pb-3">
          <div>
            <div style={{ color: "var(--text-faint)" }} className="text-xs font-medium tracking-wide uppercase">
              {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <h1 style={{ color: "var(--text)", fontFamily: "var(--font-display)" }} className="text-xl font-bold mt-0.5">
              Привет, {user.name}
            </h1>
          </div>
          <button
            onClick={() => updateUser({ theme: user.theme === "dark" ? "light" : "dark" })}
            className="flex items-center justify-center rounded-full"
            style={{ width: 40, height: 40, background: "var(--surface)", border: "1px solid var(--border)" }}
            aria-label="Переключить тему"
          >
            {user.theme === "dark" ? <Sun size={18} color="var(--text)" /> : <Moon size={18} color="var(--text)" />}
          </button>
        </header>

        {!storageOk && (
          <div className="mx-5 mb-2 px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(242,86,86,0.12)", color: "#F25656" }}>
            Не удалось сохранить данные. Изменения могут не сохраниться после перезагрузки.
          </div>
        )}

        {/* ---------- VIEWS ---------- */}
        <main className="px-5 pb-28">
          {view === "home" && (
            <HomeView
              habits={habits} user={user} xp={xp} level={level} xpIntoLevel={xpIntoLevel}
              accent={accent} allDoneToday={allDoneToday} todayDoneCount={todayDoneCount}
              onToggle={toggleComplete}
              onEdit={h => setEditingHabit(h)}
              onAdd={() => setEditingHabit({})}
            />
          )}
          {view === "stats" && (
            <StatsView habits={habits} xp={xp} level={level} totalCompletions={totalCompletions}
              bestStreakEver={bestStreakEver} accent={accent} />
          )}
          {view === "achievements" && (
            <AchievementsView achievements={achievements} unlockedCount={unlockedCount} accent={accent} />
          )}
          {view === "settings" && (
            <SettingsView
              user={user} onUpdate={updateUser}
              onResetProgress={() => setConfirm({ type: "reset" })}
              onDeleteData={() => setConfirm({ type: "deleteAll" })}
            />
          )}
        </main>

        {/* ---------- НИЖНЯЯ НАВИГАЦИЯ ---------- */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md flex items-stretch justify-around px-2 pt-2"
          style={{
            background: "var(--surface)", borderTop: "1px solid var(--border)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
          }}>
          <NavButton icon={Home} label="Главная" active={view === "home"} onClick={() => setView("home")} accent={accent} />
          <NavButton icon={BarChart3} label="Статистика" active={view === "stats"} onClick={() => setView("stats")} accent={accent} />
          <NavButton icon={Trophy} label="Достижения" active={view === "achievements"} onClick={() => setView("achievements")} accent={accent} />
          <NavButton icon={Settings} label="Настройки" active={view === "settings"} onClick={() => setView("settings")} accent={accent} />
        </nav>

        {/* ---------- МОДАЛКИ ---------- */}
        {editingHabit !== null && (
          <HabitModal
            habit={editingHabit}
            onClose={() => setEditingHabit(null)}
            onSave={(name, icon, color) => editingHabit.id
              ? saveHabitEdit(editingHabit.id, name, icon, color)
              : addHabit(name, icon, color)}
            onDelete={editingHabit.id ? () => setConfirm({ type: "deleteHabit", habitId: editingHabit.id }) : null}
          />
        )}

        <ConfirmModal
          open={confirm?.type === "deleteHabit"}
          title="Удалить привычку?"
          message="Вся история выполнения этой привычки будет потеряна безвозвратно."
          onCancel={() => setConfirm(null)}
          onConfirm={() => deleteHabit(confirm.habitId)}
        />
        <ConfirmModal
          open={confirm?.type === "reset"}
          title="Сбросить прогресс?"
          message="Все отметки о выполнении, серии и опыт будут обнулены. Список привычек и настройки останутся."
          confirmLabel="Сбросить"
          onCancel={() => setConfirm(null)}
          onConfirm={resetProgress}
        />
        <ConfirmModal
          open={confirm?.type === "deleteAll"}
          title="Удалить все данные?"
          message="Будут удалены все привычки, прогресс и настройки. Это действие необратимо."
          confirmLabel="Удалить всё"
          onCancel={() => setConfirm(null)}
          onConfirm={deleteAllData}
        />
      </div>
    </div>
  );
}

/* ============================== NAV BUTTON ============================== */

function NavButton({ icon: Icon, label, active, onClick, accent }) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl"
      style={{ color: active ? accent : "var(--text-faint)" }}>
      <Icon size={21} strokeWidth={active ? 2.4 : 2} />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

/* ============================== HOME VIEW ============================== */

function HomeView({ habits, xp, level, xpIntoLevel, accent, allDoneToday, todayDoneCount, onToggle, onEdit, onAdd }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Уровень / XP — герой экрана */}
      <div className="rounded-2xl p-5 flex items-center gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <RingProgress size={84} stroke={8} pct={xpIntoLevel / 100} color={accent}>
          <div className="flex flex-col items-center">
            <span style={{ color: "var(--text)", fontFamily: "var(--font-display)" }} className="text-lg font-bold leading-none">{level}</span>
            <span style={{ color: "var(--text-faint)" }} className="text-xs mt-0.5">LVL</span>
          </div>
        </RingProgress>
        <div className="flex-1">
          <div style={{ color: "var(--text)" }} className="text-sm font-semibold mb-1">{xp} XP всего</div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
            <div style={{ width: `${xpIntoLevel}%`, background: accent, height: "100%", transition: "width 0.5s ease" }} />
          </div>
          <div style={{ color: "var(--text-dim)" }} className="text-xs mt-1.5">{xpIntoLevel} / 100 до {level + 1} уровня</div>
        </div>
      </div>

      {allDoneToday && (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: PALETTE.green.soft }}>
          <Sparkles size={20} color={PALETTE.green.c} />
          <div style={{ color: "var(--text)" }} className="text-sm font-semibold">День закрыт! Все привычки выполнены 🎉</div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 style={{ color: "var(--text)", fontFamily: "var(--font-display)" }} className="text-base font-bold">
          Сегодня {habits.length > 0 && <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>· {todayDoneCount}/{habits.length}</span>}
        </h2>
        {habits.length > 0 && (
          <button onClick={onAdd} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ color: accent, background: PALETTE[Object.keys(PALETTE).find(k=>PALETTE[k].c===accent) || "purple"].soft }}>
            <Plus size={14} /> Привычка
          </button>
        )}
      </div>

      {habits.length === 0 ? (
        <EmptyState onAdd={onAdd} accent={accent} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {habits.map(h => (
            <HabitCard key={h.id} habit={h} onToggle={() => onToggle(h.id)} onEdit={() => onEdit(h)} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onAdd, accent }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4 rounded-2xl"
      style={{ background: "var(--surface)", border: "1px dashed var(--border)" }}>
      <div className="text-5xl mb-3">🔥</div>
      <div style={{ color: "var(--text)", fontFamily: "var(--font-display)" }} className="text-base font-bold mb-1">
        У тебя пока нет привычек
      </div>
      <div style={{ color: "var(--text-dim)" }} className="text-sm mb-5 max-w-xs">
        Создай первую привычку и начни свой первый Streak 🔥
      </div>
      <button onClick={onAdd} className="px-5 py-3 rounded-xl text-sm font-semibold" style={{ background: accent, color: "#fff" }}>
        + Создать привычку
      </button>
    </div>
  );
}

function HabitCard({ habit, onToggle, onEdit }) {
  const color = PALETTE[habit.color]?.c || PALETTE.purple.c;
  const done = habit.completedDates.includes(todayKey());
  const streak = getStreak(habit.completedDates);
  return (
    <div className="rounded-2xl p-3.5 flex items-center gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <button onClick={onEdit} className="flex items-center justify-center rounded-xl shrink-0"
        style={{ width: 44, height: 44, background: PALETTE[habit.color]?.soft || PALETTE.purple.soft, fontSize: 20 }}>
        {habit.icon}
      </button>
      <div className="flex-1 min-w-0" onClick={onEdit}>
        <div className="flex items-center gap-1.5">
          <span style={{ color: "var(--text)" }} className="text-sm font-semibold truncate">{habit.name}</span>
          {streak > 0 && (
            <span className="flex items-center gap-0.5 text-xs font-bold shrink-0" style={{ color: "#F0A93B" }}>
              <Flame size={12} /> {streak}
            </span>
          )}
        </div>
        <div className="mt-1.5"><WeekDots completedDates={habit.completedDates} color={color} /></div>
      </div>
      <button onClick={onToggle} className="flex items-center justify-center rounded-full shrink-0"
        style={{
          width: 38, height: 38,
          background: done ? color : "var(--surface2)",
          border: done ? "none" : "1.5px solid var(--border)",
          transition: "all 0.2s ease",
        }}>
        <Check size={18} color={done ? "#fff" : "var(--text-faint)"} strokeWidth={3} />
      </button>
    </div>
  );
}

/* ============================== STATS VIEW ============================== */

function StatsView({ habits, xp, level, totalCompletions, bestStreakEver, accent }) {
  const last7 = [];
  for (let i = 6; i >= 0; i--) last7.push(addDays(todayKey(), -i));
  const dayCounts = last7.map(d => habits.filter(h => h.completedDates.includes(d)).length);
  const maxCount = Math.max(1, ...dayCounts, habits.length);

  return (
    <div className="flex flex-col gap-5">
      <h2 style={{ color: "var(--text)", fontFamily: "var(--font-display)" }} className="text-lg font-bold pt-1">Статистика</h2>

      <div className="grid grid-cols-2 gap-2.5">
        <StatBox label="Уровень" value={level} sub={`${xp} XP`} />
        <StatBox label="Привычек" value={habits.length} sub="активных" />
        <StatBox label="Выполнений" value={totalCompletions} sub="всего" />
        <StatBox label="Лучшая серия" value={bestStreakEver} sub="дней подряд" />
      </div>

      <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div style={{ color: "var(--text)" }} className="text-sm font-semibold mb-4">Последние 7 дней</div>
        {habits.length === 0 ? (
          <div style={{ color: "var(--text-dim)" }} className="text-xs text-center py-4">Добавь привычки, чтобы увидеть график</div>
        ) : (
          <div className="flex items-end justify-between gap-2" style={{ height: 110 }}>
            {last7.map((d, i) => {
              const h = Math.max(6, (dayCounts[i] / maxCount) * 100);
              const isToday = d === todayKey();
              return (
                <div key={d} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div style={{ color: "var(--text-faint)" }} className="text-xs font-medium">{dayCounts[i]}</div>
                  <div style={{
                    width: "100%", maxWidth: 22, height: `${h}%`, borderRadius: 6,
                    background: isToday ? accent : "var(--surface2)",
                    transition: "height 0.4s ease",
                  }} />
                  <div style={{ color: isToday ? accent : "var(--text-faint)" }} className="text-xs font-semibold">
                    {WEEKDAYS[new Date(d + "T00:00:00").getDay()]}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {habits.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div style={{ color: "var(--text)" }} className="text-sm font-semibold">По привычкам</div>
          {habits.map(h => {
            const color = PALETTE[h.color]?.c || PALETTE.purple.c;
            const streak = getStreak(h.completedDates);
            const best = getBestStreak(h.completedDates);
            const rate = h.createdAt ? Math.round((h.completedDates.length / Math.max(1, (new Date(todayKey())-new Date(h.createdAt))/86400000 + 1)) * 100) : 0;
            return (
              <div key={h.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 34, height: 34, background: PALETTE[h.color]?.soft, fontSize: 16 }}>{h.icon}</div>
                <div className="flex-1 min-w-0">
                  <div style={{ color: "var(--text)" }} className="text-xs font-semibold truncate">{h.name}</div>
                  <div style={{ color: "var(--text-dim)" }} className="text-xs">Текущая {streak} · Лучшая {best} · {Math.min(100,rate)}%</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, sub }) {
  return (
    <div className="rounded-2xl p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ color: "var(--text)", fontFamily: "var(--font-display)" }} className="text-2xl font-bold">{value}</div>
      <div style={{ color: "var(--text-dim)" }} className="text-xs mt-0.5">{label} · {sub}</div>
    </div>
  );
}

/* ============================== ACHIEVEMENTS VIEW ============================== */

function AchievementsView({ achievements, unlockedCount, accent }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between pt-1">
        <h2 style={{ color: "var(--text)", fontFamily: "var(--font-display)" }} className="text-lg font-bold">Достижения</h2>
        <span style={{ color: accent }} className="text-sm font-semibold">{unlockedCount}/{achievements.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {achievements.map(a => (
          <div key={a.id} className="rounded-2xl p-4 flex flex-col items-center text-center gap-1.5"
            style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              opacity: a.done ? 1 : 0.45,
            }}>
            <div className="text-3xl" style={{ filter: a.done ? "none" : "grayscale(1)" }}>{a.icon}</div>
            <div style={{ color: "var(--text)" }} className="text-xs font-bold">{a.title}</div>
            <div style={{ color: "var(--text-dim)" }} className="text-xs leading-snug">{a.desc}</div>
            {a.done && <div style={{ color: accent }} className="text-xs font-bold mt-0.5">✓ Получено</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== SETTINGS VIEW ============================== */

function SettingsView({ user, onUpdate, onResetProgress, onDeleteData }) {
  const [nameDraft, setNameDraft] = useState(user.name);
  const nameChanged = nameDraft.trim() !== user.name && nameDraft.trim().length > 0;

  return (
    <div className="flex flex-col gap-5">
      <h2 style={{ color: "var(--text)", fontFamily: "var(--font-display)" }} className="text-lg font-bold pt-1">Настройки</h2>

      <SettingsGroup title="Профиль">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 38, height: 38, background: "var(--surface2)" }}>
            <User size={17} color="var(--text-dim)" />
          </div>
          <input
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            placeholder="Твоё имя"
            className="flex-1 text-sm font-medium bg-transparent outline-none py-2"
            style={{ color: "var(--text)" }}
            maxLength={24}
          />
          {nameChanged && (
            <button onClick={() => onUpdate({ name: nameDraft.trim() })}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0" style={{ background: "var(--accent)", color: "#fff" }}>
              Сохранить
            </button>
          )}
        </div>
      </SettingsGroup>

      <SettingsGroup title="Тема">
        <div className="flex gap-2">
          <ThemeButton icon={Moon} label="Тёмная" active={user.theme === "dark"} onClick={() => onUpdate({ theme: "dark" })} />
          <ThemeButton icon={Sun} label="Светлая" active={user.theme === "light"} onClick={() => onUpdate({ theme: "light" })} />
        </div>
      </SettingsGroup>

      <SettingsGroup title="Внешний вид · акцентный цвет">
        <div className="flex gap-2.5 flex-wrap">
          {Object.entries(PALETTE).map(([key, p]) => (
            <button key={key} onClick={() => onUpdate({ accent: key })}
              className="flex items-center justify-center rounded-full"
              style={{
                width: 34, height: 34, background: p.c,
                border: user.accent === key ? "3px solid var(--text)" : "3px solid transparent",
                boxShadow: user.accent === key ? "0 0 0 2px var(--surface)" : "none",
              }} aria-label={p.name}>
              {user.accent === key && <Check size={15} color="#fff" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup title="Уведомления">
        <button onClick={() => onUpdate({ notifications: !user.notifications })}
          className="w-full flex items-center justify-between py-1">
          <div className="flex items-center gap-2.5">
            {user.notifications ? <Bell size={18} color="var(--text-dim)" /> : <BellOff size={18} color="var(--text-dim)" />}
            <span style={{ color: "var(--text)" }} className="text-sm font-medium">Мотивационные сообщения</span>
          </div>
          <Toggle on={user.notifications} />
        </button>
      </SettingsGroup>

      <SettingsGroup title="Данные" danger>
        <button onClick={onResetProgress} className="w-full flex items-center gap-2.5 py-2 text-left">
          <RotateCcw size={17} color="var(--text-dim)" />
          <div className="flex-1">
            <div style={{ color: "var(--text)" }} className="text-sm font-medium">Сбросить прогресс</div>
            <div style={{ color: "var(--text-dim)" }} className="text-xs">Обнулить серии и опыт, привычки останутся</div>
          </div>
        </button>
        <div style={{ borderTop: "1px solid var(--border)" }} className="my-1" />
        <button onClick={onDeleteData} className="w-full flex items-center gap-2.5 py-2 text-left">
          <Trash2 size={17} color="#F25656" />
          <div className="flex-1">
            <div style={{ color: "#F25656" }} className="text-sm font-medium">Удалить все данные</div>
            <div style={{ color: "var(--text-dim)" }} className="text-xs">Привычки, прогресс и настройки будут стёрты</div>
          </div>
        </button>
      </SettingsGroup>
    </div>
  );
}

function SettingsGroup({ title, children, danger }) {
  return (
    <div>
      <div style={{ color: "var(--text-faint)" }} className="text-xs font-semibold uppercase tracking-wide mb-2 px-1">{title}</div>
      <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: `1px solid ${danger ? "rgba(242,86,86,0.25)" : "var(--border)"}` }}>
        {children}
      </div>
    </div>
  );
}

function ThemeButton({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl"
      style={{ background: active ? "var(--accent)" : "var(--surface2)" }}>
      <Icon size={18} color={active ? "#fff" : "var(--text-dim)"} />
      <span style={{ color: active ? "#fff" : "var(--text-dim)" }} className="text-xs font-semibold">{label}</span>
    </button>
  );
}

function Toggle({ on }) {
  return (
    <div style={{ width: 42, height: 24, borderRadius: 999, background: on ? "var(--accent)" : "var(--surface2)", position: "relative", transition: "background 0.2s ease" }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3,
        left: on ? 21 : 3, transition: "left 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }} />
    </div>
  );
}

/* ============================== МОДАЛКА ДОБАВЛЕНИЯ/РЕДАКТИРОВАНИЯ ============================== */

function HabitModal({ habit, onClose, onSave, onDelete }) {
  const isEdit = !!habit.id;
  const [name, setName] = useState(habit.name || "");
  const [icon, setIcon] = useState(habit.icon || ICONS[0]);
  const [color, setColor] = useState(habit.color || "purple");
  const canSave = name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-screen overflow-y-auto"
        style={{ background: "var(--panel-bg)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <button onClick={onClose} className="flex items-center justify-center rounded-full" style={{ width: 34, height: 34, background: "var(--surface2)" }}>
            <X size={16} color="var(--text)" />
          </button>
          <h3 style={{ color: "var(--text)", fontFamily: "var(--font-display)" }} className="text-base font-bold">
            {isEdit ? "Изменить привычку" : "Новая привычка"}
          </h3>
          <div style={{ width: 34 }} />
        </div>

        <label style={{ color: "var(--text-dim)" }} className="text-xs font-semibold uppercase tracking-wide">Название</label>
        <input
          value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Например, Пить воду"
          maxLength={40}
          className="w-full mt-2 mb-5 px-4 py-3 rounded-xl text-sm font-medium outline-none"
          style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
        />

        <label style={{ color: "var(--text-dim)" }} className="text-xs font-semibold uppercase tracking-wide">Иконка</label>
        <div className="grid grid-cols-8 gap-2 mt-2 mb-5">
          {ICONS.map(ic => (
            <button key={ic} onClick={() => setIcon(ic)} className="flex items-center justify-center rounded-xl text-lg"
              style={{
                aspectRatio: "1", background: icon === ic ? PALETTE[color].soft : "var(--surface)",
                border: icon === ic ? `1.5px solid ${PALETTE[color].c}` : "1px solid var(--border)",
              }}>
              {ic}
            </button>
          ))}
        </div>

        <label style={{ color: "var(--text-dim)" }} className="text-xs font-semibold uppercase tracking-wide">Цвет</label>
        <div className="flex gap-2.5 mt-2 mb-6">
          {Object.entries(PALETTE).map(([key, p]) => (
            <button key={key} onClick={() => setColor(key)} className="rounded-full flex items-center justify-center"
              style={{
                width: 32, height: 32, background: p.c,
                border: color === key ? "3px solid var(--text)" : "3px solid transparent",
              }}>
              {color === key && <Check size={14} color="#fff" strokeWidth={3} />}
            </button>
          ))}
        </div>

        <button
          disabled={!canSave}
          onClick={() => canSave && onSave(name, icon, color)}
          className="w-full py-3.5 rounded-xl text-sm font-bold mb-2"
          style={{ background: canSave ? "var(--accent)" : "var(--surface2)", color: canSave ? "#fff" : "var(--text-faint)" }}
        >
          {isEdit ? "Сохранить изменения" : "Создать привычку"}
        </button>

        {onDelete && (
          <button onClick={onDelete} className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2" style={{ color: "#F25656" }}>
            <Trash2 size={15} /> Удалить привычку
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================== ГЛОБАЛЬНЫЕ СТИЛИ ============================== */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
      * { box-sizing: border-box; }
      @keyframes toastIn { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }
      @keyframes confettiFall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(720px) rotate(540deg); opacity: 0; }
      }
      input::placeholder { color: var(--text-faint); }
      button { cursor: pointer; -webkit-tap-highlight-color: transparent; }
    `}</style>
  );
}
