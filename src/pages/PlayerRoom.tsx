import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Room, Player } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { ArrowLeft, Save, Trophy } from 'lucide-react';

export default function PlayerRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);

  useEffect(() => {
    if (!roomId) return;
    const userId = auth.currentUser?.uid || sessionStorage.getItem('quizhoot_playerId');
    if (!userId) {
      navigate('/');
      return;
    }

    const unsubscribeRoom = onSnapshot(doc(db, 'rooms', roomId), (docSnap) => {
      if (docSnap.exists()) {
        const r = { id: docSnap.id, ...docSnap.data() } as Room;
        setRoom(r);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `rooms/${roomId}`));

    const unsubscribePlayer = onSnapshot(doc(db, 'rooms', roomId, 'players', userId), (docSnap) => {
      if (docSnap.exists()) {
        setPlayer({ id: docSnap.id, ...docSnap.data() } as Player);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `rooms/${roomId}/players/${userId}`));

    const unsubscribePlayers = onSnapshot(collection(db, 'rooms', roomId, 'players'), (snap) => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `rooms/${roomId}/players`));

    return () => {
      unsubscribeRoom();
      unsubscribePlayer();
      unsubscribePlayers();
    };
  }, [roomId, navigate]);

  // Track question start to calculate response time
  useEffect(() => {
    if (room?.status === 'playing' && room.currentQuestionIndex >= 0) {
      // Whenever a new question starts, reset start time
      setQuestionStartTime(Date.now());
    }
  }, [room?.currentQuestionIndex, room?.status]);

  const submitAnswer = async (optionIndex: number) => {
    if (!room || !player) return;
    const responseTime = Date.now() - questionStartTime;
    try {
      await updateDoc(doc(db, 'rooms', room.id, 'players', player.id), {
        currentAnswer: {
          optionIndex,
          responseTime,
          questionIndex: room.currentQuestionIndex
        }
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `rooms/${room.id}/players/${player.id}`);
    }
  };

  if (!room || !player) {
    return <div className="min-h-screen bg-indigo-600 flex items-center justify-center text-white font-bold">Loading...</div>;
  }

  if (room.status === 'waiting') {
    return (
      <div className="min-h-screen bg-[#46178f] flex flex-col items-center justify-center p-4 text-center font-sans select-none text-white relative">
        <h2 className="text-4xl md:text-5xl font-black mb-4 italic tracking-tighter">You're in!</h2>
        <p className="text-xl opacity-80 font-bold">See your nickname on screen</p>
      </div>
    );
  }

  if (room.status === 'finished') {
    const sortedPlayers = [...players].sort((a,b) => b.score - a.score);
    const rank = sortedPlayers.findIndex(p => p.id === player.id) + 1;

    return (
      <div className="min-h-screen bg-[#46178f] flex flex-col items-center justify-center p-4 text-center font-sans select-none text-white relative">
        <h2 className="text-4xl md:text-5xl font-black mb-2 italic tracking-tighter">Game Over!</h2>
        
        {rank > 0 && (
          <div className="flex items-center gap-2 bg-yellow-400 text-yellow-900 px-6 py-2 rounded-full font-bold text-xl mt-4 mb-4 shadow-lg border-b-4 border-yellow-600">
            <Trophy size={24} />
            <span>Rank {rank}</span>
          </div>
        )}

        <div className="bg-white text-[#46178f] py-6 px-10 rounded-3xl shadow-2xl mt-4 border-b-8 border-gray-300">
          <p className="text-lg font-bold text-gray-500 mb-1 uppercase tracking-widest">Your Final Score</p>
          <p className="text-6xl font-black">{player.score}</p>
        </div>
      </div>
    );
  }

  // playing
  const isQuestionActive = room.gameState === 'question';
  const hasAnsweredCurrent = player.currentAnswer?.questionIndex === room.currentQuestionIndex;

  if (hasAnsweredCurrent || !isQuestionActive) {
    return (
      <div className="min-h-screen bg-[#46178f] flex flex-col items-center justify-center p-4 text-center font-sans select-none text-white relative">
        <h2 className="text-3xl md:text-4xl font-black mb-2 italic tracking-tighter opacity-80">
           {!isQuestionActive ? "Look at the screen!" : "Waiting for others..."}
        </h2>
      </div>
    );
  }

  // Show 4 big color blocks to choose answer
  const colors = ['bg-[#e21b3c]', 'bg-[#1368ce]', 'bg-[#d89e00]', 'bg-[#26890c]'];
  const currentQuestion = room.questions[room.currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans select-none relative">
      <div className="bg-white px-6 py-4 shadow-sm flex justify-between items-center z-10 sticky top-0 border-b border-gray-200">
        <p className="font-bold text-gray-800 text-lg md:text-xl tracking-tight">{player.nickname}</p>
        <div className="flex items-center bg-gray-100 rounded-full pl-3 pr-4 py-1.5">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Score</span>
          <span className="text-[#46178f] text-lg font-black">{player.score}</span>
        </div>
      </div>
      
      {currentQuestion && (
        <div className="bg-white px-6 py-8 md:py-12 shadow-sm border-b border-gray-200 text-center flex items-center justify-center min-h-[120px]">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800 leading-tight max-w-4xl mx-auto">{currentQuestion.text}</h2>
        </div>
      )}

      <div className="flex-grow flex items-center justify-center p-4 lg:p-8">
        <div className="grid grid-cols-2 gap-3 lg:gap-4 w-full max-w-4xl h-full pb-4">
          {colors.map((color, i) => (
            currentQuestion?.options[i] ? (
              <button
                key={i}
                className={`${color} rounded-2xl shadow-[0_6px_0_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[6px] transition-all flex flex-col items-center justify-center p-4 md:p-6 text-center hover:brightness-110 h-full min-h-[160px] group`}
                onClick={() => submitAnswer(i)}
              >
                <div className="mb-4 drop-shadow-md transform group-hover:scale-110 transition-transform">
                  {i === 0 && <div className="w-8 h-8 md:w-10 md:h-10 border-[3px] md:border-4 border-white rotate-45"></div>}
                  {i === 1 && <div className="w-8 h-8 md:w-10 md:h-10 border-[3px] md:border-4 border-white rounded-full"></div>}
                  {i === 2 && <div className="w-8 h-8 md:w-10 md:h-10 border-[3px] md:border-4 border-white"></div>}
                  {i === 3 && <div className="w-0 h-0 border-l-[14px] md:border-l-[18px] border-l-transparent border-r-[14px] md:border-r-[18px] border-r-transparent border-b-[24px] md:border-b-[32px] border-b-white"></div>}
                </div>
                <span className="text-white font-bold text-lg md:text-xl drop-shadow-md leading-tight">{currentQuestion.options[i]}</span>
              </button>
            ) : null
          ))}
        </div>
      </div>
    </div>
  );
}
