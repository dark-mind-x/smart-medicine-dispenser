import React, { useState, useEffect, useMemo } from "react";
import { ref, onValue, update, set } from "firebase/database";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { db, auth, googleProvider } from "./firebase";
import {
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Bell,
  RefreshCw,
  ShieldAlert,
  Zap,
  Calendar,
  Pill,
  HeartPulse,
  Search,
  RotateCcw,
  Check,
  Wifi,
  WifiOff,
  LogOut,
  Edit3,
  Save,
  X,
  User,
  Lock,
  Mail,
  LayoutDashboard,
  History
} from "lucide-react";

export default function App() {
  // Authentication States
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Mobile Tab Navigation State ("dashboard" | "schedules" | "history")
  const [activeTab, setActiveTab] = useState("dashboard");

  // Dispenser & RTDB States
  const [device, setDevice] = useState({
    status: "OFFLINE",
    last_seen: 0,
    current_alert: "NONE",
    caretaker_alert: false,
    manual_dispense: false
  });
  const [history, setHistory] = useState([]);
  const [schedules, setSchedules] = useState({
    slot_01: { name: "Morning Medicine", time: "08:30", dose: "500mg Metformin", active: true },
    slot_02: { name: "Evening Medicine", time: "20:00", dose: "10mg Atorvastatin", active: true }
  });

  // UI Interaction States
  const [isDispensing, setIsDispensing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Schedule Editor Modal States
  const [editingSlotKey, setEditingSlotKey] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", time: "08:00", dose: "", active: true });
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // 1. Listen for Auth State Changes
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubAuth();
  }, []);

  // 2. Real-time Clock Tick (Every 1s)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. Subscribe to Firebase RTDB (Only when authenticated)
  useEffect(() => {
    if (!user) return;

    const deviceRef = ref(db, "device");
    const historyRef = ref(db, "history");
    const schedRef = ref(db, "schedules");

    const unsubDevice = onValue(deviceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setDevice(data);
    });

    const unsubHistory = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const formatted = Object.entries(data).map(([key, val]) => ({
          id: key,
          ...val
        }));
        formatted.sort((a, b) => Number(b.id) - Number(a.id));
        setHistory(formatted);
      } else {
        setHistory([]);
      }
    });

    const unsubSched = onValue(schedRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setSchedules(data);
    });

    return () => {
      unsubDevice();
      unsubHistory();
      unsubSched();
    };
  }, [user]);

  // 4. Calculate Live ESP32 Online/Offline Status
  const currentEpoch = Math.floor(currentTime.getTime() / 1000);
  const secondsSinceHeartbeat = device.last_seen
    ? Math.max(0, currentEpoch - Number(device.last_seen))
    : 9999;
  const isOnline = secondsSinceHeartbeat <= 30;

  // Auth Handlers
  const handleGoogleSignIn = async () => {
    setAuthError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err.message.replace("Firebase: ", ""));
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError(err.message.replace("Firebase: ", ""));
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  // Hardware & Schedule Handlers
  const handleManualDispense = async () => {
    setIsDispensing(true);
    try {
      await update(ref(db, "device"), { manual_dispense: true });
      setTimeout(() => setIsDispensing(false), 3500);
    } catch (err) {
      console.error("Dispense error:", err);
      setIsDispensing(false);
    }
  };

  const handleAcknowledgeAlert = async () => {
    await update(ref(db, "device"), {
      caretaker_alert: false,
      current_alert: "NONE"
    });
  };

  const handleToggleSchedule = async (slotKey) => {
    const currentState = schedules[slotKey]?.active;
    await set(ref(db, `schedules/${slotKey}/active`), !currentState);
  };

  const openScheduleModal = (slotKey, slotData) => {
    setEditingSlotKey(slotKey);
    setEditForm({
      name: slotData.name || "",
      time: slotData.time || "08:00",
      dose: slotData.dose || "",
      active: slotData.active ?? true
    });
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!editingSlotKey) return;
    setIsSavingSchedule(true);
    try {
      await set(ref(db, `schedules/${editingSlotKey}`), {
        name: editForm.name.trim() || "Scheduled Dose",
        time: editForm.time,
        dose: editForm.dose.trim() || "1 Tablet",
        active: editForm.active
      });
      setEditingSlotKey(null);
    } catch (err) {
      console.error("Failed to update schedule:", err);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // KPI Metrics
  const missedList = useMemo(
    () => history.filter((h) => h.status === "MISSED_RETRACTED"),
    [history]
  );
  const takenList = useMemo(
    () => history.filter((h) => h.status === "TAKEN"),
    [history]
  );

  const totalDoses = takenList.length + missedList.length;
  const adherenceRate = totalDoses > 0 ? Math.round((takenList.length / totalDoses) * 100) : 100;

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesFilter =
        filterStatus === "ALL" ||
        (filterStatus === "TAKEN" && item.status === "TAKEN") ||
        (filterStatus === "MISSED" && item.status === "MISSED_RETRACTED");

      const dateStr = new Date(Number(item.id) * 1000).toLocaleString().toLowerCase();
      const slotStr = `slot ${item.slot || 1}`.toLowerCase();
      const statusStr = (item.status || "").toLowerCase();
      const query = searchQuery.toLowerCase();

      return matchesFilter && (dateStr.includes(query) || slotStr.includes(query) || statusStr.includes(query));
    });
  }, [history, filterStatus, searchQuery]);

  // Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-500 animate-pulse">
            <HeartPulse className="w-8 h-8" />
          </div>
          <p className="text-slate-400 font-mono text-sm">Initializing MedSafe Portal...</p>
        </div>
      </div>
    );
  }

  // ==================== LOGIN / AUTH VIEW ====================
  if (!user) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-4 sm:p-6 selection:bg-rose-500/30">
        <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 backdrop-blur-xl animate-fade-in">
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-500 flex items-center justify-center text-white shadow-xl shadow-rose-600/30 mb-2">
              <HeartPulse className="w-9 h-9" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              MedSafe Personal
            </h1>
            <p className="text-sm text-slate-400">
              Sign in to manage pill schedules & monitor real-time ESP32 telemetry
            </p>
          </div>

          {authError && (
            <div className="p-3.5 bg-rose-950/80 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* Google Sign-In Button */}
          <button
            onClick={handleGoogleSignIn}
            type="button"
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white hover:bg-slate-100 active:scale-[0.99] text-slate-900 font-bold rounded-xl text-sm transition-all shadow-md"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-4 text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Or with Email
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Email & Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-rose-600/25"
            >
              {isRegistering ? "Create Personal Account" : "Sign In to Dispenser"}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400">
            {isRegistering ? "Already have an account?" : "Need a caretaker account?"}{" "}
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-rose-400 hover:text-rose-300 font-semibold underline ml-1"
            >
              {isRegistering ? "Sign In" : "Register Here"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ==================== AUTHENTICATED PERSONAL APP VIEW ====================
  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans pb-20 md:pb-8 selection:bg-rose-500/30">
      {/* Caretaker Retraction Alert Banner */}
      {device.caretaker_alert && (
        <div className="bg-rose-950/95 border-b border-rose-500/50 p-4 sticky top-0 z-50 backdrop-blur-lg animate-slide-down shadow-2xl">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl animate-pulse flex-shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-rose-200">
                  Critical Alert: Missed Dose Retracted
                </h3>
                <p className="text-xs text-rose-300/90">
                  Medicine went untaken during the 3-phase alert and was swept into the lockbox.
                </p>
              </div>
            </div>
            <button
              onClick={handleAcknowledgeAlert}
              className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold rounded-xl text-xs sm:text-sm transition-all"
            >
              Acknowledge & Clear
            </button>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8 flex-1">
        {/* Top Header */}
        <header className="flex flex-col gap-4 pb-5 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr from-rose-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-600/25 flex-shrink-0">
                <HeartPulse className="w-6 h-6 sm:w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                    MedSafe Personal
                  </h1>
                  <span className="hidden sm:inline-block px-2 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-xs font-semibold rounded-md">
                    v2.5 Cloud
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">
                  Welcome, {user.displayName || user.email}
                </p>
              </div>
            </div>

            {/* User Profile & Sign Out */}
            <div className="flex items-center gap-2.5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Avatar"
                  className="w-9 h-9 rounded-xl border border-slate-700"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                  <User className="w-4 h-4" />
                </div>
              )}
              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs sm:text-sm font-semibold transition"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Live Status Bar & Instant Action */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-between gap-2.5 bg-slate-900/60 border border-slate-800/90 p-3 rounded-2xl">
            <div className="flex flex-wrap items-center gap-2.5 col-span-2 sm:col-span-1">
              {/* ESP32 Live Connection Pill */}
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border ${
                  isOnline
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                }`}
              >
                {isOnline ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <Wifi className="w-4 h-4" />
                    <span>ESP32 Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4" />
                    <span>
                      ESP32 Offline{" "}
                      {device.last_seen
                        ? `(${
                            secondsSinceHeartbeat < 120
                              ? `${secondsSinceHeartbeat}s ago`
                              : `${Math.floor(secondsSinceHeartbeat / 60)}m ago`
                          })`
                        : ""}
                    </span>
                  </>
                )}
              </div>

              {/* Live Clock */}
              <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-xl text-xs sm:text-sm font-mono text-slate-300">
                <Clock className="w-4 h-4 text-rose-400" />
                <span>
                  {currentTime.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                  })}
                </span>
              </div>
            </div>

            {/* Remote Dispense Trigger */}
            <button
              onClick={handleManualDispense}
              disabled={isDispensing || !isOnline}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-rose-600/25"
            >
              {isDispensing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              <span>{isDispensing ? "Dispensing Dose..." : "Dispense Immediate"}</span>
            </button>
          </div>
        </header>

        {/* KPI Telemetry Cards (Always visible on Desktop, visible on 'dashboard' tab on Mobile) */}
        <section
          className={`${
            activeTab === "dashboard" ? "grid" : "hidden md:grid"
          } grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5`}
        >
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs sm:text-sm font-semibold">
              <span>Adherence</span>
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-4xl font-extrabold text-white mt-2 font-mono">
              {adherenceRate}%
            </div>
            <div className="w-full bg-slate-800 h-1.5 sm:h-2 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-700"
                style={{ width: `${adherenceRate}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs sm:text-sm font-semibold">
              <span>Doses Taken</span>
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-4xl font-extrabold text-white mt-2 font-mono">
              {takenList.length}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-2">IR verified pickup</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs sm:text-sm font-semibold">
              <span>Missed Doses</span>
              <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
            </div>
            <div className="text-2xl sm:text-4xl font-extrabold text-rose-400 mt-2 font-mono">
              {missedList.length}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-2">Swept to lockbox</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between text-slate-400 text-xs sm:text-sm font-semibold">
              <span>Active Timers</span>
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-4xl font-extrabold text-white mt-2 font-mono">
              {Object.values(schedules).filter((s) => s.active).length}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-2">Synced to ESP32 RTC</p>
          </div>
        </section>

        {/* Missed Dosages Spotlight (Visible on 'dashboard' tab on Mobile & always on Desktop) */}
        <section
          className={`${
            activeTab === "dashboard" ? "block" : "hidden md:block"
          } bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Missed Medication & Reclamations
                </h2>
                <p className="text-xs text-slate-400">
                  Doses untaken after 3-phase escalation and retracted by Servo 2
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-lg">
              {missedList.length} Missed
            </span>
          </div>

          {missedList.length === 0 ? (
            <div className="p-6 text-center bg-slate-950/50 border border-slate-800/80 rounded-xl">
              <Check className="w-8 h-8 text-emerald-400 mx-auto mb-1.5" />
              <p className="text-sm font-bold text-slate-200">Zero Missed Doses</p>
              <p className="text-xs text-slate-400 mt-0.5">
                All scheduled medications have been collected on time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {missedList.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950/80 border border-rose-500/30 rounded-xl p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono text-rose-400 uppercase font-bold">
                        Compartment {item.slot || 1}
                      </span>
                      <h4 className="text-sm font-bold text-slate-100 mt-0.5">
                        Retracted to Lockbox
                      </h4>
                    </div>
                    <span className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg">
                      <RotateCcw className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-mono bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
                    <div>Time: {new Date(Number(item.id) * 1000).toLocaleTimeString()}</div>
                    <div>Date: {new Date(Number(item.id) * 1000).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Schedules & History Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Interactive Schedule Manager */}
          <div
            className={`${
              activeTab === "schedules" || activeTab === "dashboard" ? "block" : "hidden md:block"
            } space-y-4`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-rose-400" />
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Pill Schedule Configuration
                </h2>
              </div>
              <span className="text-xs text-slate-400">Tap Edit to change</span>
            </div>

            <div className="space-y-3.5">
              {Object.entries(schedules).map(([key, slot], idx) => (
                <div
                  key={key}
                  className="bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 sm:p-5 space-y-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl">
                        <Pill className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                          Slot {idx + 1}
                        </span>
                        <h3 className="font-bold text-white text-base">{slot.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{slot.dose}</p>
                      </div>
                    </div>

                    <span className="font-mono text-lg sm:text-xl font-extrabold text-rose-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                      {slot.time}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-2">
                    <button
                      onClick={() => openScheduleModal(key, slot)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Edit Schedule</span>
                    </button>

                    <button
                      onClick={() => handleToggleSchedule(key)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                        slot.active
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-slate-800 text-slate-500 border border-slate-700"
                      }`}
                    >
                      {slot.active ? "Enabled" : "Paused"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dispensing Audit History */}
          <div
            className={`${
              activeTab === "history" || activeTab === "dashboard" ? "block" : "hidden md:block"
            } lg:col-span-2 space-y-4`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-rose-400" />
                <h2 className="text-base sm:text-lg font-bold text-white">Dispensing History Log</h2>
              </div>

              {/* Search & Filter Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search history..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-44 bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
                  {["ALL", "TAKEN", "MISSED"].map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterStatus(type)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                        filterStatus === type
                          ? "bg-rose-600 text-white shadow"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-xs font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-4">Timestamp</th>
                    <th className="px-5 py-4">Compartment</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Sensor Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-5 py-10 text-center text-slate-500 text-sm">
                        No dispensing records match your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4 font-mono text-slate-300 text-xs">
                          {new Date(Number(record.id) * 1000).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                          })}
                        </td>
                        <td className="px-5 py-4 font-semibold text-white">
                          Slot {record.slot || 1}
                        </td>
                        <td className="px-5 py-4">
                          {record.status === "TAKEN" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Taken
                            </span>
                          )}
                          {record.status === "MISSED_RETRACTED" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <XCircle className="w-3.5 h-3.5" /> Retracted
                            </span>
                          )}
                          {record.status === "DISPENSED" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Awaiting Intake
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400">
                          {record.status === "TAKEN"
                            ? "IR Sensor Confirmed Removal"
                            : record.status === "MISSED_RETRACTED"
                            ? "Reclaimed by Servo 2 Trapdoor"
                            : "Pill sitting in tray"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-3">
              {filteredHistory.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-500 text-sm">
                  No dispensing events found.
                </div>
              ) : (
                filteredHistory.map((record) => (
                  <div
                    key={record.id}
                    className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">
                        Slot {record.slot || 1}
                      </span>
                      {record.status === "TAKEN" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Taken
                        </span>
                      )}
                      {record.status === "MISSED_RETRACTED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3.5 h-3.5" /> Retracted
                        </span>
                      )}
                      {record.status === "DISPENSED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Pending
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      {new Date(Number(record.id) * 1000).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                      {record.status === "TAKEN"
                        ? "IR Sensor Confirmed Pickup"
                        : record.status === "MISSED_RETRACTED"
                        ? "Servo 2 Reclaimed to Lockbox"
                        : "Awaiting Patient Collection"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Schedule Edit Modal */}
      {editingSlotKey && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-rose-400" />
                <h3 className="text-lg font-bold text-white">
                  Edit {editingSlotKey === "slot_01" ? "Slot 1" : "Slot 2"} Schedule
                </h3>
              </div>
              <button
                onClick={() => setEditingSlotKey(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Schedule Label</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="e.g., Morning Medicine"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Dispense Time (24-Hour Format)
                </label>
                <input
                  type="time"
                  required
                  value={editForm.time}
                  onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base font-mono text-rose-400 font-bold focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Medication & Dosage Details
                </label>
                <input
                  type="text"
                  required
                  value={editForm.dose}
                  onChange={(e) => setEditForm({ ...editForm, dose: e.target.value })}
                  placeholder="e.g., 500mg Metformin (1 Tablet)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-semibold text-slate-300">Enable this slot</span>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, active: !editForm.active })}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                    editForm.active
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  {editForm.active ? "Active" : "Disabled"}
                </button>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSlotKey(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSchedule}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-rose-600/25"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingSchedule ? "Saving..." : "Save Schedule"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-slate-800/90 backdrop-blur-lg z-40 px-6 py-2 flex items-center justify-around">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            activeTab === "dashboard" ? "text-rose-400" : "text-slate-400"
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[11px] font-bold">Overview</span>
        </button>

        <button
          onClick={() => setActiveTab("schedules")}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            activeTab === "schedules" ? "text-rose-400" : "text-slate-400"
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[11px] font-bold">Schedules</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            activeTab === "history" ? "text-rose-400" : "text-slate-400"
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[11px] font-bold">History</span>
        </button>
      </nav>
    </div>
  );
}
