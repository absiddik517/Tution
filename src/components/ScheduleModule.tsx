import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Schedule } from '../types';
import { 
  Calendar, Plus, Clock, MapPin, Copy, Trash2, Edit3, X, Sparkles, BookOpen, UserSquare, CalendarDays
} from 'lucide-react';
import { formatDate, formatTime } from '../formatUtils';
import { useTheme } from '../theme';
import ConfirmModal from './ConfirmModal';

export default function ScheduleModule() {
  const { theme } = useTheme();
  const { 
    schedules, students, addSchedule, updateSchedule, deleteSchedule, duplicateSchedule 
  } = useStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deleteConfirmScheduleId, setDeleteConfirmScheduleId] = useState<string | null>(null);

  // Form Fields
  const [formStudentId, setFormStudentId] = useState('');
  const [formWeekday, setFormWeekday] = useState<Schedule['weekday']>('Saturday');
  const [formStartTime, setFormStartTime] = useState('15:00');
  const [formEndTime, setFormEndTime] = useState('16:30');
  const [formLocation, setFormLocation] = useState('Home Tuition');
  const [formSubject, setFormSubject] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formError, setFormError] = useState('');

  // Weekly Agenda Segments
  const weekDaysOrdered: Schedule['weekday'][] = [
    'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
  ];

  // Auto detect today is Saturday, Sunday, Monday etc.
  const initialDayTab = React.useMemo<Schedule['weekday']>(() => {
    const days: Schedule['weekday'][] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[new Date().getDay()];
    return weekDaysOrdered.includes(currentDay) ? currentDay : 'Saturday';
  }, []);

  const [selectedDayTab, setSelectedDayTab] = useState<Schedule['weekday']>(initialDayTab);

  // Load editing values
  const handleStartEdit = (sc: Schedule) => {
    setEditingSchedule(sc);
    setFormStudentId(sc.studentId);
    setFormWeekday(sc.weekday);
    setFormStartTime(sc.startTime);
    setFormEndTime(sc.endTime);
    setFormLocation(sc.location);
    setFormSubject(sc.subject);
    setFormRemarks(sc.remarks);
    setFormError('');
    setShowAddModal(true);
  };

  const resetForm = () => {
    // Select first active student by default if available
    const activeOnes = students.filter(s => s.status === 'Active');
    setFormStudentId(activeOnes[0]?.id || '');
    setFormWeekday('Saturday');
    setFormStartTime('15:00');
    setFormEndTime('16:30');
    setFormLocation('Home Tuition');
    setFormSubject('');
    setFormRemarks('');
    setFormError('');
  };

  const handleOpenAdd = () => {
    resetForm();
    setEditingSchedule(null);
    setShowAddModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentId) {
      setFormError('Please select a student for this schedule.');
      return;
    }
    if (!formSubject.trim()) {
      setFormError('Course / Subject name is required.');
      return;
    }
    if (formStartTime >= formEndTime) {
      setFormError('Ending time must be greater than starting time.');
      return;
    }

    const payload = {
      studentId: formStudentId,
      weekday: formWeekday,
      startTime: formStartTime,
      endTime: formEndTime,
      location: formLocation.trim() || 'Home Tuition',
      subject: formSubject.trim(),
      remarks: formRemarks.trim()
    };

    if (editingSchedule) {
      updateSchedule(editingSchedule.id, payload);
    } else {
      addSchedule(payload);
    }

    setShowAddModal(false);
    resetForm();
  };

  // Grouped active schedules grouped by weekday
  const schedulesByDay = useMemo(() => {
    const map: { [key in Schedule['weekday']]: Schedule[] } = {
      Saturday: [], Sunday: [], Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: []
    };
    schedules.forEach(sc => {
      const stud = students.find(s => s.id === sc.studentId);
      // Only capture active student schedules
      if (stud?.status === 'Active') {
        map[sc.weekday].push(sc);
      }
    });
    // Sort scheduling blocks inside any day by starting times
    Object.keys(map).forEach((dayKey) => {
      const dk = dayKey as Schedule['weekday'];
      map[dk].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return map;
  }, [schedules, students]);

  // Active students only
  const activeStudents = useMemo(() => students.filter(s => s.status === 'Active'), [students]);

  return (
    <div className="space-y-6">
      
      {/* Header description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${theme.textTitle}`}>Tuition Weekly Planner</h2>
          <p className={`text-xs ${theme.textMuted}`}>Schedule periodic time slots, duplicate parameters, and manage venue locations</p>
        </div>
      </div>

      {activeStudents.length === 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl text-xs text-amber-800 dark:text-amber-300 font-medium animate-pulse">
          ⚠️ Notice: Set up active student accounts under the student directory prior to arranging recurring session blocks here.
        </div>
      )}

      {/* Saturday - Friday Weekday Navigation Bar */}
      <div className={`p-1 ${theme.bgCardElevated} border ${theme.borderMuted} rounded-2xl flex flex-wrap gap-1`}>
        {weekDaysOrdered.map((day) => {
          const count = schedulesByDay[day].length;
          return (
            <button
              key={day}
              onClick={() => setSelectedDayTab(day)}
              className={`flex-1 min-w-[75px] py-3 px-1.5 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5 ${
                selectedDayTab === day 
                  ? `${theme.bgCard} ${theme.textAccent} shadow-sm border ${theme.borderMuted}` 
                  : `${theme.textMuted} hover:${theme.textMain}`
              }`}
            >
              <span>{day.substring(0, 3)}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-md mt-0.5 ${
                selectedDayTab === day 
                  ? `${theme.bgAccent} ${theme.textAccent}` 
                  : count > 0 ? `${theme.bgCard} ${theme.textMain} border ${theme.borderMuted}` : `${theme.bgCardElevated} ${theme.textMuted}`
              }`}>
                {count} {count === 1 ? 'class' : 'classes'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Day Agenda Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Day Schedule block */}
        <div className={`${theme.bgCard} border ${theme.borderMain} p-5 rounded-3xl shadow-sm space-y-4 lg:col-span-2`}>
          <div className={`flex items-center justify-between border-b ${theme.borderMuted} pb-3`}>
            <div>
              <h3 className={`text-base font-bold ${theme.textTitle}`}>{selectedDayTab} Agenda</h3>
              <p className={`text-xs ${theme.textMuted}`}>Hourly session timetable for this weekday</p>
            </div>
            
            <span className={`text-xs font-bold ${theme.textAccent} ${theme.bgAccent} px-2.5 py-1 rounded-full uppercase tracking-wider`}>
              {schedulesByDay[selectedDayTab].length} Slots
            </span>
          </div>

          <div className="space-y-3.5">
            {schedulesByDay[selectedDayTab].length === 0 ? (
              <div className={`text-center py-16 ${theme.textMuted} space-y-3`}>
                <CalendarDays className={`mx-auto ${theme.textMuted} stroke-[1.2]`} size={42} />
                <p className={`text-sm font-semibold ${theme.textMain}`}>Peaceful Weekday</p>
                <p className={`text-xs max-w-xs mx-auto ${theme.textMuted}`}>
                  No tuition classes scheduled on {selectedDayTab}s yet. Assign some by clicking Add schedule slot above.
                </p>
              </div>
            ) : (
              schedulesByDay[selectedDayTab].map(sc => {
                const student = students.find(s => s.id === sc.studentId);
                return (
                  <div 
                    key={sc.id} 
                    className={`p-4 ${theme.bgCardElevated} border ${theme.borderMuted} rounded-2xl hover:${theme.borderMain} transition flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-10 h-10 ${theme.bgAccentSolid || 'bg-indigo-600'} text-white rounded-xl flex items-center justify-center font-bold text-sm shrink-0`}>
                        {student?.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className={`font-bold text-sm ${theme.textTitle}`}>{student?.name}</h4>
                          <span className={`px-2 py-0.5 text-[9px] font-bold ${theme.bgCard} ${theme.textMain} border ${theme.borderMuted} rounded`}>
                            {student?.class}
                          </span>
                        </div>

                        <div className={`flex flex-wrap items-center gap-3 ${theme.textMuted} text-xs mt-1.5 font-medium`}>
                          <span className="flex items-center gap-1">
                            <BookOpen size={13} className={theme.textMuted} /> {sc.subject}
                          </span>
                          <span className="flex items-center gap-1 text-[11px]">
                            <MapPin size={12} /> {sc.location}
                          </span>
                        </div>

                        {sc.remarks && (
                          <p className={`text-[10px] italic ${theme.textMuted} mt-2 ${theme.bgCard} border ${theme.borderMuted} px-2 py-1 rounded inline-block`}>
                            💡 Note: {sc.remarks}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/60 pt-2.5 sm:pt-0">
                      <div className={`flex items-center gap-1.5 text-xs font-bold ${theme.textTitle} ${theme.bgCard} border ${theme.borderMuted} px-2.5 py-1 rounded-xl shadow-sm`}>
                        <Clock size={13} className={theme.textAccent} />
                        <span>{formatTime(sc.startTime)} - {formatTime(sc.endTime)}</span>
                      </div>

                      {/* Scheduling Quick Actions */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => duplicateSchedule(sc.id)}
                          className={`p-1.5 border ${theme.borderAccent} ${theme.textAccent} ${theme.bgAccent} rounded-lg transition hover:scale-105`}
                          title="Duplicate this schedule into another weekday slot"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          onClick={() => handleStartEdit(sc)}
                          className={`p-1.5 border ${theme.borderMuted} ${theme.textMuted} hover:${theme.textAccent} hover:${theme.bgCard} rounded-lg transition`}
                          title="Edit slot details"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmScheduleId(sc.id)}
                          className={`p-1.5 border ${theme.borderMuted} ${theme.textMuted} hover:text-red-500 hover:${theme.bgCard} rounded-lg transition`}
                          title="Delete slot"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Dynamic insights card */}
        <div className={`${theme.bgCardElevated} border ${theme.borderMuted} p-5 rounded-3xl shadow-sm space-y-4`}>
          <div className={`flex items-center gap-2 ${theme.textAccent}`}>
            <Sparkles size={18} />
            <h3 className="font-extrabold text-sm tracking-wide uppercase">Tutor Calendar Insights</h3>
          </div>
          
          <div className={`space-y-3.5 text-xs ${theme.textMain} leading-relaxed`}>
            <p>
              Maintaining strict, predictable slots helps students construct robust study routines. TutorTrack recommends holding <strong>1.5 hr</strong> classes twice every cycle block.
            </p>

            <div className={`p-3.5 ${theme.bgCard} border ${theme.borderMuted} rounded-2xl space-y-2`}>
              <span className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider`}>Weekly Workload Volume</span>
              <div className={`flex items-center justify-between ${theme.textTitle} font-bold`}>
                <span>Total Active Classes:</span>
                <span>{schedules.length} Slots</span>
              </div>
              <div className={`flex items-center justify-between ${theme.textTitle} font-bold`}>
                <span>Unique Clients:</span>
                <span>{students.filter(s => s.status === 'Active').length} Students</span>
              </div>
            </div>

            <p className={`text-[10px] ${theme.textMuted}`}>
              * Schedules modified here automatically prompt dynamic alarms 30 minutes before any registered commence triggers, reminding you of the address context.
            </p>
          </div>
        </div>

      </div>

      {/* SCHEDULE DETAILED MODAL (ADD / EDIT) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${theme.bgCard} border ${theme.borderMain} rounded-3xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200`}>
            <div className={`p-6 border-b ${theme.borderMuted} flex items-center justify-between`}>
              <div>
                <h3 className={`text-base font-bold ${theme.textTitle}`}>
                  {editingSchedule ? 'Modify Class Slot' : 'Create Weekly Class Slot'}
                </h3>
                <p className={`text-xs ${theme.textMuted} mt-0.5`}>Define student timing coordinates and location rules</p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className={`w-8 h-8 rounded-full ${theme.bgCardElevated} flex items-center justify-center ${theme.textMuted} hover:${theme.bgCardHover} hover:text-slate-600`}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-400 font-bold">
                  ⚠️ {formError}
                </div>
              )}

              {/* Student Id Selection */}
              <div className="space-y-1">
                <label className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>Student</label>
                <select
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  className={`w-full text-xs font-semibold p-3 ${theme.bgInput} border ${theme.borderMain} rounded-xl focus:outline-none`}
                >
                  <option value="" className={`${theme.bgCard} ${theme.textMain}`}>-- Choose active student --</option>
                  {activeStudents.map(s => (
                    <option key={s.id} value={s.id} className={`${theme.bgCard} ${theme.textMain}`}>{s.name} ({s.class})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Weekday */}
                <div className="space-y-1">
                  <label className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>Weekday</label>
                  <select
                    value={formWeekday}
                    onChange={(e) => setFormWeekday(e.target.value as any)}
                    className={`w-full text-xs font-semibold p-3 ${theme.bgInput} border ${theme.borderMain} rounded-xl focus:outline-none`}
                  >
                    {weekDaysOrdered.map(day => (
                      <option key={day} value={day} className={`${theme.bgCard} ${theme.textMain}`}>{day}</option>
                    ))}
                  </select>
                </div>

                {/* Course Subject */}
                <div className="space-y-1">
                  <label className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>Course Subject</label>
                  <input 
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="e.g. Physics, Chemistry II"
                    className={`w-full text-xs font-semibold p-3 ${theme.bgInput} border ${theme.borderMain} rounded-xl focus:outline-none`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Start Time */}
                <div className="space-y-1">
                  <label className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>Start Time</label>
                  <input 
                    type="time" 
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className={`w-full text-xs font-semibold p-3 ${theme.bgInput} border ${theme.borderMain} rounded-xl focus:outline-none`}
                  />
                </div>

                {/* End Time */}
                <div className="space-y-1">
                  <label className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>End Time</label>
                  <input 
                    type="time" 
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className={`w-full text-xs font-semibold p-3 ${theme.bgInput} border ${theme.borderMain} rounded-xl focus:outline-none`}
                  />
                </div>
              </div>

              {/* Location Venue */}
              <div className="space-y-1">
                <label className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>Location / Room Venue</label>
                <input 
                  type="text" 
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="e.g. Home Tuition, online Skype, coaching center B"
                  className={`w-full text-xs font-semibold p-3 ${theme.bgInput} border ${theme.borderMain} rounded-xl focus:outline-none`}
                />
              </div>

              {/* Remarks/Notes */}
              <div className="space-y-1">
                <label className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>Remarks (Special Syllabus Goals)</label>
                <textarea 
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="e.g. Finish Trigonometry exercise 4-7, review coordinate concepts..."
                  rows={2}
                  className={`w-full text-xs font-semibold p-3 ${theme.bgInput} border ${theme.borderMain} rounded-xl focus:outline-none resize-none`}
                />
              </div>

              {/* Footer CTAs */}
              <div className="pt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className={`px-4 py-2.5 border ${theme.borderMain} ${theme.textMain} font-semibold rounded-xl text-xs hover:${theme.bgCardHover} transition`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 ${theme.btnPrimary} font-bold rounded-xl text-xs shadow transition`}
                >
                  {editingSchedule ? 'Save schedule updates' : 'Add class to schedule'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Floating Add Schedule Slot FAB */}
      <button 
        onClick={handleOpenAdd}
        disabled={activeStudents.length === 0}
        className={`fixed bottom-6 right-6 z-40 ${theme.bgAccentSolid || 'bg-indigo-600'} hover:opacity-90 text-white p-4 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center border ${theme.borderAccent}`}
        title="Add schedule slot"
      >
        <Plus size={24} className="stroke-[2.5]" />
      </button>

      {/* Delete Schedule Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmScheduleId}
        title="Delete Tuition Schedule Slot"
        message="Are you sure you want to remove this weekly class schedule slot?"
        subMessage="This slot will be removed from your weekly schedule overview."
        confirmText="Remove Slot"
        cancelText="Keep Slot"
        isDestructive={true}
        icon="trash"
        onConfirm={() => {
          if (deleteConfirmScheduleId) {
            deleteSchedule(deleteConfirmScheduleId);
            setDeleteConfirmScheduleId(null);
          }
        }}
        onCancel={() => setDeleteConfirmScheduleId(null)}
      />

    </div>
  );
}
