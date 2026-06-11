import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { LogIn, Plus, Play, LogOut, ArrowLeft } from 'lucide-react';
import { Quiz } from '../types';

export default function HostDashboard() {
  const [user, setUser] = useState(auth.currentUser);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u) {
        fetchQuizzes(u.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchQuizzes = async (userId: string) => {
    try {
      const q = query(collection(db, 'quizzes'), where('hostId', '==', userId));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Quiz));
      setQuizzes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    auth.signOut();
  };

  const playQuiz = async (quiz: Quiz) => {
    if (!user) return;
    try {
      // Fetch private answers
      const privateSnap = await getDoc(doc(db, 'quizzes', quiz.id, 'private', 'hostOnly'));
      const correctAnswers = privateSnap.exists() ? privateSnap.data().correctAnswers : [];

      // Generate a 6-digit PIN string
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      const roomId = pin;

      const roomData = {
        hostId: user.uid,
        pin,
        status: 'waiting',
        gameState: 'question',
        currentQuestionIndex: 0,
        questions: quiz.questions,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'rooms', roomId), roomData).catch(e => {
        handleFirestoreError(e, OperationType.CREATE, `rooms/${roomId}`);
      });

      const privateData = { correctAnswers };
      await setDoc(doc(db, 'rooms', roomId, 'private', 'hostOnly'), privateData).catch(e => {
        handleFirestoreError(e, OperationType.CREATE, `rooms/${roomId}/private/hostOnly`);
      });

      navigate(`/host/room/${roomId}`);
    } catch (err) {
      console.error(err);
      alert("Failed to create game room.");
    }
  };

  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-[#46178f] flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative">
          <button
            onClick={() => navigate('/')}
            className="absolute top-6 left-6 text-gray-400 hover:text-gray-700 transition-colors"
            title="Back to Home"
          >
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-3xl font-black mb-6 text-[#333] italic tracking-tighter mt-4">Host Login</h2>
          <button
            onClick={handleLogin}
            className="w-full bg-[#1368ce] hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg border-b-4 border-black/20 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-3 text-lg"
          >
            <LogIn size={24} />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 rounded-xl transition-colors"
              title="Back to Home"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-black text-[#333] tracking-tighter italic">Library</h1>
              <p className="text-gray-500 font-medium">Logged in as {user?.email}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/host/create')}
              className="bg-[#26890c] hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl shadow-md border-b-4 border-black/20 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2"
            >
              <Plus size={20} />
              Create
            </button>
            <button
              onClick={handleLogout}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 px-4 rounded-xl shadow-sm border-b-4 border-gray-300 active:border-b-0 active:translate-y-1 transition-all flex items-center"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.length === 0 && (
            <div className="col-span-full text-center py-20 bg-white border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 font-bold text-lg">
               You haven't created any quizzes yet. <br /> Click "Create" to get started!
            </div>
          )}
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div>
                <h3 className="text-2xl font-black text-gray-800 mb-2 truncate">{quiz.title}</h3>
                <p className="text-gray-500 font-medium mb-6 uppercase tracking-widest text-sm">{quiz.questions.length} questions</p>
              </div>
              <button
                onClick={() => playQuiz(quiz)}
                className="w-full bg-[#1368ce] hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow border-b-4 border-black/20 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                <Play size={20} />
                Host Game
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
