
import React, { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react';
import { Routes, Route, useNavigate, Link, useLocation, useParams } from 'react-router-dom';
import { GoogleGenAI, Type } from "@google/genai";
import { User, Material, Post, Role, Comment, Report, AISettings, QuizQuestion, QuizSession, DailyTarget } from './types';
import { INITIAL_MATERIALS, ADMIN_PASSCODE, LEGAL_PAGES, CATEGORIES, SYLLABUS } from './constants';

// --- Context & State Management ---
interface AppContextType {
  currentUser: User | null;
  login: (email: string, password?: string) => User | null;
  signup: (userData: { name: string; email: string; password: string }) => User | null;
  logout: () => void;
  promoteToAdmin: (pass: string) => boolean;
  materials: Material[];
  addMaterial: (m: Omit<Material, 'id' | 'downloads' | 'uploadDate' | 'ratings' | 'comments' | 'reports'>) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  deleteMaterial: (id: string) => void;
  incrementDownload: (id: string, title: string) => void;
  addCommentToMaterial: (materialId: string, content: string) => void;
  pinMaterialComment: (materialId: string, commentId: string) => void;
  rateMaterial: (materialId: string, score: number) => void;
  deleteMaterialComment: (materialId: string, commentId: string) => void;
  deleteMaterialRating: (materialId: string, userId: string) => void;
  reportMaterial: (materialId: string) => void;
  reportMaterialComment: (materialId: string, commentId: string) => void;
  posts: Post[];
  addPost: (content: string) => void;
  editPost: (id: string, content: string) => void;
  deletePost: (id: string) => void;
  pinPost: (id: string) => void;
  addComment: (postId: string, content: string) => void;
  deleteComment: (postId: string, commentId: string) => void;
  addReply: (postId: string, commentId: string, content: string) => void;
  toggleLikePost: (postId: string) => void;
  toggleLikeComment: (postId: string, commentId: string, replyId?: string) => void;
  pinComment: (postId: string, commentId: string) => void;
  users: User[];
  warnUser: (id: string) => void;
  muteUser: (id: string) => void;
  banUser: (id: string) => void;
  unbanUser: (id: string) => void;
  updateUser: (updates: Partial<User>) => void;
  reports: Report[];
  reportContent: (targetId: string, targetType: Report['targetType'], reason: string) => void;
  deleteReport: (id: string) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isAIChatOpen: boolean;
  setAIChatOpen: (open: boolean) => void;
  generateQuiz: (topic: string, difficulty: string, count: number, context?: string) => Promise<QuizQuestion[]>;
}

const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAIChatOpen, setAIChatOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>((() => localStorage.getItem('ranker_theme') === 'dark'));

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  const [materials, setMaterials] = useState<Material[]>(() => {
    const saved = localStorage.getItem('ranker_materials');
    if (!saved) return INITIAL_MATERIALS;
    try { return JSON.parse(saved); } catch { return INITIAL_MATERIALS; }
  });

  const [posts, setPosts] = useState<Post[]>(() => {
    const saved = localStorage.getItem('ranker_posts');
    try { return saved ? JSON.parse(saved) : []; } catch { return []; }
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('ranker_users');
    if (!saved) return [
      { id: 'admin-1', name: 'Super Admin', email: 'admin@ranker.com', password: 'admin', role: 'admin', warnings: 0, isBanned: false, isMuted: false, downloadHistory: [] }
    ];
    try { return JSON.parse(saved); } catch { return []; }
  });

  const [reports, setReports] = useState<Report[]>(() => {
    const saved = localStorage.getItem('ranker_reports');
    try { return saved ? JSON.parse(saved) : []; } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('ranker_materials', JSON.stringify(materials));
    localStorage.setItem('ranker_posts', JSON.stringify(posts));
    localStorage.setItem('ranker_users', JSON.stringify(users));
    localStorage.setItem('ranker_reports', JSON.stringify(reports));
  }, [materials, posts, users, reports]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('ranker_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const saved = localStorage.getItem('ranker_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const u = users.find(x => x.id === parsed.id);
        if (u) setCurrentUser({ ...u });
      } catch { setCurrentUser(null); }
    }
  }, [users]);

  const login = (email: string, password?: string): User | null => {
    const user = users.find(u => u.email === email);
    if (!user) {
      if (!password && email.includes('@guest.com')) {
        const newUser: User = { 
          id: Math.random().toString(36).substr(2, 9), 
          name: email.split('@')[0], 
          email, role: 'student', warnings: 0, isBanned: false, isMuted: false, downloadHistory: [],
          dailyTargets: [],
          performanceStats: { weeklyHours: [2, 4, 3, 5, 2, 6, 4], streak: 1, accuracyTrend: [70, 75, 80], chapterProficiency: {} }
        };
        setUsers(prev => [...prev, newUser]);
        setCurrentUser(newUser);
        localStorage.setItem('ranker_user', JSON.stringify(newUser));
        return newUser;
      }
      alert("Account not found."); return null;
    }
    if (password && user.password !== password) { alert("Invalid password."); return null; }
    if (user.isBanned) { alert("Your account has been banned due to repeated violations."); return null; }
    setCurrentUser(user);
    localStorage.setItem('ranker_user', JSON.stringify(user));
    return user;
  };

  const signup = (userData: { name: string; email: string; password: string }) => {
    const newUser: User = { 
      id: Math.random().toString(36).substr(2, 9), 
      name: userData.name, 
      email: userData.email, 
      password: userData.password, 
      role: 'student', 
      warnings: 0, 
      isBanned: false, 
      isMuted: false, 
      downloadHistory: [],
      aiSettings: { icon: '🧠', theme: 'indigo', personality: 'scholarly' },
      dailyTargets: [],
      performanceStats: { weeklyHours: [0, 0, 0, 0, 0, 0, 0], streak: 0, accuracyTrend: [], chapterProficiency: {} }
    };
    setUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);
    localStorage.setItem('ranker_user', JSON.stringify(newUser));
    return newUser;
  };

  const promoteToAdmin = (pass: string) => {
    if (pass === ADMIN_PASSCODE) {
      updateUser({ role: 'admin' });
      return true;
    }
    return false;
  };

  const logout = () => { setCurrentUser(null); localStorage.removeItem('ranker_user'); navigate('/'); };

  const addMaterial = (m: any) => {
    const newM: Material = { 
      ...m, 
      id: Date.now().toString(), 
      downloads: 0, 
      uploadDate: new Date().toISOString().split('T')[0], 
      ratings: [], 
      comments: [], 
      reports: 0 
    };
    setMaterials(prev => [newM, ...prev]);
  };

  const updateMaterial = (id: string, updates: Partial<Material>) => setMaterials(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  const deleteMaterial = (id: string) => {
    if (window.confirm("DELETE THIS MATERIAL?")) {
      setMaterials(prev => prev.filter(m => m.id !== id));
    }
  };

  const incrementDownload = (id: string, title: string) => {
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, downloads: m.downloads + 1 } : m));
    if (currentUser) {
      const history = [{ materialId: id, materialTitle: title, date: Date.now() }, ...(currentUser.downloadHistory || [])].slice(0, 50);
      updateUser({ downloadHistory: history });
    }
  };

  const addCommentToMaterial = (materialId: string, content: string) => {
    if (!currentUser) return;
    const comment: Comment = { id: Date.now().toString(), authorId: currentUser.id, authorName: currentUser.name, content, timestamp: Date.now(), reports: 0, likedBy: [], likes: 0, replies: [] };
    setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, comments: [comment, ...(m.comments || [])] } : m));
  };

  const pinMaterialComment = (materialId: string, commentId: string) => {
    setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, comments: m.comments.map(c => ({ ...c, isPinned: c.id === commentId ? !c.isPinned : c.isPinned })) } : m));
  };

  const deleteMaterialComment = (materialId: string, commentId: string) => {
    if (window.confirm("DELETE THIS COMMENT?")) {
      setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, comments: m.comments.filter(c => c.id !== commentId) } : m));
    }
  };

  const deleteMaterialRating = (materialId: string, userId: string) => {
    setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, ratings: m.ratings.filter(r => r.userId !== userId) } : m));
  };

  const reportMaterial = (id: string) => {
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, reports: (m.reports || 0) + 1 } : m));
    reportContent(id, 'material', 'Flagged as inappropriate.');
  };

  const reportMaterialComment = (materialId: string, commentId: string) => {
    setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, comments: m.comments.map(c => c.id === commentId ? { ...c, reports: c.reports + 1 } : c) } : m));
    reportContent(commentId, 'material_comment', 'Comment violation.');
  };

  const rateMaterial = (materialId: string, score: number) => {
    if (!currentUser) return;
    setMaterials(prev => prev.map(m => {
      if (m.id !== materialId) return m;
      const ratings = [...(m.ratings || [])].filter(r => r.userId !== currentUser.id);
      ratings.push({ userId: currentUser.id, score });
      return { ...m, ratings };
    }));
  };

  const addPost = (content: string) => {
    if (!currentUser) return;
    const post: Post = { id: Date.now().toString(), authorId: currentUser.id, authorName: currentUser.name, content, timestamp: Date.now(), likedBy: [], likes: 0, reports: 0, comments: [] };
    setPosts(prev => [post, ...prev]);
  };

  const editPost = (id: string, content: string) => setPosts(prev => prev.map(p => p.id === id ? { ...p, content, isEdited: true } : p));
  
  const deletePost = (id: string) => {
    if (window.confirm("DELETE THIS POST PERMANENTLY?")) {
      setPosts(prev => prev.filter(p => p.id !== id));
      alert("Post removed.");
    }
  };

  const pinPost = (id: string) => setPosts(prev => prev.map(p => p.id === id ? { ...p, isPinned: !p.isPinned } : p));

  const addComment = (postId: string, content: string) => {
    if (!currentUser) return;
    const comment: Comment = { id: Date.now().toString(), authorId: currentUser.id, authorName: currentUser.name, content, timestamp: Date.now(), reports: 0, likedBy: [], likes: 0, replies: [] };
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: [comment, ...(p.comments || [])] } : p));
  };

  const deleteComment = (postId: string, commentId: string) => {
    if (window.confirm("DELETE THIS COMMENT?")) {
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        return {
          ...p,
          comments: p.comments.filter(c => c.id !== commentId).map(c => ({
            ...c,
            replies: c.replies.filter(r => r.id !== commentId)
          }))
        };
      }));
      alert("Comment removed.");
    }
  };

  const addReply = (postId: string, commentId: string, content: string) => {
    if (!currentUser) return;
    const reply: Comment = { id: Date.now().toString(), authorId: currentUser.id, authorName: currentUser.name, content, timestamp: Date.now(), reports: 0, likedBy: [], likes: 0, replies: [] };
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: p.comments.map(c => c.id === commentId ? { ...c, replies: [reply, ...(c.replies || [])] } : c) } : p));
  };

  const toggleLikePost = (postId: string) => {
    if (!currentUser) return;
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const likedBy = p.likedBy || [];
      const hasLiked = likedBy.includes(currentUser.id);
      const newLikedBy = hasLiked ? likedBy.filter(id => id !== currentUser.id) : [...likedBy, currentUser.id];
      return { ...p, likedBy: newLikedBy, likes: newLikedBy.length };
    }));
  };
  
  const toggleLikeComment = (postId: string, commentId: string, replyId?: string) => {
    if (!currentUser) return;
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        comments: p.comments.map(c => {
          if (c.id === commentId) {
            if (!replyId) {
              const likedBy = c.likedBy || [];
              const hasLiked = likedBy.includes(currentUser.id);
              const newLikedBy = hasLiked ? likedBy.filter(id => id !== currentUser.id) : [...likedBy, currentUser.id];
              return { ...c, likedBy: newLikedBy, likes: newLikedBy.length };
            }
            return {
              ...c,
              replies: c.replies.map(r => {
                if (r.id === replyId) {
                  const likedBy = r.likedBy || [];
                  const hasLiked = likedBy.includes(currentUser.id);
                  const newLikedBy = hasLiked ? likedBy.filter(id => id !== currentUser.id) : [...likedBy, currentUser.id];
                  return { ...r, likedBy: newLikedBy, likes: newLikedBy.length };
                }
                return r;
              })
            };
          }
          return c;
        })
      };
    }));
  };

  const pinComment = (postId: string, commentId: string) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: p.comments.map(c => ({ ...c, isPinned: c.id === commentId ? !c.isPinned : c.isPinned })) } : p));
  };

  const reportContent = (targetId: string, targetType: Report['targetType'], reason: string) => {
    if (!currentUser) return;
    const newReport: Report = { 
      id: "REP-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).substr(2, 4).toUpperCase(), 
      targetId, 
      targetType, 
      reporterId: currentUser.id, 
      reason: reason || "Investigation requested.", 
      timestamp: Date.now() 
    };
    setReports(prev => [newReport, ...prev]);
    alert("Report sent to Admin authority. investigation started. 🚩");
  };

  const deleteReport = (id: string) => setReports(prev => prev.filter(r => r.id !== id));
  
  const warnUser = (id: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const newWarnings = u.warnings + 1;
        const autoBan = newWarnings >= 3;
        if (autoBan) {
          alert(`CRITICAL: User ${u.name} reached 3/3 warnings and has been AUTOMATICALLY BANNED.`);
        } else {
          alert(`Warning issued to ${u.name} (${newWarnings}/3).`);
        }
        return { ...u, warnings: newWarnings, isBanned: u.isBanned || autoBan };
      }
      return u;
    }));
  };

  const muteUser = (id: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const newMute = !u.isMuted;
        alert(`${u.name} node transmission: ${newMute ? 'MUTED' : 'UNMUTED'}.`);
        return { ...u, isMuted: newMute };
      }
      return u;
    }));
  };

  const banUser = (id: string) => {
    if (window.confirm("BAN THIS USER PERMANENTLY?")) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, isBanned: true } : u));
      alert("User banned.");
    }
  };

  const unbanUser = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, isBanned: false, warnings: 0 } : u));
    alert("User reinstated.");
  };

  const updateUser = (updates: Partial<User>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...updates };
    setCurrentUser(updated);
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    localStorage.setItem('ranker_user', JSON.stringify(updated));
  };

  const generateQuiz = async (topic: string, difficulty: string, count: number, context?: string): Promise<QuizQuestion[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Create a professional educational quiz of ${count} questions.
        Topic: "${topic}"
        Standard: JEE/NEET competitive exams (India).
        Difficulty: ${difficulty}.
        Additional Context: ${context || 'General scholarly material'}.
        Ensure questions are conceptually deep and include metadata for analysis (subject and chapter).`,
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING },
                  minItems: 4,
                  maxItems: 4
                },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
                subject: { type: Type.STRING },
                chapter: { type: Type.STRING }
              },
              required: ["question", "options", "correctIndex", "explanation", "subject", "chapter"],
            }
          }
        }
      });
      
      const jsonStr = response.text;
      if (!jsonStr) throw new Error("Empty response");
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error("AI Node generation failure:", error);
      throw error;
    }
  };

  return (
    <AppContext.Provider value={{ 
      currentUser, login, signup, logout, promoteToAdmin, materials, addMaterial, updateMaterial, deleteMaterial, incrementDownload,
      addCommentToMaterial, pinMaterialComment, rateMaterial, deleteMaterialComment, deleteMaterialRating, reportMaterial, reportMaterialComment,
      posts, addPost, editPost, deletePost, pinPost, addComment, deleteComment, addReply, toggleLikePost, toggleLikeComment, pinComment,
      users, warnUser, muteUser, banUser, unbanUser, updateUser,
      reports, reportContent, deleteReport, isDarkMode, toggleDarkMode,
      isAIChatOpen, setAIChatOpen, generateQuiz
    }}>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300 font-inter">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage type="login" />} />
            <Route path="/signup" element={<AuthPage type="signup" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/library" element={<Library />} />
            <Route path="/community" element={<Community />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/ai-test" element={<AITestSection />} />
            <Route path="/legal/:page" element={<LegalPage />} />
          </Routes>
        </main>
        <AIChatbot />
        <Footer />
      </div>
    </AppContext.Provider>
  );
};

export default App;

// --- Sub-Components ---

const Navbar: React.FC = () => {
  const { currentUser, logout, isDarkMode, toggleDarkMode } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-[100] bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        <Link to="/" className="text-xl md:text-2xl font-black uppercase tracking-tighter text-slate-900 dark:text-white flex items-center gap-2 group">
          <span className="bg-indigo-600 text-white p-2 rounded-xl group-hover:scale-110 transition-transform">R</span>
          <span className="hidden sm:inline"><span className="text-indigo-600">RANKER</span> SCHOLAR</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {currentUser && (
            <>
              <Link to="/library" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600">Library</Link>
              <Link to="/ai-test" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-3 py-1 rounded-lg">AI Tests</Link>
              <Link to="/community" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600">Forum</Link>
              <Link to="/dashboard" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600">Console</Link>
              <Link to="/profile" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 flex items-center gap-2">
                 Profile {currentUser.role === 'admin' && <span className="text-indigo-500">✓</span>}
              </Link>
              {currentUser.role === 'admin' && <Link to="/admin" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-3 py-1 rounded-lg">Admin Panel</Link>}
            </>
          )}
          <button onClick={toggleDarkMode} className="p-2 text-xl hover:rotate-12 transition-transform">{isDarkMode ? '🌙' : '☀️'}</button>
          {currentUser ? (
            <button onClick={logout} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2 rounded-xl font-black text-[10px] uppercase">Sign Out</button>
          ) : (
            <Link to="/login" className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-black text-[10px] uppercase">Sync Node</Link>
          )}
        </div>
        
        <button onClick={() => setIsOpen(!isOpen)} className="md:hidden text-2xl text-slate-900 dark:text-white">☰</button>
      </div>
      
      {isOpen && (
        <div className="md:hidden bg-white dark:bg-slate-900 border-t p-8 flex flex-col gap-6 animate-in slide-in-from-top-4">
          {currentUser ? (
             <>
                <Link to="/library" onClick={() => setIsOpen(false)} className="text-lg font-black uppercase text-slate-900 dark:text-white">Library</Link>
                <Link to="/ai-test" onClick={() => setIsOpen(false)} className="text-lg font-black uppercase text-indigo-600">AI Tests</Link>
                <Link to="/community" onClick={() => setIsOpen(false)} className="text-lg font-black uppercase text-slate-900 dark:text-white">Forum</Link>
                <Link to="/dashboard" onClick={() => setIsOpen(false)} className="text-lg font-black uppercase text-slate-900 dark:text-white">Console</Link>
                <Link to="/profile" onClick={() => setIsOpen(false)} className="text-lg font-black uppercase text-slate-900 dark:text-white">Profile</Link>
                {currentUser.role === 'admin' && (
                  <Link to="/admin" onClick={() => setIsOpen(false)} className="text-lg font-black uppercase text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-2 rounded-xl border-2 border-indigo-100 dark:border-indigo-900">Admin Panel</Link>
                )}
                <button onClick={() => { logout(); setIsOpen(false); }} className="text-left text-lg font-black uppercase text-red-500">Exit Node</button>
             </>
          ) : (
            <Link to="/login" onClick={() => setIsOpen(false)} className="text-lg font-black uppercase text-slate-900 dark:text-white">Login</Link>
          )}
        </div>
      )}
    </nav>
  );
};

const LandingPage: React.FC = () => {
  const { currentUser } = useAppContext();
  return (
    <div className="max-w-7xl mx-auto px-4 pb-32 overflow-x-hidden">
      <section className="py-24 md:py-48 text-center relative">
        <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #4f46e5 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[40rem] h-[40rem] bg-indigo-500/10 dark:bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
        <div className="absolute top-1/3 right-1/4 -translate-y-1/2 w-[30rem] h-[30rem] bg-fuchsia-500/10 dark:bg-fuchsia-600/5 rounded-full blur-[100px] pointer-events-none -z-10"></div>
        <div className="absolute top-20 left-10 md:left-40 text-4xl opacity-20 dark:opacity-40 animate-bounce transition-all duration-[4s]">📚</div>
        <div className="absolute bottom-40 right-10 md:right-40 text-5xl opacity-20 dark:opacity-40 animate-pulse transition-all duration-[6s]">🧠</div>
        <div className="absolute top-1/2 right-20 text-3xl opacity-10 dark:opacity-30 animate-spin transition-all duration-[10s]">⚛️</div>
        <div className="absolute bottom-20 left-20 text-4xl opacity-10 dark:opacity-30 animate-pulse">🎓</div>

        <div className="relative z-10 inline-flex items-center gap-2 px-6 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-[0.4em] mb-10 border border-indigo-100 dark:border-indigo-900/50 shadow-sm backdrop-blur-md">
           <span className="w-2 h-2 bg-indigo-600 rounded-full animate-ping"></span>
           Elite Scholar Protocol
        </div>

        <div className="relative z-10 mb-8">
            <h1 className="text-6xl md:text-[11rem] font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-[0.85] select-none text-center">
              Ranker <br/>
              <span className="text-indigo-600 drop-shadow-[0_0_30px_rgba(79,70,229,0.3)]">Scholar</span>
            </h1>
        </div>

        <p className="relative z-10 max-w-2xl mx-auto text-lg md:text-2xl text-slate-500 dark:text-slate-400 mb-16 font-medium leading-relaxed">
          The high-clearance educational environment for advanced peer-to-peer synchronization and neural knowledge distillation.
        </p>

        <div className="relative z-10 flex flex-col sm:flex-row justify-center gap-6">
            {!currentUser ? (
              <>
                <Link to="/signup" className="group bg-indigo-600 text-white px-12 py-6 rounded-[32px] font-black text-xl uppercase shadow-3xl hover:shadow-indigo-500/50 hover:scale-105 transition-all flex items-center justify-center gap-3">
                    Initiate Protocol <span className="group-hover:translate-x-1 transition-transform">➔</span>
                </Link>
                <Link to="/login" className="bg-white dark:bg-slate-900 border-4 border-slate-100 dark:border-slate-800 px-12 py-6 rounded-[32px] font-black text-xl uppercase hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-indigo-600 transition-all text-slate-900 dark:text-white">
                    Access Console
                </Link>
              </>
            ) : (
              <Link to="/dashboard" className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-12 py-6 rounded-[32px] font-black text-xl uppercase hover:scale-105 transition-all shadow-2xl">
                Enter Dashboard
              </Link>
            )}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-20 py-24 border-t dark:border-slate-800 relative">
          <div>
              <h2 className="text-[12px] font-black uppercase text-indigo-600 tracking-[0.3em] mb-6">Mission & Goal</h2>
              <h3 className="text-4xl md:text-6xl font-black mb-8 uppercase leading-tight tracking-tighter text-slate-900 dark:text-white">Our Goal: <br/><span className="text-indigo-600">Academic Mastery</span></h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-lg leading-relaxed mb-8">
                RANKER STUDY SPACE was created to dismantle the barriers to elite education. We believe that every student deserves access to S-Class study nodes, peer-verified lecture materials, and AI-assisted deep learning protocols.
              </p>
              <div className="space-y-4">
                  {[
                    "Democratizing High-Performance Study Tools",
                    "Building a Resilient Peer Verification Network",
                    "Synthesizing Knowledge via Neural AI Nodes",
                    "Providing 100% Free Access to Library Repository"
                  ].map((goal, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 shadow-sm hover:border-indigo-500/50 transition-all">
                        <span className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-black text-xs">0{i+1}</span>
                        <p className="text-sm font-black uppercase text-slate-700 dark:text-slate-200">{goal}</p>
                    </div>
                  ))}
              </div>
          </div>
          <div className="bg-slate-900 dark:bg-indigo-950/20 rounded-[64px] p-12 md:p-20 text-white relative overflow-hidden shadow-4xl flex flex-col justify-center border-4 border-slate-800/50">
              <h4 className="text-3xl md:text-4xl font-black uppercase mb-8 tracking-tighter">About the App</h4>
              <p className="text-slate-400 text-lg mb-10 leading-relaxed font-medium">
                Ranker is more than a library; it's a social learning console. Users can broadcast discovery in the Forum, synchronize materials in the Library, and sharpen focus with the Pomodoro Neural Timer.
              </p>
              <div className="grid grid-cols-2 gap-6 relative z-10">
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm">
                      <p className="text-3xl font-black text-indigo-500 mb-1">10k+</p>
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Active Node Syncs</p>
                  </div>
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm">
                      <p className="text-3xl font-black text-indigo-500 mb-1">S-Class</p>
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">AI Integration</p>
                  </div>
              </div>
              <div className="absolute -bottom-10 -right-10 text-[200px] font-black text-white/5 uppercase pointer-events-none select-none">CORE</div>
          </div>
      </section>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { currentUser, setAIChatOpen, updateUser } = useAppContext();
  const [newTarget, setNewTarget] = useState('');
  
  if (!currentUser) return null;

  const stats = currentUser.performanceStats || { weeklyHours: [0,0,0,0,0,0,0], streak: 0, accuracyTrend: [], chapterProficiency: {} };
  const dailyTargets = currentUser.dailyTargets || [];

  const handleAddTarget = () => {
    if (!newTarget.trim()) return;
    const target: DailyTarget = { id: Date.now().toString(), text: newTarget, completed: false };
    updateUser({ dailyTargets: [...dailyTargets, target] });
    setNewTarget('');
  };

  const toggleTarget = (id: string) => {
    updateUser({ dailyTargets: dailyTargets.map(t => t.id === id ? { ...t, completed: !t.completed } : t) });
  };

  const clearCompleted = () => {
    updateUser({ dailyTargets: dailyTargets.filter(t => !t.completed) });
  };

  // Derived AI Insights
  const weakChapters = Object.entries(stats.chapterProficiency).filter(([_, p]) => p === 'weak').map(([n]) => n);
  const aiInsight = weakChapters.length > 0 
    ? `System has detected conceptual leakage in "${weakChapters[0]}". Immediate neural re-alignment via revision is mandated.` 
    : "Neural integrity at optimal levels. Continue core simulation cycles.";

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-24 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-16">
        <div>
          <h1 className="text-4xl md:text-7xl font-black tracking-tighter mb-4 text-slate-900 dark:text-white uppercase flex items-center gap-3">
            Scholar Console
            {currentUser.role === 'admin' && <span className="text-indigo-500 text-3xl md:text-6xl" title="Verified Authority">✓</span>}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-lg md:text-2xl">Identity Verified: <span className="text-indigo-600 font-black">{currentUser.name}</span>.</p>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-900/10 px-8 py-5 rounded-3xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
          <p className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em] mb-1 text-center">Neural Streak</p>
          <p className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white uppercase text-center">{stats.streak} Days 🔥</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-16">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-10 md:p-16 rounded-[64px] border-4 dark:border-slate-800 shadow-xl">
             <h3 className="text-2xl font-black mb-10 uppercase tracking-tight flex items-center gap-3 text-slate-900 dark:text-white">
                <span className="p-3 bg-indigo-50 dark:bg-indigo-950 rounded-2xl">📊</span>
                Neural Activity (Weekly Sync)
             </h3>
             <div className="h-48 flex items-end gap-4 px-4 mb-6">
                {stats.weeklyHours.map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full bg-indigo-500/10 rounded-xl relative group transition-all h-32 overflow-hidden border-2 border-transparent hover:border-indigo-500/30">
                            <div style={{ height: `${(h / 8) * 100}%` }} className="absolute bottom-0 left-0 right-0 bg-indigo-600 rounded-t-lg transition-all duration-1000 group-hover:bg-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.3)]"></div>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase">Day {i+1}</span>
                    </div>
                ))}
             </div>
             <div className="flex justify-between items-center pt-8 border-t-2 dark:border-slate-800 mt-10">
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accuracy Trend</p>
                   <p className="text-2xl font-black text-indigo-600">{stats.accuracyTrend.length > 0 ? stats.accuracyTrend[stats.accuracyTrend.length-1] : 0}%</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Study Volume</p>
                   <p className="text-2xl font-black text-indigo-600">{stats.weeklyHours.reduce((a,b)=>a+b, 0)} Hrs</p>
                </div>
             </div>
          </div>
          
          <div className="space-y-10">
             <div className="bg-slate-900 p-12 rounded-[56px] text-white shadow-4xl relative overflow-hidden group border-4 border-white/5 ring-8 ring-indigo-500/5">
                <div className="relative z-10">
                   <div className="flex items-center gap-3 mb-8">
                      <span className="p-3 bg-white/10 rounded-2xl text-2xl">🤖</span>
                      <h4 className="font-black uppercase text-xs tracking-widest text-indigo-400">Neural Advisor</h4>
                   </div>
                   <p className="text-xl font-bold leading-relaxed mb-10 italic">"{aiInsight}"</p>
                   <Link to="/ai-test" className="block text-center bg-indigo-600 py-5 rounded-[32px] font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-indigo-500 transition-all">Launch Revision Node</Link>
                </div>
                <div className="absolute top-0 right-0 p-8 text-8xl opacity-5">🧠</div>
             </div>

             <div className="bg-white dark:bg-slate-900 p-12 rounded-[56px] border-4 dark:border-slate-800 shadow-xl">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mb-8">Target Matrix</h4>
                <div className="space-y-4 mb-8 max-h-48 overflow-y-auto no-scrollbar">
                   {dailyTargets.map(t => (
                      <div key={t.id} className="flex items-center gap-4 group">
                         <button onClick={() => toggleTarget(t.id)} className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${t.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700'}`}>
                            {t.completed && '✓'}
                         </button>
                         <span className={`text-sm font-bold flex-grow ${t.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{t.text}</span>
                      </div>
                   ))}
                </div>
                <div className="flex gap-3 pt-6 border-t-2 dark:border-slate-800">
                   <input value={newTarget} onChange={e => setNewTarget(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTarget()} placeholder="Set Objective..." className="flex-grow bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl outline-none font-bold text-xs text-slate-900 dark:text-white" />
                   <button onClick={handleAddTarget} className="bg-indigo-600 text-white w-12 h-12 rounded-2xl font-black text-xl shadow-lg hover:scale-105 transition-transform shrink-0">+</button>
                </div>
                {dailyTargets.some(t => t.completed) && (
                  <button onClick={clearCompleted} className="w-full mt-4 text-[8px] font-black uppercase text-indigo-500 hover:underline">Flush Completed Protocols</button>
                )}
             </div>
          </div>
      </div>
    </div>
  );
};

const Community: React.FC = () => {
  const { posts, addPost, toggleLikePost, toggleLikeComment, pinComment, addComment, addReply, reportContent, currentUser, users } = useAppContext();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [replyTarget, setReplyTarget] = useState<{postId: string, commentId: string} | null>(null);
  const [replyText, setReplyText] = useState('');

  if (!currentUser) return null;

  const filteredPosts = useMemo(() => 
    posts.filter(p => p.content.toLowerCase().includes(search.toLowerCase()))
         .sort((a, b) => b.timestamp - a.timestamp), 
    [posts, search]
  );

  const handleReply = (postId: string, commentId: string) => {
    if (!replyText.trim()) return;
    addReply(postId, commentId, replyText);
    setReplyText('');
    setReplyTarget(null);
  };

  const handleReportPost = (postId: string) => {
    const reason = window.prompt("REASON FOR VIOLATION REPORT? (e.g. Spam, Abuse, Misinformation)");
    if (reason && reason.trim()) {
      reportContent(postId, 'post', reason);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 md:py-24">
      <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-8">
        <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-none text-slate-900 dark:text-white">Elite <br/><span className="text-indigo-600">Forum</span></h1>
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Filter broadcasts..." 
          className="p-5 rounded-3xl bg-white dark:bg-slate-900 border dark:border-slate-800 outline-none text-xs font-bold w-full max-w-sm text-slate-900 dark:text-white"
        />
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[56px] mb-16 border-2 dark:border-slate-800 shadow-sm">
        <textarea 
          value={text} 
          onChange={e => setText(e.target.value)} 
          placeholder="Broadcast scholarly discovery to the node..." 
          className="w-full bg-slate-50 dark:bg-slate-950 p-8 rounded-[32px] mb-8 outline-none h-40 border-2 dark:border-slate-800 font-bold text-lg resize-none shadow-inner text-slate-900 dark:text-white" 
        />
        <div className="flex justify-end">
          <button 
            onClick={() => { if(text.trim()) { addPost(text); setText(''); } }} 
            className="bg-indigo-600 text-white px-12 py-5 rounded-[28px] font-black text-[12px] uppercase shadow-2xl tracking-[0.2em] hover:scale-105 active:scale-95 transition-all"
          >
            Broadcast
          </button>
        </div>
      </div>

      <div className="space-y-16">
        {filteredPosts.map(post => {
          const author = users.find(u => u.id === post.authorId);
          const isLiked = post.likedBy?.includes(currentUser.id);
          
          return (
            <div key={post.id} className="p-10 md:p-16 rounded-[64px] border-4 bg-white dark:bg-slate-900 shadow-xl animate-in fade-in transition-all relative">
               <div className="flex items-center gap-6 mb-10">
                    <div className="w-16 h-16 bg-indigo-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center font-black text-2xl text-indigo-600 border-2 border-indigo-100 dark:border-indigo-900 shadow-inner overflow-hidden">
                      {author?.photoUrl ? <img src={author.photoUrl} className="w-full h-full object-cover" alt="" /> : author?.name[0]}
                    </div>
                    <div>
                      <h4 className="font-black text-xl uppercase tracking-tight text-slate-900 dark:text-white">{author?.name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(post.timestamp).toLocaleString()}</p>
                    </div>
               </div>
               
               <p className="text-lg md:text-2xl font-bold text-slate-700 dark:text-slate-200 mb-12 leading-relaxed italic">"{post.content}"</p>
               
               <div className="flex flex-wrap items-center gap-4 mb-12 border-b-2 dark:border-slate-800 pb-8 text-slate-900 dark:text-white">
                  <button 
                    onClick={() => toggleLikePost(post.id)} 
                    className={`flex items-center gap-3 px-6 md:px-8 py-4 rounded-[28px] font-black text-[10px] md:text-xs uppercase transition-all shadow-md active:scale-95 ${isLiked ? 'bg-indigo-600 text-white shadow-indigo-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-2 border-transparent'}`}
                  >
                    {isLiked ? '❤️ ENDORSED' : '🤍 ENDORSE'} {post.likedBy?.length || 0}
                  </button>
                  <button 
                    onClick={() => handleReportPost(post.id)}
                    className="flex items-center gap-2 px-6 md:px-8 py-4 rounded-[28px] font-black text-[10px] md:text-xs uppercase text-rose-400 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 transition-all border-2 border-rose-100/50 dark:border-rose-900/50"
                  >
                    🚩 REPORT
                  </button>
               </div>

               <div className="space-y-8">
                  {post.comments.map(comment => (
                    <CommentComp 
                      key={comment.id} 
                      comment={comment} 
                      postId={post.id} 
                      currentUser={currentUser}
                      toggleLikeComment={toggleLikeComment}
                      pinComment={pinComment}
                      reportContent={reportContent}
                      replyTarget={replyTarget}
                      setReplyTarget={setReplyTarget}
                      replyText={replyText}
                      setReplyText={setReplyText}
                      handleReply={handleReply}
                    />
                  ))}
                  
                  <div className="flex flex-col gap-4">
                     <textarea 
                       placeholder="Synthesize commentary..." 
                       className="w-full p-6 rounded-[32px] bg-slate-50 dark:bg-slate-950 border-2 dark:border-slate-800 outline-none text-sm font-bold min-h-[100px] resize-none focus:border-indigo-600 transition-colors text-slate-900 dark:text-white"
                       onKeyPress={(e) => {
                         if (e.key === 'Enter' && !e.shiftKey) {
                           e.preventDefault();
                           const val = (e.target as HTMLTextAreaElement).value;
                           if (val.trim()) {
                             addComment(post.id, val);
                             (e.target as HTMLTextAreaElement).value = '';
                           }
                         }
                       }}
                     />
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Press Enter to Broadcast</p>
                  </div>
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CommentComp: React.FC<{ 
  comment: Comment, 
  postId: string, 
  isReply?: boolean,
  currentUser: User,
  toggleLikeComment: (postId: string, commentId: string, replyId?: string) => void,
  pinComment: (postId: string, commentId: string) => void,
  reportContent: (targetId: string, targetType: Report['targetType'], reason: string) => void,
  replyTarget: {postId: string, commentId: string} | null,
  setReplyTarget: (target: {postId: string, commentId: string} | null) => void,
  replyText: string,
  setReplyText: (text: string) => void,
  handleReply: (postId: string, commentId: string) => void
}> = ({ comment, postId, isReply = false, currentUser, toggleLikeComment, pinComment, reportContent, replyTarget, setReplyTarget, replyText, setReplyText, handleReply }) => {
  const isLiked = comment.likedBy?.includes(currentUser.id);
  const sortedReplies = useMemo(() => [...(comment.replies || [])].sort((a,b) => b.timestamp - a.timestamp), [comment.replies]);

  const handleReport = () => {
    const reason = window.prompt("REASON FOR COMMENT REPORT? (e.g. Spam, Abuse)");
    if (reason && reason.trim()) {
      reportContent(comment.id, 'comment', reason);
    }
  };

  return (
    <div className={`p-6 rounded-[32px] border-2 transition-all relative ${comment.isPinned ? 'border-indigo-600 bg-indigo-50/30 dark:bg-indigo-900/10' : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-black uppercase text-indigo-600">
            {comment.authorName[0]}
          </div>
          <div>
            <p className="font-black text-xs uppercase flex items-center gap-2 text-slate-900 dark:text-white">
              {comment.authorName} 
              {comment.isPinned && <span className="text-[10px] text-indigo-600 bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 rounded-full">PINNED</span>}
            </p>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{new Date(comment.timestamp).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-4">{comment.content}</p>
      
      <div className="flex flex-wrap items-center gap-4">
        <button 
          onClick={() => toggleLikeComment(postId, isReply ? '' : comment.id, isReply ? comment.id : undefined)} 
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all font-black text-[9px] uppercase ${isLiked ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'}`}
        >
          {isLiked ? '❤️' : '🤍'} {comment.likedBy?.length || 0}
        </button>
        
        {!isReply && (
          <button 
            onClick={() => setReplyTarget(replyTarget?.commentId === comment.id ? null : { postId, commentId: comment.id })} 
            className="text-[9px] font-black uppercase text-slate-400 hover:text-indigo-600"
          >
            Reply
          </button>
        )}

        <button 
          onClick={handleReport} 
          className="text-[9px] font-black uppercase text-rose-400 hover:text-rose-600 transition-colors flex items-center gap-1"
          title="Report Violation"
        >
          <span>🚩</span> Report
        </button>
      </div>

      {replyTarget?.commentId === comment.id && (
        <div className="mt-4 flex gap-2 animate-in slide-in-from-top-2">
          <input 
            value={replyText} 
            onChange={e => setReplyText(e.target.value)} 
            placeholder="Reply..." 
            className="flex-grow p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs outline-none focus:border-indigo-600 text-slate-900 dark:text-white"
          />
          <button onClick={() => handleReply(postId, comment.id)} className="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-[9px] font-black uppercase">Send</button>
        </div>
      )}

      {sortedReplies.length > 0 && (
        <div className="mt-6 ml-6 border-l-2 border-slate-100 dark:border-slate-800 pl-6 space-y-4">
          {sortedReplies.map(reply => (
            <CommentComp 
              key={reply.id} 
              comment={reply} 
              postId={postId} 
              isReply={true} 
              currentUser={currentUser}
              toggleLikeComment={toggleLikeComment}
              pinComment={pinComment}
              reportContent={reportContent}
              replyTarget={replyTarget}
              setReplyTarget={setReplyTarget}
              replyText={replyText}
              setReplyText={setReplyText}
              handleReply={handleReply}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const AdminPanel: React.FC = () => {
    const { users, warnUser, muteUser, banUser, unbanUser, currentUser, materials, posts, reports, deleteMaterial, deletePost, deleteComment, deleteMaterialComment, deleteReport } = useAppContext();
    const [activeTab, setActiveTab] = useState<'users' | 'community' | 'reports'>('users');

    if (!currentUser || currentUser.role !== 'admin') return <div className="p-40 text-center font-black uppercase text-2xl text-red-500">403 Forbidden</div>;

    const handleActionOnReport = (report: Report, action: 'delete' | 'mute' | 'warn') => {
        const targetId = report.targetId;
        
        if (action === 'delete') {
            if (report.targetType === 'post') {
                deletePost(targetId);
            } else if (report.targetType === 'comment') {
                const parentPost = posts.find(p => p.comments.some(c => c.id === targetId || c.replies.some(r => r.id === targetId)));
                if (parentPost) {
                  deleteComment(parentPost.id, targetId);
                } else {
                  alert("Target not found. It may have been deleted already.");
                }
            } else if (report.targetType === 'material') {
                deleteMaterial(targetId);
            } else if (report.targetType === 'material_comment') {
                const parentMat = materials.find(m => m.comments.some(c => c.id === targetId));
                if (parentMat) deleteMaterialComment(parentMat.id, targetId);
            }
        } else if (action === 'warn') {
            let authorId = "";
            if (report.targetType === 'post') {
                authorId = posts.find(p => p.id === targetId)?.authorId || "";
            } else if (report.targetType === 'comment') {
                const post = posts.find(p => p.comments.some(c => c.id === targetId || c.replies.some(r => r.id === targetId)));
                const comment = post?.comments.find(c => c.id === targetId) || post?.comments.flatMap(c => c.replies).find(r => r.id === targetId);
                authorId = comment?.authorId || "";
            }
            if (authorId) warnUser(authorId);
            else alert("Could not locate author.");
        }
    };

    const getReportedContentPreview = (report: Report) => {
        if (report.targetType === 'post') {
            return posts.find(p => p.id === report.targetId)?.content || "[Terminated]";
        } else if (report.targetType === 'comment') {
            const allComments = posts.flatMap(p => p.comments);
            const allReplies = allComments.flatMap(c => c.replies);
            return allComments.find(c => c.id === report.targetId)?.content || 
                   allReplies.find(r => r.id === report.targetId)?.content || 
                   "[Terminated]";
        } else if (report.targetType === 'material') {
            return materials.find(m => m.id === report.targetId)?.title || "[Terminated]";
        }
        return "Target Node Undefined";
    };

    return (
      <div className="max-w-7xl mx-auto px-4 py-12 md:py-24 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div>
                <h1 className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none mb-4 text-slate-900 dark:text-white">Admin <br/><span className="text-indigo-600">Command</span></h1>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Secure Control Center</p>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {(['users', 'community', 'reports'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'bg-white dark:bg-slate-900 border dark:border-slate-800 text-slate-400 hover:text-indigo-600'}`}>
                        {tab}
                    </button>
                ))}
            </div>
        </div>

        {activeTab === 'users' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {users.map(u => (
                    <div key={u.id} className="p-8 bg-white dark:bg-slate-900 rounded-[48px] border-4 dark:border-slate-800 shadow-xl relative overflow-hidden group">
                        <h4 className="font-black text-xl uppercase mb-1 flex items-center gap-2 text-slate-900 dark:text-white">
                            {u.name} 
                            {u.role === 'admin' && <span className="text-indigo-500 text-xs">✓</span>}
                            {u.isBanned && <span className="text-rose-600 text-[10px]">BANNED</span>}
                        </h4>
                        <p className="text-[10px] text-slate-400 mb-8 uppercase tracking-widest">{u.email}</p>
                        <div className="flex gap-3">
                            <button onClick={() => warnUser(u.id)} className="flex-1 py-4 bg-amber-50 dark:bg-amber-900/20 text-amber-600 text-[10px] font-black uppercase rounded-2xl border-2 border-amber-100 dark:border-amber-900 hover:bg-amber-600 hover:text-white transition-all">Warn ({u.warnings}/3)</button>
                            <button onClick={() => u.isBanned ? unbanUser(u.id) : banUser(u.id)} className={`flex-1 py-4 text-[10px] font-black uppercase rounded-2xl border-2 transition-all ${u.isBanned ? 'bg-indigo-600 text-white' : 'bg-rose-50 text-rose-600 border-rose-900'}`}>
                                {u.isBanned ? 'Unban' : 'Ban'}
                            </button>
                        </div>
                        <button onClick={() => muteUser(u.id)} className="w-full mt-3 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[9px] font-black uppercase rounded-xl">
                            {u.isMuted ? 'Unmute' : 'Mute'}
                        </button>
                    </div>
                ))}
            </div>
        )}

        {activeTab === 'community' && (
            <div className="space-y-8">
                {posts.map(p => (
                    <div key={p.id} className="bg-white dark:bg-slate-900 p-10 rounded-[48px] border-4 dark:border-slate-800 shadow-xl flex flex-col md:flex-row justify-between gap-10">
                        <div className="flex-grow">
                            <p className="font-black uppercase text-sm text-slate-900 dark:text-white">{p.authorName}</p>
                            <p className="text-[10px] text-slate-400 mb-4">{new Date(p.timestamp).toLocaleString()}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium line-clamp-3 mb-6">"{p.content}"</p>
                        </div>
                        <div className="flex md:flex-col gap-3 shrink-0">
                            <button onClick={() => deletePost(p.id)} className="bg-rose-600 text-white px-10 py-5 rounded-[28px] font-black text-[10px] uppercase shadow-xl hover:bg-rose-500 transition-all">Remove Post</button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {activeTab === 'reports' && (
            <div className="space-y-6">
                {reports.length === 0 ? (
                    <div className="p-20 text-center text-slate-400 font-black uppercase tracking-widest border-4 border-dashed rounded-[64px]">No Reports Ledgered</div>
                ) : (
                    reports.map(r => (
                        <div key={r.id} className="bg-white dark:bg-slate-900 p-10 rounded-[48px] border-4 dark:border-slate-800 shadow-xl flex flex-col gap-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                                <div className="flex-grow">
                                    <div className="flex items-center gap-4 mb-2">
                                        <span className="bg-rose-100 text-rose-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{r.targetType} Issue</span>
                                        <span className="text-slate-400 text-[10px] font-bold">{new Date(r.timestamp).toLocaleString()}</span>
                                    </div>
                                    <h4 className="text-xl font-black uppercase tracking-tight mb-2 text-slate-900 dark:text-white">Reason: {r.reason}</h4>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => handleActionOnReport(r, 'warn')} className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase border-2 border-amber-100">Warn Author</button>
                                    <button onClick={() => handleActionOnReport(r, 'delete')} className="bg-rose-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl">Delete Content</button>
                                    <button onClick={() => deleteReport(r.id)} className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase">Dismiss Report</button>
                                </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border-2 dark:border-slate-800">
                                <p className="text-[9px] font-black uppercase text-slate-400 mb-3 tracking-widest">Target Preview:</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 italic">"{getReportedContentPreview(r)}"</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}
      </div>
    );
};

const AuthPage: React.FC<{ type: 'login' | 'signup' }> = ({ type }) => {
  const { login, signup } = useAppContext();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (formData.password.length < 8) {
      alert("Password must be 8+ characters for security.");
      return;
    }
    const user = type === 'login' ? login(formData.email, formData.password) : signup(formData); 
    if (user) navigate('/dashboard'); 
  };
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 p-12 md:p-20 rounded-[64px] border-4 dark:border-slate-800 shadow-4xl w-full max-w-2xl">
        <h2 className="text-4xl md:text-6xl font-black uppercase mb-12 tracking-tighter text-center leading-none text-slate-900 dark:text-white">Sync <br/><span className="text-indigo-600">Access Node</span></h2>
        <form onSubmit={handleSubmit} className="space-y-8">
          {type === 'signup' && (<input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Full Name" className="w-full p-6 rounded-[28px] bg-slate-50 dark:bg-slate-950 border-2 dark:border-slate-800 outline-none font-bold text-slate-900 dark:text-white" />)}
          <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Email Address" className="w-full p-6 rounded-[28px] bg-slate-50 dark:bg-slate-950 border-2 dark:border-slate-800 outline-none font-bold text-slate-900 dark:text-white" />
          <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Password" minLength={8} className="w-full p-6 rounded-[28px] bg-slate-50 dark:bg-slate-950 border-2 dark:border-slate-800 outline-none font-bold text-slate-900 dark:text-white" />
          <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-[32px] font-black text-sm uppercase tracking-[0.3em] shadow-2xl"> {type === 'login' ? 'Confirm Sync' : 'Initiate Link'}</button>
        </form>
        <div className="mt-12 text-center"><Link to={type === 'login' ? "/signup" : "/login"} className="text-[10px] font-black uppercase text-indigo-600 tracking-widest hover:underline">{type === 'login' ? "Register New Account" : "Back to Login Node"}</Link></div>
      </div>
    </div>
  );
};

const LegalPage: React.FC = () => {
    const { page } = useParams<{ page: string }>();
    const pageData = LEGAL_PAGES[page as keyof typeof LEGAL_PAGES];
    if (!pageData) return <div className="p-40 text-center font-black uppercase text-2xl text-slate-900 dark:text-white">404 Missing Ledger</div>;
    return (
      <div className="max-w-4xl mx-auto px-4 py-24"><h1 className="text-5xl md:text-7xl font-black mb-16 uppercase tracking-tighter text-indigo-600">{pageData.title}</h1><div className="bg-white dark:bg-slate-900 p-12 md:p-20 rounded-[64px] border-4 dark:border-slate-800 shadow-4xl leading-relaxed"><p className="whitespace-pre-line text-lg font-medium text-slate-700 dark:text-slate-300">{pageData.content}</p></div></div>
    );
};

const Footer: React.FC = () => (
    <footer className="bg-white dark:bg-slate-950 border-t-4 border-slate-50 dark:border-slate-900 py-24 mt-20">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-20">
        <div><h2 className="text-indigo-600 font-black mb-10 text-4xl uppercase tracking-tighter">Ranker</h2><p className="text-slate-400 text-sm md:text-lg leading-relaxed font-medium">Empowering global scholarship through decentralized high-performance framework.</p></div>
        <div><h4 className="text-[10px] font-black uppercase mb-10 text-slate-300 tracking-widest">Protocols</h4><ul className="space-y-6 text-xs font-black text-slate-500 uppercase tracking-widest"><li><Link to="/legal/terms" className="hover:text-indigo-600">Terms</Link></li><li><Link to="/legal/privacy" className="hover:text-indigo-600">Privacy Policy</Link></li><li><Link to="/legal/disclaimer" className="hover:text-indigo-600">Disclaimer</Link></li></ul></div>
        <div><h4 className="text-[10px] font-black uppercase mb-10 text-slate-300 tracking-widest">Support Node</h4><a href="mailto:studyspacerankers@gmail.com" className="text-indigo-600 text-sm md:text-xl font-black">studyspacerankers@gmail.com</a></div>
      </div>
    </footer>
);

// --- Profile & Misc ---

const Profile: React.FC = () => {
    const { currentUser, updateUser, promoteToAdmin } = useAppContext();
    const [name, setName] = useState(currentUser?.name || '');
    const [isElevating, setIsElevating] = useState(false);
    const [passcode, setPasscode] = useState('');
    
    if (!currentUser) return null;
    
    const handleUpdate = (e: React.FormEvent) => { e.preventDefault(); updateUser({ name }); alert("Profile updated."); };
    const handleElevation = (e: React.FormEvent) => { e.preventDefault(); if (promoteToAdmin(passcode)) { alert("Access Elevated."); setIsElevating(false); } else { alert("Failed."); } };
    
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 animate-in slide-in-from-top-8">
        <h1 className="text-5xl md:text-7xl font-black mb-16 uppercase tracking-tighter text-indigo-600">Scholar Profile</h1>
        <div className="bg-white dark:bg-slate-900 p-12 md:p-20 rounded-[64px] border-4 dark:border-slate-800 shadow-4xl relative">
            <h2 className="text-3xl md:text-5xl font-black uppercase mb-8 text-slate-900 dark:text-white">{currentUser.name} {currentUser.role === 'admin' && '✓'}</h2>
            <form onSubmit={handleUpdate} className="space-y-8">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Display Name" className="w-full p-6 rounded-[28px] bg-slate-50 dark:bg-slate-950 border-2 dark:border-slate-800 outline-none font-bold text-slate-900 dark:text-white" />
                <button type="submit" className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-6 rounded-[32px] font-black text-sm uppercase shadow-2xl">Confirm Updates</button>
            </form>
            <div className="mt-12 pt-12 border-t-2 dark:border-slate-800">
                <button onClick={() => setIsElevating(!isElevating)} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Elevate Permissions</button>
                {isElevating && (
                  <form onSubmit={handleElevation} className="mt-4 flex gap-2">
                      <input type="password" value={passcode} onChange={e => setPasscode(e.target.value)} placeholder="SYNC KEY" className="bg-slate-50 dark:bg-slate-800 border-2 border-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black outline-none w-32" />
                      <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">SYNC</button>
                  </form>
                )}
            </div>
        </div>
      </div>
    );
};

// --- Library & Tests ---

const Library: React.FC = () => {
  const { materials, currentUser, incrementDownload, generateQuiz, reportMaterial } = useAppContext();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState<QuizSession | null>(null);
  const [isLoadingTest, setIsLoadingTest] = useState(false);

  if (!currentUser) return null;

  const handleGenerateTest = async (m: Material) => {
    setIsLoadingTest(true);
    try {
      const qs = await generateQuiz(m.title, "Scholar", 6, m.description);
      setSelectedQuiz({
        id: Date.now().toString(),
        title: `AI Assessment: ${m.title}`,
        questions: qs,
        startTime: Date.now(),
        type: 'chapter',
        exam: 'JEE'
      });
    } catch {
      alert("Neural sync failure. Check node link.");
    } finally {
      setIsLoadingTest(false);
    }
  };

  const filteredMaterials = materials.filter(m => filter === 'All' || m.category === filter).filter(m => m.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-24 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">Neural Library</h1>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search repository..." className="flex-grow max-w-xl p-6 rounded-[32px] bg-white dark:bg-slate-900 border dark:border-slate-800 outline-none text-sm shadow-inner font-bold text-slate-900 dark:text-white" />
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-6 mb-12 no-scrollbar">
        {['All', ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilter(c)} className={`px-8 py-4 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${filter === c ? 'bg-indigo-600 text-white shadow-xl scale-105' : 'bg-white dark:bg-slate-900 border dark:border-slate-800 text-slate-400 hover:text-indigo-600'}`}>{c}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
        {filteredMaterials.map(m => (
          <div key={m.id} className="bg-white dark:bg-slate-900 p-10 rounded-[48px] border dark:border-slate-800 flex flex-col group relative overflow-hidden shadow-sm hover:shadow-2xl transition-all">
            <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-full tracking-[0.2em] w-fit mb-8">{m.category}</span>
            <h3 className="text-2xl font-black mb-4 text-slate-900 dark:text-white uppercase tracking-tight">{m.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-10 flex-grow leading-relaxed font-medium line-clamp-3">{m.description}</p>
            
            <div className="flex flex-col gap-3 pt-8 border-t dark:border-slate-800">
              <button onClick={() => { incrementDownload(m.id, m.title); window.open(m.fileName, '_blank'); }} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-lg">Synchronize Node</button>
              <button onClick={() => handleGenerateTest(m)} disabled={isLoadingTest} className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-500 disabled:opacity-50">⚡ Distill AI Test</button>
              <button onClick={() => reportMaterial(m.id)} className="text-[9px] font-black text-rose-500 hover:underline mt-2">Flag Content</button>
            </div>
          </div>
        ))}
      </div>

      {selectedQuiz && <QuizModal quiz={selectedQuiz} onClose={() => setSelectedQuiz(null)} />}
    </div>
  );
};

const QuizModal: React.FC<{ quiz: QuizSession; onClose: () => void }> = ({ quiz, onClose }) => {
    const { updateUser, currentUser } = useAppContext();
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState<(number | null)[]>(new Array(quiz.questions.length).fill(null));
    const [isFinished, setIsFinished] = useState(false);
    
    const handleAnswer = (idx: number) => {
        const newAns = [...answers];
        newAns[currentStep] = idx;
        setAnswers(newAns);
        if (currentStep < quiz.questions.length - 1) setCurrentStep(currentStep + 1);
        else setIsFinished(true);
    };

    if (isFinished) {
        const correctCount = answers.filter((ans, i) => ans === quiz.questions[i].correctIndex).length;
        return (
            <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl z-[1000] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[64px] p-16 border-4 dark:border-slate-800 shadow-4xl text-center">
                    <h2 className="text-5xl font-black uppercase text-indigo-600 mb-6">Distillation Complete</h2>
                    <p className="text-2xl font-bold mb-12 text-slate-900 dark:text-white">Score: {correctCount} / {quiz.questions.length}</p>
                    <button onClick={onClose} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-6 rounded-[32px] font-black uppercase text-xs tracking-widest shadow-2xl">Terminate Node Link</button>
                </div>
            </div>
        );
    }

    const currentQ = quiz.questions[currentStep];
    return (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[1000] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[64px] p-16 border-4 dark:border-slate-800 shadow-4xl relative overflow-hidden">
                <span className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em] bg-indigo-50 dark:bg-indigo-950 px-4 py-2 rounded-xl mb-10 block w-fit">Question {currentStep + 1}/{quiz.questions.length}</span>
                <h2 className="text-2xl md:text-3xl font-black mb-12 text-slate-900 dark:text-white leading-tight">{currentQ.question}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    {currentQ.options.map((opt, i) => (
                        <button key={i} onClick={() => handleAnswer(i)} className="text-left p-8 rounded-[40px] bg-slate-50 dark:bg-slate-800/50 border-4 border-transparent hover:border-indigo-600 hover:bg-indigo-50 transition-all font-bold group flex items-center gap-6">
                            <span className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg shrink-0 font-black">{String.fromCharCode(65 + i)}</span>
                            <span className="text-lg text-slate-900 dark:text-white">{opt}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

const AITestSection: React.FC = () => {
    return (
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-24 text-center">
            <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tighter mb-6 text-slate-900 dark:text-white">Assessment <span className="text-indigo-600">Hub</span></h1>
            <p className="text-slate-500 font-bold text-lg md:text-2xl max-w-2xl mx-auto mb-16">Syncing with competitive standard protocols. Select a material node to distill a test.</p>
            <Link to="/library" className="bg-indigo-600 text-white px-12 py-6 rounded-[32px] font-black text-xl uppercase shadow-3xl hover:shadow-indigo-500/50 hover:scale-105 transition-all">Go to Library Node</Link>
        </div>
    );
};

const AIChatbot: React.FC = () => {
    const { isAIChatOpen, setAIChatOpen, currentUser } = useAppContext();
    const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight); }, [messages, isTyping]);

    if (!currentUser || !isAIChatOpen) return (
      <button onClick={() => setAIChatOpen(true)} className="fixed bottom-10 right-10 bg-indigo-600 text-white w-20 h-20 rounded-[32px] shadow-4xl flex items-center justify-center text-4xl hover:scale-110 transition-all z-[500]">🧠</button>
    );

    const handleSend = async () => {
      if (!input.trim()) return;
      setMessages(prev => [...prev, { role: 'user', text: input }]);
      const currentInput = input;
      setInput('');
      setIsTyping(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const res = await ai.models.generateContent({ 
          model: 'gemini-3-flash-preview', 
          contents: currentInput,
          config: { systemInstruction: "Ranker AI Mentor. Brief, helpful, scholarly." }
        });
        setMessages(prev => [...prev, { role: 'bot', text: res.text || "Connection lost." }]);
      } catch { setMessages(prev => [...prev, { role: 'bot', text: "Verification failure." }]); }
      finally { setIsTyping(false); }
    };

    return (
      <div className="fixed bottom-10 right-10 z-[1000] w-[450px] h-[650px] bg-white dark:bg-slate-900 rounded-[48px] shadow-4xl border-4 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom-12">
        <div className="bg-indigo-600 p-8 flex justify-between items-center text-white">
            <h3 className="font-black uppercase text-xs tracking-[0.4em]">Neural Mentor</h3>
            <button onClick={() => setAIChatOpen(false)} className="text-xl font-black">✕</button>
        </div>
        <div ref={scrollRef} className="flex-grow p-8 overflow-y-auto space-y-6 no-scrollbar">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-5 rounded-[28px] text-sm font-bold ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>{m.text}</div>
            </div>
          ))}
          {isTyping && <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full w-fit animate-pulse text-xs font-black uppercase text-slate-400">Syncing...</div>}
        </div>
        <div className="p-8 flex gap-4 border-t-2 dark:border-slate-800">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="Ask scholarly..." className="flex-grow p-5 bg-slate-50 dark:bg-slate-950 rounded-[24px] outline-none text-sm font-bold text-slate-900 dark:text-white" />
          <button onClick={handleSend} className="bg-indigo-600 text-white w-14 h-14 rounded-[24px] font-black text-xl">➔</button>
        </div>
      </div>
    );
};
