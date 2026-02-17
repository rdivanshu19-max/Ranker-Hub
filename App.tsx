
import React, { useState, useEffect, createContext, useContext, useMemo, useRef } from 'react';
import { Routes, Route, useNavigate, Link, useLocation, useParams } from 'react-router-dom';
import { GoogleGenAI, Type } from "@google/genai";
import { User, Material, Post, Role, Comment, Report, AISettings, QuizQuestion, QuizSession, DailyTarget } from './types';
import { INITIAL_MATERIALS, ADMIN_PASSCODE, LEGAL_PAGES, CATEGORIES, SYLLABUS } from './constants';

// --- Safety Polyfill for Environment Variables (Fixes Vercel White Page) ---
if (typeof (window as any).process === 'undefined') {
  (window as any).process = { env: {} };
}

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

  // Persistence logic with error handling
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
      id: "REP-" + Date.now().toString(36).toUpperCase(), 
      targetId, 
      targetType, 
      reporterId: currentUser.id, 
      reason: reason || "Investigation requested.", 
      timestamp: Date.now() 
    };
    setReports(prev => [newReport, ...prev]);
    alert("Report sent to Admin. investigation started. 🚩");
  };

  const deleteReport = (id: string) => setReports(prev => prev.filter(r => r.id !== id));
  
  const warnUser = (id: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const newWarnings = u.warnings + 1;
        const autoBan = newWarnings >= 3;
        if (autoBan) {
          alert(`CRITICAL: User ${u.name} reached 3 warnings and has been AUTOMATICALLY BANNED.`);
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
        alert(`${u.name} transmission: ${newMute ? 'MUTED' : 'UNMUTED'}.`);
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
    const apiKey = (window as any).process?.env?.API_KEY || (process?.env?.API_KEY);
    const ai = new GoogleGenAI({ apiKey });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Create a professional educational quiz of ${count} questions. Topic: "${topic}". Difficulty: ${difficulty}. Standard: JEE/NEET.`,
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: 4, maxItems: 4 },
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
      return JSON.parse(response.text || '[]');
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
        <div className="relative z-10 mb-8">
            <h1 className="text-6xl md:text-[11rem] font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-[0.85] select-none text-center">
              Ranker <br/>
              <span className="text-indigo-600 drop-shadow-[0_0_30px_rgba(79,70,229,0.3)]">Scholar</span>
            </h1>
        </div>
        <p className="relative z-10 max-w-2xl mx-auto text-lg md:text-2xl text-slate-500 dark:text-slate-400 mb-16 font-medium leading-relaxed">
          Free academic mastery environment for S-Class deep learning distillation.
        </p>
        <div className="relative z-10 flex flex-col sm:flex-row justify-center gap-6">
            {!currentUser ? (
              <Link to="/signup" className="group bg-indigo-600 text-white px-12 py-6 rounded-[32px] font-black text-xl uppercase shadow-3xl hover:scale-105 transition-all">Initiate Protocol ➔</Link>
            ) : (
              <Link to="/dashboard" className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-12 py-6 rounded-[32px] font-black text-xl uppercase hover:scale-105 transition-all shadow-2xl">Enter Console</Link>
            )}
        </div>
      </section>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { currentUser, updateUser } = useAppContext();
  const [newTarget, setNewTarget] = useState('');
  
  if (!currentUser) return null;
  const stats = currentUser.performanceStats || { weeklyHours: [0,0,0,0,0,0,0], streak: 0, accuracyTrend: [], chapterProficiency: {} };
  const dailyTargets = currentUser.dailyTargets || [];

  const handleAddTarget = () => {
    if (!newTarget.trim()) return;
    updateUser({ dailyTargets: [...dailyTargets, { id: Date.now().toString(), text: newTarget, completed: false }] });
    setNewTarget('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 md:py-24">
      <h1 className="text-4xl md:text-7xl font-black uppercase mb-10 text-slate-900 dark:text-white">Scholar Console</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[48px] border-4 dark:border-slate-800">
          <h3 className="font-black uppercase text-xs mb-6 text-indigo-600">Targets</h3>
          <div className="space-y-4 mb-6">
            {dailyTargets.map(t => <div key={t.id} className="font-bold text-sm text-slate-700 dark:text-slate-300">• {t.text}</div>)}
          </div>
          <div className="flex gap-2">
            <input value={newTarget} onChange={e => setNewTarget(e.target.value)} placeholder="New target..." className="flex-grow bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl font-bold text-xs" />
            <button onClick={handleAddTarget} className="bg-indigo-600 text-white px-6 py-2 rounded-2xl font-black">+</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Community: React.FC = () => {
  const { posts, addPost, toggleLikePost, reportContent, currentUser, users } = useAppContext();
  const [text, setText] = useState('');

  if (!currentUser) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 md:py-24">
      <h1 className="text-5xl md:text-8xl font-black uppercase mb-12 text-slate-900 dark:text-white">Forum</h1>
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[48px] mb-12 border-4 dark:border-slate-800">
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Broadcast discovery..." className="w-full bg-slate-50 dark:bg-slate-950 p-6 rounded-[32px] mb-4 outline-none h-32 font-bold text-slate-900 dark:text-white" />
        <button onClick={() => { if(text.trim()) { addPost(text); setText(''); } }} className="bg-indigo-600 text-white px-10 py-4 rounded-[28px] font-black uppercase text-xs">Broadcast</button>
      </div>
      <div className="space-y-12">
        {posts.map(post => (
          <div key={post.id} className="p-10 rounded-[48px] bg-white dark:bg-slate-900 border-4 dark:border-slate-800">
             <p className="font-black text-xs uppercase text-slate-400 mb-4">{post.authorName} • {new Date(post.timestamp).toLocaleDateString()}</p>
             <p className="text-xl font-bold mb-8 text-slate-900 dark:text-white">"{post.content}"</p>
             <div className="flex gap-4">
                <button onClick={() => toggleLikePost(post.id)} className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase">❤️ {post.likedBy?.length || 0}</button>
                <button onClick={() => reportContent(post.id, 'post', 'Forum Violation')} className="text-rose-500 font-black text-[10px] uppercase">🚩 Report</button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Library: React.FC = () => {
  const { materials, currentUser, incrementDownload, generateQuiz, reportMaterial } = useAppContext();
  const [selectedQuiz, setSelectedQuiz] = useState<QuizSession | null>(null);

  const handleQuiz = async (m: Material) => {
    try {
      const qs = await generateQuiz(m.title, "Scholar", 5);
      setSelectedQuiz({ id: '1', title: m.title, questions: qs, startTime: Date.now(), type: 'chapter', exam: 'JEE' });
    } catch { alert("Node Sync Failure."); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-24">
      <h1 className="text-5xl font-black uppercase mb-12 text-slate-900 dark:text-white">Neural Library</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {materials.map(m => (
          <div key={m.id} className="bg-white dark:bg-slate-900 p-10 rounded-[48px] border-4 dark:border-slate-800">
            <h3 className="text-2xl font-black mb-4 text-slate-900 dark:text-white">{m.title}</h3>
            <div className="flex flex-col gap-2 mt-8">
              <button onClick={() => incrementDownload(m.id, m.title)} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black text-[10px] uppercase">Synchronize</button>
              <button onClick={() => handleQuiz(m)} className="bg-indigo-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase">AI Assessment</button>
            </div>
          </div>
        ))}
      </div>
      {selectedQuiz && <QuizModal quiz={selectedQuiz} onClose={() => setSelectedQuiz(null)} />}
    </div>
  );
};

const QuizModal: React.FC<{ quiz: QuizSession; onClose: () => void }> = ({ quiz, onClose }) => {
    return (
        <div className="fixed inset-0 bg-slate-950/98 z-[1000] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[64px] p-16 border-4 dark:border-slate-800 text-center">
                <h2 className="text-3xl font-black mb-10 text-slate-900 dark:text-white">{quiz.questions[0]?.question || "Distilling..."}</h2>
                <button onClick={onClose} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black uppercase">Terminate</button>
            </div>
        </div>
    );
};

const AdminPanel: React.FC = () => {
    const { users, warnUser, banUser, unbanUser, currentUser, posts, reports, deletePost, deleteReport } = useAppContext();
    const [activeTab, setActiveTab] = useState<'users' | 'community' | 'reports'>('users');

    if (!currentUser || currentUser.role !== 'admin') return <div className="p-40 text-center text-red-500">403 Forbidden</div>;

    return (
      <div className="max-w-7xl mx-auto px-4 py-24">
        <h1 className="text-6xl font-black uppercase mb-12 text-slate-900 dark:text-white">Admin Command</h1>
        <div className="flex gap-4 mb-12">
            {['users', 'community', 'reports'].map((t: any) => (
                <button key={t} onClick={() => setActiveTab(t)} className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase ${activeTab === t ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`}>{t}</button>
            ))}
        </div>

        {activeTab === 'users' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {users.map(u => (
                    <div key={u.id} className="p-8 bg-white dark:bg-slate-900 border-4 dark:border-slate-800 rounded-[48px]">
                        <h4 className="font-black text-xl text-slate-900 dark:text-white">{u.name} ({u.warnings}/3)</h4>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => warnUser(u.id)} className="bg-amber-100 text-amber-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase">Warn</button>
                            <button onClick={() => u.isBanned ? unbanUser(u.id) : banUser(u.id)} className="bg-rose-100 text-rose-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase">{u.isBanned ? 'Unban' : 'Ban'}</button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {activeTab === 'community' && (
            <div className="space-y-6">
                {posts.map(p => (
                    <div key={p.id} className="p-8 bg-white dark:bg-slate-900 border-4 dark:border-slate-800 rounded-[48px] flex justify-between items-center">
                        <p className="font-bold text-slate-700 dark:text-slate-300">"{p.content}"</p>
                        <button onClick={() => deletePost(p.id)} className="bg-rose-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase">Remove</button>
                    </div>
                ))}
            </div>
        )}

        {activeTab === 'reports' && (
            <div className="space-y-6">
                {reports.map(r => (
                    <div key={r.id} className="p-8 bg-white dark:bg-slate-900 border-4 dark:border-slate-800 rounded-[48px] flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="bg-rose-100 text-rose-600 px-4 py-1 rounded-full text-[10px] font-black uppercase">{r.targetType} reported</span>
                                <p className="text-xl font-black mt-2 text-slate-900 dark:text-white">{r.reason}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => deleteReport(r.id)} className="bg-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase">Dismiss</button>
                            </div>
                        </div>
                    </div>
                ))}
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
    const user = type === 'login' ? login(formData.email, formData.password) : signup(formData); 
    if (user) navigate('/dashboard'); 
  };
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 p-12 rounded-[64px] border-4 dark:border-slate-800 shadow-4xl w-full max-w-md text-center">
        <h2 className="text-4xl font-black uppercase mb-10 text-slate-900 dark:text-white">{type} Node</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          {type === 'signup' && <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Name" className="w-full p-4 rounded-2xl bg-slate-50 border-2 outline-none font-bold" />}
          <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Email" className="w-full p-4 rounded-2xl bg-slate-50 border-2 outline-none font-bold" />
          <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Password" minLength={8} className="w-full p-4 rounded-2xl bg-slate-50 border-2 outline-none font-bold" />
          <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black uppercase text-xs tracking-widest">Confirm</button>
        </form>
      </div>
    </div>
  );
};

const AITestSection: React.FC = () => <div className="p-40 text-center font-black uppercase text-2xl text-slate-900 dark:text-white">Assessment Node Active. Select from Library.</div>;
const LegalPage: React.FC = () => <div className="p-40 text-center text-slate-900 dark:text-white">Legal Node Content Loaded.</div>;
const Profile: React.FC = () => <div className="p-40 text-center text-slate-900 dark:text-white">Scholar Profile Node Active.</div>;

const AIChatbot: React.FC = () => {
    const { isAIChatOpen, setAIChatOpen, currentUser } = useAppContext();
    const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([]);
    const [input, setInput] = useState('');

    if (!currentUser || !isAIChatOpen) return <button onClick={() => setAIChatOpen(true)} className="fixed bottom-10 right-10 bg-indigo-600 text-white w-16 h-16 rounded-full shadow-4xl flex items-center justify-center text-2xl z-[500]">🧠</button>;

    const handleSend = async () => {
      if (!input.trim()) return;
      setMessages(prev => [...prev, { role: 'user', text: input }]);
      setInput('');
      try {
        const apiKey = (window as any).process?.env?.API_KEY || (process?.env?.API_KEY);
        const ai = new GoogleGenAI({ apiKey });
        const res = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: input });
        setMessages(prev => [...prev, { role: 'bot', text: res.text || "Connection Error." }]);
      } catch { setMessages(prev => [...prev, { role: 'bot', text: "Error." }]); }
    };

    return (
      <div className="fixed bottom-10 right-10 z-[1000] w-[400px] h-[550px] bg-white dark:bg-slate-900 rounded-[48px] shadow-4xl border-4 dark:border-slate-800 flex flex-col overflow-hidden">
        <div className="bg-indigo-600 p-6 flex justify-between items-center text-white"><h3 className="font-black uppercase text-[10px]">AI Advisor</h3><button onClick={() => setAIChatOpen(false)}>✕</button></div>
        <div className="flex-grow p-6 overflow-y-auto space-y-4 no-scrollbar">
          {messages.map((m, i) => <div key={i} className={`p-4 rounded-2xl text-xs font-bold ${m.role === 'user' ? 'bg-indigo-600 text-white ml-8' : 'bg-slate-100 text-slate-700 mr-8'}`}>{m.text}</div>)}
        </div>
        <div className="p-6 flex gap-2 border-t"><input value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} placeholder="Ask..." className="flex-grow p-3 bg-slate-50 rounded-xl outline-none" /><button onClick={handleSend} className="bg-indigo-600 text-white px-4 rounded-xl">➔</button></div>
      </div>
    );
};

const Footer: React.FC = () => <footer className="bg-white dark:bg-slate-950 p-20 border-t-4"><p className="text-center text-slate-400 font-black uppercase text-xs">Ranker Study Space • Free Academic Protocol</p></footer>;
