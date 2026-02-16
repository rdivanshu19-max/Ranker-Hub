
export type Role = 'admin' | 'student';

export interface AISettings {
  icon: string;
  theme: 'indigo' | 'rose' | 'emerald' | 'amber' | 'slate';
  personality: 'scholarly' | 'encouraging' | 'creative' | 'socratic';
}

export interface DailyTarget {
  id: string;
  text: string;
  completed: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: Role;
  photoUrl?: string;
  warnings: number;
  isBanned: boolean;
  isMuted: boolean;
  muteUntil?: number;
  downloadHistory: { materialId: string; materialTitle: string; date: number }[];
  aiSettings?: AISettings;
  dailyTargets?: DailyTarget[];
  performanceStats?: {
    weeklyHours: number[]; // 7 days
    streak: number;
    accuracyTrend: number[]; // Last 5 tests
    chapterProficiency: Record<string, 'weak' | 'moderate' | 'strong'>;
  };
}

export interface Material {
  id: string;
  title: string;
  description: string;
  category: 'PDF' | 'Lecture' | 'Note' | 'Test' | 'Video';
  fileName: string;
  uploadDate: string;
  downloads: number;
  ratings: { userId: string; score: number }[];
  comments: Comment[];
  reports: number;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: number;
  likedBy: string[]; // Track user IDs who liked
  likes: number; // For backward compatibility/caching
  reports: number;
  comments: Comment[];
  isEdited?: boolean;
  isPinned?: boolean;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: number;
  reports: number;
  likedBy: string[]; // Track user IDs who liked
  likes: number;
  replies: Comment[];
  isPinned?: boolean;
}

export interface Report {
  id: string;
  targetId: string;
  targetType: 'post' | 'comment' | 'material_comment' | 'material';
  reporterId: string;
  reason: string;
  timestamp: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  subject?: string;
  chapter?: string;
}

export interface QuizSession {
  id: string;
  title: string;
  questions: QuizQuestion[];
  startTime: number;
  type: 'chapter' | 'subject' | 'full_mock' | 'pyq';
  exam: 'JEE' | 'NEET';
  durationLimit?: number; // in seconds
}
