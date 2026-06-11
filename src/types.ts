export interface Question {
  text: string;
  options: string[];
  timeLimit: number;
}

export interface Quiz {
  id: string;
  hostId: string;
  title: string;
  questions: Question[];
  createdAt: number;
}

export interface Room {
  id: string; // The PIN
  hostId: string;
  pin: string;
  status: 'waiting' | 'playing' | 'finished';
  gameState: 'question' | 'answer' | 'leaderboard';
  currentQuestionIndex: number;
  questions: Question[];
  createdAt: number;
}

export interface Player {
  id: string;
  roomId: string;
  nickname: string;
  score: number;
  joinedAt: number;
  currentAnswer?: {
    optionIndex: number;
    responseTime: number;
    questionIndex: number;
  } | null;
}

export interface Answer {
  optionIndex: number;
  responseTime: number;
  submittedAt: number;
}
