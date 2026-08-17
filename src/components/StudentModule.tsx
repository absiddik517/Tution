import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Student } from '../types';
import { 
  Plus, Search, Filter, SortAsc, Edit2, Trash2, Calendar, Phone, DollarSign, X, Check, Eye, UserX, UserCheck, RefreshCw
} from 'lucide-react';
import { formatDate } from '../formatUtils';
import { useTheme } from '../theme';
import ConfirmModal from './ConfirmModal';

export default function StudentModule() {
  const { 
    students, addStudent, updateStudent, deleteStudent,
    searchTerm, setSearchTerm, classFilter, setClassFilter,
    statusFilter, setStatusFilter
  } = useStore();

  const { theme } = useTheme();

  const [sorting, setSorting] = useState<'name' | 'salary' | 'date'>('name');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<Student | null>(null);

  // Form Fields State
  const [formName, setFormName] = useState('');
  const [formClass, setFormClass] = useState('Class 10 (SSC)');
  const [formSubjectVal, setFormSubjectVal] = useState('');
  const [formSubjects, setFormSubjects] = useState<string[]>([]);
  const [formPhone, setFormPhone] = useState('');
  const [formCycle, setFormCycle] = useState<Student['paymentCycle']>('Monthly');
  const [formSalary, setFormSalary] = useState(5000);
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [formStatus, setFormStatus] = useState<Student['status']>('Active');
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Reset helper
  const resetForm = () => {
    setFormName('');
    setFormClass('Class 10 (SSC)');
    setFormSubjectVal('');
    setFormSubjects([]);
    setFormPhone('');
    setFormCycle('Monthly');
    setFormSalary(5000);
    setFormStartDate(new Date().toISOString().substring(0, 10));
    setFormStatus('Active');
    setFormErrors({});
  };

  // Trigger Edit Setup
  const handleStartEdit = (student: Student) => {
    setEditingStudent(student);
    setFormName(student.name);
    setFormClass(student.class);
    setFormSubjects([...student.subjects]);
    setFormPhone(student.phone);
    setFormCycle(student.paymentCycle);
    setFormSalary(student.monthlySalary);
    setFormStartDate(student.startDate);
    setFormStatus(student.status);
    setFormErrors({});
    setShowAddModal(true);
  };

  const handleAddSubject = () => {
    if (formSubjectVal.trim() && !formSubjects.includes(formSubjectVal.trim())) {
      setFormSubjects([...formSubjects, formSubjectVal.trim()]);
      setFormSubjectVal('');
    }
  };

  const handleRemoveSubject = (sub: string) => {
    setFormSubjects(formSubjects.filter(s => s !== sub));
  };

  // Form validation (mimicking Zod validation schemas for robust safety matches)
  const validateSchema = () => {
    const errors: { [key: string]: string } = {};
    if (!formName.trim()) {
      errors.name = "Full name is required";
    } else if (formName.trim().length < 3) {
      errors.name = "Name must be at least 3 characters";
    }

    if (!formPhone.trim()) {
      errors.phone = "Phone contact number is required";
    } else if (!/^\+?[0-9\s\-()]{7,16}$/.test(formPhone.trim())) {
      errors.phone = "Please enter a valid phone number (e.g. 01711315695 or +8801711315695)";
    }

    if (formSalary <= 0) {
      errors.salary = "Salary rate must be positive";
    }

    if (formSubjects.length === 0) {
      errors.subjects = "At least one subject must be specified";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSchema()) return;

    const payload = {
      name: formName.trim(),
      class: formClass,
      subjects: formSubjects,
      phone: formPhone.trim(),
      paymentCycle: formCycle,
      monthlySalary: formSalary,
      startDate: formStartDate,
      status: formStatus,
    };

    if (editingStudent) {
      updateStudent(editingStudent.id, payload);
    } else {
      addStudent(payload);
    }

    setShowAddModal(false);
    setEditingStudent(null);
    resetForm();
  };

  // PULL-TO-REFRESH SIMULATION
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handlePullToRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 850);
  };

  // FILTER, SEARCH & SORT LOGIC
  const filteredStudents = useMemo(() => {
    return students
      .filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              s.subjects.some(sub => sub.toLowerCase().includes(searchTerm.toLowerCase())) ||
                              s.class.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesClass = classFilter === 'All' ? true : s.class === classFilter;
        const matchesStatus = statusFilter === 'All' ? true : s.status === statusFilter;
        return matchesSearch && matchesClass && matchesStatus;
      })
      .sort((a, b) => {
        if (sorting === 'name') return a.name.localeCompare(b.name);
        if (sorting === 'salary') return b.monthlySalary - a.monthlySalary;
        if (sorting === 'date') return b.startDate.localeCompare(a.startDate);
        return 0;
      });
  }, [students, searchTerm, classFilter, statusFilter, sorting]);

  // Extract distinct classes for the class selection filter
  const distinctClasses = useMemo(() => {
    const setOfC = new Set(students.map(s => s.class));
    return ['All', ...Array.from(setOfC)];
  }, [students]);

  return (
    <div className={`space-y-6 ${theme.textMain}`}>
      
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${theme.textTitle}`}>Student Directory</h2>
          <p className={`text-xs ${theme.textMuted}`}>Add or manage private students and review billing preferences</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handlePullToRefresh}
            className={`p-2.5 ${theme.bgCardElevated} border ${theme.borderMain} rounded-xl ${theme.textMuted} hover:${theme.bgCardHover} transition shadow-sm`}
            title="Refresh database"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          
          <button 
            onClick={() => { resetForm(); setEditingStudent(null); setShowAddModal(true); }}
            className={`px-4 py-2 ${theme.btnPrimary} font-semibold text-xs tracking-wider uppercase rounded-xl shadow-sm transition flex items-center gap-1.5`}
          >
            <Plus size={15} /> Add Student
          </button>
        </div>
      </div>

      {/* Directory filtering & sorting controls */}
      <div className={`p-4 ${theme.bgCard} border ${theme.borderMain} rounded-2xl shadow-sm space-y-4`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search match */}
          <div className="relative md:col-span-2">
            <Search className={`absolute left-3.5 top-3 ${theme.textMuted}`} size={17} />
            <input 
              type="text" 
              placeholder="Search by name, class or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 ${theme.bgInput} border rounded-xl text-xs font-semibold placeholder:${theme.textMuted} focus:outline-none focus:border-indigo-500 transition`}
            />
          </div>

          {/* Class Filter */}
          <div className="flex items-center gap-2">
            <Filter size={15} className={`${theme.textMuted} shrink-0`} />
            <select 
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className={`w-full ${theme.bgCardElevated} border ${theme.borderMain} rounded-xl p-2.5 text-xs font-semibold ${theme.textMain} focus:outline-none`}
            >
              <option value="All" className={`${theme.bgCard} ${theme.textMain}`}>All Grades</option>
              {distinctClasses.filter(c => c !== 'All').map(cl => (
                <option key={cl} value={cl} className={`${theme.bgCard} ${theme.textMain}`}>{cl}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <SortAsc size={15} className={`${theme.textMuted} shrink-0`} />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={`w-full ${theme.bgCardElevated} border ${theme.borderMain} rounded-xl p-2.5 text-xs font-semibold ${theme.textMain} focus:outline-none`}
            >
              <option value="All" className={`${theme.bgCard} ${theme.textMain}`}>All Statuses</option>
              <option value="Active" className={`${theme.bgCard} ${theme.textMain}`}>Active only</option>
              <option value="Inactive" className={`${theme.bgCard} ${theme.textMain}`}>Inactive only</option>
            </select>
          </div>
        </div>

        {/* Sort triggers */}
        <div className={`flex justify-end gap-2 text-xs border-t ${theme.borderMuted} pt-3`}>
          <span className={`${theme.textMuted} self-center`}>Sort by:</span>
          {['name', 'salary', 'date'].map((item) => (
            <button
              key={item}
              onClick={() => setSorting(item as any)}
              className={`px-3 py-1.5 rounded-lg border font-medium transition ${
                sorting === item 
                  ? `${theme.bgAccent} ${theme.borderAccent} ${theme.textAccent}` 
                  : `${theme.bgCardElevated} ${theme.borderMain} ${theme.textMain} hover:${theme.bgCardHover}`
              }`}
            >
              {item === 'name' ? 'Student Name' : item === 'salary' ? 'Monthly Rate' : 'Start Date'}
            </button>
          ))}
        </div>
      </div>

      {/* Directory Records List */}
      {filteredStudents.length === 0 ? (
        <div className={`text-center py-16 ${theme.bgCard} border ${theme.borderMain} rounded-3xl space-y-4`}>
          <UserX className={`mx-auto ${theme.textMuted}`} size={48} />
          <div>
            <h4 className={`font-bold ${theme.textTitle} text-base`}>No Students Found</h4>
            <p className={`text-xs ${theme.textMuted} mt-1 max-w-sm mx-auto`}>
              Please refine your search criteria or register a new student using the button above.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredStudents.map(student => (
            <div 
              key={student.id} 
              className={`p-5 ${theme.bgCard} border rounded-2xl shadow-sm transition hover:shadow-md flex flex-col justify-between ${
                student.status === 'Inactive' ? `border-dashed ${theme.borderMain} opacity-60` : theme.borderMain
              }`}
            >
              {/* Header block */}
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className={`w-11 h-11 ${theme.bgAccent} ${theme.textAccent} rounded-xl flex items-center justify-center font-bold text-base shadow-sm shrink-0`}>
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className={`font-bold ${theme.textTitle} text-sm flex items-center gap-1.5 leading-snug`}>
                        {student.name}
                        {student.syncStatus === 'pending' && (
                          <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" title="Local offline change pending cloud backup sync" />
                        )}
                      </h3>
                      <p className={`text-xs ${theme.textAccent} font-semibold mt-0.5`}>{student.class}</p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 text-[10px] font-bold tracking-wider rounded-md uppercase ${
                    student.status === 'Active' 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40' 
                      : `${theme.bgCardElevated} ${theme.textMuted} border ${theme.borderMain}`
                  }`}>
                    {student.status}
                  </span>
                </div>

                {/* Subject highlight chips */}
                <div className={`flex flex-wrap gap-1.5 mt-3 pt-3 border-t ${theme.borderMuted}`}>
                  {student.subjects.map(sub => (
                    <span key={sub} className={`${theme.bgCardElevated} border ${theme.borderMuted} text-[10px] font-medium ${theme.textMain} px-2 py-0.5 rounded-full`}>
                      {sub}
                    </span>
                  ))}
                </div>
              </div>

              {/* Contact and Billing Details section */}
              <div className={`mt-4 pt-4 border-t ${theme.borderMuted} space-y-2 text-xs`}>
                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 ${theme.textMuted}`}>
                    <Phone size={13} /> Phone:
                  </span>
                  <a href={`tel:${student.phone}`} className={`font-semibold ${theme.textTitle} hover:underline`}>{student.phone}</a>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 ${theme.textMuted}`}>
                    <DollarSign size={13} /> Tuition Rate:
                  </span>
                  <div className="text-right">
                    <span className={`font-bold ${theme.textTitle}`}>৳{student.monthlySalary}</span>
                    <span className={`text-[10px] ${theme.textMain} ${theme.bgCardElevated} px-1.5 py-0.5 rounded ml-1 tracking-wide font-medium`}>
                      {student.paymentCycle}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`flex items-center gap-1.5 ${theme.textMuted}`}>
                    <Calendar size={13} /> Commencement:
                  </span>
                  <span className={`font-medium ${theme.textMain}`}>{formatDate(student.startDate)}</span>
                </div>
              </div>

              {/* Primary action controls */}
              <div className={`flex items-center justify-between mt-5 pt-3 border-t ${theme.borderMuted} gap-2`}>
                <button
                  onClick={() => setSelectedStudent(student)}
                  className={`px-3 py-1.5 text-xs font-semibold ${theme.textAccent} ${theme.bgAccent} rounded-lg hover:${theme.bgCardHover} transition flex items-center gap-1`}
                >
                  <Eye size={13} /> Summary
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStartEdit(student)}
                    className={`p-1.5 ${theme.textMuted} hover:${theme.textAccent} hover:${theme.bgAccent} rounded-lg transition`}
                    title="Edit profile"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmStudent(student)}
                    className={`p-1.5 ${theme.textMuted} hover:text-rose-500 hover:bg-rose-950/20 rounded-lg transition`}
                    title="Delete profile"
                  >
                    <Trash2 size={14} />
                  </button>
                  
                  {student.status === 'Active' ? (
                    <button
                      onClick={() => updateStudent(student.id, { status: 'Inactive' })}
                      className={`p-1.5 ${theme.textMuted} hover:text-amber-500 hover:bg-amber-950/20 rounded-lg transition`}
                      title="Deactivate portfolio"
                    >
                      <UserX size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => updateStudent(student.id, { status: 'Active' })}
                      className={`p-1.5 ${theme.textMuted} hover:text-emerald-500 hover:bg-emerald-950/20 rounded-lg transition`}
                      title="Reactivate portfolio"
                    >
                      <UserCheck size={14} />
                    </button>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}      {/* DETAILED STUDENT MODAL (ADD / EDIT FORM) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${theme.bgCard} border ${theme.borderMain} rounded-3xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200`}>
            <div className={`p-6 border-b ${theme.borderMuted} flex items-center justify-between`}>
              <div>
                <h3 className={`text-base font-bold ${theme.textTitle}`}>
                  {editingStudent ? 'Modify Student Portfolio' : 'Enroll New Student'}
                </h3>
                <p className={`text-xs ${theme.textMuted} mt-0.5`}>Please provide mandatory student registration variables</p>
              </div>
              <button 
                onClick={() => { setShowAddModal(false); setEditingStudent(null); resetForm(); }}
                className={`w-8 h-8 rounded-full ${theme.bgCardElevated} flex items-center justify-center ${theme.textMuted} hover:${theme.bgCardHover} hover:text-slate-600`}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {/* Name */}
              <div className="space-y-1">
                <label className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>Full Name</label>
                <input 
                  type="text" 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Elizabeth Thompson"
                  className={`w-full text-xs font-semibold p-3 ${theme.bgInput} border rounded-xl focus:outline-none ${
                    formErrors.name ? 'border-red-400 ring-1 ring-red-100' : theme.borderMain
                  }`}
                />
                {formErrors.name && <span className="text-[10px] text-red-500 font-bold block">{formErrors.name}</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Class */}
                <div className="space-y-1">
                  <label className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>Class / Grade</label>
                  <select
                    value={formClass}
                    onChange={(e) => setFormClass(e.target.value)}
                    className={`w-full text-xs font-semibold p-3 ${theme.bgInput} border ${theme.borderMain} rounded-xl focus:outline-none`}
                  >
                    <option value="Class 5" className={`${theme.bgCard} ${theme.textMain}`}>Class 5</option>
                    <option value="Class 6" className={`${theme.bgCard} ${theme.textMain}`}>Class 6</option>
                    <option value="Class 7" className={`${theme.bgCard} ${theme.textMain}`}>Class 7</option>
                    <option value="Class 8 (JSC)" className={`${theme.bgCard} ${theme.textMain}`}>Class 8 (JSC)</option>
                    <option value="Class 9" className={`${theme.bgCard} ${theme.textMain}`}>Class 9</option>
                    <option value="Class 10 (SSC)" className={`${theme.bgCard} ${theme.textMain}`}>Class 10 (SSC)</option>
                    <option value="Class 11 (HSC)" className={`${theme.bgCard} ${theme.textMain}`}>Class 11 (HSC)</option>
                    <option value="Class 12 (HSC)" className={`${theme.bgCard} ${theme.textMain}`}>Class 12 (HSC)</option>
                    <option value="Admission Prep" className={`${theme.bgCard} ${theme.textMain}`}>Admission Prep (BUET/Medical/DU)</option>
                    <option value="Undergraduate" className={`${theme.bgCard} ${theme.textMain}`}>Undergraduate</option>
                  </select>
                </div>

                {/* Contact Phone */}
                <div className="space-y-1">
                  <label className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>Parent / Student Cell</label>
                  <input 
                    type="text" 
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. 01711315695 or +8801711315695"
                    className={`w-full text-xs font-semibold p-3 ${theme.bgInput} border rounded-xl focus:outline-none ${
                      formErrors.phone ? 'border-red-400 ring-1 ring-red-100' : theme.borderMain
                    }`}
                  />
                  {formErrors.phone && <span className="text-[10px] text-red-500 font-bold block">{formErrors.phone}</span>}
                </div>
              </div>

              {/* Subjects Tuition Package */}
              <div className="space-y-2">
                <label className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>Subjects Tuition Package</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={formSubjectVal}
                    onChange={(e) => setFormSubjectVal(e.target.value)}
                    placeholder="Add subject (e.g., Chemistry)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubject();
                      }
                    }}
                    className={`w-full text-xs font-semibold p-3 ${theme.bgInput} border ${theme.borderMain} rounded-xl focus:outline-none`}
                  />
                  <button
                    type="button"
                    onClick={handleAddSubject}
                    className={`px-4 py-2 ${theme.btnPrimary} rounded-xl text-xs font-semibold`}
                  >
                    Add
                  </button>
                </div>
                {formErrors.subjects && <span className="text-[10px] text-red-500 font-bold block">{formErrors.subjects}</span>}

                {formSubjects.length > 0 && (
                  <div className={`flex flex-wrap gap-1.5 p-2 ${theme.bgCardElevated} border ${theme.borderMuted} rounded-xl`}>
                    {formSubjects.map(sub => (
                      <span key={sub} className={`${theme.bgAccent} ${theme.textAccent} text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1`}>
                        {sub}
                        <button type="button" onClick={() => handleRemoveSubject(sub)} className={`${theme.textAccentMuted} hover:${theme.textAccent}`}>
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Payment Cycle */}
                <div className="space-y-1">
                  <label className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>Payment Model Cycle</label>
                  <select
                    value={formCycle}
                    onChange={(e) => setFormCycle(e.target.value as any)}
                    className={`w-full text-xs font-semibold p-3 ${theme.bgInput} border ${theme.borderMain} rounded-xl focus:outline-none`}
                  >
                    <option value="Monthly" className={`${theme.bgCard} ${theme.textMain}`}>Monthly Cycle</option>
                    <option value="Weekly" className={`${theme.bgCard} ${theme.textMain}`}>Weekly Cycle</option>
                    <option value="12 Days" className={`${theme.bgCard} ${theme.textMain}`}>12 Days Period</option>
                    <option value="Custom" className={`${theme.bgCard} ${theme.textMain}`}>Custom Arrangement</option>
                  </select>
                </div>

                {/* Monthly Rate/Salary */}
                <div className="space-y-1">
                  <label className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>Tuition Rate (Salary)</label>
                  <div className="relative">
                    <span className={`absolute left-3 top-3 ${theme.textMuted} text-xs font-bold`}>৳</span>
                    <input 
                      type="number" 
                      value={formSalary}
                      onChange={(e) => setFormSalary(Number(e.target.value))}
                      placeholder="5000"
                      className={`w-full text-xs font-semibold pl-8 pr-3 p-3 ${theme.bgInput} border rounded-xl focus:outline-none ${
                        formErrors.salary ? 'border-red-400 ring-1 ring-red-100' : theme.borderMain
                      }`}
                    />
                  </div>
                  {formErrors.salary && <span className="text-[10px] text-red-500 font-bold block">{formErrors.salary}</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Starting Commencement Date */}
                <div className="space-y-1">
                  <label className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>Starting Date</label>
                  <input 
                    type="date" 
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className={`w-full text-xs font-semibold p-3 ${theme.bgInput} border ${theme.borderMain} rounded-xl focus:outline-none`}
                  />
                </div>

                {/* Status Selection */}
                <div className="space-y-1">
                  <label className={`text-xs font-bold ${theme.textMuted} uppercase tracking-wider block`}>Current Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className={`w-full text-xs font-semibold p-3 ${theme.bgInput} border ${theme.borderMain} rounded-xl focus:outline-none`}
                  >
                    <option value="Active" className={`${theme.bgCard} ${theme.textMain}`}>Active Student</option>
                    <option value="Inactive" className={`${theme.bgCard} ${theme.textMain}`}>Inactive Student</option>
                  </select>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditingStudent(null); resetForm(); }}
                  className={`px-4 py-2.5 border ${theme.borderMain} ${theme.textMain} font-semibold rounded-xl text-xs hover:${theme.bgCardHover} transition`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 ${theme.btnPrimary} font-bold rounded-xl text-xs shadow transition`}
                >
                  {editingStudent ? 'Save Portfolio' : 'Complete Registration'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* SUMMARY DIALOG POPUP */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${theme.bgCard} border ${theme.borderMain} rounded-3xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in duration-200`}>
            <div className={`p-6 border-b ${theme.borderMuted} flex items-center justify-between ${theme.bgCardElevated}`}>
              <div className="flex gap-3">
                <div className={`w-10 h-10 ${theme.bgAccentSolid || 'bg-indigo-600'} text-white rounded-xl flex items-center justify-center font-bold`}>
                  {selectedStudent.name.charAt(0)}
                </div>
                <div>
                  <h3 className={`font-bold ${theme.textTitle} text-base`}>{selectedStudent.name}</h3>
                  <p className={`text-xs ${theme.textMuted}`}>Overview Analytics Checklist</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStudent(null)}
                className={`w-8 h-8 rounded-full ${theme.bgCard} border ${theme.borderMuted} flex items-center justify-center ${theme.textMuted} hover:${theme.bgCardHover}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 ${theme.bgCardElevated} border ${theme.borderMuted} rounded-2xl`}>
                  <span className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-widest block`}>Class Status</span>
                  <span className={`text-base font-extrabold ${theme.textTitle} mt-1 block`}>{selectedStudent.class}</span>
                  <span className={`text-[10px] ${theme.textMuted} block mt-1`}>{selectedStudent.status} status</span>
                </div>

                <div className={`p-4 ${theme.bgCardElevated} border ${theme.borderMuted} rounded-2xl`}>
                  <span className={`text-[10px] font-bold ${theme.textMuted} uppercase tracking-widest block`}>Cycle Rate</span>
                  <span className={`text-base font-extrabold ${theme.textTitle} mt-1 block`}>৳{selectedStudent.monthlySalary}</span>
                  <span className={`text-[10px] ${theme.textMuted} block mt-1`}>Paid on {selectedStudent.paymentCycle} basis</span>
                </div>
              </div>

              {/* Attendance metrics and notes */}
              <div className="space-y-2">
                <h4 className={`font-bold text-xs ${theme.textTitle} uppercase tracking-wide`}>Course Specifics</h4>
                <div className={`p-4 ${theme.bgCardElevated} border ${theme.borderMuted} rounded-2xl space-y-2 text-xs`}>
                  <div className="flex justify-between">
                    <span className={theme.textMuted}>Subjects Enrolled:</span>
                    <span className={`font-bold ${theme.textTitle}`}>{selectedStudent.subjects.join(', ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={theme.textMuted}>Commencement Date:</span>
                    <span className={`font-medium ${theme.textMain}`}>{formatDate(selectedStudent.startDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={theme.textMuted}>Phone Contact:</span>
                    <span className={`font-bold ${theme.textAccent}`}>{selectedStudent.phone}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className={`w-full py-3 ${theme.btnPrimary} rounded-xl text-xs font-bold transition`}
                >
                  Close portfolio review
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Delete Student Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmStudent}
        title="Delete Student Record"
        message={`Are you sure you want to permanently delete the profile for "${deleteConfirmStudent?.name}"?`}
        subMessage="This action will also clean up all associated tuition schedules, class logs, and exam marks."
        confirmText="Delete Student"
        cancelText="Keep Student"
        isDestructive={true}
        icon="trash"
        onConfirm={() => {
          if (deleteConfirmStudent) {
            deleteStudent(deleteConfirmStudent.id);
            setDeleteConfirmStudent(null);
          }
        }}
        onCancel={() => setDeleteConfirmStudent(null)}
      />

    </div>
  );
}
