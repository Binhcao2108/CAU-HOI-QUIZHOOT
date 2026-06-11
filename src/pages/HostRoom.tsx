import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, collection, onSnapshot, updateDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Room, Player } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { Users, Trophy, ChevronRight, Play, ArrowLeft, XCircle, Download } from 'lucide-react';

export default function HostRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState<(number | number[])[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only check roomId
    if (!roomId) return;
    
    const unsubscribeRoom = onSnapshot(doc(db, 'rooms', roomId), (docSnap) => {
      if (docSnap.exists()) {
        const r = { id: docSnap.id, ...docSnap.data() } as Room;
        setRoom(r);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `rooms/${roomId}`));

    const unsubscribePlayers = onSnapshot(collection(db, 'rooms', roomId, 'players'), (snap) => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/players`));

    getDoc(doc(db, 'rooms', roomId, 'private', 'hostOnly'))
      .then(snap => {
        if (snap.exists()) setCorrectAnswers(snap.data().correctAnswers);
      })
      .catch(e => handleFirestoreError(e, OperationType.GET, `rooms/${roomId}/private/hostOnly`));

    return () => {
      unsubscribeRoom();
      unsubscribePlayers();
    };
  }, [roomId]);

  // Timer logic
  useEffect(() => {
    if (room?.status === 'playing' && room?.gameState === 'question' && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (room?.status === 'playing' && room?.gameState === 'question' && timeLeft === 0) {
      handleTimeUp();
    } else if (room?.status === 'playing' && room?.gameState === 'preview' && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (room?.status === 'playing' && room?.gameState === 'preview' && timeLeft === 0) {
      if (room.questions && room.questions[room.currentQuestionIndex]) {
        setTimeLeft(room.questions[room.currentQuestionIndex].timeLimit);
      }
      updateDoc(doc(db, 'rooms', room.id), { gameState: 'question' }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `rooms/${room.id}`));
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [room?.status, room?.gameState, timeLeft, room?.currentQuestionIndex, room?.id, room?.questions]);

  // Check if all players answered
  useEffect(() => {
    if (room?.status === 'playing' && room?.gameState === 'question' && players.length > 0) {
      const currentQ = room.questions[room.currentQuestionIndex];
      const allAnswered = players.every(p => p.currentAnswer?.questionIndex === room.currentQuestionIndex);
      if (allAnswered) {
        handleTimeUp();
      }
    }
  }, [players, room]);

  const startGame = async () => {
    if (!room) return;
    try {
      setTimeLeft(10);
      await updateDoc(doc(db, 'rooms', room.id), {
        status: 'playing',
        gameState: 'preview',
        currentQuestionIndex: 0
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `rooms/${room.id}`);
    }
  };

  const handleTimeUp = async () => {
    if (!room) return;
    
    // Calculate and assign scores
    try {
      const batch = writeBatch(db);
      players.forEach(p => {
        if (p.currentAnswer?.questionIndex === room.currentQuestionIndex) {
          const expectedAnswer = correctAnswers[room.currentQuestionIndex];
          const isMultiple = Array.isArray(expectedAnswer);
          
          let isCorrect = false;
          if (isMultiple) {
            const playerIndexes = p.currentAnswer.optionIndexes || (p.currentAnswer.optionIndex !== undefined ? [p.currentAnswer.optionIndex] : []);
            const exactMatch = playerIndexes.length === expectedAnswer.length && playerIndexes.every(idx => expectedAnswer.includes(idx));
            isCorrect = exactMatch;
          } else {
            isCorrect = p.currentAnswer.optionIndex === expectedAnswer;
          }

          let newScore = p.score;
          if (isCorrect) {
            const timeLimit = room.questions[room.currentQuestionIndex].timeLimit;
            const multiplier = room.questions[room.currentQuestionIndex].pointsMultiplier || 1;
            // Kahoot formula: 500 + 500 * (1 - responseTime / timeLimit)
            const pts = Math.max(0, 500 + 500 * (1 - (p.currentAnswer.responseTime / 1000) / timeLimit));
            newScore = p.score + Math.round(pts * multiplier);
          }
          
          batch.update(doc(db, 'rooms', room.id, 'players', p.id), { 
            score: newScore,
            [`answerHistory.${room.currentQuestionIndex}`]: {
              optionIndex: p.currentAnswer.optionIndex !== undefined ? p.currentAnswer.optionIndex : null,
              optionIndexes: p.currentAnswer.optionIndexes || null,
              isCorrect
            }
          });
        } else {
           // Did not answer
           batch.update(doc(db, 'rooms', room.id, 'players', p.id), {
             [`answerHistory.${room.currentQuestionIndex}`]: {
               optionIndex: -1,
               isCorrect: false
             }
           });
        }
      });
      
      // Update room state to answer
      batch.update(doc(db, 'rooms', room.id), { gameState: 'answer' });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${room.id}/players`);
    }
  };

  const nextQuestionOrLeaderboard = () => {
    if (!room) return;
    if (room.gameState === 'answer') {
      updateDoc(doc(db, 'rooms', room.id), { gameState: 'leaderboard' })
        .catch(e => handleFirestoreError(e, OperationType.UPDATE, `rooms/${room.id}`));
    } else if (room.gameState === 'leaderboard') {
      if (room.currentQuestionIndex < room.questions.length - 1) {
        const nextIndex = room.currentQuestionIndex + 1;
        setTimeLeft(10);
        updateDoc(doc(db, 'rooms', room.id), { 
           currentQuestionIndex: nextIndex,
           gameState: 'preview'
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `rooms/${room.id}`));
      } else {
        updateDoc(doc(db, 'rooms', room.id), { status: 'finished' })
          .catch(e => handleFirestoreError(e, OperationType.UPDATE, `rooms/${room.id}`));
      }
    }
  };

  const forceEndGame = async () => {
    if (!room) return;
    try {
      await updateDoc(doc(db, 'rooms', room.id), { status: 'finished' });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `rooms/${room.id}`);
    }
  };

  const exportResults = () => {
    if (!room || !players) return;
    
    // Create the CSV data header with UTF-8 BOM for proper Excel rendering
    let csvData = '\uFEFFPlayer Name,Score,Correct Answers,Incorrect Answers,';
    
    // Add Question headers
    room.questions.forEach((q, i) => {
      csvData += `Q${i + 1} (${q.text.replace(/,/g, '')}),`;
    });
    csvData += '\n';
    
    // Rows
    const sorted = [...players].sort((a,b) => b.score - a.score);
    sorted.forEach(p => {
      let correct = 0;
      let incorrect = 0;
      let qStatuses = '';
      
      room.questions.forEach((q, i) => {
        const h = p.answerHistory?.[i];
        if (h && h.isCorrect) {
          correct++;
          qStatuses += 'Correct,';
        } else if (h && (h.optionIndex !== -1 || h.optionIndexes?.length)) {
          incorrect++;
          qStatuses += 'Incorrect,';
        } else {
          incorrect++;
          qStatuses += 'Missed,';
        }
      });
      
      csvData += `${p.nickname.replace(/,/g, '')},${p.score},${correct},${incorrect},${qStatuses}\n`;
    });
    
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `quiz_results_${room.pin}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!room) return <div className="min-h-screen flex items-center justify-center font-bold text-2xl">Loading Room...</div>;

  const currentQ = room.questions[room.currentQuestionIndex] || room.questions[0];
  const answeredCount = players.filter(p => p.currentAnswer?.questionIndex === room.currentQuestionIndex).length;

  if (room.status === 'waiting') {
    return (
      <div className="min-h-screen bg-[#46178f] flex flex-col p-8 items-center text-white font-sans select-none relative">
        <button onClick={() => navigate(-1)} className="absolute top-6 left-6 bg-white/20 hover:bg-white/30 text-white font-bold py-2 px-4 rounded-xl shadow-lg border-b-4 border-black/20 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2 z-50">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter italic">Join at the screen with PIN:</h1>
        <div className="flex flex-col items-center mb-12">
          <div className="text-6xl md:text-8xl font-black bg-white text-[#46178f] py-6 px-12 rounded-3xl tracking-widest shadow-2xl border-b-8 border-gray-300">
            {room.pin}
          </div>
          <a href={`/join/${room.pin}`} target="_blank" rel="noopener noreferrer" className="mt-4 bg-white/20 hover:bg-white/30 text-white font-bold py-3 px-6 rounded-xl shadow-lg border border-white/20 transition-colors flex items-center gap-2">
            Click to join as player <ChevronRight size={20} />
          </a>
        </div>
        
        <div className="flex w-full max-w-5xl justify-between items-center mb-8">
          <div className="flex items-center text-2xl font-bold bg-white/10 backdrop-blur-sm border border-white/20 px-6 py-3 rounded-xl shadow-lg">
            <Users className="mr-3" /> {players.length} Players
          </div>
          <button 
            onClick={startGame}
            disabled={players.length === 0}
            className="bg-[#26890c] hover:bg-green-600 disabled:opacity-50 text-white font-bold text-2xl py-4 px-8 rounded-2xl shadow-lg border-b-4 border-black/20 active:border-b-0 active:translate-y-1 transition-all"
          >
            Start Game
          </button>
        </div>

        <div className="w-full max-w-5xl grid grid-cols-2 md:grid-cols-4 gap-4">
          {players.map(p => (
            <div key={p.id} className="bg-white/10 border border-white/20 backdrop-blur-sm shadow-md text-xl font-bold p-4 rounded-xl text-center truncate">
              {p.nickname}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (room.gameState === 'preview') {
    return (
      <div className="min-h-screen bg-[#46178f] flex flex-col items-center justify-center p-4 md:p-8 font-sans select-none text-white relative">
        <div className="animate-pulse flex flex-col items-center">
          <span className="text-xl md:text-2xl font-black tracking-[0.2em] mb-4 opacity-50 uppercase">Get Ready</span>
          <h1 className="text-4xl md:text-6xl font-black mb-12 text-center leading-tight max-w-4xl">{currentQ.text}</h1>
          <div className="w-32 h-32 md:w-48 md:h-48 border-8 border-white rounded-full flex items-center justify-center shadow-xl">
            <span className="text-6xl md:text-8xl font-black">{timeLeft}</span>
          </div>
        </div>
      </div>
    );
  }

  if (room.status === 'finished') {
    const sorted = [...players].sort((a,b) => b.score - a.score);
    return (
      <div className="min-h-screen bg-[#46178f] flex flex-col items-center p-8 text-white font-sans select-none relative">
        <button onClick={() => navigate('/')} className="absolute top-6 left-6 bg-white/20 hover:bg-white/30 text-white font-bold py-2 px-4 rounded-xl shadow-lg border-b-4 border-black/20 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2 z-50">
          <ArrowLeft size={16} /> Home
        </button>
        <Trophy size={80} className="mb-6 text-yellow-400 drop-shadow-lg" />
        <h1 className="text-5xl md:text-6xl font-black mb-12 text-white italic tracking-tighter">Podium</h1>
        <div className="flex items-end gap-2 md:gap-4 max-w-4xl w-full justify-center">
          {sorted[1] && <div className="bg-[#1368ce] flex flex-col items-center justify-end w-32 md:w-40 rounded-t-xl pb-4 font-bold h-40 md:h-48 text-white shadow-lg border-x-4 border-t-4 border-black/20">
            <div className="text-xl md:text-2xl truncate px-2">{sorted[1].nickname}</div>
            <div className="text-lg md:text-xl opacity-80">{sorted[1].score}</div>
          </div>}
          {sorted[0] && <div className="bg-[#d89e00] flex flex-col items-center justify-end w-40 md:w-48 rounded-t-xl pb-4 font-bold h-56 md:h-64 text-white shadow-2xl z-10 border-x-4 border-t-4 border-black/20">
            <div className="text-2xl md:text-3xl truncate px-2">{sorted[0].nickname}</div>
            <div className="text-xl md:text-2xl opacity-80">{sorted[0].score}</div>
          </div>}
          {sorted[2] && <div className="bg-[#26890c] flex flex-col items-center justify-end w-32 md:w-40 rounded-t-xl pb-4 font-bold h-32 md:h-36 text-white shadow-lg border-x-4 border-t-4 border-black/20">
            <div className="text-xl md:text-2xl truncate px-2">{sorted[2].nickname}</div>
            <div className="text-lg md:text-xl opacity-80">{sorted[2].score}</div>
          </div>}
        </div>
        <div className="mt-16 flex gap-4">
          <button onClick={exportResults} className="bg-green-500 text-white font-bold py-4 px-8 rounded-full shadow-lg hover:bg-green-600 transition-colors text-lg border-b-4 border-green-700 active:translate-y-1 active:border-b-0 flex items-center gap-2">
            <Download size={24} /> Export Results (CSV)
          </button>
          <button onClick={() => navigate('/')} className="bg-white text-[#46178f] font-bold py-4 px-8 rounded-full shadow-lg hover:scale-105 transition-transform text-lg border-b-4 border-gray-300 active:translate-y-1 active:border-b-0">Exit to Home</button>
        </div>
      </div>
    );
  }

  if (room.gameState === 'leaderboard') {
    const sorted = [...players].sort((a,b) => b.score - a.score).slice(0, 5);
    return (
      <div className="min-h-screen bg-[#46178f] flex flex-col items-center p-4 md:p-8 font-sans select-none text-white relative">
        <button onClick={forceEndGame} className="absolute top-6 left-6 bg-red-500/20 hover:bg-red-500/40 text-white font-bold py-2 px-4 rounded-xl shadow-lg border-b-4 border-black/20 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2 z-50">
          <XCircle size={16} /> End Game
        </button>
        <div className="w-full flex justify-between items-center mb-8 max-w-4xl bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 mt-12">
          <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter">Leaderboard</h1>
          <button onClick={nextQuestionOrLeaderboard} className="bg-white text-[#46178f] font-bold py-3 px-6 rounded-xl flex items-center shadow-lg border-b-4 border-gray-300 active:translate-y-1 active:border-b-0 hover:bg-gray-50 transition-all">
            Next <ChevronRight className="ml-2" />
          </button>
        </div>
        <div className="w-full max-w-2xl space-y-4">
          {sorted.map((p, i) => (
            <div key={p.id} className="bg-black/20 p-4 md:p-6 rounded-2xl flex justify-between items-center border border-white/10 shadow-lg transform transition-all duration-300 hover:scale-[1.02]">
              <div className="flex items-center">
                <span className={`text-2xl italic font-black w-12 ${i === 0 ? 'text-yellow-400' : 'text-white/50'}`}>{i + 1}</span>
                <span className="text-xl md:text-2xl font-bold text-white">{p.nickname}</span>
              </div>
              <span className="text-xl md:text-2xl font-black text-white">{p.score}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // showing_question or showing_answer
  const isShowAnswer = room.gameState === 'answer';
  const expectedAnswer = correctAnswers[room.currentQuestionIndex];
  
  const isCorrectHelper = (index: number) => {
    if (Array.isArray(expectedAnswer)) {
      return expectedAnswer.includes(index);
    }
    return expectedAnswer === index;
  };
  
  const colors = ['bg-[#e21b3c]', 'bg-[#1368ce]', 'bg-[#d89e00]', 'bg-[#26890c]'];
  const shapes = [
    <svg className="w-10 h-10 md:w-16 md:h-16 text-white drop-shadow-lg transform group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l10 10-10 10L2 12 12 2z"/></svg>,
    <svg className="w-10 h-10 md:w-16 md:h-16 text-white drop-shadow-lg transform group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>,
    <svg className="w-10 h-10 md:w-16 md:h-16 text-white drop-shadow-lg transform group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>,
    <svg className="w-10 h-10 md:w-16 md:h-16 text-white drop-shadow-lg transform group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2z"/></svg>
  ];

  return (
    <div className="min-h-screen bg-[#46178f] text-white p-4 md:p-6 flex flex-col font-sans select-none overflow-hidden relative">
      <button onClick={forceEndGame} className="absolute top-6 left-6 bg-red-500/20 hover:bg-red-500/40 text-red-100 font-bold py-2 px-4 rounded-xl shadow-lg border-b-4 border-black/20 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2 z-50">
        <XCircle size={16} /> End Game
      </button>
      <header className="flex justify-between items-center mb-6 h-16 bg-white/10 backdrop-blur-md rounded-2xl px-4 md:px-8 border border-white/20 flex-shrink-0 mt-12">
        <div className="flex items-center gap-4">
          <div className="hidden md:flex w-10 h-10 bg-white rounded-lg items-center justify-center">
            <div className="w-6 h-6 bg-[#46178f] rounded-sm"></div>
          </div>
          <span className="text-xl md:text-2xl font-black tracking-tighter italic">QUIZHOOT!</span>
        </div>
        <div className="flex items-center bg-[#2d0f5a] px-4 md:px-6 py-2 rounded-xl border border-white/10 hidden md:flex">
          <span className="text-sm uppercase tracking-widest opacity-60 mr-4 font-bold">Game PIN:</span>
          <span className="text-3xl font-black tracking-widest">{room.pin}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">{answeredCount} Answers</span>
          {isShowAnswer && (
            <button onClick={nextQuestionOrLeaderboard} className="bg-white text-[#46178f] font-bold py-1 px-4 rounded-full flex items-center shadow-lg hover:scale-105 transition-transform text-sm">
              Next <ChevronRight className="ml-1" size={16} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-4 mb-4 md:gap-6 md:mb-6 min-h-0">
        <div className="flex-1 bg-white rounded-3xl p-6 md:p-10 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gray-200">
            <div className="h-full bg-[#1368ce] transition-all duration-1000" style={{ width: `${(timeLeft / (room.questions[room.currentQuestionIndex]?.timeLimit || 1)) * 100}%` }}></div>
          </div>
          <span className="text-[#333] text-xs md:text-sm font-black uppercase tracking-[0.2em] mb-4 opacity-50 flex items-center gap-2">
            Question {room.currentQuestionIndex + 1} of {room.questions.length}
            {currentQ.pointsMultiplier === 2 && (
              <span className="bg-purple-100 text-[#46178f] px-2 py-0.5 rounded-md">2x Points</span>
            )}
            {currentQ.type === 'multiple' && (
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">Multi-Select</span>
            )}
          </span>
          <h1 className="text-[#333] text-2xl md:text-4xl font-black leading-tight max-w-3xl px-4">{currentQ.text}</h1>
          
          {!isShowAnswer ? (
             <div className="absolute top-4 md:top-6 right-4 md:right-6 w-12 h-12 md:w-16 md:h-16 border-4 md:border-[6px] border-[#46178f] rounded-full flex items-center justify-center">
               <span className="text-xl md:text-2xl font-black text-[#46178f]">{timeLeft}</span>
             </div>
          ) : (
            <div className="mt-8 text-2xl font-black text-green-500 uppercase tracking-widest">
              Time's Up!
            </div>
          )}
        </div>
      </main>

      <footer className="grid grid-cols-2 gap-2 md:gap-4 h-auto md:h-[240px] flex-shrink-0">
        {[0, 1, 2, 3].map(i => (
          currentQ.options[i] ? (
            <div key={i} className={`${colors[i]} ${isShowAnswer && !isCorrectHelper(i) ? 'opacity-30' : 'opacity-100'} rounded-2xl flex flex-col md:flex-row items-center justify-center md:justify-start p-4 md:p-6 gap-2 md:gap-4 shadow-lg border-b-4 border-black/20 transition-opacity duration-300 relative`}>
              {shapes[i]}
              <span className="text-sm md:text-2xl font-bold break-words text-center md:text-left">{currentQ.options[i]}</span>
              {isShowAnswer && isCorrectHelper(i) && (
                <div className="absolute top-2 right-2 md:top-4 md:right-4">
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-white text-green-500 rounded-full flex items-center justify-center text-xl">✓</div>
                </div>
              )}
            </div>
          ) : null
        ))}
      </footer>
    </div>
  );
}

