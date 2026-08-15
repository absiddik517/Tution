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
import { useTheme } from '../theme';

export default function ExamsModule() {
  const { theme, darkMode } = useTheme();
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
  const [plannerFilter, setPlannerFilter] = useState<'Pending' | 'Today' | 'Complete' | 'All'>('Today');
  const [selectedAnalyticsStudentId, setSelectedAnalyticsStudentId] = useState<string>(() => {
    return students[0]?.id || '';
  });

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

  // Sync selectedAnalyticsStudentId with first student when available
  useEffect(() => {
    if (!selectedAnalyticsStudentId && students.length > 0) {
      setSelectedAnalyticsStudentId(students[0].id);
    }
  }, [students, selectedAnalyticsStudentId]);

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
    const todayStr = new Date().toISOString().split('T')[0];

    return examSchedules
      .filter(ex => {
        const student = students.find(s => s.id === ex.studentId);
        const matchesSearch = 
          ex.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
          ex.topic.toLowerCase().includes(searchTerm.toLowerCase()) || 
          (student && student.name.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStudent = selectedStudentFilter === 'All' || ex.studentId === selectedStudentFilter;
        const matchesSubject = selectedSubjectFilter === 'All' || ex.subject === selectedSubjectFilter;
        if (!matchesSearch || !matchesStudent || !matchesSubject) return false;

        const isCompleted = examRecords.some(er => er.examScheduleId === ex.id);

        if (plannerFilter === 'Pending') {
          return !isCompleted;
        } else if (plannerFilter === 'Today') {
          return ex.date === todayStr;
        } else if (plannerFilter === 'Complete') {
          return isCompleted;
        } else {
          return true; // 'All'
        }
      })
      .sort((a, b) => {
        // Sort by exam date and time asc
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });
  }, [examSchedules, students, examRecords, searchTerm, selectedStudentFilter, selectedSubjectFilter, plannerFilter]);

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
    const targetSchedules = selectedStudentFilter === 'All'
      ? examSchedules
      : examSchedules.filter(ex => ex.studentId === selectedStudentFilter);

    const targetRecords = selectedStudentFilter === 'All'
      ? examRecords
      : examRecords.filter(er => er.studentId === selectedStudentFilter);

    const upcomingCount = targetSchedules.filter(ex => {
      const isCompleted = examRecords.some(er => er.examScheduleId === ex.id);
      return !isCompleted;
    }).length;

    const completedCount = targetRecords.length;
    
    // Average Grade score pct percentage
    let totalScorePctSum = 0;
    let gradedRecordsCount = 0;
    let passCount = 0;

    targetRecords.forEach(rec => {
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
    const passRate = targetRecords.length > 0 ? Math.round((passCount / targetRecords.length) * 100) : 0;

    return {
      upcomingCount,
      completedCount,
      averageScore,
      passRate
    };
  }, [examSchedules, examRecords, selectedStudentFilter]);

  // Subject performance matrix for SELECTED individual student
  const selectedStudentSubjectPerformance = useMemo(() => {
    const dataMap: { [subject: string]: { totalMarks: number, marksObtained: number, count: number } } = {};
    
    examRecords.forEach(rec => {
      if (rec.studentId === selectedAnalyticsStudentId && (rec.status === 'Passed' || rec.status === 'Failed')) {
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
        'Avg Performance %': avgPercentage > 100 ? 100 : avgPercentage,
        'Total Tests': dataMap[subject].count
      };
    });
  }, [examRecords, selectedAnalyticsStudentId]);

  // Selected student individual progress over time (chronological)
  const selectedStudentProgressOverTime = useMemo(() => {
    const records = examRecords
      .filter(rec => rec.studentId === selectedAnalyticsStudentId && (rec.status === 'Passed' || rec.status === 'Failed'))
      .sort((a, b) => a.date.localeCompare(b.date));

    return records.map(rec => {
      const percentage = rec.totalMarks > 0 ? Math.round((rec.marksObtained / rec.totalMarks) * 100) : 0;
      return {
        date: formatDate(rec.date),
        rawDate: rec.date,
        subject: rec.subject,
        topic: rec.topic,
        'Score %': percentage,
        displayLabel: `${rec.subject} - ${rec.topic}`,
        marksLabel: `${rec.marksObtained}/${rec.totalMarks}`
      };
    });
  }, [examRecords, selectedAnalyticsStudentId]);

  // Selected student overview stats
  const selectedStudentOverviewStats = useMemo(() => {
    const records = examRecords.filter(rec => rec.studentId === selectedAnalyticsStudentId);
    const passedFailed = records.filter(rec => rec.status === 'Passed' || rec.status === 'Failed');
    
    const totalTaken = records.length;
    const passedCount = records.filter(rec => rec.status === 'Passed').length;
    const failedCount = records.filter(rec => rec.status === 'Failed').length;
    const absentCount = records.filter(rec => rec.status === 'Absent').length;
    const awaitingCount = records.filter(rec => rec.status === 'Awaiting').length;

    let totalPctSum = 0;
    passedFailed.forEach(rec => {
      const pct = rec.totalMarks > 0 ? (rec.marksObtained / rec.totalMarks) * 100 : 0;
      totalPctSum += pct;
    });

    const averageScore = passedFailed.length > 0 ? Math.round(totalPctSum / passedFailed.length) : 0;
    const passRate = passedFailed.length > 0 ? Math.round((passedCount / passedFailed.length) * 100) : 0;

    return {
      totalTaken,
      passedCount,
      failedCount,
      absentCount,
      awaitingCount,
      averageScore,
      passRate
    };
  }, [examRecords, selectedAnalyticsStudentId]);

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
    <div className={`space-y-6 font-sans ${theme.textMain} animate-in fade-in duration-200`} id="exams-module-root">
      
      {/* KPI METRIC CARDS HEADER */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="exams-kpi-row">
        
        {/* KPI 1: Upcoming Exams */}
        <div className={`${theme.bgCard} border ${theme.borderMain} rounded-3xl p-5 shadow-sm hover:shadow-md transition duration-200 flex items-center gap-4`}>
          <div className={`w-12 h-12 ${theme.bgAccent} ${theme.textAccent} rounded-2xl flex items-center justify-center shrink-0`}>
            <CalendarDays size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <p className={`text-[10px] uppercase font-bold tracking-wider ${theme.textMuted}`}>Upcoming Tests</p>
            <h4 className={`text-2xl font-black ${theme.textTitle} leading-none mt-1`}>{kpis.upcomingCount}</h4>
          </div>
        </div>

        {/* KPI 2: Completed Exams */}
        <div className={`${theme.bgCard} border ${theme.borderMain} rounded-3xl p-5 shadow-sm hover:shadow-md transition duration-200 flex items-center gap-4`}>
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <p className={`text-[10px] uppercase font-bold tracking-wider ${theme.textMuted}`}>Total Graded</p>
            <h4 className={`text-2xl font-black ${theme.textTitle} leading-none mt-1`}>{kpis.completedCount}</h4>
          </div>
        </div>

        {/* KPI 3: Avg Score */}
        <div className={`${theme.bgCard} border ${theme.borderMain} rounded-3xl p-5 shadow-sm hover:shadow-md transition duration-200 flex items-center gap-4`}>
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
            <TrendingUp size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <p className={`text-[10px] uppercase font-bold tracking-wider ${theme.textMuted}`}>Average Score</p>
            <h4 className={`text-2xl font-black ${theme.textTitle} leading-none mt-1`}>{kpis.averageScore}%</h4>
          </div>
        </div>

        {/* KPI 4: Pass Rate */}
        <div className={`${theme.bgCard} border ${theme.borderMain} rounded-3xl p-5 shadow-sm hover:shadow-md transition duration-200 flex items-center gap-4`}>
          <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center shrink-0">
            <Award size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <p className={`text-[10px] uppercase font-bold tracking-wider ${theme.textMuted}`}>Pass Rate</p>
            <h4 className={`text-2xl font-black ${theme.textTitle} leading-none mt-1`}>{kpis.passRate}%</h4>
          </div>
        </div>

      </div>

      {/* FILTER CONTROLS & TAB TOGGLES */}
      <div className={`${theme.bgCard} border ${theme.borderMain} p-4 rounded-3xl shadow-sm space-y-4 lg:space-y-0 lg:flex lg:items-center lg:justify-between`} id="exams-toolbar-container">
        
        {/* Toggle selectors */}
        <div className={`flex gap-1.5 ${theme.bgCardElevated} p-1 rounded-2xl overflow-x-auto scrollbar-none max-w-full shrink-0 flex-nowrap w-full sm:w-fit`} id="exams-tabs">
          <button
            onClick={() => setActiveTab('planner')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'planner'
                ? `${theme.bgCard} ${theme.textAccent} shadow-sm`
                : `${theme.textMain} hover:${theme.bgCardHover}`
            }`}
          >
            <ListTodo size={14} />
            Exam Planner
          </button>
          <button
            onClick={() => setActiveTab('gradebook')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'gradebook'
                ? `${theme.bgCard} ${theme.textAccent} shadow-sm`
                : `${theme.textMain} hover:${theme.bgCardHover}`
            }`}
          >
            <GraduationCap size={14} />
            Gradebook Logs
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
              activeTab === 'analytics'
                ? `${theme.bgCard} ${theme.textAccent} shadow-sm`
                : `${theme.textMain} hover:${theme.bgCardHover}`
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
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${theme.textMuted}`} size={14} />
            <input
              type="text"
              placeholder="Search subject, topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 ${theme.bgInput} border ${theme.borderMain} rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none`}
            />
          </div>

          {/* Student Filter */}
          <select
            value={selectedStudentFilter}
            onChange={(e) => setSelectedStudentFilter(e.target.value)}
            className={`px-3 py-2 ${theme.bgInput} border ${theme.borderMain} rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none`}
          >
            <option value="All" className={`${theme.bgCard} ${theme.textMain}`}>All Pupils</option>
            {students.map(s => (
              <option key={s.id} value={s.id} className={`${theme.bgCard} ${theme.textMain}`}>{s.name} ({s.class})</option>
            ))}
          </select>

          {/* Subject Filter */}
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className={`px-3 py-2 ${theme.bgInput} border ${theme.borderMain} rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none`}
          >
            <option value="All" className={`${theme.bgCard} ${theme.textMain}`}>All Subjects</option>
            {availableSubjects.map(sub => (
              <option key={sub} value={sub} className={`${theme.bgCard} ${theme.textMain}`}>{sub}</option>
            ))}
          </select>

          {/* Create Button */}
          {activeTab === 'planner' && (
            <button
              onClick={handleOpenScheduleCreate}
              className={`py-2 px-3 ${theme.btnPrimary} rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0`}
              id="schedule-exam-btn"
            >
              <Plus size={14} />
              Schedule Test
            </button>
          )}

          {activeTab === 'gradebook' && (
            <button
              onClick={handleOpenRecordCreate}
              className={`py-2 px-3 ${theme.btnPrimary} rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0`}
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
        <div className="space-y-4 animate-fade-in">
          {/* Status filters row */}
          <div className={`flex flex-wrap items-center gap-2 pb-1 ${theme.bgCardElevated} p-2.5 rounded-2xl border ${theme.borderMain} max-w-fit`} id="planner-status-filters">
            {(['Pending', 'Today', 'Complete', 'All'] as const).map((filter) => {
              const count = examSchedules.filter(ex => {
                const matchesStudent = selectedStudentFilter === 'All' || ex.studentId === selectedStudentFilter;
                const matchesSubject = selectedSubjectFilter === 'All' || ex.subject === selectedSubjectFilter;
                if (!matchesStudent || !matchesSubject) return false;
                
                const isCompleted = examRecords.some(er => er.examScheduleId === ex.id);
                if (filter === 'Pending') return !isCompleted;
                if (filter === 'Today') return ex.date === new Date().toISOString().split('T')[0];
                if (filter === 'Complete') return isCompleted;
                return true;
              }).length;

              return (
                <button
                  key={filter}
                  onClick={() => setPlannerFilter(filter)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    plannerFilter === filter
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : `${theme.bgCard} hover:${theme.bgCardHover} ${theme.textMain} border ${theme.borderMain}`
                  }`}
                >
                  <span>{filter}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black leading-none ${
                    plannerFilter === filter ? 'bg-indigo-500 text-white' : `${theme.bgCardElevated} ${theme.textMuted}`
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="schedules-deck">
          {filteredSchedules.length === 0 ? (
            <div className={`col-span-full ${theme.bgCard} border ${theme.borderMain} rounded-3xl p-10 text-center space-y-3`} id="schedules-empty-slate">
              <CalendarDays className={`mx-auto ${theme.textMuted} stroke-[1.2]`} size={48} />
              <h4 className={`text-sm font-extrabold ${theme.textTitle}`}>No upcoming exam schedules found</h4>
              <p className={`text-xs ${theme.textMuted} max-w-sm mx-auto`}>Create test slots so that the applet can trigger alert reminders automatically before completion.</p>
              <button
                onClick={handleOpenScheduleCreate}
                className={`mx-auto py-2 px-4 ${theme.btnPrimary} rounded-xl text-xs font-bold transition flex items-center gap-1.5`}
              >
                <Plus size={14} /> Schedule First Test
              </button>
            </div>
          ) : (
            filteredSchedules.map(ex => {
              const todayStr = new Date().toISOString().split('T')[0];
              const isToday = ex.date === todayStr;
              const hasRecordLink = examRecords.some(er => er.examScheduleId === ex.id);
              
              const statusTag: 'Pending' | 'Today' | 'Complete' = hasRecordLink
                ? 'Complete'
                : isToday
                  ? 'Today'
                  : 'Pending';

              return (
                <div 
                  key={ex.id} 
                  className={`${theme.bgCard} border rounded-[28px] p-5 shadow-sm hover:shadow-md transition duration-250 flex flex-col justify-between space-y-4 relative overflow-hidden ${
                    statusTag === 'Complete' 
                      ? 'border-emerald-150 dark:border-emerald-900/40 bg-slate-50/40 dark:bg-emerald-950/5' 
                      : statusTag === 'Today'
                        ? 'border-amber-200 dark:border-amber-900/40 ring-2 ring-amber-500/5'
                        : `border-indigo-150 dark:border-indigo-900/40 ring-2 ring-indigo-500/5`
                  }`}
                >
                  {/* Badge */}
                  <div className="absolute top-0 right-0">
                    <span className={`text-[8.5px] font-black uppercase px-3.5 py-1 rounded-bl-xl border-l border-b ${
                      statusTag === 'Complete'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40'
                        : statusTag === 'Today'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/40 animate-pulse'
                          : `bg-indigo-50 dark:bg-indigo-950/40 ${theme.textAccent} border-indigo-100 dark:border-indigo-900/40`
                    }`}>
                      {statusTag}
                    </span>
                  </div>

                  {/* Header info */}
                  <div className="space-y-2">
                    <span className={`text-[9.5px] ${theme.bgCardElevated} ${theme.textMain} py-1 px-2.5 rounded-full font-bold uppercase tracking-wider`}>
                      {ex.subject}
                    </span>
                    <h3 className={`text-base font-black ${theme.textTitle} leading-tight pt-1`}>
                      {ex.topic}
                    </h3>
                    <p className={`text-xs ${theme.textMuted} font-medium flex items-center gap-1.5`}>
                      <User size={12} className={theme.textMuted} />
                      {getSubTitleText(ex.studentId)}
                    </p>
                  </div>

                  {/* Date details */}
                  <div className={`py-2.5 px-3.5 ${theme.bgInput} rounded-2xl flex items-center justify-between text-xs font-bold ${theme.textMain} font-mono`}>
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className={theme.textMuted} />
                      {formatDate(ex.date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={13} className={theme.textMuted} />
                      {formatTime(ex.time)}
                    </span>
                  </div>

                  {/* Option values */}
                  <div className={`flex items-center justify-between text-[11px] ${theme.textMuted} font-medium`}>
                    <span>Target total: <strong>{ex.totalMarks} Marks</strong></span>
                    <span className="flex items-center gap-1">
                      <AlertCircle size={11} />
                      Alert {ex.reminderMinutes} mins prior
                    </span>
                  </div>

                  {/* Action row footer */}
                  <div className={`border-t ${theme.borderMuted} pt-3.5 flex items-center gap-1.5 justify-between`}>
                    <div className="flex items-center gap-1 min-h-[36px]">
                      {statusTag !== 'Complete' && (
                        <>
                          <button
                            onClick={() => handleOpenScheduleEdit(ex)}
                            className={`p-2 border ${theme.borderMain} hover:${theme.bgCardHover} ${theme.textMuted} hover:${theme.textTitle} rounded-xl transition cursor-pointer`}
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
                            className={`p-2 border ${theme.borderMain} hover:bg-rose-50 dark:hover:bg-rose-950/20 ${theme.textMuted} hover:text-rose-600 rounded-xl transition cursor-pointer`}
                            title="Delete schedule slot"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>

                    {hasRecordLink ? (
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 py-1.5 px-2.5 rounded-xl flex items-center gap-1 shadow-xs">
                        <CheckCircle2 size={12} /> Graded Log
                      </span>
                    ) : (
                      <button
                        onClick={() => handleLogMarksFromSchedule(ex)}
                        className={`py-1.5 px-3 ${theme.btnPrimary} rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer`}
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
      </div>
      )}

      {/* TAB 2: GRADEBOOK LOGS */}
      {activeTab === 'gradebook' && (
        <div className={`${theme.bgCard} border ${theme.borderMain} rounded-3xl overflow-hidden shadow-sm`} id="gradebook-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`${theme.bgCardElevated} border-b ${theme.borderMain} ${theme.textMuted} font-extrabold uppercase text-[10px] tracking-wider`}>
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
              <tbody className={`divide-y ${theme.borderMuted} text-xs`}>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={`py-12 px-5 text-center ${theme.textMuted} font-medium`}>
                      <div className="space-y-2">
                        <Award className={`mx-auto ${theme.textMuted} stroke-[1.2]`} size={36} />
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
                      <tr key={rec.id} className={`hover:${theme.bgCardHover} transition`}>
                        <td className={`py-4 px-5 font-bold ${theme.textTitle}`}>
                          {getSubTitleText(rec.studentId)}
                        </td>
                        <td className="py-4 px-5">
                          <span className={`${theme.bgCardElevated} ${theme.textMain} py-0.5 px-2 rounded-md font-bold text-[10px]`}>
                            {rec.subject}
                          </span>
                        </td>
                        <td className={`py-4 px-5 font-medium ${theme.textMain} max-w-[150px] truncate`}>
                          {rec.topic}
                        </td>
                        <td className={`py-4 px-5 font-mono ${theme.textMuted}`}>
                          {formatDate(rec.date)}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <div className="inline-block">
                            <span className={`font-bold ${theme.textTitle} text-sm`}>
                              {rec.status === 'Absent' ? '-' : rec.marksObtained}
                            </span>
                            <span className={theme.textMuted}> / {rec.totalMarks}</span>
                            {rec.status !== 'Absent' && rec.status !== 'Awaiting' && (
                              <p className={`text-[9px] font-bold ${theme.textMuted} mt-0.5`}>({scorePct}%)</p>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className={`py-4 px-5 ${theme.textMuted} italic max-w-[200px] truncate`} title={rec.remarks}>
                          {rec.remarks || 'No notes added'}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenRecordEdit(rec)}
                              className={`p-1.5 border ${theme.borderMain} hover:${theme.bgCardHover} ${theme.textMuted} hover:${theme.textTitle} rounded-lg transition`}
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
                              className={`p-1.5 border ${theme.borderMain} hover:bg-rose-50 dark:hover:bg-rose-950/20 ${theme.textMuted} hover:text-rose-600 rounded-lg transition`}
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
          {students.length === 0 ? (
            <div className={`${theme.bgCard} border ${theme.borderMain} rounded-3xl p-10 text-center space-y-3`}>
              <User className={`mx-auto ${theme.textMuted}`} size={48} />
              <h4 className={`text-sm font-extrabold ${theme.textTitle}`}>No student directory records available</h4>
              <p className={`text-xs ${theme.textMuted} max-w-sm mx-auto`}>Create student files under Student Directory to visualize custom grade analysis.</p>
            </div>
          ) : (
            <>
              {/* Student Selector Row */}
              <div className={`${theme.bgCardElevated} border ${theme.borderMain} p-4 rounded-[24px] flex flex-col md:flex-row md:items-center justify-between gap-4`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${theme.bgAccent} border ${theme.borderMain} ${theme.textAccent} rounded-2xl flex items-center justify-center font-extrabold shrink-0`}>
                    <User size={18} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-black ${theme.textTitle} leading-none`}>Individual Student Analytics Workspace</h4>
                    <p className={`text-[10px] ${theme.textMuted} mt-1 flex-wrap`}>Select a student first to isolate and inspect their progress without comparison.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${theme.textMuted} shrink-0`}>Student Profile:</span>
                  <select
                    value={selectedAnalyticsStudentId}
                    onChange={(e) => setSelectedAnalyticsStudentId(e.target.value)}
                    className={`${theme.bgCard} border ${theme.borderMain} rounded-xl px-4 py-2 text-xs font-bold ${theme.textMain} outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 min-w-[200px] shadow-xs cursor-pointer`}
                  >
                    {students.map(s => (
                      <option key={s.id} value={s.id} className={`${theme.bgCard} ${theme.textMain}`}>{s.name} ({s.class})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Individual Student KPI stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`${theme.bgCard} border ${theme.borderMain} rounded-2xl p-4 shadow-xs`}>
                  <p className={`text-[9px] uppercase font-bold tracking-wider ${theme.textMuted}`}>Total Exams Taken</p>
                  <p className={`text-xl font-black ${theme.textTitle} mt-1`}>{selectedStudentOverviewStats.totalTaken}</p>
                  <p className={`text-[8.5px] ${theme.textMuted} mt-0.5`}>Includes absent/awaiting slots</p>
                </div>
                <div className={`${theme.bgCard} border ${theme.borderMain} rounded-2xl p-4 shadow-xs`}>
                  <p className={`text-[9px] uppercase font-bold tracking-wider ${theme.textMuted}`}>Pass Efficiency Rate</p>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{selectedStudentOverviewStats.passRate}%</p>
                  <p className="text-[8.5px] text-emerald-500/80 mt-0.5">{selectedStudentOverviewStats.passedCount} tests passed</p>
                </div>
                <div className={`${theme.bgCard} border ${theme.borderMain} rounded-2xl p-4 shadow-xs`}>
                  <p className={`text-[9px] uppercase font-bold tracking-wider ${theme.textMuted}`}>Average Score Ratio</p>
                  <p className={`text-xl font-black ${theme.textAccent} mt-1`}>{selectedStudentOverviewStats.averageScore}%</p>
                  <p className={`text-[8.5px] ${theme.textMuted} mt-0.5`}>Based on graded scores</p>
                </div>
                <div className={`${theme.bgCard} border ${theme.borderMain} rounded-2xl p-4 shadow-xs`}>
                  <p className={`text-[9px] uppercase font-bold tracking-wider ${theme.textMuted}`}>Class Standing Logs</p>
                  <div className="flex items-center gap-1.5 mt-1 font-bold text-xs select-none">
                    <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded" title="Passed">{selectedStudentOverviewStats.passedCount}P</span>
                    <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded" title="Failed">{selectedStudentOverviewStats.failedCount}F</span>
                    <span className={`text-slate-500 ${theme.bgCardElevated} px-1.5 py-0.5 rounded`} title="Absent">{selectedStudentOverviewStats.absentCount}Ab</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Chart 1: Student Subject performance */}
                <div className={`${theme.bgCard} border ${theme.borderMain} p-5 rounded-[28px] shadow-sm flex flex-col justify-between`}>
                  <div>
                    <h4 className={`text-sm font-extrabold ${theme.textTitle} flex items-center gap-1.5`}>
                      <BarChart3 size={15} className={theme.textAccent} />
                      Subject-Wise Efficiency Breakdown
                    </h4>
                    <p className={`text-[10px] ${theme.textMuted} mt-0.5 pb-2`}>Average percentage scores across different tutoring subjects for this student.</p>
                  </div>

                  <div className="h-64 mt-2" id="student-subject-score-bar">
                    {selectedStudentSubjectPerformance.length === 0 ? (
                      <div className={`h-full flex items-center justify-center ${theme.textMuted} text-xs font-medium`}>
                        No graded test records logged yet for this specific student profile.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={selectedStudentSubjectPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? '#334155' : '#f1f5f9'} />
                          <XAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 600, fill: darkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fontWeight: 500, fill: darkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ 
                              borderRadius: '12px', 
                              background: darkMode ? '#1e293b' : '#ffffff', 
                              border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, 
                              color: darkMode ? '#f8fafc' : '#0f172a',
                              fontSize: '11px', 
                              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' 
                            }} 
                            formatter={(val) => [`${val}%`, 'Avg Score']}
                          />
                          <Bar dataKey="Avg Performance %" radius={[6, 6, 0, 0]}>
                            {selectedStudentSubjectPerformance.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={idx % 2 === 0 ? '#4f46e5' : '#06b6d4'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Individual completed exams log list */}
                <div className={`${theme.bgCard} border ${theme.borderMain} p-5 rounded-[28px] shadow-sm flex flex-col justify-between`}>
                  <div>
                    <h4 className={`text-sm font-extrabold ${theme.textTitle} flex items-center gap-1.5`}>
                      <BookOpen size={15} className={theme.textAccent} />
                      Completed Exam Syllabus Records
                    </h4>
                    <p className={`text-[10px] ${theme.textMuted} mt-0.5 pb-2`}>List of graded assessment achievements and exam scores.</p>
                  </div>

                  <div className="h-64 mt-2 overflow-y-auto pr-1 space-y-2.5" id="student-exam-history-list">
                    {selectedStudentProgressOverTime.length === 0 ? (
                      <div className={`h-full flex items-center justify-center ${theme.textMuted} text-xs font-medium`}>
                        No completing exam sessions logged yet for this target student.
                      </div>
                    ) : (
                      selectedStudentProgressOverTime.slice().reverse().map((rec, idx) => {
                        return (
                          <div key={idx} className={`flex items-center justify-between p-3 ${theme.bgInput} rounded-2xl border ${theme.borderMuted}`}>
                            <div>
                              <h5 className={`text-xs font-extrabold ${theme.textTitle} leading-none`}>{rec.displayLabel}</h5>
                              <p className={`text-[9px] ${theme.textMuted} mt-1`}>{rec.date} • Score: {rec.marksLabel}</p>
                            </div>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              rec['Score %'] >= 50 ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                            }`}>
                              {rec['Score %']}%
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>              {/* Historical academic trajectory line map */}
              <div className={`${theme.bgCard} border ${theme.borderMain} p-5 rounded-[28px] shadow-sm`}>
                <h4 className={`text-sm font-extrabold ${theme.textTitle} flex items-center gap-1.5`}>
                  <Activity size={15} className={theme.textAccent} />
                  Isolated Academic Score Trajectory Curve
                </h4>
                <p className={`text-[10px] ${theme.textMuted} mt-0.5 pb-2`}>Chronological grade progression trajectory across tests completed by this student.</p>
                
                <div className="h-72 mt-4" id="historical-score-recharts-line">
                  {selectedStudentProgressOverTime.length === 0 ? (
                    <div className={`h-full flex items-center justify-center ${theme.textMuted} text-xs font-medium`}>
                      Logs of completed test sessions will form structural progress markers here.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={selectedStudentProgressOverTime}
                        margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#334155' : '#f1f5f9'} vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 500, fill: darkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fontWeight: 500, fill: darkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '12px', 
                            background: darkMode ? '#1e293b' : '#ffffff', 
                            border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, 
                            color: darkMode ? '#f8fafc' : '#0f172a',
                            fontSize: '11px' 
                          }} 
                          formatter={(val, name, props) => [`${val}%`, `${props.payload.displayLabel}`]}
                        />
                        <Line type="monotone" dataKey="Score %" stroke="#4f46e5" strokeWidth={3} activeDot={{ r: 6 }} dot={{ strokeWidth: 2, r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL 1: EXAM SCHEDULE PLANNER FORM */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowScheduleModal(false)} />
          <div className={`${theme.bgCard} rounded-3xl w-full max-w-md p-6 relative z-10 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 border ${theme.borderMain}`}>
            <div className={`flex items-center justify-between border-b ${theme.borderMuted} pb-3`}>
              <h3 className={`text-lg font-black ${theme.textTitle} font-display flex items-center gap-1.5`}>
                <CalendarDays size={18} className={theme.textAccent} />
                {editingScheduleId ? 'Edit Exam Schedule' : 'Schedule Custom Exam'}
              </h3>
              <button 
                onClick={() => setShowScheduleModal(false)} 
                className={`${theme.textMuted} hover:${theme.textTitle} font-extrabold text-xs`}
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              
              {/* Pupil select */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider font-display`}>Target Pupil *</label>
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
                  className={`w-full px-3 py-2.5 ${theme.bgInput} border ${theme.borderMain} ${theme.textMain} rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15`}
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id} className={`${theme.bgCard} ${theme.textMain}`}>{s.name} ({s.class})</option>
                  ))}
                </select>
              </div>

              {/* Subject matters */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider font-display`}>Course Matter *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maths, Physics"
                    value={scheduleForm.subject}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, subject: e.target.value })}
                    className={`w-full px-3 py-2.5 ${theme.bgInput} border ${theme.borderMain} ${theme.textMain} rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15`}
                  />
                </div>
                <div className="space-y-1">
                  <label className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider font-display`}>Target Marks *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={scheduleForm.totalMarks}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, totalMarks: parseInt(e.target.value) || 100 })}
                    className={`w-full px-3 py-2.5 ${theme.bgInput} border ${theme.borderMain} ${theme.textMain} rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15`}
                  />
                </div>
              </div>

              {/* Exam topic */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider font-display`}>Exam Module/Chapters *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chapter 3: Differentiation quiz"
                  value={scheduleForm.topic}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, topic: e.target.value })}
                  className={`w-full px-3 py-2.5 ${theme.bgInput} border ${theme.borderMain} ${theme.textMain} rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15`}
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="space-y-1">
                  <label className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider font-display`}>Test Date *</label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.date}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                    className={`w-full px-3 py-2.5 ${theme.bgInput} border ${theme.borderMain} ${theme.textMain} rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15`}
                  />
                </div>
                <div className="space-y-1">
                  <label className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider font-display`}>Lock Hour *</label>
                  <input
                    type="time"
                    required
                    value={scheduleForm.time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                    className={`w-full px-3 py-2.5 ${theme.bgInput} border ${theme.borderMain} ${theme.textMain} rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15`}
                  />
                </div>
              </div>

              {/* Reminder parameters */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider font-display`}>App Alarm Reminder (Minutes Before Exam) *</label>
                <select
                  value={scheduleForm.reminderMinutes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, reminderMinutes: parseInt(e.target.value) })}
                  className={`w-full px-3 py-2.5 ${theme.bgInput} border ${theme.borderMain} ${theme.textMain} rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15`}
                >
                  <option value={15} className={`${theme.bgCard} ${theme.textMain}`}>15 Minutes Before</option>
                  <option value={30} className={`${theme.bgCard} ${theme.textMain}`}>30 Minutes Before</option>
                  <option value={60} className={`${theme.bgCard} ${theme.textMain}`}>1 Hour Before</option>
                  <option value={120} className={`${theme.bgCard} ${theme.textMain}`}>2 Hours Before</option>
                  <option value={1440} className={`${theme.bgCard} ${theme.textMain}`}>1 Day Before</option>
                </select>
              </div>

              <button
                type="submit"
                className={`w-full py-3 ${theme.btnPrimary} rounded-xl font-bold text-xs uppercase tracking-wider transition active:scale-98`}
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
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowRecordModal(false)} />
          <div className={`${theme.bgCard} rounded-3xl w-full max-w-md p-6 relative z-10 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 border ${theme.borderMain}`}>
            <div className={`flex items-center justify-between border-b ${theme.borderMuted} pb-3`}>
              <h3 className={`text-lg font-black ${theme.textTitle} font-display flex items-center gap-1.5`}>
                <Award size={18} className={theme.textAccent} />
                {editingRecordId ? 'Edit Graded Record' : 'Record Student Score'}
              </h3>
              <button 
                onClick={() => setShowRecordModal(false)} 
                className={`${theme.textMuted} hover:${theme.textTitle} font-extrabold text-xs`}
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleRecordSubmit} className="space-y-4">
              
              {/* Pupil select */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider font-display`}>Target Pupil *</label>
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
                  className={`w-full px-3 py-2.5 ${theme.bgInput} border ${theme.borderMain} ${theme.textMain} rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60`}
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id} className={`${theme.bgCard} ${theme.textMain}`}>{s.name} ({s.class})</option>
                  ))}
                </select>
              </div>

              {/* Subject details & Total Marks */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider font-display`}>Course Matter *</label>
                  <input
                    type="text"
                    required
                    disabled={!!recordForm.examScheduleId}
                    placeholder="e.g. Algebra, Trigonometry"
                    value={recordForm.subject}
                    onChange={(e) => setRecordForm({ ...recordForm, subject: e.target.value })}
                    className={`w-full px-3 py-2.5 ${theme.bgInput} border ${theme.borderMain} ${theme.textMain} rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-60`}
                  />
                </div>
                <div className="space-y-1">
                  <label className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider font-display`}>Budgets Marks *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={recordForm.totalMarks}
                    onChange={(e) => setRecordForm({ ...recordForm, totalMarks: parseInt(e.target.value) || 100 })}
                    className={`w-full px-3 py-2.5 ${theme.bgInput} border ${theme.borderMain} ${theme.textMain} rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15`}
                  />
                </div>
              </div>

              {/* Topic */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider font-display`}>Topic Checked *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Quadratic equations test sheet"
                  value={recordForm.topic}
                  onChange={(e) => setRecordForm({ ...recordForm, topic: e.target.value })}
                  className={`w-full px-3 py-2.5 ${theme.bgInput} border ${theme.borderMain} ${theme.textMain} rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15`}
                />
              </div>

              {/* Date & Obtainer Marks */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider font-display`}>Test Date *</label>
                  <input
                    type="date"
                    required
                    value={recordForm.date}
                    onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })}
                    className={`w-full px-3 py-2.5 ${theme.bgInput} border ${theme.borderMain} ${theme.textMain} rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15`}
                  />
                </div>
                <div className="space-y-1">
                  <label className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider font-display`}>Marks Obtained *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={recordForm.totalMarks}
                    disabled={recordForm.status === 'Absent' || recordForm.status === 'Awaiting'}
                    value={recordForm.marksObtained}
                    onChange={(e) => setRecordForm({ ...recordForm, marksObtained: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-3 py-2.5 ${theme.bgInput} border ${theme.borderMain} ${theme.textMain} rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:opacity-50`}
                  />
                </div>
              </div>

              {/* Status Selector */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider font-display`}>Verdict Outcome *</label>
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
                  className={`w-full px-3 py-2.5 ${theme.bgInput} border ${theme.borderMain} ${theme.textMain} rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15`}
                >
                  <option value="Passed" className={`${theme.bgCard} ${theme.textMain}`}>Auto Grading (Pass / Fail thresholds)</option>
                  <option value="Awaiting" className={`${theme.bgCard} ${theme.textMain}`}>Awaiting Result (Paper checking active)</option>
                  <option value="Absent" className={`${theme.bgCard} ${theme.textMain}`}>Absent (Student skipped exam)</option>
                </select>
              </div>

              {/* Remarks notes */}
              <div className="space-y-1">
                <label className={`text-[10px] uppercase font-bold ${theme.textMuted} tracking-wider font-display`}>Private Tutorial Remarks</label>
                <textarea
                  placeholder="Excellent performance on theorems. Needs work on calculations..."
                  rows={2}
                  value={recordForm.remarks}
                  onChange={(e) => setRecordForm({ ...recordForm, remarks: e.target.value })}
                  className={`w-full px-3 py-2.5 ${theme.bgInput} border ${theme.borderMain} ${theme.textMain} rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/15 resize-none`}
                />
              </div>

              <button
                type="submit"
                className={`w-full py-3 ${theme.btnPrimary} rounded-xl font-bold text-xs uppercase tracking-wider transition active:scale-98`}
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
