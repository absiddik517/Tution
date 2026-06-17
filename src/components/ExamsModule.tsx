import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { 
  GraduationCap, Calendar, Award, Check, Plus, Trash2, Edit2, Search, 
  Clock, AlertCircle, CalendarDays, Activity, TrendingUp, User, 
  CheckCircle2, AlertTriangle, BookOpen, ChevronRight, BarChart3, ListTodo, Sparkles
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { formatDate, formatTime } from '../formatUtils';

export default function ExamsModule() {
  const { 
    students, schedules, examSchedules, examRecords, 
    addExamSchedule, updateExamSchedule, deleteExamSchedule,
    addExamRecord, updateExamRecord, deleteExamRecord,
    addNotification
  } = useStore();

  const [activeTab, setActiveTab] = useState<'planner' | 'gradebook' | 'analytics'>('planner');
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentFilter, setSelectedStudentFilter] = useState('All');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('All');

  // Form states - Exam Schedule
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    studentId: '',
    subject: '',
    topic: '',
    date: '',
    time: '',
    totalMarks: 100,
    reminderMinutes: 60
  });

  // Form states - Exam Record
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordForm, setRecordForm] = useState({
    studentId: '',
    examScheduleId: '',
    subject: '',
    topic: '',
    date: '',
    totalMarks: 100,
    marksObtained: 0,
    remarks: '',
    status: 'Passed' as 'Passed' | 'Failed' | 'Awaiting' | 'Absent'
  });

  // Background reminder system checking loop runs on local ticking state
  useEffect(() => {
    // Run reminder checks every 30 seconds
    const checkReminders = () => {
      const now = new Date();
      examSchedules.forEach(exam => {
        if (exam.reminderSent) return;

        // Combine date and time strings
        const examDateTime = new Date(`${exam.date}T${exam.time}`);
        const deltaMs = examDateTime.getTime() - now.getTime();
        const deltaMins = deltaMs / 60000;

        if (deltaMins > 0 && deltaMins <= exam.reminderMinutes) {
          // Send notification
          const student = students.find(s => s.id === exam.studentId);
          addNotification(
            'Exam Reminder Alert',
            `Offline alerts: Prep lesson support is needed. "${exam.subject}" exam on topic "${exam.topic}" for ${student ? student.name : 'your student'} is in ${Math.round(deltaMins)} minutes!`,
            'exam'
          );
          updateExamSchedule(exam.id, { reminderSent: true });
        }
      });
    };

    checkReminders();
    const interval = setInterval(checkReminders, 25000);
    return () => clearInterval(interval);
  }, [examSchedules, students, addNotification, updateExamSchedule]);

  // Unique lists of subjects currently listed in the directory to ease selector dropdowns
  const availableSubjects = useMemo(() => {
    const list = new Set<string>();
    students.forEach(s => s.subjects?.forEach(sub => list.add(sub)));
    examSchedules.forEach(ex => list.add(ex.subject));
    examRecords.forEach(er => list.add(er.subject));
    return Array.from(list);
  }, [students, examSchedules, examRecords]);

  // Filter schedules
  const filteredSchedules = useMemo(() => {
    return examSchedules.filter(ex => {
      const student = students.find(s => s.id === ex.studentId);
      const matchesSearch = 
        ex.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
        ex.topic.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (student && student.name.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStudent = selectedStudentFilter === 'All' || ex.studentId === selectedStudentFilter;
      const matchesSubject = selectedSubjectFilter === 'All' || ex.subject === selectedSubjectFilter;
      return matchesSearch && matchesStudent && matchesSubject;
    });
  }, [examSchedules, students, searchTerm, selectedStudentFilter, selectedSubjectFilter]);

  // Filter records
  const filteredRecords = useMemo(() => {
    return examRecords.filter(er => {
      const student = students.find(s => s.id === er.studentId);
      const matchesSearch = 
        er.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
        er.topic.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (student && student.name.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStudent = selectedStudentFilter === 'All' || er.studentId === selectedStudentFilter;
      const matchesSubject = selectedSubjectFilter === 'All' || er.subject === selectedSubjectFilter;
      return matchesSearch && matchesStudent && matchesSubject;
    });
  }, [examRecords, students, searchTerm, selectedStudentFilter, selectedSubjectFilter]);

  // Key KPI metrics calculators
  const kpis = useMemo(() => {
    const upcomingCount = examSchedules.filter(ex => new Date(ex.date) >= new Date()).length;
    const completedCount = examRecords.length;
    
    // Average Grade score pct percentage
    let totalScorePctSum = 0;
    let gradedRecordsCount = 0;
    let passCount = 0;

    examRecords.forEach(rec => {
      if (rec.status !== 'Awaiting') {
        const pct = rec.totalMarks > 0 ? (rec.marksObtained / rec.totalMarks) * 100 : 0;
        totalScorePctSum += pct;
        gradedRecordsCount++;
      }
      if (rec.status === 'Passed') {
        passCount++;
      }
    });

    const averageScore = gradedRecordsCount > 0 ? Math.round(totalScorePctSum / gradedRecordsCount) : 0;
    const passRate = examRecords.length > 0 ? Math.round((passCount / examRecords.length) * 100) : 0;

    return {
      upcomingCount,
      completedCount,
      averageScore,
      passRate
    };
  }, [examSchedules, examRecords]);

  // Recharts payload data mapping: Subject performance matrix
  const subjectPerformanceData = useMemo(() => {
    const dataMap: { [subject: string]: { totalMarks: number, marksObtained: number, count: number } } = {};
    
    examRecords.forEach(rec => {
      if (rec.status === 'Passed' || rec.status === 'Failed') {
        if (!dataMap[rec.subject]) {
          dataMap[rec.subject] = { totalMarks: 0, marksObtained: 0, count: 0 };
        }
        dataMap[rec.subject].totalMarks += rec.totalMarks;
        dataMap[rec.subject].marksObtained += rec.marksObtained;
        dataMap[rec.subject].count += 1;
      }
    });

    return Object.keys(dataMap).map(subject => {
      const { totalMarks, marksObtained } = dataMap[subject];
      const avgPercentage = totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0;
      return {
        subject,
        'Avg Performance %': avgPercentage,
        'Total Tests': dataMap[subject].count
      };
    });
  }, [examRecords]);

  // Recharts payload data mapping: Students rankings
  const studentRankPerformance = useMemo(() => {
    const list = students.map(stud => {
      const studRecords = examRecords.filter(er => er.studentId === stud.id && (er.status === 'Passed' || er.status === 'Failed'));
      let totalPctSum = 0;
      studRecords.forEach(rec => {
        const pct = rec.totalMarks > 0 ? (rec.marksObtained / rec.totalMarks) * 100 : 0;
        totalPctSum += pct;
      });
      const score = studRecords.length > 0 ? Math.round(totalPctSum / studRecords.length) : 0;
      return {
        name: stud.name,
        'Avg Score %': score,
        'Exams Completed': studRecords.length
      };
    }).filter(item => item['Exams Completed'] > 0);

    return list.sort((a, b) => b['Avg Score %'] - a['Avg Score %']);
  }, [students, examRecords]);

  // Helper to find the next schedule date and time for a student
  const getNextScheduleData = (studentId: string) => {
    const studentSchedules = schedules.filter(s => s.studentId === studentId);
    if (studentSchedules.length === 0) {
      return {
        date: new Date().toISOString().split('T')[0],
        time: '14:00'
      };
    }

    const today = new Date();
    const currentDayNum = today.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday

    const weekdayMap: Record<string, number> = {
      'Sunday': 0,
      'Monday': 1,
      'Tuesday': 2,
      'Wednesday': 3,
      'Thursday': 4,
      'Friday': 5,
      'Saturday': 6
    };

    let selectedSchedule = studentSchedules[0];
    let minDaysDiff = 100;

    studentSchedules.forEach(schedule => {
      const targetDayNum = weekdayMap[schedule.weekday];
      if (targetDayNum !== undefined) {
        let diff = (targetDayNum - currentDayNum + 7) % 7;
        
        // If the schedule day matches today, check if its startTime has passed
        if (diff === 0) {
          const [schedHours, schedMins] = schedule.startTime.split(':').map(Number);
          const schedTimeToday = new Date(today);
          schedTimeToday.setHours(schedHours, schedMins, 0, 0);
          if (today > schedTimeToday) {
            diff = 7; // schedule has passed for today, so set to 7 days later
          }
        }

        if (diff < minDaysDiff) {
          minDaysDiff = diff;
          selectedSchedule = schedule;
        }
      }
    });

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + minDaysDiff);

    return {
      date: targetDate.toISOString().split('T')[0],
      time: selectedSchedule.startTime
    };
  };

  // Trigger: Fill schedule form
  const handleOpenScheduleCreate = () => {
    const defaultStudentId = students[0]?.id || '';
    const nextSched = getNextScheduleData(defaultStudentId);
    setScheduleForm({
      studentId: defaultStudentId,
      subject: students[0]?.subjects?.[0] || '',
      topic: '',
      date: nextSched.date,
      time: nextSched.time,
      totalMarks: 100,
      reminderMinutes: 1440
    });
    setEditingScheduleId(null);
    setShowScheduleModal(true);
  };

  const handleOpenScheduleEdit = (schedule: typeof examSchedules[0]) => {
    setScheduleForm({
      studentId: schedule.studentId,
      subject: schedule.subject,
      topic: schedule.topic,
      date: schedule.date,
      time: schedule.time,
      totalMarks: schedule.totalMarks,
      reminderMinutes: schedule.reminderMinutes
    });
    setEditingScheduleId(schedule.id);
    setShowScheduleModal(true);
  };

  // Submit Schedule form
  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.studentId || !scheduleForm.subject || !scheduleForm.topic || !scheduleForm.date) {
      alert('Kindly complete all mandatory input parameters.');
      return;
    }

    if (editingScheduleId) {
      updateExamSchedule(editingScheduleId, scheduleForm);
    } else {
      addExamSchedule(scheduleForm);
    }
    setShowScheduleModal(false);
  };

  // Log marks for an upcoming slot
  const handleLogMarksFromSchedule = (sched: typeof examSchedules[0]) => {
    setRecordForm({
      studentId: sched.studentId,
      examScheduleId: sched.id,
      subject: sched.subject,
      topic: sched.topic,
      date: sched.date,
      totalMarks: sched.totalMarks,
      marksObtained: 0,
      remarks: '',
      status: 'Passed'
    });
    setEditingRecordId(null);
    setShowRecordModal(true);
  };

  // Trigger: Fill record form
  const handleOpenRecordCreate = () => {
    setRecordForm({
      studentId: students[0]?.id || '',
      examScheduleId: '',
      subject: students[0]?.subjects?.[0] || '',
      topic: '',
      date: new Date().toISOString().split('T')[0],
      totalMarks: 100,
      marksObtained: 0,
      remarks: '',
      status: 'Passed'
    });
    setEditingRecordId(null);
    setShowRecordModal(true);
  };

  const handleOpenRecordEdit = (rec: typeof examRecords[0]) => {
    setRecordForm({
      studentId: rec.studentId,
      examScheduleId: rec.examScheduleId || '',
      subject: rec.subject,
      topic: rec.topic,
      date: rec.date,
      totalMarks: rec.totalMarks,
      marksObtained: rec.marksObtained,
      remarks: rec.remarks,
      status: rec.status
    });
    setEditingRecordId(rec.id);
    setShowRecordModal(true);
  };

  // Submit record form
  const handleRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordForm.studentId || !recordForm.subject || !recordForm.topic || !recordForm.date) {
      alert('Kindly complete all mandatory fields.');
      return;
    }

    // Auto calculate Status if marks obtained vs total marks
    let computedStatus = recordForm.status;
    if (computedStatus === 'Passed' || computedStatus === 'Failed') {
      const pct = (recordForm.marksObtained / recordForm.totalMarks) * 100;
      computedStatus = pct >= 40 ? 'Passed' : 'Failed';
    }

    const payload = {
      ...recordForm,
      status: computedStatus
    };

    if (editingRecordId) {
      updateExamRecord(editingRecordId, payload);
    } else {
      addExamRecord(payload);
    }
    setShowRecordModal(false);
  };

  // Return formatted student name helper
  const getSubTitleText = (id: string) => {
    const stud = students.find(s => s.id === id);
    if (!stud) return 'Unknown Student';
    return `${stud.name} (${stud.class})`;
  };

  return (
    <div className="space-y-6 font-sans text-slate-800 animate-in fade-in duration-200" id="exams-module-root">
      
      {/* KPI METRIC CARDS HEADER */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="exams-kpi-row">
        
        {/* KPI 1: Upcoming Exams */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition duration-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
            <CalendarDays size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Upcoming Tests</p>
            <h4 className="text-2xl font-black text-slate-900 leading-none mt-1">{kpis.upcomingCount}</h4>
          </div>
        </div>

        {/* KPI 2: Completed Exams */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition duration-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Graded</p>
            <h4 className="text-2xl font-black text-slate-900 leading-none mt-1">{kpis.completedCount}</h4>
          </div>
        </div>

        {/* KPI 3: Avg Score */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition duration-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
            <TrendingUp size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Average Score</p>
            <h4 className="text-2xl font-black text-slate-900 leading-none mt-1">{kpis.averageScore}%</h4>
          </div>
        </div>

        {/* KPI 4: Pass Rate */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition duration-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
            <Award size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Pass Rate</p>
            <h4 className="text-2xl font-black text-slate-900 leading-none mt-1">{kpis.passRate}%</h4>
          </div>
        </div>

      </div>

      {/* FILTER CONTROLS & TAB TOGGLES */}
      <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-sm space-y-4 lg:space-y-0 lg:flex lg:items-center lg:justify-between" id="exams-toolbar-container">
        
        {/* Toggle selectors */}
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-2xl w-fit" id="exams-tabs">
          <button
            onClick={() => setActiveTab('planner')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'planner'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/50'
            }`}
          >
            <ListTodo size={14} />
            Exam Planner
          </button>
          <button
            onClick={() => setActiveTab('gradebook')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'gradebook'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/50'
            }`}
          >
            <GraduationCap size={14} />
            Gradebook Logs
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/50'
            }`}
          >
            <BarChart3 size={14} />
            Performance Analytics
          </button>
        </div>

        {/* Global filtration selectors */}
        <div className="flex flex-wrap items-center gap-2.5" id="exams-global-filters">
          
          {/* Search bar */}
          <div className="relative min-w-[180px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search subject, topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none"
            />
          </div>

          {/* Student Filter */}
          <select
            value={selectedStudentFilter}
            onChange={(e) => setSelectedStudentFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none"
          >
            <option value="All">All Pupils</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.class})</option>
            ))}
          </select>

          {/* Subject Filter */}
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none"
          >
            <option value="All">All Subjects</option>
            {availableSubjects.map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>

          {/* Create Button */}
          {activeTab === 'planner' && (
            <button
              onClick={handleOpenScheduleCreate}
              className="py-2 px-3 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
              id="schedule-exam-btn"
            >
              <Plus size={14} />
              Schedule Test
            </button>
          )}

          {activeTab === 'gradebook' && (
            <button
              onClick={handleOpenRecordCreate}
              className="py-2 px-3 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
              id="record-grade-btn"
            >
              <Plus size={14} />
              Add Record
            </button>
          )}

        </div>

      </div>

      {/* RENDER ACTIVE TAB VIEW */}

      {/* TAB 1: SCHEDULE PLANNER */}
      {activeTab === 'planner' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="schedules-deck">
          {filteredSchedules.length === 0 ? (
            <div className="col-span-full bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-3" id="schedules-empty-slate">
              <CalendarDays className="mx-auto text-slate-350 text-slate-300 stroke-[1.2]" size={48} />
              <h4 className="text-sm font-extrabold text-slate-800">No upcoming exam schedules found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">Create test slots so that the applet can trigger alert reminders automatically before completion.</p>
              <button
                onClick={handleOpenScheduleCreate}
                className="mx-auto py-2 px-4 bg-indigo-600 text-white hover:bg-indigo-750 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Plus size={14} /> Schedule First Test
              </button>
            </div>
          ) : (
            filteredSchedules.map(ex => {
              const isExpired = new Date(ex.date) < new Date();
              const hasRecordLink = examRecords.some(er => er.examScheduleId === ex.id);

              return (
                <div 
                  key={ex.id} 
                  className={`bg-white border rounded-[28px] p-5 shadow-sm hover:shadow-md transition duration-250 flex flex-col justify-between space-y-4 relative overflow-hidden ${
                    isExpired ? 'border-slate-200 bg-slate-50/50' : 'border-indigo-100 ring-2 ring-indigo-500/5'
                  }`}
                >
                  {/* Badge */}
                  <div className="absolute top-0 right-0">
                    <span className={`text-[8.5px] font-black uppercase px-3.5 py-1 rounded-bl-xl border-l border-b ${
                      isExpired 
                        ? 'bg-slate-100 text-slate-500 border-slate-200' 
                        : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                    }`}>
                      {isExpired ? 'Expired' : 'Active'}
                    </span>
                  </div>

                  {/* Header info */}
                  <div className="space-y-2">
                    <span className="text-[9.5px] bg-slate-100 text-slate-600 py-1 px-2.5 rounded-full font-bold uppercase tracking-wider">
                      {ex.subject}
                    </span>
                    <h3 className="text-base font-black text-slate-900 leading-tight pt-1">
                      {ex.topic}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                      <User size={12} className="text-slate-400" />
                      {getSubTitleText(ex.studentId)}
                    </p>
                  </div>

                  {/* Date details */}
                  <div className="py-2.5 px-3.5 bg-slate-50 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-700 font-mono">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-slate-400" />
                      {formatDate(ex.date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={13} className="text-slate-400" />
                      {formatTime(ex.time)}
                    </span>
                  </div>

                  {/* Option values */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Target total: <strong>{ex.totalMarks} Marks</strong></span>
                    <span className="flex items-center gap-1">
                      <AlertCircle size={11} />
                      Alert {ex.reminderMinutes} mins prior
                    </span>
                  </div>

                  {/* Action row footer */}
                  <div className="border-t border-slate-100 pt-3.5 flex items-center gap-1.5 justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenScheduleEdit(ex)}
                        className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition"
                        title="Edit schedule details"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this schedule? This cannot be undone.')) {
                            deleteExamSchedule(ex.id);
                          }
                        }}
                        className="p-2 border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition"
                        title="Delete schedule slot"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {hasRecordLink ? (
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 py-1.5 px-2.5 rounded-xl flex items-center gap-1">
                        <CheckCircle2 size={12} /> Logged
                      </span>
                    ) : (
                      <button
                        onClick={() => handleLogMarksFromSchedule(ex)}
                        className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95"
                      >
                        <GraduationCap size={13} />
                        Log Score
                      </button>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: GRADEBOOK LOGS */}
      {activeTab === 'gradebook' && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm" id="gradebook-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-4 px-5">Pupil Profile</th>
                  <th className="py-4 px-5">Subject Matters</th>
                  <th className="py-4 px-5">Topic Checked</th>
                  <th className="py-4 px-5">Test Date</th>
                  <th className="py-4 px-5 text-center">Marks Score</th>
                  <th className="py-4 px-5 text-center">Verdict</th>
                  <th className="py-4 px-5">Teacher Notes</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 px-5 text-center text-slate-400 font-medium">
                      <div className="space-y-2">
                        <Award className="mx-auto text-slate-300 stroke-[1.2]" size={36} />
                        <p>No graded academic records found matched under selected parameters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(rec => {
                    const scorePct = rec.totalMarks > 0 ? Math.round((rec.marksObtained / rec.totalMarks) * 100) : 0;
                    
                    // Style indicators
                    let statusColor = 'bg-slate-50 text-slate-600 border-slate-200';
                    let statusLabel = rec.status;
                    if (rec.status === 'Passed') {
                      statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                    } else if (rec.status === 'Failed') {
                      statusColor = 'bg-rose-50 text-rose-700 border-rose-100';
                    } else if (rec.status === 'Absent') {
                      statusColor = 'bg-slate-100 text-slate-400 border-slate-200';
                    } else if (rec.status === 'Awaiting') {
                      statusColor = 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse';
                    }

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-4 px-5 font-bold text-slate-900">
                          {getSubTitleText(rec.studentId)}
                        </td>
                        <td className="py-4 px-5">
                          <span className="bg-slate-100 text-slate-700 py-0.5 px-2 rounded-md font-bold text-[10px]">
                            {rec.subject}
                          </span>
                        </td>
                        <td className="py-4 px-5 font-medium text-slate-700 max-w-[150px] truncate">
                          {rec.topic}
                        </td>
                        <td className="py-4 px-5 font-mono text-slate-500">
                          {formatDate(rec.date)}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <div className="inline-block">
                            <span className="font-bold text-slate-800 text-sm">
                              {rec.status === 'Absent' ? '-' : rec.marksObtained}
                            </span>
                            <span className="text-slate-400"> / {rec.totalMarks}</span>
                            {rec.status !== 'Absent' && rec.status !== 'Awaiting' && (
                              <p className="text-[9px] font-bold text-slate-400 mt-0.5">({scorePct}%)</p>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-slate-500 italic max-w-[200px] truncate" title={rec.remarks}>
                          {rec.remarks || 'No notes added'}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenRecordEdit(rec)}
                              className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-lg transition"
                              title="Edit academic details"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this result entry?')) {
                                  deleteExamRecord(rec.id);
                                }
                              }}
                              className="p-1.5 border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                              title="Delete result row"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PERFORMANCE ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6" id="analytics-deck">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Subject performance Comparison */}
            <div className="bg-white border border-slate-200 p-5 rounded-[28px] shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                  <BarChart3 size={15} className="text-indigo-600" />
                  Subject-Wise Performance Distribution
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5 pb-2">Average percentage scores scored across different study courses.</p>
              </div>

              <div className="h-64 mt-2" id="subject-score-recharts-bar">
                {subjectPerformanceData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs font-medium">
                    No graded exam record indices available yet to create subject charts.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fontWeight: 500, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }} 
                        formatter={(val) => [`${val}%`, 'Average Score']}
                      />
                      <Bar dataKey="Avg Performance %" radius={[6, 6, 0, 0]}>
                        {subjectPerformanceData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={idx % 2 === 0 ? '#4f46e5' : '#06b6d4'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Student rankings table leaderboards */}
            <div className="bg-white border border-slate-200 p-5 rounded-[28px] shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                  <TrendingUp size={15} className="text-indigo-600" />
                  Student Academic Leaderboards Ranking
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5 pb-2">Average achievement metrics evaluated across registered tutoring slots.</p>
              </div>

              <div className="h-64 mt-2 overflow-y-auto pr-1" id="ranking-list">
                {studentRankPerformance.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs font-medium">
                    Leaderboard lists are compiled dynamically when records are generated.
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {studentRankPerformance.map((item, idx) => {
                      let medalColor = 'bg-slate-100 text-slate-600';
                      if (idx === 0) medalColor = 'bg-amber-100 text-amber-700 font-extrabold';
                      else if (idx === 1) medalColor = 'bg-slate-200 text-slate-800';
                      else if (idx === 2) medalColor = 'bg-orange-150 bg-orange-100 text-orange-850';

                      return (
                        <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs font-semibold shrink-0 ${medalColor}`}>
                              {idx + 1}
                            </span>
                            <div>
                              <h5 className="text-xs font-extrabold text-slate-850 text-slate-800 leading-none">{item.name}</h5>
                              <p className="text-[9px] text-slate-400 mt-1">{item['Exams Completed']} tests logged</p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-xs font-black text-indigo-600">{item['Avg Score %']}%</span>
                            <p className="text-[8px] uppercase tracking-wide font-black text-slate-400">Avg Efficiency</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Historical academic trajectory line map */}
          <div className="bg-white border border-slate-200 p-5 rounded-[28px] shadow-sm">
            <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <Activity size={15} className="text-indigo-600" />
              Academic Exam Score Progress Ledger Map
            </h4>
            <p className="text-[10px] text-slate-405 text-slate-400 mt-0.5 pb-2">Graded score percentage chronologies across the active tuition semester. (All composite test cycles)</p>
            
            <div className="h-72 mt-4" id="historical-score-recharts-line">
              {examRecords.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-450 text-slate-404 text-xs font-medium">
                  Add more graded test logs to plot automatic scores progressions trajectory curves.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={examRecords
                      .filter(er => er.status === 'Passed' || er.status === 'Failed')
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map((rec, i) => {
                        const student = students.find(s => s.id === rec.studentId);
                        return {
                          name: `T-${i+1}`,
                          'Score %': rec.totalMarks > 0 ? Math.round((rec.marksObtained / rec.totalMarks) * 100) : 0,
                          subject: rec.subject,
                          student: student ? student.name : 'Unknown'
                        };
                      })
                    }
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 500, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fontWeight: 500, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }} 
                      formatter={(val, name, props) => [`${val}%`, `${props.payload.student} (${props.payload.subject})`]}
                    />
                    <Line type="monotone" dataKey="Score %" stroke="#4f46e5" strokeWidth={3} activeDot={{ r: 6 }} dot={{ strokeWidth: 2, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>
      )}

      {/* MODAL 1: EXAM SCHEDULE PLANNER FORM */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowScheduleModal(false)} />
          <div className="bg-white rounded-3xl w-full max-w-md p-6 relative z-10 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-950 font-display flex items-center gap-1.5">
                <CalendarDays size={18} className="text-indigo-600" />
                {editingScheduleId ? 'Edit Exam Schedule' : 'Schedule Custom Exam'}
              </h3>
              <button 
                onClick={() => setShowScheduleModal(false)} 
                className="text-slate-400 hover:text-slate-600 font-extrabold text-xs"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              
              {/* Pupil select */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Target Pupil *</label>
                <select
                  value={scheduleForm.studentId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const stud = students.find(s => s.id === id);
                    const nextSched = getNextScheduleData(id);
                    setScheduleForm({
                      ...scheduleForm,
                      studentId: id,
                      subject: stud?.subjects?.[0] || '',
                      time: nextSched.time,
                      date: nextSched.date
                    });
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15"
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.class})</option>
                  ))}
                </select>
              </div>

              {/* Subject matters */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Course Matter *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maths, Physics"
                    value={scheduleForm.subject}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, subject: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Target Marks *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={scheduleForm.totalMarks}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, totalMarks: parseInt(e.target.value) || 100 })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
              </div>

              {/* Exam topic */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Exam Module/Chapters *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chapter 3: Differentiation quiz"
                  value={scheduleForm.topic}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, topic: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Test Date *</label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.date}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Lock Hour *</label>
                  <input
                    type="time"
                    required
                    value={scheduleForm.time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
              </div>

              {/* Reminder parameters */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">App Alarm Reminder (Minutes Before Exam) *</label>
                <select
                  value={scheduleForm.reminderMinutes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, reminderMinutes: parseInt(e.target.value) })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15"
                >
                  <option value={15}>15 Minutes Before</option>
                  <option value={30}>30 Minutes Before</option>
                  <option value={60}>1 Hour Before</option>
                  <option value={120}>2 Hours Before</option>
                  <option value={1440}>1 Day Before</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-650 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition active:scale-98"
              >
                {editingScheduleId ? 'Save Schedule Overwrite' : 'Publish New Test Slot'}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PERFORMANCE GRADE RECORD FORM */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowRecordModal(false)} />
          <div className="bg-white rounded-3xl w-full max-w-md p-6 relative z-10 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-950 font-display flex items-center gap-1.5">
                <Award size={18} className="text-indigo-600" />
                {editingRecordId ? 'Edit Graded Record' : 'Record Student Score'}
              </h3>
              <button 
                onClick={() => setShowRecordModal(false)} 
                className="text-slate-400 hover:text-slate-600 font-extrabold text-xs"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleRecordSubmit} className="space-y-4">
              
              {/* Pupil select */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Target Pupil *</label>
                <select
                  disabled={!!recordForm.examScheduleId}
                  value={recordForm.studentId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const stud = students.find(s => s.id === id);
                    setRecordForm({
                      ...recordForm,
                      studentId: id,
                      subject: stud?.subjects?.[0] || ''
                    });
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60"
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.class})</option>
                  ))}
                </select>
              </div>

              {/* Subject details & Total Marks */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Course Matter *</label>
                  <input
                    type="text"
                    required
                    disabled={!!recordForm.examScheduleId}
                    placeholder="e.g. Algebra, Trigonometry"
                    value={recordForm.subject}
                    onChange={(e) => setRecordForm({ ...recordForm, subject: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Budgets Marks *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={recordForm.totalMarks}
                    onChange={(e) => setRecordForm({ ...recordForm, totalMarks: parseInt(e.target.value) || 100 })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
              </div>

              {/* Topic */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Topic Checked *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quadratic equations test sheet"
                  value={recordForm.topic}
                  onChange={(e) => setRecordForm({ ...recordForm, topic: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15"
                />
              </div>

              {/* Date & Obtainer Marks */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Test Date *</label>
                  <input
                    type="date"
                    required
                    value={recordForm.date}
                    onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Marks Obtained *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={recordForm.totalMarks}
                    disabled={recordForm.status === 'Absent' || recordForm.status === 'Awaiting'}
                    value={recordForm.marksObtained}
                    onChange={(e) => setRecordForm({ ...recordForm, marksObtained: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Status Selector */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Verdict Outcome *</label>
                <select
                  value={recordForm.status}
                  onChange={(e) => {
                    const nextVal = e.target.value as any;
                    setRecordForm({ 
                      ...recordForm, 
                      status: nextVal,
                      marksObtained: (nextVal === 'Absent' || nextVal === 'Awaiting') ? 0 : recordForm.marksObtained
                    });
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15"
                >
                  <option value="Passed">Auto Grading (Pass / Fail thresholds)</option>
                  <option value="Awaiting">Awaiting Result (Paper checking active)</option>
                  <option value="Absent">Absent (Student skipped exam)</option>
                </select>
              </div>

              {/* Remarks notes */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-display">Private Tutorial Remarks</label>
                <textarea
                  placeholder="Excellent performance on theorems. Needs work on calculations..."
                  rows={2}
                  value={recordForm.remarks}
                  onChange={(e) => setRecordForm({ ...recordForm, remarks: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-650 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition active:scale-98"
              >
                {editingRecordId ? 'Overwrite Score Record' : 'Record Score Ledger Entry'}
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
