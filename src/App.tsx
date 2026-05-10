import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GraduationCap, 
  BookOpen, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  BarChart3, 
  Info,
  Clock,
  Wifi,
  Heart,
  Activity,
  Loader2,
  Upload,
  FileSpreadsheet,
  Download,
  Table as TableIcon,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Menu,
  X,
  Plus,
  Trash2,
  FileText,
  CheckSquare,
  Square,
  Mail,
  Lock,
  ArrowLeft
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  ReferenceLine
} from 'recharts';
import * as XLSX from 'xlsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { predictBatchStudentGrades, chatWithGemini } from './services/geminiService';
import { StudentData, PredictionResult as PredictionResultType, User, UserRole } from './types';

const INITIAL_DATA: StudentData = {
  sex: 'M',
  age: 18,
  traveltime: 1,
  studytime: 2,
  activities: true,
  failures: 0,
  internet: true,
  health: 5,
  absences: 0,
  goout: 3,
  freetime: 3,
  Mid1: 18,
  Mid2: 20,
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  
  const [studentData, setStudentData] = useState<StudentData>(INITIAL_DATA);
  const [prediction, setPrediction] = useState<PredictionResultType | null>(null);
  const [batchResults, setBatchResults] = useState<(PredictionResultType & { student: StudentData })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal & Checklist states
  const [activeModal, setActiveModal] = useState<'profile' | 'progress' | 'chatbot' | 'predictor' | 'logout' | null>(null);
  const [checklist, setChecklist] = useState<{ id: string; text: string; completed: boolean }[]>(() => {
    const saved = localStorage.getItem('edu_checklist');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTopic, setNewTopic] = useState('');

  // Chatbot states
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; parts: { text: string }[] }[]>([
    { role: 'model', parts: [{ text: "Hi! I'm EduBot. How can I help you with your studies today?" }] }
  ]);
  const [facultyChatMessages, setFacultyChatMessages] = useState<{ role: 'user' | 'model'; parts: { text: string }[] }[]>([
    { role: 'model', parts: [{ text: "Hello Professor! I can help you generate questions, quizzes, and assessment materials. What subject are we working on today?" }] }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [crafterTopic, setCrafterTopic] = useState('');
  const [crafterCount, setCrafterCount] = useState('');
  const [crafterType, setCrafterType] = useState('MCQ');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const facultyChatEndRef = useRef<HTMLDivElement>(null);

  // Upcoming Tasks states
  const [upcomingTasks, setUpcomingTasks] = useState<{ title: string; date: string; type: string; color: string }[]>(() => {
    const saved = localStorage.getItem('edu_tasks');
    return saved ? JSON.parse(saved) : [
      { title: 'Math Quiz', date: 'Tomorrow', type: 'Exam', color: 'bg-red-100 text-red-600' },
      { title: 'History Essay', date: 'Friday', type: 'Assignment', color: 'bg-blue-100 text-blue-600' },
      { title: 'Lab Report', date: 'Next Mon', type: 'Project', color: 'bg-purple-100 text-purple-600' },
    ];
  });
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', date: '', type: 'Assignment' });

  // Faculty Classes states
  const [facultyClasses, setFacultyClasses] = useState<{ subject: string; time: string; section: string; color: string }[]>(() => {
    const saved = localStorage.getItem('edu_faculty_classes');
    return saved ? JSON.parse(saved) : [
      { subject: 'Advanced AI', time: '09:00 AM', section: 'CSE-A', color: 'bg-blue-100 text-blue-600' },
      { subject: 'Machine Learning', time: '11:30 AM', section: 'CSE-C', color: 'bg-indigo-100 text-indigo-600' },
      { subject: 'Data Structures', time: '02:00 PM', section: 'IT-B', color: 'bg-purple-100 text-purple-600' },
    ];
  });
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClass, setNewClass] = useState({ subject: '', time: '', section: '' });
  const [loginMode, setLoginMode] = useState<'student' | 'faculty' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    localStorage.setItem('edu_tasks', JSON.stringify(upcomingTasks));
  }, [upcomingTasks]);

  useEffect(() => {
    localStorage.setItem('edu_faculty_classes', JSON.stringify(facultyClasses));
  }, [facultyClasses]);

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.subject || !newClass.time || !newClass.section) return;

    const colors = [
      'bg-blue-100 text-blue-600',
      'bg-indigo-100 text-indigo-600',
      'bg-purple-100 text-purple-600',
      'bg-emerald-100 text-emerald-600',
      'bg-amber-100 text-amber-600'
    ];

    setFacultyClasses([
      ...facultyClasses,
      { 
        ...newClass, 
        color: colors[facultyClasses.length % colors.length]
      }
    ]);
    setNewClass({ subject: '', time: '', section: '' });
    setIsAddingClass(false);
  };

  const handleRemoveClass = (index: number) => {
    setFacultyClasses(facultyClasses.filter((_, i) => i !== index));
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.date) return;

    const colors = {
      'Exam': 'bg-red-100 text-red-600',
      'Assignment': 'bg-blue-100 text-blue-600',
      'Project': 'bg-purple-100 text-purple-600',
      'Grading': 'bg-amber-100 text-amber-600',
      'Lecture': 'bg-indigo-100 text-indigo-600',
      'Meeting': 'bg-emerald-100 text-emerald-600',
      'Other': 'bg-slate-100 text-slate-600'
    };

    setUpcomingTasks([
      ...upcomingTasks,
      { 
        ...newTask, 
        color: colors[newTask.type as keyof typeof colors] || colors['Other']
      }
    ]);
    setNewTask({ title: '', date: '', type: 'Assignment' });
    setIsAddingTask(false);
  };

  const handleRemoveTask = (index: number) => {
    setUpcomingTasks(upcomingTasks.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent, isFacultyChat = false) => {
    e.preventDefault();
    if (chatLoading) return;
    
    const inputMessage = chatInput.trim();
    
    if (isFacultyChat) {
      if (!inputMessage && !crafterTopic.trim() && !crafterCount.trim()) return;
      
      let userMessage = inputMessage;
      
      // If using the structured inputs
      if (crafterTopic.trim() || crafterCount.trim() || crafterType.trim()) {
        if (!crafterTopic.trim() || !crafterCount.trim() || !crafterType.trim()) {
          const missing = [];
          if (!crafterTopic.trim()) missing.push("Subject/Topic");
          if (!crafterCount.trim()) missing.push("Number of Questions");
          if (!crafterType.trim()) missing.push("Question Type");
          
          const newMessages = [...facultyChatMessages, { role: 'user' as const, parts: [{ text: `Topic: ${crafterTopic || 'Missing'}, Count: ${crafterCount || 'Missing'}, Type: ${crafterType || 'Missing'}` }] }];
          setFacultyChatMessages([...newMessages, { role: 'model' as const, parts: [{ text: `I'm ready to create your assessment! However, I'm missing the following required details: **${missing.join(', ')}**. \n\nPlease provide these so I can generate the perfect ${crafterType || 'questions'} for you.` }] }]);
          return;
        }
        userMessage = `Please generate ${crafterCount} ${crafterType} questions for the topic: ${crafterTopic}.${inputMessage ? ` Additional instructions: ${inputMessage}` : ''}`;
        setCrafterTopic('');
        setCrafterCount('');
        setCrafterType('MCQ');
      }
      
      setChatInput('');
      const newMessages = [...facultyChatMessages, { role: 'user' as const, parts: [{ text: userMessage }] }];
      setFacultyChatMessages(newMessages);
      setChatLoading(true);
      try {
        const facultySystemInstruction = `You are an expert academic assessment generator. Your goal is to help faculty create high-quality questions, quizzes, and exam papers. 
        
        CRITICAL: Before generating any questions, you MUST ensure the user has provided ALL THREE:
        1. Subject/Topic
        2. Number of Questions
        3. Question Type (e.g., MCQ, Theory, True/False, Short Answer)
        
        If ANY of these are missing, do NOT generate any questions. Instead, politely ask the user for the missing information.
        
        Use Markdown (bolding, lists, and tables) to make your answers highly visual and easy to scan. Provide clear, structured questions with marking schemes when asked.`;
        
        const response = await chatWithGemini(newMessages, facultySystemInstruction);
        setFacultyChatMessages([...newMessages, { role: 'model' as const, parts: [{ text: response }] }]);
      } catch (err) {
        console.error("Faculty Chat Error:", err);
        const errorMessage = err instanceof Error && err.message === "API_KEY_MISSING" 
          ? "API Key is missing. Please configure it in Settings (AI Studio) or your .env file (local)."
          : "I encountered an error while generating your assessment. Please check your connection or API key.";
        setFacultyChatMessages([...newMessages, { role: 'model' as const, parts: [{ text: errorMessage }] }]);
      } finally {
        setChatLoading(false);
      }
    } else {
      if (!inputMessage) return;
      setChatInput('');
      const newMessages = [...chatMessages, { role: 'user' as const, parts: [{ text: inputMessage }] }];
      setChatMessages(newMessages);
      setChatLoading(true);
      try {
        const response = await chatWithGemini(newMessages);
        setChatMessages([...newMessages, { role: 'model' as const, parts: [{ text: response }] }]);
      } catch (err) {
        console.error("Student Chat Error:", err);
        const errorMessage = err instanceof Error && err.message === "API_KEY_MISSING" 
          ? "API Key is missing. Please configure it in Settings (AI Studio) or your .env file (local)."
          : "Sorry, I'm having trouble connecting. Please check your API key or try again later.";
        setChatMessages([...newMessages, { role: 'model' as const, parts: [{ text: errorMessage }] }]);
      } finally {
        setChatLoading(false);
      }
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    facultyChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [facultyChatMessages]);

  useEffect(() => {
    localStorage.setItem('edu_checklist', JSON.stringify(checklist));
  }, [checklist]);

  const addTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim()) return;
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      text: newTopic.trim(),
      completed: false,
    };
    setChecklist([...checklist, newItem]);
    setNewTopic('');
  };

  const toggleTopic = (id: string) => {
    setChecklist(checklist.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const removeTopic = (id: string) => {
    setChecklist(checklist.filter(item => item.id !== id));
  };

  useEffect(() => {
    // Auth removed - direct access enabled
    setAuthLoading(false);
  }, []);

  const handlePortalEntry = (role: UserRole) => {
    setLoginMode(role);
    setLoginError('');
    setEmail('');
    setPassword('');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLoginError('Please enter both email and password');
      return;
    }
    
    // Simple mock validation
    if (password.length < 6) {
      setLoginError('Password must be at least 6 characters');
      return;
    }

    const mockUser: User = {
      uid: `mock-${loginMode}-${Date.now()}`,
      email: email,
      role: loginMode as UserRole,
      displayName: loginMode === 'student' ? 'Bathula Harish' : 'P. Deepthi',
      rollNumber: loginMode === 'student' ? '24245A6601' : undefined,
      facultyId: loginMode === 'faculty' ? '501' : undefined,
    };
    setUser(mockUser);
    setLoginMode(null);
  };

  const handleLogout = () => {
    setUser(null);
    setActiveModal(null);
  };

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setBatchResults([]);
    try {
      const results = await predictBatchStudentGrades([studentData]);
      setPrediction(results[0]);
    } catch (err) {
      console.error("Prediction Error:", err);
      const errorMessage = err instanceof Error && err.message === "API_KEY_MISSING" 
        ? "API Key is missing. Please configure it in Settings (AI Studio) or your .env file (local)."
        : "Failed to generate prediction. Please check your connection or API key.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setPrediction(null);
    
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        // Map excel data to StudentData
        const students: StudentData[] = data.map(row => ({
          sex: (row['Sex'] || row['sex'] || 'M').toUpperCase() as 'M' | 'F',
          age: Number(row['Age'] || row['age'] || 18),
          traveltime: Number(row['Travel Time'] || row['traveltime'] || 1),
          studytime: Number(row['Study Time'] || row['studytime'] || 2),
          activities: String(row['Activities'] || row['activities']).toLowerCase() === 'yes' || !!row['activities'],
          failures: Number(row['Failures'] || row['failures'] || 0),
          internet: String(row['Internet'] || row['internet']).toLowerCase() === 'yes' || !!row['internet'],
          health: Number(row['Health'] || row['health'] || 5),
          absences: Number(row['Absences'] || row['absences'] || 0),
          goout: Number(row['Go Out'] || row['goout'] || 3),
          freetime: Number(row['Free Time'] || row['freetime'] || 3),
          Mid1: Number(row['Mid1'] || row['Midterm 1'] || row['G1'] || row['g1'] || 18),
          Mid2: Number(row['Mid2'] || row['Midterm 2'] || row['G2'] || row['g2'] || 20),
        }));

        if (students.length === 0) {
          setError("No valid student data found in the Excel sheet.");
          setLoading(false);
          return;
        }

        // Limit batch size for demo purposes if needed, but Gemini 3 Flash can handle a decent amount
        try {
          const results = await predictBatchStudentGrades(students.slice(0, 10)); // Limit to 10 for speed in demo
          setBatchResults(results.map((res, idx) => ({ ...res, student: students[idx] })));
        } catch (err) {
          console.error("Batch Prediction Error:", err);
          const errorMessage = err instanceof Error && err.message === "API_KEY_MISSING" 
            ? "API Key is missing. Please configure it in Settings (AI Studio) or your .env file (local)."
            : "Failed to generate batch predictions. Please check your connection or API key.";
          setError(errorMessage);
        }
        setLoading(false);
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      console.error(err);
      setError("Failed to process Excel file. Ensure columns match: Sex, Age, Travel Time, Study Time, Activities, Failures, Internet, Health, Absences, Go Out, Free Time, Mid1, Mid2.");
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Sex': 'M',
        'Age': 18,
        'Travel Time': 1,
        'Study Time': 2,
        'Activities': 'Yes',
        'Failures': 0,
        'Internet': 'Yes',
        'Health': 5,
        'Absences': 2,
        'Go Out': 3,
        'Free Time': 3,
        'Mid1': 18,
        'Mid2': 20
      },
      {
        'Sex': 'F',
        'Age': 17,
        'Travel Time': 2,
        'Study Time': 4,
        'Activities': 'No',
        'Failures': 0,
        'Internet': 'Yes',
        'Health': 3,
        'Absences': 0,
        'Go Out': 2,
        'Free Time': 2,
        'Mid1': 22,
        'Mid2': 24
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "EduExplain_Template.xlsx");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center p-4 bg-blue-600 rounded-2xl shadow-xl shadow-blue-200 mb-6">
              <GraduationCap className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">EduExplain</h1>
            <p className="text-slate-500 font-medium">Predicting Success with Explainable AI</p>
          </div>

          <AnimatePresence mode="wait">
            {!loginMode ? (
              <motion.div 
                key="portal-selection"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                {/* Student Portal Card */}
                <motion.div 
                  className="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-sm transition-all hover:border-green-100 hover:shadow-xl hover:shadow-green-50"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <UserIcon className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Student Portal</h2>
                      <p className="text-xs text-slate-500">Access your personal roadmap</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => handlePortalEntry('student')}
                    className="w-full bg-slate-50 hover:bg-green-600 text-slate-600 hover:text-white font-bold py-4 rounded-2xl border-2 border-transparent transition-all flex items-center justify-center gap-2 group"
                  >
                    Enter Student Portal
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </motion.div>

                {/* Faculty Portal Card */}
                <motion.div 
                  className="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-sm transition-all hover:border-blue-100 hover:shadow-xl hover:shadow-blue-50"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <ShieldCheck className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Faculty Portal</h2>
                      <p className="text-xs text-slate-500">Manage batch predictions</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => handlePortalEntry('faculty')}
                    className="w-full bg-slate-50 hover:bg-blue-600 text-slate-600 hover:text-white font-bold py-4 rounded-2xl border-2 border-transparent transition-all flex items-center justify-center gap-2 group"
                  >
                    Enter Faculty Portal
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="login-form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-md mx-auto w-full bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-xl"
              >
                <button 
                  onClick={() => setLoginMode(null)}
                  className="flex items-center gap-2 text-slate-400 hover:text-slate-600 mb-6 font-bold text-sm transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to selection
                </button>

                <div className="mb-8">
                  <h2 className="text-3xl font-black text-slate-900 mb-2">
                    {loginMode === 'student' ? 'Student Login' : 'Faculty Login'}
                  </h2>
                  <p className="text-slate-500 font-medium">Enter your credentials to continue</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@university.edu"
                        className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input 
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-12 pr-6 py-4 rounded-2xl border-2 border-slate-50 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                        required
                      />
                    </div>
                  </div>

                  {loginError && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold border border-red-100"
                    >
                      {loginError}
                    </motion.div>
                  )}

                  <button 
                    type="submit"
                    className={`w-full py-5 rounded-2xl text-white font-black text-lg transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 ${
                      loginMode === 'student' ? 'bg-green-600 shadow-green-100 hover:bg-green-700' : 'bg-blue-600 shadow-blue-100 hover:bg-blue-700'
                    }`}
                  >
                    Login to Portal
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">EduExplain</h1>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900">{user.displayName}</p>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{user.role}</p>
              </div>
              <button 
                onClick={() => setActiveModal('logout')}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {user.role === 'student' ? (
          <div className="space-y-8">
            {/* Student Hero */}
            <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl shadow-blue-200">
              <div className="relative z-10 max-w-2xl">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
                    Welcome, <br />
                    <span className="text-blue-200">{user.displayName}</span>
                  </h2>
                </motion.div>
              </div>
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
                <GraduationCap className="w-96 h-96 -mr-20 -mt-20 transform rotate-12" />
              </div>
            </section>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { id: 'profile', label: 'My Profile', icon: UserIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
                { id: 'syllabus', label: 'Syllabus', icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { id: 'progress', label: 'Progress', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { id: 'chatbot', label: 'EduBot', icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'syllabus') {
                      window.open('https://www.griet.ac.in/syllabus.php', '_blank');
                    } else {
                      setActiveModal(item.id as any);
                    }
                  }}
                  className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group"
                >
                  <div className={`w-12 h-12 ${item.bg} ${item.color} rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: 'Current GPA', value: '9.2 / 10.0', icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Attendance', value: '94%', icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
              ].map((stat, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center mb-4`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-slate-900">Academic Progress</h3>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { semester: 'Sem 1', grade: 7.8 },
                        { semester: 'Sem 2', grade: 8.2 },
                        { semester: 'Sem 3', grade: 8.5 },
                        { semester: 'Sem 4', grade: 8.1 },
                        { semester: 'Sem 5', grade: 8.8 },
                        { semester: 'Sem 6', grade: 9.2 },
                        { semester: 'Sem 7', grade: null },
                        { semester: 'Sem 8', grade: null },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="semester" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="grade" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>

              <div className="space-y-8">
                <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-900">Upcoming Tasks</h3>
                    <button 
                      onClick={() => setIsAddingTask(!isAddingTask)}
                      className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  <AnimatePresence>
                    {isAddingTask && (
                      <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleAddTask}
                        className="mb-6 space-y-3 overflow-hidden"
                      >
                        <input
                          type="text"
                          placeholder="Task title..."
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          value={newTask.title}
                          onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                          required
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Due date (e.g. Tomorrow)"
                            className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={newTask.date}
                            onChange={(e) => setNewTask({ ...newTask, date: e.target.value })}
                            required
                          />
                          <select
                            className="px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                            value={newTask.type}
                            onChange={(e) => setNewTask({ ...newTask, type: e.target.value })}
                          >
                            <option value="Assignment">Assignment</option>
                            <option value="Exam">Exam</option>
                            <option value="Project">Project</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
                          Add Task
                        </button>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  <div className="space-y-4">
                    {upcomingTasks.map((task, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${task.color.split(' ')[0]}`}></div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{task.title}</p>
                            <p className="text-xs text-slate-500">{task.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${task.color}`}>
                            {task.type}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveTask(idx);
                            }}
                            className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {upcomingTasks.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-8">No upcoming tasks. Add one!</p>
                  )}
                </section>

                <section className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl shadow-slate-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-600 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold">AI Tip of the Day</h3>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6">
                    "Students who study in 45-minute blocks with 10-minute breaks show 23% higher retention rates in complex subjects like Physics."
                  </p>
                  <button className="text-blue-400 text-sm font-bold hover:text-blue-300 transition-colors flex items-center gap-2">
                    Learn More <ChevronRight className="w-4 h-4" />
                  </button>
                </section>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Faculty Hero */}
            <section className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
              <div className="relative z-10 max-w-2xl">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
                    Welcome, <br />
                    <span className="text-indigo-200">Prof. {user.displayName}</span>
                  </h2>
                </motion.div>
              </div>
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
                <Users className="w-96 h-96 -mr-20 -mt-20 transform rotate-12" />
              </div>
            </section>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { id: 'profile', label: 'Faculty Profile', icon: UserIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
                { id: 'syllabus', label: 'Syllabus', icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { id: 'progress', label: 'Question Crafter', icon: CheckSquare, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { id: 'predictor', label: 'Success Predictor', icon: ShieldCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'syllabus') {
                      window.open('https://www.griet.ac.in/syllabus.php', '_blank');
                    } else {
                      setActiveModal(item.id as any);
                    }
                  }}
                  className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group"
                >
                  <div className={`w-12 h-12 ${item.bg} ${item.color} rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-slate-900">Batch Performance</h3>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { batch: 'Section A', grade: 8.2 },
                        { batch: 'Section B', grade: 7.9 },
                        { batch: 'Section C', grade: 8.5 },
                        { batch: 'Section D', grade: 8.1 },
                        { batch: 'Section E', grade: 8.8 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="batch" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="grade" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>

              <div className="space-y-8">
                <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-900">Today's Classes</h3>
                    <button 
                      onClick={() => setIsAddingClass(!isAddingClass)}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  <AnimatePresence>
                    {isAddingClass && (
                      <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleAddClass}
                        className="mb-6 space-y-3 overflow-hidden"
                      >
                        <input
                          type="text"
                          placeholder="Subject Name"
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                          value={newClass.subject}
                          onChange={(e) => setNewClass({ ...newClass, subject: e.target.value })}
                          required
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Time (e.g. 09:00 AM)"
                            className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            value={newClass.time}
                            onChange={(e) => setNewClass({ ...newClass, time: e.target.value })}
                            required
                          />
                          <input
                            type="text"
                            placeholder="Section (e.g. CSE-A)"
                            className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            value={newClass.section}
                            onChange={(e) => setNewClass({ ...newClass, section: e.target.value })}
                            required
                          />
                        </div>
                        <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">
                          Add Class
                        </button>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  <div className="space-y-4">
                    {facultyClasses.map((cls, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${cls.color.split(' ')[0]}`}></div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{cls.subject}</p>
                            <p className="text-xs text-slate-500">{cls.time}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${cls.color}`}>
                            {cls.section}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveClass(idx);
                            }}
                            className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {facultyClasses.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-8">No classes scheduled for today.</p>
                  )}
                </section>

                <section className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl shadow-slate-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-600 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold">Faculty AI Insight</h3>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6">
                    "Predictive models show that students with consistent attendance above 85% in the first 4 weeks are 40% more likely to achieve an 'A' grade."
                  </p>
                  <button className="text-indigo-400 text-sm font-bold hover:text-indigo-300 transition-colors flex items-center gap-2">
                    View Analytics <ChevronRight className="w-4 h-4" />
                  </button>
                </section>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setActiveModal(user.role === 'student' ? 'chatbot' : 'predictor')}
        className={`fixed bottom-8 right-8 p-4 rounded-full shadow-2xl z-[55] text-white transition-all ${
          user.role === 'student' ? 'bg-blue-600 shadow-blue-200' : 'bg-indigo-600 shadow-indigo-200'
        }`}
      >
        {user.role === 'student' ? (
          <Activity className="w-6 h-6" />
        ) : (
          <ShieldCheck className="w-6 h-6" />
        )}
      </motion.button>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <GraduationCap className="w-5 h-5" />
            <span className="text-sm font-bold">EduExplain</span>
          </div>
          <p className="text-sm text-slate-500">
            Based on research: "Explainable AI Methods for Predicting Student Grades and Improving Academic Success"
          </p>
          <div className="flex gap-6 text-sm font-medium text-slate-400">
            <a href="#" className="hover:text-slate-900">Privacy</a>
            <a href="#" className="hover:text-slate-900">Terms</a>
            <a href="#" className="hover:text-slate-900">Contact</a>
          </div>
        </div>
      </footer>

      {/* Modal Component */}
      <AnimatePresence>
        {activeModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[80]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 flex items-center justify-center z-[90] p-4 pointer-events-none"
            >
              <div className={`bg-white w-full ${activeModal === 'predictor' ? 'max-w-4xl' : 'max-w-2xl'} max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col pointer-events-auto border border-slate-100`}>
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                      {activeModal === 'profile' && <UserIcon className="w-6 h-6 text-white" />}
                      {activeModal === 'progress' && <TrendingUp className="w-6 h-6 text-white" />}
                      {activeModal === 'chatbot' && <Activity className="w-6 h-6 text-white" />}
                      {activeModal === 'predictor' && <ShieldCheck className="w-6 h-6 text-white" />}
                      {activeModal === 'logout' && <LogOut className="w-6 h-6 text-white" />}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 capitalize">
                        {activeModal === 'chatbot' ? 'EduBot Assistant' : 
                         activeModal === 'predictor' ? 'Success Predictor' : 
                         activeModal === 'progress' && user.role === 'faculty' ? 'Question Crafter' :
                         activeModal}
                      </h2>
                      <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">
                        {activeModal === 'profile' && 'Your Personal Information'}
                        {activeModal === 'progress' && (user.role === 'student' ? 'Learning Milestone Tracker' : 'AI Assessment Generator')}
                        {activeModal === 'chatbot' && 'AI Academic Advisor'}
                        {activeModal === 'predictor' && 'AI-Powered Grade Prediction'}
                        {activeModal === 'logout' && 'Confirm Session End'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveModal(null)}
                    className="p-3 hover:bg-slate-200 rounded-2xl transition-all hover:rotate-90"
                  >
                    <X className="w-6 h-6 text-slate-500" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                  {activeModal === 'profile' && (
                    <div className="space-y-8">
                      <div className="flex flex-col items-center text-center space-y-4">
                        <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-black text-5xl shadow-2xl shadow-blue-200 border-4 border-white">
                          {user.displayName?.[0]}
                        </div>
                        <div>
                          <h3 className="text-3xl font-black text-slate-900">{user.displayName}</h3>
                          <p className="text-slate-500 font-medium">{user.email}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Role</p>
                          <p className="text-lg font-bold text-slate-900 capitalize">{user.role}</p>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                            {user.role === 'student' ? 'Roll Number' : 'Faculty ID'}
                          </p>
                          <p className="text-lg font-bold text-blue-600">
                            {user.role === 'student' ? user.rollNumber : user.facultyId}
                          </p>
                        </div>
                      </div>

                      <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                        <div className="flex items-center gap-3 mb-2">
                          <ShieldCheck className="w-5 h-5 text-blue-600" />
                          <h4 className="font-bold text-blue-900">Account Status</h4>
                        </div>
                        <p className="text-sm text-blue-700">Your account is verified and secured with EduExplain AI protocols.</p>
                      </div>
                    </div>
                  )}

                  {activeModal === 'progress' && (
                    <div className="space-y-8">
                      {user.role === 'student' ? (
                        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                          <div className="flex items-center justify-between mb-6">
                            <div>
                              <h3 className="text-2xl font-black text-slate-900">Learning Journey</h3>
                              <p className="text-sm text-slate-500 font-medium">Keep track of your academic milestones</p>
                            </div>
                            <div className="text-right">
                              <p className="text-3xl font-black text-blue-600">
                                {checklist.length > 0 ? Math.round((checklist.filter(i => i.completed).length / checklist.length) * 100) : 0}%
                              </p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed</p>
                            </div>
                          </div>
                          
                          <div className="h-4 bg-slate-100 rounded-full overflow-hidden mb-8 shadow-inner">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${checklist.length > 0 ? (checklist.filter(i => i.completed).length / checklist.length) * 100 : 0}%` }}
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg"
                            />
                          </div>

                          <form onSubmit={addTopic} className="flex gap-3 mb-8">
                            <input 
                              type="text"
                              value={newTopic}
                              onChange={(e) => setNewTopic(e.target.value)}
                              placeholder="What are you studying next?"
                              className="flex-1 px-6 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-base font-medium"
                            />
                            <button 
                              type="submit"
                              className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-2xl shadow-xl shadow-blue-200 transition-all active:scale-95"
                            >
                              <Plus className="w-6 h-6" />
                            </button>
                          </form>

                          <div className="space-y-4">
                            {checklist.map((item) => (
                              <motion.div 
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                key={item.id}
                                className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all group ${
                                  item.completed 
                                    ? 'bg-green-50/50 border-green-100' 
                                    : 'bg-white border-slate-50 hover:border-blue-100 hover:shadow-lg hover:shadow-slate-100'
                                }`}
                              >
                                <button 
                                  onClick={() => toggleTopic(item.id)}
                                  className={`shrink-0 transition-all transform active:scale-125 ${item.completed ? 'text-green-600' : 'text-slate-200 hover:text-blue-500'}`}
                                >
                                  {item.completed ? <CheckSquare className="w-8 h-8" /> : <Square className="w-8 h-8" />}
                                </button>
                                <span className={`flex-1 text-base font-bold transition-all ${
                                  item.completed ? 'text-green-700/50 line-through' : 'text-slate-700'
                                }`}>
                                  {item.text}
                                </span>
                                <button 
                                  onClick={() => removeTopic(item.id)}
                                  className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </motion.div>
                            ))}
                            {checklist.length === 0 && (
                              <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-100">
                                <CheckSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-400 font-bold">Your checklist is empty</p>
                                <p className="text-xs text-slate-300 mt-1">Add topics to start tracking your progress</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col h-full max-h-[600px]">
                          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 rounded-2xl mb-4 border border-slate-100">
                            {facultyChatMessages.map((msg, idx) => (
                              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                                  msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                                    : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                                }`}>
                                  <div className="text-sm font-medium leading-relaxed prose prose-slate max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.parts[0].text}</ReactMarkdown>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {chatLoading && (
                              <div className="flex justify-start">
                                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
                                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                                </div>
                              </div>
                            )}
                            <div ref={facultyChatEndRef} />
                          </div>
                          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm mb-4">
                            <div className="grid grid-cols-3 gap-4 mb-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Subject/Topic</label>
                                <input 
                                  type="text"
                                  value={crafterTopic}
                                  onChange={(e) => setCrafterTopic(e.target.value)}
                                  placeholder="e.g. Calculus"
                                  className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 focus:border-indigo-500 outline-none transition-all text-sm font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">No. of Qs</label>
                                <input 
                                  type="number"
                                  value={crafterCount}
                                  onChange={(e) => setCrafterCount(e.target.value)}
                                  placeholder="e.g. 10"
                                  className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 focus:border-indigo-500 outline-none transition-all text-sm font-bold"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Type</label>
                                <select 
                                  value={crafterType}
                                  onChange={(e) => setCrafterType(e.target.value)}
                                  className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 focus:border-indigo-500 outline-none transition-all text-sm font-bold appearance-none bg-white"
                                >
                                  <option value="MCQ">MCQ</option>
                                  <option value="Theory">Theory</option>
                                  <option value="True/False">True/False</option>
                                  <option value="Short Answer">Short Answer</option>
                                  <option value="Mixed">Mixed</option>
                                </select>
                              </div>
                            </div>
                            <form onSubmit={(e) => handleSendMessage(e, true)} className="flex gap-2">
                              <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Additional instructions (optional)..."
                                className="flex-1 px-6 py-4 rounded-2xl border-2 border-slate-50 focus:border-indigo-500 outline-none transition-all font-medium"
                              />
                              <button
                                type="submit"
                                disabled={chatLoading || (!chatInput.trim() && (!crafterTopic.trim() || !crafterCount.trim() || !crafterType.trim()))}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 rounded-2xl shadow-xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
                              >
                                <ChevronRight className="w-6 h-6" />
                              </button>
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeModal === 'chatbot' && (
                    <div className="flex flex-col h-full max-h-[600px]">
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 rounded-2xl mb-4 border border-slate-100">
                        {chatMessages.map((msg, idx) => (
                          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                              msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-tr-none' 
                                : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                            }`}>
                              <div className="text-sm font-medium leading-relaxed prose prose-slate max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.parts[0].text}</ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        ))}
                        {chatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
                              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                      <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask me anything about your studies..."
                          className="flex-1 px-6 py-4 rounded-2xl border-2 border-slate-100 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium"
                        />
                        <button
                          type="submit"
                          disabled={chatLoading || !chatInput.trim()}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-2xl shadow-xl shadow-blue-200 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </button>
                      </form>
                    </div>
                  )}

                  {activeModal === 'predictor' && (
                    <div className="flex flex-col gap-8">
                      {/* Top Section: Input */}
                      <div className="space-y-6">
                        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl max-w-md mx-auto">
                          <button 
                            onClick={() => setMode('single')}
                            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'single' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            Single Student
                          </button>
                          <button 
                            onClick={() => setMode('batch')}
                            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'batch' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            Batch Upload
                          </button>
                        </div>

                        {mode === 'single' ? (
                          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                              <h2 className="text-lg font-semibold flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-blue-600" />
                                Student Profile
                              </h2>
                            </div>
                            <form onSubmit={handlePredict} className="p-6 space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Sex</label>
                                  <select 
                                    value={studentData.sex}
                                    onChange={(e) => setStudentData({...studentData, sex: e.target.value as 'M' | 'F'})}
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                  >
                                    <option value="M">Male</option>
                                    <option value="F">Female</option>
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Age</label>
                                  <input 
                                    type="number" 
                                    min="15" max="22"
                                    value={studentData.age}
                                    onChange={(e) => setStudentData({...studentData, age: Number(e.target.value)})}
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Study Time (1-4)</label>
                                  <input 
                                    type="number" 
                                    min="1" max="4"
                                    value={studentData.studytime}
                                    onChange={(e) => setStudentData({...studentData, studytime: Number(e.target.value)})}
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Travel Time (1-4)</label>
                                  <input 
                                    type="number" 
                                    min="1" max="4"
                                    value={studentData.traveltime}
                                    onChange={(e) => setStudentData({...studentData, traveltime: Number(e.target.value)})}
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Failures</label>
                                  <input 
                                    type="number" 
                                    min="0"
                                    value={studentData.failures}
                                    onChange={(e) => setStudentData({...studentData, failures: Number(e.target.value)})}
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Health (1-5)</label>
                                  <input 
                                    type="number" 
                                    min="1" max="5"
                                    value={studentData.health}
                                    onChange={(e) => setStudentData({...studentData, health: Number(e.target.value)})}
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Absences</label>
                                  <input 
                                    type="number" 
                                    min="0" max="93"
                                    value={studentData.absences}
                                    onChange={(e) => setStudentData({...studentData, absences: Number(e.target.value)})}
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Go Out (1-5)</label>
                                  <input 
                                    type="number" 
                                    min="1" max="5"
                                    value={studentData.goout}
                                    onChange={(e) => setStudentData({...studentData, goout: Number(e.target.value)})}
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Free Time (1-5)</label>
                                  <input 
                                    type="number" 
                                    min="1" max="5"
                                    value={studentData.freetime}
                                    onChange={(e) => setStudentData({...studentData, freetime: Number(e.target.value)})}
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mid1 (0-30)</label>
                                  <input 
                                    type="number" 
                                    min="0" max="30"
                                    value={studentData.Mid1}
                                    onChange={(e) => setStudentData({...studentData, Mid1: Number(e.target.value)})}
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mid2 (0-30)</label>
                                  <input 
                                    type="number" 
                                    min="0" max="30"
                                    value={studentData.Mid2}
                                    onChange={(e) => setStudentData({...studentData, Mid2: Number(e.target.value)})}
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-50 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                  />
                                </div>
                                <div className="flex flex-col gap-4 pt-4">
                                  <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative">
                                      <input 
                                        type="checkbox"
                                        checked={studentData.activities}
                                        onChange={(e) => setStudentData({...studentData, activities: e.target.checked})}
                                        className="peer sr-only"
                                      />
                                      <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                                    </div>
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">Activities</span>
                                  </label>
                                  <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative">
                                      <input 
                                        type="checkbox"
                                        checked={studentData.internet}
                                        onChange={(e) => setStudentData({...studentData, internet: e.target.checked})}
                                        className="peer sr-only"
                                      />
                                      <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                                    </div>
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-600 transition-colors">Internet</span>
                                  </label>
                                </div>
                              </div>

                              <button 
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-lg py-5 rounded-[2rem] shadow-xl shadow-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group active:scale-95"
                              >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                                  <>
                                    Predict Success
                                    <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                                  </>
                                )}
                              </button>
                            </form>
                          </section>
                        ) : (
                          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                              <h2 className="text-lg font-semibold flex items-center gap-2">
                                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                                Batch Upload
                              </h2>
                            </div>
                            <div className="p-6 space-y-6">
                              <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-all group"
                              >
                                <Upload className="w-6 h-6 text-blue-600 mb-2" />
                                <p className="text-sm font-semibold text-slate-900">Upload Excel</p>
                                <input 
                                  type="file" 
                                  ref={fileInputRef}
                                  onChange={handleFileUpload}
                                  accept=".xlsx, .xls"
                                  className="hidden"
                                />
                              </div>
                              <button 
                                onClick={downloadTemplate}
                                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                              >
                                <Download className="w-3 h-3" />
                                Download Template
                              </button>
                            </div>
                          </section>
                        )}
                      </div>

                      {/* Bottom Section: Results */}
                      <div className="w-full space-y-6">
                        <div className="flex items-center gap-3 px-2">
                          <div className="h-px flex-1 bg-slate-100" />
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Analysis Results</h3>
                          <div className="h-px flex-1 bg-slate-100" />
                        </div>
                        <AnimatePresence mode="wait">
                          {!prediction && batchResults.length === 0 && !loading ? (
                            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                              <BarChart3 className="w-10 h-10 text-slate-300 mb-4" />
                              <p className="text-slate-500 text-sm">Ready for Analysis</p>
                            </div>
                          ) : loading ? (
                            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border border-slate-200">
                              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                              <p className="text-slate-900 font-bold">Analyzing Data...</p>
                            </div>
                          ) : prediction ? (
                            <div className="space-y-6">
                              <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-xl shadow-blue-100">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="text-sm font-medium opacity-80 mb-1">Predicted Grade</p>
                                    <p className="text-4xl font-black">{prediction.predictedGrade.toFixed(2)}/10.00</p>
                                  </div>
                                  <div className="text-right">
                                    <div className="bg-white/20 px-4 py-2 rounded-2xl backdrop-blur-sm">
                                      <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-1">Class</p>
                                      <p className="text-2xl font-black">{prediction.gradeClass}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="bg-white p-6 rounded-3xl border border-slate-200">
                                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                  <Info className="w-4 h-4 text-blue-600" />
                                  SHAP Reasoning
                                </h4>
                                <div className="text-sm text-slate-600 leading-relaxed prose prose-slate max-w-none">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{prediction.explanation}</ReactMarkdown>
                                </div>
                              </div>

                              {prediction.featureImportance && prediction.featureImportance.length > 0 && (
                                <div className="bg-white p-6 rounded-3xl border border-slate-200">
                                  <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                                    Key Factors
                                  </h4>
                                  <div className="space-y-3">
                                    {prediction.featureImportance.map((feat, idx) => (
                                      <div key={idx} className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold">
                                          <span className="text-slate-600 capitalize">{feat.feature}</span>
                                          <span className={feat.importance > 0 ? 'text-green-600' : 'text-red-600'}>
                                            {feat.importance > 0 ? '+' : ''}{Math.round(feat.importance * 100)}%
                                          </span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                          <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.abs(feat.importance) * 100}%` }}
                                            className={`h-full rounded-full ${feat.importance > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {prediction.recommendations && prediction.recommendations.length > 0 && (
                                <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                                  <h4 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                    AI Recommendations
                                  </h4>
                                  <ul className="space-y-2">
                                    {prediction.recommendations.map((rec, idx) => (
                                      <li key={idx} className="flex gap-2 text-sm text-indigo-700">
                                        <span className="font-bold text-indigo-400">•</span>
                                        {rec}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ) : batchResults.length > 0 && (
                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                              <div className="max-h-[400px] overflow-y-auto">
                                <table className="w-full text-left">
                                  <thead className="bg-slate-50 sticky top-0">
                                    <tr>
                                      <th className="p-4 text-xs font-bold text-slate-400 uppercase">Student</th>
                                      <th className="p-4 text-xs font-bold text-slate-400 uppercase">Grade</th>
                                      <th className="p-4 text-xs font-bold text-slate-400 uppercase">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {batchResults.map((res, idx) => (
                                      <tr key={idx}>
                                        <td className="p-4 text-sm font-semibold text-slate-900">Student #{idx + 1}</td>
                                        <td className="p-4 text-sm font-bold text-blue-600">{res.predictedGrade.toFixed(2)}/10.00 ({res.gradeClass})</td>
                                        <td className="p-4">
                                          <button onClick={() => setPrediction(res)} className="text-xs font-bold text-blue-600 hover:underline">Details</button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}

                  {activeModal === 'logout' && (
                    <div className="text-center space-y-8 py-8">
                      <div className="w-24 h-24 bg-red-50 rounded-[2rem] flex items-center justify-center mx-auto shadow-lg shadow-red-50">
                        <LogOut className="w-12 h-12 text-red-600" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-3xl font-black text-slate-900">Sign Out?</h3>
                        <p className="text-slate-500 font-medium">Are you sure you want to end your current session?</p>
                      </div>
                      <div className="flex flex-col gap-3">
                        <button 
                          onClick={handleLogout}
                          className="w-full py-5 rounded-2xl bg-red-600 text-white font-black text-lg hover:bg-red-700 transition-all shadow-xl shadow-red-100 active:scale-95"
                        >
                          Yes, Logout
                        </button>
                        <button 
                          onClick={() => setActiveModal(null)}
                          className="w-full py-4 rounded-2xl bg-white border-2 border-slate-100 text-slate-500 font-bold hover:bg-slate-50 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
