import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Schedule } from '../types';
import { 
  Calendar, Plus, Clock, MapPin, Copy, Trash2, Edit3, X, Sparkles, BookOpen, UserSquare, CalendarDays
} from 'lucide-react';
import { formatDate, formatTime } from '../formatUtils';

export default function ScheduleModule() {
  const { 
    schedules, students, addSchedule, updateSchedule, deleteSchedule, duplicateSchedule 
  } = useStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

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
          <h2 className="text-xl font-bold text-slate-800">Tuition Weekly Planner</h2>
          <p className="text-xs text-slate-400">Schedule periodic time slots, duplicate parameters, and manage venue locations</p>
        </div>
      </div>

      {activeStudents.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 font-medium">
          ⚠️ Notice: Set up active student accounts under the student directory prior to arranging recurring session blocks here.
        </div>
      )}

      {/* Saturday - Friday Weekday Navigation Bar */}
      <div className="p-1 bg-slate-100/80 border border-slate-200/50 rounded-2xl flex flex-wrap gap-1">
        {weekDaysOrdered.map((day) => {
          const count = schedulesByDay[day].length;
          return (
            <button
              key={day}
              onClick={() => setSelectedDayTab(day)}
              className={`flex-1 min-w-[75px] py-3 px-1.5 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5 ${
                selectedDayTab === day 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{day.substring(0, 3)}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-md mt-0.5 ${
                selectedDayTab === day 
                  ? 'bg-indigo-50 text-indigo-600' 
                  : count > 0 ? 'bg-slate-200 text-slate-600' : 'bg-slate-50 text-slate-300'
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
        <div className="lg:col-span-2 bg-white border border-slate-100 p-5 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-800">{selectedDayTab} Agenda</h3>
              <p className="text-xs text-slate-400">Hourly session timetable for this weekday</p>
            </div>
            
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
              {schedulesByDay[selectedDayTab].length} Slots
            </span>
          </div>

          <div className="space-y-3.5">
            {schedulesByDay[selectedDayTab].length === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-3">
                <CalendarDays className="mx-auto text-slate-300 stroke-[1.2]" size={42} />
                <p className="text-sm font-semibold text-slate-600">Peaceful Weekday</p>
                <p className="text-xs max-w-xs mx-auto text-slate-400">
                  No tuition classes scheduled on {selectedDayTab}s yet. Assign some by clicking Add schedule slot above.
                </p>
              </div>
            ) : (
              schedulesByDay[selectedDayTab].map(sc => {
                const student = students.find(s => s.id === sc.studentId);
                return (
                  <div 
                    key={sc.id} 
                    className="p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-slate-200 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                        {student?.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-800">{student?.name}</h4>
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-200 text-slate-600 rounded">
                            {student?.class}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-slate-500 text-xs mt-1.5 font-medium">
                          <span className="flex items-center gap-1">
                            <BookOpen size={13} className="text-slate-400" /> {sc.subject}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <MapPin size={12} /> {sc.location}
                          </span>
                        </div>

                        {sc.remarks && (
                          <p className="text-[10px] italic text-slate-400 mt-2 bg-slate-100 px-2 py-1 rounded inline-block">
                            💡 Note: {sc.remarks}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-2.5 sm:pt-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-100 px-2.5 py-1 rounded-xl shadow-sm">
                        <Clock size={13} className="text-indigo-500" />
                        <span>{formatTime(sc.startTime)} - {formatTime(sc.endTime)}</span>
                      </div>

                      {/* Scheduling Quick Actions */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => duplicateSchedule(sc.id)}
                          className="p-1 px-2 border border-indigo-100 text-[10px] font-bold rounded-lg text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 hover:scale-105 transition flex items-center gap-1"
                          title="Duplicate this schedule into another weekday slot"
                        >
                          <Copy size={11} /> Duplicate
                        </button>
                        <button
                          onClick={() => handleStartEdit(sc)}
                          className="p-1.5 border border-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition"
                          title="Edit slot details"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove this tuition slot?`)) {
                              deleteSchedule(sc.id);
                            }
                          }}
                          className="p-1.5 border border-slate-100 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition"
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
        <div className="bg-gradient-to-br from-indigo-50 to-slate-100 border border-slate-200/40 p-5 rounded-3xl shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-indigo-900">
            <Sparkles size={18} />
            <h3 className="font-extrabold text-sm tracking-wide uppercase">Tutor Calendar Insights</h3>
          </div>
          
          <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
            <p>
              Maintaining strict, predictable slots helps students construct robust study routines. TutorTrack recommends holding <strong>1.5 hr</strong> classes twice every cycle block.
            </p>

            <div className="p-3.5 bg-white border border-slate-150 rounded-2xl space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Weekly Workload Volume</span>
              <div className="flex items-center justify-between text-slate-700 font-bold">
                <span>Total Active Classes:</span>
                <span>{schedules.length} Slots</span>
              </div>
              <div className="flex items-center justify-between text-slate-700 font-bold">
                <span>Unique Clients:</span>
                <span>{students.filter(s => s.status === 'Active').length} Students</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400">
              * Schedules modified here automatically prompt dynamic alarms 30 minutes before any registered commence triggers, reminding you of the address context.
            </p>
          </div>
        </div>

      </div>

      {/* SCHEDULE DETAILED MODAL (ADD / EDIT) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {editingSchedule ? 'Modify Class Slot' : 'Create Weekly Class Slot'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Define student timing coordinates and location rules</p>
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

              {/* Student Id Selection */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Student</label>
                <select
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                >
                  <option value="">-- Choose active student --</option>
                  {activeStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.class})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Weekday */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Weekday</label>
                  <select
                    value={formWeekday}
                    onChange={(e) => setFormWeekday(e.target.value as any)}
                    className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  >
                    {weekDaysOrdered.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                {/* Course Subject */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Course Subject</label>
                  <input 
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="e.g. Physics, Chemistry II"
                    className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Start Time */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Start Time</label>
                  <input 
                    type="time" 
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  />
                </div>

                {/* End Time */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">End Time</label>
                  <input 
                    type="time" 
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Location Venue */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Location / Room Venue</label>
                <input 
                  type="text" 
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="e.g. Home Tuition, online Skype, coaching center B"
                  className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none"
                />
              </div>

              {/* Remarks/Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Remarks (Special Syllabus Goals)</label>
                <textarea 
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="e.g. Finish Trigonometry exercise 4-7, review coordinate concepts..."
                  rows={2}
                  className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none resize-none"
                />
              </div>

              {/* Footer CTAs */}
              <div className="pt-4 flex justify-end gap-2.5">
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
        className="fixed bottom-6 right-6 z-40 bg-indigo-600 hover:bg-indigo-755 text-white p-4 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center border border-indigo-500/10"
        title="Add schedule slot"
      >
        <Plus size={24} className="stroke-[2.5]" />
      </button>

    </div>
  );
}
