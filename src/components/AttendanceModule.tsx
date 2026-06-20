import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Attendance } from '../types';
import { 
  Plus, Calendar, Clock, User, Filter, Search, Trash2, Edit3, X, ClipboardCheck, CheckSquare, ChevronLeft, ChevronRight, List
} from 'lucide-react';
import { formatDate, formatTime } from '../formatUtils';

// Precise custom student highlight badges matching the user's provided screenshot
const getStudentBadgeStyle = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('sabil')) {
    return 'bg-[#d32f2f] text-white font-extrabold'; // Coral-red
  }
  if (n.includes('ramim')) {
    return 'bg-[#e67e22] text-white font-extrabold'; // Amber-orange
  }
  if (n.includes('arnob') || n.includes('badho')) {
    return 'bg-[#c0ca33] text-white font-extrabold'; // Yellow-green
  }
  if (n.includes('shonai')) {
    return 'bg-[#10ac84] text-white font-extrabold'; // Minty dark-green
  }
  
  // Balanced default background mapping fallback
  const colors = [
    'bg-indigo-700 text-white font-semibold',
    'bg-pink-600 text-white font-semibold',
    'bg-purple-600 text-white font-semibold',
    'bg-emerald-600 text-white font-semibold',
    'bg-teal-600 text-white font-semibold',
    'bg-slate-700 text-white font-semibold',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h += name.charCodeAt(i);
  }
  return colors[h % colors.length];
};

export default function AttendanceModule() {
  const { 
    attendance, students, addAttendance, updateAttendance, deleteAttendance 
  } = useStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
  
  // Filtering states
  const [selectedStudentFilter, setSelectedStudentFilter] = useState('All');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('All');
  const [dateSearchTerm, setDateSearchTerm] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndingDateFilter] = useState('');

  // Main view state: default to 'calendar' as requested
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  // Current calendar view mode: 'day' | 'week' | 'month' (default is 'month' to preserve general views)
  const [calendarSubMode, setCalendarSubMode] = useState<'day' | 'week' | 'month'>('month');
  // Date tracker for Calendar state
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Hour definitions for Day and Week view matrices
  const HOUR_SLOTS = useMemo(() => [
    { label: '9 AM', hour: 9 },
    { label: '10 AM', hour: 10 },
    { label: '11 AM', hour: 11 },
    { label: '12 PM', hour: 12 },
    { label: '1 PM', hour: 13 },
    { label: '2 PM', hour: 14 },
    { label: '3 PM', hour: 15 },
    { label: '4 PM', hour: 16 },
    { label: '5 PM', hour: 17 },
    { label: '6 PM', hour: 18 },
    { label: '7 PM', hour: 19 },
    { label: '8 PM', hour: 20 },
    { label: '9 PM', hour: 21 },
    { label: '10 PM', hour: 22 },
    { label: '11 PM', hour: 23 },
  ], []);

  // Compute the current week's boundary lines
  const startOfWeek = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day; // Adjust for Sunday (0) start
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
  }, [currentDate]);

  const endOfWeek = useMemo(() => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [startOfWeek]);

  // Seven distinct day dates for current week column mappings
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }, [startOfWeek]);

  // Formatted labels representing active submode scopes
  const weekLabel = useMemo(() => {
    const s = startOfWeek;
    const e = endOfWeek;
    
    const sMonth = s.toLocaleString('en-US', { month: 'long' });
    const eMonth = e.toLocaleString('en-US', { month: 'long' });
    const sYear = s.getFullYear();
    const eYear = e.getFullYear();

    if (sYear !== eYear) {
      return `${sMonth} ${s.getDate()}, ${sYear} – ${eMonth} ${e.getDate()}, ${eYear}`;
    }
    if (sMonth !== eMonth) {
      return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}, ${sYear}`;
    }
    return `${sMonth} ${s.getDate()} – ${e.getDate()}, ${sYear}`;
  }, [startOfWeek, endOfWeek]);

  const dayLabel = useMemo(() => {
    const weekday = currentDate.toLocaleString('en-US', { weekday: 'long' });
    const month = currentDate.toLocaleString('en-US', { month: 'short' });
    const dayNum = currentDate.getDate();
    return `${weekday} ${month} ${dayNum}`;
  }, [currentDate]);

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
    setEditingAttendance(null);
    setShowAddModal(true);
  };

  const handleStartEdit = (log: Attendance) => {
    setEditingAttendance(log);
    setFormStudentId(log.studentId);
    setFormDate(log.date);
    setFormEntryAt(log.entryAt);
    setFormExitAt(log.exitAt);
    setFormRemarks(log.remarks || '');
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

    const payload = {
      studentId: formStudentId,
      date: formDate,
      entryAt: formEntryAt,
      exitAt: formExitAt,
      duration: Math.round(calculatedDuration * 100) / 100,
      remarks: formRemarks.trim() || 'Standard revision slot.',
    };

    if (editingAttendance) {
      updateAttendance(editingAttendance.id, payload);
    } else {
      addAttendance(payload);
    }

    setShowAddModal(false);
    setEditingAttendance(null);
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
    return attendance
      .filter(at => {
        const matchesStudent = selectedStudentFilter === 'All' ? true : at.studentId === selectedStudentFilter;
        const matchesMonth = selectedMonthFilter === 'All' ? true : at.date.startsWith(selectedMonthFilter);
        const matchesSearch = dateSearchTerm ? at.date.includes(dateSearchTerm) || at.remarks.toLowerCase().includes(dateSearchTerm.toLowerCase()) : true;
        
        // Date range filters
        const matchesStartDate = startDateFilter ? at.date >= startDateFilter : true;
        const matchesEndDate = endDateFilter ? at.date <= endDateFilter : true;

        return matchesStudent && matchesMonth && matchesSearch && matchesStartDate && matchesEndDate;
      })
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.entryAt.localeCompare(a.entryAt);
      });
  }, [attendance, selectedStudentFilter, selectedMonthFilter, dateSearchTerm, startDateFilter, endDateFilter]);

  // Group filteredAttendance by date
  const groupedAttendanceByDate = useMemo(() => {
    const groups: { [key: string]: typeof filteredAttendance } = {};
    filteredAttendance.forEach(log => {
      if (!groups[log.date]) {
        groups[log.date] = [];
      }
      groups[log.date].push(log);
    });
    return groups;
  }, [filteredAttendance]);

  // Group active students
  const activeStudents = useMemo(() => students.filter(s => s.status === 'Active'), [students]);

  // --- CALENDAR GENERATION LOGIC ---
  const calendarCells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay(); // 0 is Sunday, 1 is Monday ...
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: { dayNum: number; isCurrent: boolean; dateStr: string }[] = [];

    // Prior month overflow (ghost cells)
    for (let i = startWeekday - 1; i >= 0; i--) {
      const pDate = new Date(year, month - 1, prevMonthDays - i);
      const y = pDate.getFullYear();
      const mStr = String(pDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(pDate.getDate()).padStart(2, '0');
      cells.push({
        dayNum: prevMonthDays - i,
        isCurrent: false,
        dateStr: `${y}-${mStr}-${dStr}`
      });
    }

    // Active current month cells
    for (let i = 1; i <= daysInMonth; i++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(i).padStart(2, '0');
      cells.push({
        dayNum: i,
        isCurrent: true,
        dateStr: `${year}-${mStr}-${dStr}`
      });
    }

    // Subsequent month overflow (ghost cells) up to a tidy multiple of 7 rows (42 blocks)
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const nDate = new Date(year, month + 1, i);
      const y = nDate.getFullYear();
      const mStr = String(nDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(nDate.getDate()).padStart(2, '0');
      cells.push({
        dayNum: i,
        isCurrent: false,
        dateStr: `${y}-${mStr}-${dStr}`
      });
    }

    return cells;
  }, [currentDate]);

  const handlePrev = () => {
    if (calendarSubMode === 'month') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else if (calendarSubMode === 'week') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 1));
    }
  };

  const handleNext = () => {
    if (calendarSubMode === 'month') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else if (calendarSubMode === 'week') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1));
    }
  };

  const handleGoToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight font-display">Attendance Log Register</h2>
          <p className="text-xs text-slate-400">View and track completed client classes in an interactive workspace</p>
        </div>

        {/* Dynamic Mode Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl shrink-0 shadow-inner">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              viewMode === 'calendar' 
                ? 'bg-white text-indigo-700 shadow-sm' 
                : 'text-slate-500 hover:text-slate-850'
            }`}
          >
            <Calendar size={14} />
            Calendar View
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              viewMode === 'list' 
                ? 'bg-white text-indigo-700 shadow-sm' 
                : 'text-slate-500 hover:text-slate-850'
            }`}
          >
            <List size={14} />
            Timeline Register
          </button>
        </div>
      </div>

      {activeStudents.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 font-medium">
          ⚠️ Notice: Register active students first under Student Directory to sign daily attendance records here.
        </div>
      )}

      {/* Aggregate metrics box is completely removed as requested */}

      {/* Filtering tools */}
      <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Quick client select */}
          <div className="flex items-center gap-2">
            <User size={15} className="text-slate-400 shrink-0" />
            <select
              value={selectedStudentFilter}
              onChange={(e) => setSelectedStudentFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs font-bold text-slate-600 focus:outline-none"
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
              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs font-bold text-slate-600 focus:outline-none"
            >
              <option value="All">All Months</option>
              {distinctMonths.map(m => {
                const [yearCode, monthNum] = m.split('-');
                const monthObj = new Date(Number(yearCode), Number(monthNum) - 1, 1);
                const desc = monthObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                return <option key={m} value={m}>{desc}</option>;
              })}
            </select>
          </div>

          {/* Date Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-3.5 text-slate-400" size={13} />
            <input 
              type="text" 
              placeholder="Filter by date (YYYY-MM-DD) or notes..."
              value={dateSearchTerm}
              onChange={(e) => setDateSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Date Range Sub-Filter Row */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-500">Date Range:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <input 
                type="date" 
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-bold text-slate-600 focus:outline-none"
              />
              <span className="text-slate-400">to</span>
              <input 
                type="date" 
                value={endDateFilter}
                onChange={(e) => setEndingDateFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-bold text-slate-600 focus:outline-none"
              />
            </div>
            {(startDateFilter || endDateFilter) && (
              <button
                onClick={() => {
                  setStartDateFilter('');
                  setEndingDateFilter('');
                }}
                className="px-2 py-1 text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold rounded-lg transition cursor-pointer"
              >
                Clear Range
              </button>
            )}
          </div>
          
          <div className="text-[11px] text-slate-400 font-medium">
            Filtered <strong className="text-indigo-600 font-extrabold">{filteredAttendance.length}</strong> of {attendance.length} entries
          </div>
        </div>
      </div>

      {/* RENDER IN PORTRAIT CALENDAR CONTAINER WITH DYNAMIC DAY/WEEK/MONTH INTERACTION */}
      {viewMode === 'calendar' && (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            
            {/* Visual View Selection Sub-indicator Bar matching the sample images */}
            <div className="flex items-center gap-5">
              <button 
                onClick={() => setCalendarSubMode('day')}
                className={`text-[13px] font-bold pb-2.5 transition relative top-[13px] z-10 ${
                  calendarSubMode === 'day' 
                    ? 'text-blue-600 border-b-2 border-blue-600 font-extrabold' 
                    : 'text-slate-400 hover:text-slate-750'
                }`}
              >
                Day
              </button>
              <button 
                onClick={() => setCalendarSubMode('week')}
                className={`text-[13px] font-bold pb-2.5 transition relative top-[13px] z-10 ${
                  calendarSubMode === 'week' 
                    ? 'text-blue-600 border-b-2 border-blue-600 font-extrabold' 
                    : 'text-slate-400 hover:text-slate-750'
                }`}
              >
                Week
              </button>
              <button 
                onClick={() => setCalendarSubMode('month')}
                className={`text-[13px] font-bold pb-2.5 transition relative top-[13px] z-10 ${
                  calendarSubMode === 'month' 
                    ? 'text-blue-600 border-b-2 border-blue-600 font-extrabold' 
                    : 'text-slate-400 hover:text-slate-750'
                }`}
              >
                Month
              </button>
            </div>
          </div>

          {/* Navigable Selector */}
          <div className="flex items-center justify-between py-2">
            <button 
              onClick={handlePrev}
              className="p-1.5 rounded-xl border border-slate-205 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition"
              title="Previous"
            >
              <ChevronLeft size={16} />
            </button>
            <h3 className="font-extrabold text-slate-800 text-sm md:text-base tracking-tight font-display">
              {calendarSubMode === 'month' && currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
              {calendarSubMode === 'week' && weekLabel}
              {calendarSubMode === 'day' && dayLabel}
            </h3>
            <button 
              onClick={handleNext}
              className="p-1.5 rounded-xl border border-slate-205 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition"
              title="Next"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* DYNAMIC SUBSECTION: MONTH SUB-MODE */}
          {calendarSubMode === 'month' && (
            <>
              {/* Weekday indicators */}
              <div className="grid grid-cols-7 text-center border-t border-slate-105 pt-3">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, dIdx) => (
                  <span key={dIdx} className="text-xs font-bold text-slate-400 py-1">
                    {day}
                  </span>
                ))}
              </div>

              {/* Day Cells Matrix */}
              <div className="grid grid-cols-7 border-t border-l border-slate-100 rounded-b-xl overflow-hidden shadow-xs">
                {calendarCells.map((cell, idx) => {
                  const cellDate = cell.dateStr;
                  
                  // Filter active records matching this cell's date and the selected filters
                  const dayMatches = filteredAttendance.filter(at => at.date === cellDate);
                  const isToday = cellDate === new Date().toISOString().substring(0, 10);

                  return (
                    <div 
                      key={idx}
                      onClick={() => {
                        setFormDate(cellDate);
                        handleOpenAdd();
                      }}
                      className={`min-h-[110px] sm:min-h-[130px] p-1.5 border-r border-b border-slate-100 flex flex-col justify-between transition relative group cursor-pointer ${
                        cell.isCurrent ? 'bg-white hover:bg-slate-50/50' : 'bg-slate-50/20 text-slate-350'
                      }`}
                      title="Click empty grid space to log a new attendance record"
                    >
                      
                      {/* Row showing Date bubble or padded string */}
                      <div className="flex justify-end pr-0.5">
                        {isToday ? (
                          <span className="w-5.5 h-5.5 bg-blue-600 text-white rounded-full flex items-center justify-center font-extrabold text-[10px] shadow-sm">
                            {cell.dayNum}
                          </span>
                        ) : (
                          <span className={`text-[10px] font-bold ${cell.isCurrent ? 'text-slate-500' : 'text-slate-300'}`}>
                            {cell.dayNum < 10 ? `0${cell.dayNum}` : cell.dayNum}
                          </span>
                        )}
                      </div>

                      {/* Badges stack container */}
                      <div className="flex-1 mt-1 space-y-1 overflow-y-auto max-h-[80px] scrollbar-thin pr-0.5">
                        {dayMatches.map((log) => {
                          const student = students.find(s => s.id === log.studentId);
                          const studentName = student?.name || 'Client';

                          return (
                            <div
                              key={log.id}
                              onClick={(e) => {
                                e.stopPropagation(); // Block fallback date creation trigger
                                handleStartEdit(log);
                              }}
                              className={`w-full py-0.5 px-1.5 rounded text-[9px] font-extrabold truncate text-center transition hover:brightness-95 active:scale-95 shadow-sm ${getStudentBadgeStyle(studentName)}`}
                              title={`${studentName}: ${formatTime(log.entryAt)} - ${formatTime(log.exitAt)} (${log.remarks})`}
                            >
                              {studentName}
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* DYNAMIC SUBSECTION: WEEK SUB-MODE */}
          {calendarSubMode === 'week' && (
            <div className="overflow-x-auto">
              <div className="min-w-[700px] border border-slate-150 rounded-2xl overflow-hidden bg-slate-55/40">
                {/* Week View Date and Column header row */}
                <div className="grid grid-cols-[64px_repeat(7,1fr)] bg-slate-50 border-b border-slate-150 text-center py-3">
                  <div /> {/* Top left spacer cell */}
                  {weekDays.map((wd, index) => {
                    const isToday = wd.toISOString().substring(0, 10) === new Date().toISOString().substring(0, 10);
                    return (
                      <div key={index} className="flex flex-col items-center">
                        <span className={`text-[14px] font-extrabold leading-none ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center font-black shadow-xs' : 'text-slate-800'}`}>
                          {wd.getDate()}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                          {wd.toLocaleString('en-US', { weekday: 'narrow' })}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Vertical Hour and day grid panel */}
                <div className="grid grid-cols-[64px_repeat(7,1fr)] relative" style={{ height: `${HOUR_SLOTS.length * 52}px` }}>
                  
                  {/* Hour slots display labels */}
                  <div className="flex flex-col relative" style={{ height: `${HOUR_SLOTS.length * 52}px` }}>
                    {HOUR_SLOTS.map((slot, index) => (
                      <div 
                        key={index} 
                        className="absolute left-0 right-0 text-right pr-3 text-[10px] font-bold text-slate-400 flex items-center justify-end select-none"
                        style={{ top: `${index * 52}px`, height: '52px' }}
                      >
                        {slot.label}
                      </div>
                    ))}
                  </div>

                  {/* Draw helper horizontal grid line layers across */}
                  <div className="absolute left-[64px] right-0 top-0 bottom-0 pointer-events-none">
                    {HOUR_SLOTS.map((_, index) => (
                      <div 
                        key={index} 
                        className="absolute left-0 right-0 border-b border-slate-100/80"
                        style={{ top: `${index * 52}px`, height: '52px' }}
                      />
                    ))}
                  </div>

                  {/* 7 Columns for Sunday to Saturday */}
                  {weekDays.map((wdDate, dayIdx) => {
                    const dateStr = wdDate.toISOString().substring(0, 10);
                    const dayLogs = filteredAttendance.filter(at => at.date === dateStr);

                    return (
                      <div 
                        key={dayIdx} 
                        className="relative border-l border-slate-100 h-full cursor-pointer hover:bg-slate-50/20"
                        onClick={() => {
                          setFormDate(dateStr);
                          setFormEntryAt('15:00');
                          setFormExitAt('16:30');
                          handleOpenAdd();
                        }}
                      >
                        {dayLogs.map(log => {
                          const student = students.find(s => s.id === log.studentId);
                          const studentName = student?.name || 'Client';

                          // Parse start/end hour marks for absolute scaling
                          const [entH, entM] = log.entryAt.split(':').map(Number);
                          const [exH, exM] = log.exitAt.split(':').map(Number);
                          const entDec = entH + entM / 60;
                          const exDec = exH + exM / 60;

                          // Scaled view from 9 AM to midnight
                          const visibleStart = 9;
                          if (entDec < visibleStart) return null;

                          const topP = (entDec - visibleStart) * 52;
                          const heightP = (exDec - entDec) * 52;

                          return (
                            <div
                              key={log.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(log);
                              }}
                              className={`absolute left-1 right-1 rounded-lg p-1.5 flex flex-col justify-between transition cursor-pointer hover:brightness-95 hover:shadow-sm overflow-hidden select-none border-l-[3px] border-black/10 ${getStudentBadgeStyle(studentName)}`}
                              style={{ 
                                top: `${topP + 4}px`, 
                                height: `${heightP - 8}px`,
                                minHeight: '28px'
                              }}
                              title={`${studentName}: ${formatTime(log.entryAt)} - ${formatTime(log.exitAt)} (${log.remarks})`}
                            >
                              <div className="flex flex-col h-full justify-between overflow-hidden">
                                <span className="text-[10px] font-black leading-tight truncate">{studentName}</span>
                                {heightP > 40 && (
                                  <span className="text-[8px] opacity-80 font-bold whitespace-nowrap leading-none mt-0.5">
                                    {formatTime(log.entryAt)}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* DYNAMIC SUBSECTION: DAY SUB-MODE */}
          {calendarSubMode === 'day' && (
            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
              {/* Day View Header Day Initial */}
              <div className="grid grid-cols-[80px_1fr] bg-slate-50 border-b border-slate-150 py-3 text-center">
                <div />
                <div className="flex flex-col items-center">
                  <span className="text-xs font-bold text-slate-400 tracking-wider">
                    {currentDate.toLocaleString('en-US', { weekday: 'narrow' })}
                  </span>
                  <span className="text-sm font-extrabold text-slate-800 leading-none mt-1">
                    {currentDate.getDate()}
                  </span>
                </div>
              </div>

              {/* Scrollable Hourly schedule card list */}
              <div className="overflow-x-auto">
                <div className="min-w-[400px] relative divide-y divide-slate-100" style={{ height: `${HOUR_SLOTS.length * 52}px` }}>
                  {HOUR_SLOTS.map((slot, index) => {
                    return (
                      <div 
                        key={index} 
                        className="absolute left-0 right-0 border-b border-slate-100 flex items-center h-[52px]" 
                        style={{ top: `${index * 52}px` }}
                        onClick={() => {
                          const localDateStr = currentDate.toISOString().substring(0, 10);
                          const formatHStr = String(slot.hour).padStart(2, '0');
                          const formatDismissHStr = String(Math.min(slot.hour + 1, 23)).padStart(2, '0');
                          setFormDate(localDateStr);
                          setFormEntryAt(`${formatHStr}:00`);
                          setFormExitAt(`${formatDismissHStr}:30`);
                          handleOpenAdd();
                        }}
                      >
                        {/* Hour Label */}
                        <div className="w-[80px] text-right pr-4 text-[10px] font-bold text-slate-400 select-none">
                          {slot.label}
                        </div>
                        <div className="flex-1 h-full border-l border-slate-100 relative" />
                      </div>
                    );
                  })}

                  {/* Absolute rendered session logs list for active submode date */}
                  {(() => {
                    const activeDateStr = currentDate.toISOString().substring(0, 10);
                    const dayLogs = filteredAttendance.filter(at => at.date === activeDateStr);

                    return dayLogs.map(log => {
                      const student = students.find(s => s.id === log.studentId);
                      const studentName = student?.name || 'Client';

                      // Calculate percentage positions
                      const [entH, entM] = log.entryAt.split(':').map(Number);
                      const [exH, exM] = log.exitAt.split(':').map(Number);
                      const entDec = entH + entM / 60;
                      const exDec = exH + exM / 60;

                      const visibleStart = 9;
                      if (entDec < visibleStart) return null;

                      const topP = (entDec - visibleStart) * 52;
                      const heightP = (exDec - entDec) * 52;

                      return (
                        <div
                          key={log.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(log);
                          }}
                          className={`absolute left-[80px] right-4 rounded-xl p-3 flex flex-col justify-between transition cursor-pointer hover:brightness-95 hover:shadow-md select-none border-l-4 overflow-hidden border-black/10 ${getStudentBadgeStyle(studentName)}`}
                          style={{ 
                            top: `${topP + 4}px`, 
                            height: `${heightP - 8}px`,
                            minHeight: '34px'
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black truncate">{studentName}</span>
                            <span className="text-[9px] opacity-85 font-black whitespace-nowrap bg-black/10 px-1.5 py-0.5 rounded leading-none">
                              {formatTime(log.entryAt)} - {formatTime(log.exitAt)} ({log.duration} hrs)
                            </span>
                          </div>
                          {heightP > 60 && log.remarks && (
                            <p className="text-[10px] opacity-90 line-clamp-2 leading-tight italic mt-1.5 select-none font-medium">
                              📝 {log.remarks}
                            </p>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* RENDER IN GROUPED SEQUENTIAL TABLE VIEW */}
      {viewMode === 'list' && (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-800">Attendance Database Entries ({filteredAttendance.length})</h3>
            <span className="text-xs text-slate-400 font-medium">Grouped by date</span>
          </div>

          {filteredAttendance.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <ClipboardCheck className="mx-auto text-slate-300 stroke-[1.2]" size={42} />
              <p className="text-sm font-semibold">No Attendance Records</p>
              <p className="text-xs max-w-xs mx-auto">
                No daily session marks align with the query. Press the "+" action floating button to add new records.
              </p>
            </div>
          ) : (
            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
              {(Object.entries(groupedAttendanceByDate) as [string, Attendance[]][]).map(([dateStr, logs]) => {
                return (
                  <div key={dateStr} className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-xs">
                    {/* Date Group Header */}
                    <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-indigo-600" />
                        <span className="text-xs font-bold text-slate-700">{formatDate(dateStr)}</span>
                      </div>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded-full">
                        {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
                      </span>
                    </div>

                    {/* Table presentation for this date */}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[550px] border-collapse text-left text-xs text-slate-600">
                        <thead>
                          <tr className="bg-slate-50/30 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="px-4 py-2.5">Student</th>
                            <th className="px-4 py-2.5">Duration</th>
                            <th className="px-4 py-2.5">Note</th>
                            <th className="px-4 py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {logs.map((log) => {
                            const student = students.find(s => s.id === log.studentId);
                            const studentName = student?.name || 'Unknown client';
                            return (
                              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                {/* Student Column */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 select-none">
                                      {studentName.charAt(0)}
                                    </div>
                                    <div>
                                      <span className="font-extrabold text-[13px] text-slate-800 block leading-tight">{studentName}</span>
                                      {student?.class && (
                                        <span className="text-[9px] font-bold text-slate-405 leading-none">
                                          {student.class}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Duration Column */}
                                <td className="px-4 py-3">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 text-slate-705 font-bold">
                                      <Clock size={11} className="text-slate-400" />
                                      <span>{formatTime(log.entryAt)} - {formatTime(log.exitAt)}</span>
                                    </div>
                                    <div className="text-[10px] font-extrabold text-indigo-650">
                                      {log.duration} hrs worked
                                    </div>
                                  </div>
                                </td>

                                {/* Note Column */}
                                <td className="px-4 py-3 max-w-[200px] md:max-w-[300px]">
                                  {log.remarks ? (
                                    <span className="text-[11px] text-slate-500 font-sans italic line-clamp-1 block" title={log.remarks}>
                                      {log.remarks}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 italic">-</span>
                                  )}
                                </td>

                                {/* Actions Column */}
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-3.5">
                                    <button
                                      onClick={() => handleStartEdit(log)}
                                      className="text-indigo-600 hover:text-indigo-850 font-bold transition flex items-center gap-1"
                                      title="Edit Entry"
                                    >
                                      <Edit3 size={12} />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (confirm(`Are you sure you want to permanently erase this attendance mark?`)) {
                                          deleteAttendance(log.id);
                                        }
                                      }}
                                      className="text-slate-405 hover:text-red-600 font-bold transition flex items-center gap-1"
                                      title="Delete Entry"
                                    >
                                      <Trash2 size={12} />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* QUICK ATTENDANCE ENTRY DIALOG MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {editingAttendance ? 'Edit Attendance Entry' : 'New Attendance Entry'}
                </h3>
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
                  {editingAttendance ? 'Save Changes' : 'Save Log'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Floating Log Session FAB */}
      <button 
        onClick={handleOpenAdd}
        disabled={activeStudents.length === 0}
        className="fixed bottom-6 right-6 z-40 bg-indigo-600 hover:bg-indigo-755 text-white p-4 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center border border-indigo-500/10"
        title="Log session attendance"
      >
        <Plus size={24} className="stroke-[2.5]" />
      </button>

    </div>
  );
}
