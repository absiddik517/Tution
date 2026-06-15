import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Attendance } from '../types';
import { 
  Plus, Calendar, Clock, User, Filter, Search, Trash2, X, ClipboardCheck, ArrowUpRight, CheckSquare
} from 'lucide-react';

export default function AttendanceModule() {
  const { 
    attendance, students, addAttendance, deleteAttendance 
  } = useStore();

  const [showAddModal, setShowAddModal] = useState(false);
  
  // Filtering states
  const [selectedStudentFilter, setSelectedStudentFilter] = useState('All');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('All');
  const [dateSearchTerm, setDateSearchTerm] = useState('');

  // Add Attendance Form State
  const [formStudentId, setFormStudentId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().substring(0, 10));
  const [formEntryAt, setFormEntryAt] = useState('15:00');
  const [formExitAt, setFormExitAt] = useState('16:30');
  const [formRemarks, setFormRemarks] = useState('');
  const [formError, setFormError] = useState('');

  // Auto Calculations of duration (Duration = exitAt - entryAt in hours decimal representation)
  const calculatedDuration = useMemo(() => {
    try {
      const [entryH, entryM] = formEntryAt.split(':').map(Number);
      const [exitH, exitM] = formExitAt.split(':').map(Number);
      
      const totalEntryMin = entryH * 60 + entryM;
      const totalExitMin = exitH * 60 + exitM;

      if (totalExitMin <= totalEntryMin) return 0;
      return (totalExitMin - totalEntryMin) / 60;
    } catch (e) {
      return 0;
    }
  }, [formEntryAt, formExitAt]);

  const handleOpenAdd = () => {
    const active = students.filter(s => s.status === 'Active');
    setFormStudentId(active[0]?.id || '');
    setFormDate(new Date().toISOString().substring(0, 10));
    setFormEntryAt('15:00');
    setFormExitAt('16:30');
    setFormRemarks('');
    setFormError('');
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentId) {
      setFormError('Please choose a student for this session.');
      return;
    }
    if (calculatedDuration <= 0) {
      setFormError('Exit time must occur after the entry commencement time.');
      return;
    }

    addAttendance({
      studentId: formStudentId,
      date: formDate,
      entryAt: formEntryAt,
      exitAt: formExitAt,
      duration: Math.round(calculatedDuration * 100) / 100,
      remarks: formRemarks.trim() || 'Standard revision slot.',
    });

    setShowAddModal(false);
  };

  // EXTRACT DYNAMIC MONTHS LISTED FOR DROPDOWN FILTER
  const distinctMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    attendance.forEach(at => {
      // date is "YYYY-MM-DD", extract "YYYY-MM"
      const prefix = at.date.substring(0, 7);
      monthsSet.add(prefix);
    });
    return Array.from(monthsSet).sort().reverse(); // Show latest months first
  }, [attendance]);

  // FILTERED ATTENDANCE DATASET
  const filteredAttendance = useMemo(() => {
    return attendance.filter(at => {
      const matchesStudent = selectedStudentFilter === 'All' ? true : at.studentId === selectedStudentFilter;
      const matchesMonth = selectedMonthFilter === 'All' ? true : at.date.startsWith(selectedMonthFilter);
      const matchesSearch = dateSearchTerm ? at.date.includes(dateSearchTerm) || at.remarks.toLowerCase().includes(dateSearchTerm.toLowerCase()) : true;
      return matchesStudent && matchesMonth && matchesSearch;
    });
  }, [attendance, selectedStudentFilter, selectedMonthFilter, dateSearchTerm]);

  // REFRESH METRICS FROM FILTERED DATASET
  const totalDays = filteredAttendance.length;
  const totalHours = useMemo(() => {
    return Math.round(filteredAttendance.reduce((sum, curr) => sum + curr.duration, 0) * 10) / 10;
  }, [filteredAttendance]);

  // Group active students
  const activeStudents = useMemo(() => students.filter(s => s.status === 'Active'), [students]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Attendance Log Register</h2>
          <p className="text-xs text-slate-400">Log private tuitions completed, audit teaching hours and output logs</p>
        </div>

        <button 
          onClick={handleOpenAdd}
          disabled={activeStudents.length === 0}
          className="px-4 py-2 bg-indigo-600 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-sm hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <Plus size={15} /> Log session attendance
        </button>
      </div>

      {activeStudents.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 font-medium">
          ⚠️ Notice: Register active students first under Student Directory to sign daily attendance records here.
        </div>
      )}

      {/* Aggregate metrics box */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-indigo-905 bg-slate-900 text-white rounded-2xl">
          <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest block">Logged Sessions</span>
          <span className="text-2xl font-bold tracking-tight block mt-1">{totalDays} classes</span>
          <span className="text-[10px] text-indigo-200 mt-2 block font-medium">Total completed days</span>
        </div>

        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-bold">Invoiced hours</span>
          <span className="text-2xl font-bold text-slate-800 tracking-tight block mt-1">{totalHours} hours</span>
          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full inline-block mt-2 font-semibold">
            Average: {totalDays > 0 ? (Math.round((totalHours / totalDays) * 10) / 10) : 0} hrs/session
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-1.5 flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-bold">Billing Synchronization</span>
          <p className="text-xs text-slate-500 leading-snug">
            Attendance marks are translated directly into payable amounts on the Payments controller screen.
          </p>
        </div>
      </div>

      {/* Filtering tools */}
      <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Quick client select */}
          <div className="flex items-center gap-2">
            <User size={15} className="text-slate-400 shrink-0" />
            <select
              value={selectedStudentFilter}
              onChange={(e) => setSelectedStudentFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs font-semibold text-slate-600 focus:outline-none"
            >
              <option value="All">All Students</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.class})</option>
              ))}
            </select>
          </div>

          {/* Month selector filter */}
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-slate-400 shrink-0" />
            <select
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs font-semibold text-slate-600 focus:outline-none"
            >
              <option value="All">All Months</option>
              {distinctMonths.map(m => {
                // translate "YYYY-MM" to readable "Month YYYY"
                const [yearCode, monthNum] = m.split('-');
                const monthObj = new Date(Number(yearCode), Number(monthNum) - 1, 1);
                const desc = monthObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                return <option key={m} value={m}>{desc}</option>;
              })}
            </select>
          </div>

          {/* Date Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={15} />
            <input 
              type="text" 
              placeholder="Filter by date (YYYY-MM-DD) or notes..."
              value={dateSearchTerm}
              onChange={(e) => setDateSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Primary Log grid */}
      <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800">Attendance Database Entries ({filteredAttendance.length})</h3>

        {filteredAttendance.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-2">
            <ClipboardCheck className="mx-auto text-slate-300 stroke-[1.2]" size={42} />
            <p className="text-sm font-semibold">No Attendance Records</p>
            <p className="text-xs max-w-xs mx-auto">
              No daily session marks align with the query. Press "Log session attendance" above to add new records.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-120 overflow-y-auto pr-1">
            {filteredAttendance.map(log => {
              const student = students.find(s => s.id === log.studentId);
              return (
                <div key={log.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-200 transition">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-bold">
                      {student?.name.charAt(0) || '?'}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-800">{student?.name || 'Unknown client'}</h4>
                        <span className="text-[10px] text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                          {student?.class}
                        </span>
                        {log.syncStatus === 'pending' && (
                          <span className="w-2 h-2 bg-orange-400 rounded-full inline-block animate-pulse" title="Sync pending to firebase" />
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 text-xs mt-1.5 font-medium">
                        <span className="flex items-center gap-1 text-slate-600 font-semibold bg-white border border-slate-100 px-2 py-0.5 rounded-lg shadow-sm">
                          <Clock size={13} className="text-indigo-600" />
                          {log.entryAt} - {log.exitAt} ({log.duration} hrs)
                        </span>
                        <span className="text-slate-400">Date: <span className="text-slate-700 font-bold">{log.date}</span></span>
                      </div>

                      {log.remarks && (
                        <p className="text-xs italic text-slate-400 mt-2">
                          📝 {log.remarks}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0">
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to permanently erase this attendance mark? This will update calculated invoice parameters.`)) {
                          deleteAttendance(log.id);
                        }
                      }}
                      className="text-xs font-semibold text-slate-400 hover:text-red-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-slate-100 hover:border-red-100 transition flex items-center gap-1 shrink-0 ml-auto"
                    >
                      <Trash2 size={13} /> Erase Log
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QUICK ATTENDANCE ENTRY DIALOG MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">New Attendance Entry</h3>
                <p className="text-xs text-slate-400 mt-0.5">Define session duration times and log student remarks</p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {formError && (
                <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-xs text-red-600 font-bold">
                  ⚠️ {formError}
                </div>
              )}

              {/* Student Id selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Student</label>
                <select
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                >
                  {activeStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.class})</option>
                  ))}
                </select>
              </div>

              {/* Session Date */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Date</label>
                <input 
                  type="date" 
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Entry Time */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Entry Time (Commence)</label>
                  <input 
                    type="time" 
                    value={formEntryAt}
                    onChange={(e) => setFormEntryAt(e.target.value)}
                    className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  />
                </div>

                {/* Exit Time */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Exit Time (Dismiss)</label>
                  <input 
                    type="time" 
                    value={formExitAt}
                    onChange={(e) => setFormExitAt(e.target.value)}
                    className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Live calculated duration indicator feedback */}
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-900 flex justify-between items-center font-bold">
                <span className="flex items-center gap-1"><CheckSquare size={13} /> Logged Duration:</span>
                <span className="text-indigo-700 bg-white px-3 py-1 rounded-full shadow-sm">
                  {calculatedDuration > 0 ? `${Math.round(calculatedDuration * 100) / 100} hours` : '0 hours (invalid timeframe)'}
                </span>
              </div>

              {/* Remarks */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Session Logs / Syllabus Notes</label>
                <textarea 
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="e.g. Conducted mock test in calculus, reviewed geometry formulas, mapped physics graphs..."
                  rows={2}
                  className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none resize-none"
                />
              </div>

              {/* Action triggers */}
              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl text-xs hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow hover:bg-indigo-700 transition"
                >
                  Save Log
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
