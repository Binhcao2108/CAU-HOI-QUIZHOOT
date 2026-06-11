export interface Question {
  text: string;
  options: string[];
  timeLimit: number;
  type?: 'single' | 'multiple';
  pointsMultiplier?: number;
}

export interface Quiz {
  id: string;
  hostId: string;
  title: string;
  questions: Question[];
  createdAt: number;
  hideQuestionsOnPlayerDevice?: boolean;
  previewTimeLimit?: number;
}

export interface Room {
  id: string; // The PIN
  hostId: string;
  pin: string;
  status: 'waiting' | 'playing' | 'finished';
  gameState: 'preview' | 'question' | 'answer' | 'leaderboard';
  currentQuestionIndex: number;
  questions: Question[];
  createdAt: number;
  hideQuestionsOnPlayerDevice?: boolean;
  autoAdvance?: boolean;
  isPaused?: boolean;
  previewTimeLimit?: number;
}

export interface Player {
  id: string;
  roomId: string;
  nickname: string;
  score: number;
  joinedAt: number;
  currentAnswer?: {
    optionIndex?: number;
    optionIndexes?: number[];
    responseTime: number;
    questionIndex: number;
  } | null;
  answerHistory?: {
    [questionIndex: number]: {
      optionIndex?: number;
      optionIndexes?: number[];
      isCorrect: boolean;
    }
  };
}

export interface Answer {
  optionIndex?: number;
  optionIndexes?: number[];
  responseTime: number;
  submittedAt: number;
}
