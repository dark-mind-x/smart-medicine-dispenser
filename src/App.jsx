import React, { useState, useEffect, useMemo } from "react";
import { ref, onValue, update, set } from "firebase/database";
import { db } from "./firebase";
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
  ChevronRight,
  Wifi,
  WifiOff
} from "lucide-react";

export default function App() {
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
  const [isDispensing, setIsDispensing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Filters and search states
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Realtime Database sync
  useEffect(() => {
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
  }, []);

  // Manual Trigger
  const handleManualDispense = async () => {
    setIsDispensing(true);
    try {
      await update(ref(db, "device"), { manual_dispense: true });
      setTimeout(() => setIsDispensing(false), 3500);
    } catch (err) {
      console.error("Dispense trigger error:", err);
      setIsDispensing(false);
    }
  };

  // Clear Emergency Retraction Alert
  const handleAcknowledgeAlert = async () => {
    await update(ref(db, "device"), {
      caretaker_alert: false,
      current_alert: "NONE"
    });
  };

  // Toggle Schedules
  const handleToggleSchedule = async (slotKey) => {
    const currentState = schedules[slotKey]?.active;
    await set(ref(db, `schedules/${slotKey}/active`), !currentState);
  };

  // KPI Calculations
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

  // Filtered History
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

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans transition-colors duration-300">
      {/* Caretaker Retraction Alert Banner */}
      {device.caretaker_alert && (
        <div className="bg-rose-950/90 border-b border-rose-500/50 p-4 sm:p-5 sticky top-0 z-50 backdrop-blur-lg animate-slide-down shadow-2xl shadow-rose-950/50">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl animate-pulse flex-shrink-0">
                <ShieldAlert className="w-7 h-7 sm:w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-rose-200">
                  Patient Alert: Missed Dose Retracted
                </h3>
                <p className="text-xs sm:text-sm text-rose-300/90 mt-0.5">
                  The medicine was not taken during the 3-phase reminder escalation. Servo 2 swept the dose into the locked container.
                </p>
              </div>
            </div>
            <button
              onClick={handleAcknowledgeAlert}
              className="w-full md:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold rounded-xl text-sm transition-all duration-200 shadow-lg shadow-rose-900/40"
            >
              Acknowledge & Clear
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 flex-1">
        {/* Navigation & Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-xl shadow-indigo-600/25 flex-shrink-0">
              <HeartPulse className="w-7 h-7 sm:w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  SmartDispense IoT
                </h1>
                <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-xs font-semibold rounded-lg">
                  FreeRTOS Core
                </span>
              </div>
              <p className="text-sm sm:text-base text-slate-400 mt-1">
                Automated schedule monitoring & infrared verification
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Clock Widget */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3.5 py-2.5 rounded-xl text-sm sm:text-base shadow-inner">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span className="font-mono text-slate-200 font-semibold">
                {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>

            {/* Hardware Status */}
            <div className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-800 px-3.5 py-2.5 rounded-xl text-sm font-medium">
              {device.status === "ONLINE" ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-emerald-400 font-semibold">ESP32 Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-rose-500" />
                  <span className="text-rose-400 font-semibold">Offline</span>
                </>
              )}
            </div>

            {/* Manual Dispense */}
            <button
              onClick={handleManualDispense}
              disabled={isDispensing || device.status !== "ONLINE"}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold rounded-xl text-sm sm:text-base transition-all duration-200 shadow-lg shadow-indigo-600/30 ml-auto lg:ml-0"
            >
              {isDispensing ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Zap className="w-4 h-4 text-white" />
              )}
              <span>Dispense Now</span>
            </button>
          </div>
        </header>

        {/* Analytics Overview Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <div className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between text-slate-400 text-sm font-semibold">
              <span>Adherence Rate</span>
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-white mt-3 font-mono">
              {adherenceRate}%
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full mt-4 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${adherenceRate}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between text-slate-400 text-sm font-semibold">
              <span>Doses Taken</span>
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-white mt-3 font-mono">
              {takenList.length}
            </div>
            <p className="text-xs text-slate-400 mt-3">Verified by optical IR sensor</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between text-slate-400 text-sm font-semibold">
              <span>Missed & Retracted</span>
              <XCircle className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-rose-400 mt-3 font-mono">
              {missedList.length}
            </div>
            <p className="text-xs text-slate-400 mt-3">Safely swept into lockbox</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between text-slate-400 text-sm font-semibold">
              <span>Daily Schedules</span>
              <Calendar className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-white mt-3 font-mono">
              {Object.values(schedules).filter((s) => s.active).length}
            </div>
            <p className="text-xs text-slate-400 mt-3">Synced via DS3231 RTC clock</p>
          </div>
        </section>

        {/* Dedicated Missed Dosages Monitor */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Missed Medication Incidents
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Doses that timed out without removal and were retracted by Servo 2
                </p>
              </div>
            </div>
            <span className="text-xs sm:text-sm font-mono font-semibold px-3 py-1 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-lg self-start sm:self-auto">
              {missedList.length} Total Incidents
            </span>
          </div>

          {missedList.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/50 border border-slate-800/80 rounded-xl">
              <Check className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-base font-bold text-slate-200">No Missed Medication</p>
              <p className="text-sm text-slate-400 mt-1">
                The patient retrieved all dispensed doses on time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {missedList.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950/80 border border-rose-500/30 hover:border-rose-500/50 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono text-rose-400 uppercase tracking-wider font-bold">
                        Slot {item.slot || 1}
                      </span>
                      <h4 className="text-base font-bold text-slate-100 mt-1">Dose Retracted</h4>
                    </div>
                    <span className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                      <RotateCcw className="w-5 h-5" />
                    </span>
                  </div>

                  <div className="text-sm text-slate-300 space-y-1.5 font-mono bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
                    <div>Time: {new Date(Number(item.id) * 1000).toLocaleTimeString()}</div>
                    <div>Date: {new Date(Number(item.id) * 1000).toLocaleDateString()}</div>
                  </div>

                  <div className="text-xs text-rose-300/90 flex items-center gap-2 pt-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>IR sensor confirmed pill reclamation</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Schedules & Audit Logs Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Schedules Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Scheduled Timers</h2>
            </div>

            <div className="space-y-3">
              {Object.entries(schedules).map(([key, slot]) => (
                <div
                  key={key}
                  className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 transition-all duration-200"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-slate-800/80 text-indigo-400 rounded-xl">
                      <Pill className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-100 text-sm sm:text-base">{slot.name}</h3>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 mt-1 font-mono">
                        <span className="text-indigo-300 font-semibold">{slot.time}</span>
                        <span>•</span>
                        <span>{slot.dose}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleSchedule(key)}
                    className={`text-xs sm:text-sm px-3.5 py-2 rounded-xl font-semibold transition-all duration-200 active:scale-95 ${
                      slot.active
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                        : "bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    {slot.active ? "Active" : "Disabled"}
                  </button>
                </div>
              ))}
            </div>

            {/* 3-Phase Progression Guide */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3.5 text-xs sm:text-sm">
              <span className="font-bold text-slate-200 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                3-Phase Alert Workflow
              </span>
              <div className="space-y-2.5 text-slate-400">
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="font-medium text-slate-300">Phase 1 (0–60s)</span>
                  <span>Soft chime & display reminder</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="font-medium text-amber-300">Phase 2 (60–120s)</span>
                  <span>Fast beeping & alert LED</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-rose-400">Phase 3 (120–180s)</span>
                  <span>Alarm tone & trapdoor sweep</span>
                </div>
              </div>
            </div>
          </div>

          {/* Audit History Log Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">Dispensing Audit Log</h2>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-44 bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1 text-xs sm:text-sm">
                  {["ALL", "TAKEN", "MISSED"].map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterStatus(type)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all duration-200 ${
                        filterStatus === type
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Desktop Table View (Hidden on mobile) */}
            <div className="hidden md:block bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-xs font-semibold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-4">Timestamp</th>
                    <th className="px-5 py-4">Slot</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-5 py-12 text-center text-slate-500 text-sm">
                        No dispensing events found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4 font-mono text-slate-300">
                          {new Date(Number(record.id) * 1000).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                          })}
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-100">
                          Slot {record.slot || 1}
                        </td>
                        <td className="px-5 py-4">
                          {record.status === "TAKEN" && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Taken
                            </span>
                          )}
                          {record.status === "MISSED_RETRACTED" && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <XCircle className="w-3.5 h-3.5" /> Missed & Retracted
                            </span>
                          )}
                          {record.status === "DISPENSED" && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> In Progress
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400">
                          {record.status === "TAKEN"
                            ? "IR Sensor Confirmed Pickup"
                            : record.status === "MISSED_RETRACTED"
                            ? "Servo 2 Reclaimed to Lockbox"
                            : "Awaiting Patient Collection"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (Rendered on mobile screens) */}
            <div className="md:hidden space-y-3">
              {filteredHistory.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-500 text-sm">
                  No dispensing events found.
                </div>
              ) : (
                filteredHistory.map((record) => (
                  <div
                    key={record.id}
                    className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 text-base">
                        Slot {record.slot || 1}
                      </span>
                      {record.status === "TAKEN" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Taken
                        </span>
                      )}
                      {record.status === "MISSED_RETRACTED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3.5 h-3.5" /> Retracted
                        </span>
                      )}
                      {record.status === "DISPENSED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Pending
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-mono text-slate-400">
                      {new Date(Number(record.id) * 1000).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                      })}
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
    </div>
  );
}
