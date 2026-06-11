import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, setDoc, getDoc, serverTimestamp, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { Question, Quiz } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { PlusCircle, Trash2, Save, ArrowLeft, Download } from 'lucide-react';

export default function HostCreate() {
  const { quizId } = useParams<{ quizId: string }>();
  const [title, setTitle] = useState('My Awesome Quiz');
  const [questions, setQuestions] = useState<Question[]>([
    { text: '', options: ['', '', '', ''], timeLimit: 20, type: 'single', pointsMultiplier: 1 }
  ]);
  const [correctAnswers, setCorrectAnswers] = useState<(number | number[])[]>([0]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!!quizId);
  const navigate = useNavigate();

  useEffect(() => {
    if (!quizId) return;
    const fetchQuiz = async () => {
      try {
        const quizSnap = await getDoc(doc(db, 'quizzes', quizId));
        if (quizSnap.exists()) {
          const quizData = quizSnap.data();
          setTitle(quizData.title);
          setQuestions(quizData.questions.map((q: any) => ({
            ...q,
            type: q.type || 'single',
            pointsMultiplier: q.pointsMultiplier || 1
          })));
          
          const privateSnap = await getDoc(doc(db, 'quizzes', quizId, 'private', 'hostOnly'));
          if (privateSnap.exists()) {
            setCorrectAnswers(privateSnap.data().correctAnswers || Array(quizData.questions.length).fill(0));
          } else {
             setCorrectAnswers(Array(quizData.questions.length).fill(0));
          }
        }
      } catch (err) {
         console.error("Failed to load quiz", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuiz();
  }, [quizId]);

  const getOrCreateHostId = () => {
    let hostId = localStorage.getItem('quizhoot_hostId');
    if (!hostId) {
      hostId = 'host_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('quizhoot_hostId', hostId);
    }
    return hostId;
  };

  const exportQuiz = () => {
    const quizData = {
      title,
      questions,
      correctAnswers
    };
    const blob = new Blob([JSON.stringify(quizData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'quiz'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const addQuestion = () => {
    setQuestions([...questions, { text: '', options: ['', '', '', ''], timeLimit: 20, type: 'single', pointsMultiplier: 1 }]);
    setCorrectAnswers([...correctAnswers, 0]);
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const newQs = [...questions];
    newQs[index] = { ...newQs[index], [field]: value };
    // If switching from multiple to single, reset correctAnswers to the first selection or 0
    if (field === 'type') {
      const newCA = [...correctAnswers];
      if (value === 'single' && Array.isArray(newCA[index])) {
        newCA[index] = (newCA[index] as number[]).length > 0 ? (newCA[index] as number[])[0] : 0;
        setCorrectAnswers(newCA);
      } else if (value === 'multiple' && !Array.isArray(newCA[index])) {
        newCA[index] = [newCA[index] as number];
        setCorrectAnswers(newCA);
      }
    }
    setQuestions(newQs);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const newQs = [...questions];
    const newOptions = [...newQs[qIndex].options];
    newOptions[oIndex] = value;
    newQs[qIndex] = { ...newQs[qIndex], options: newOptions };
    setQuestions(newQs);
  };

  const removeQuestion = (index: number) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
    setCorrectAnswers(correctAnswers.filter((_, i) => i !== index));
  };

  const saveQuiz = async () => {
    const hostId = getOrCreateHostId();
    try {
      setIsSaving(true);
      const quizRef = quizId ? doc(db, 'quizzes', quizId) : doc(collection(db, 'quizzes'));
      const finalQuizId = quizRef.id;

      const quizData: any = {
        hostId,
        title,
        questions,
      };
      
      if (!quizId) {
        quizData.createdAt = serverTimestamp();
      }

      await setDoc(quizRef, quizData, { merge: true }).catch(e => {
        handleFirestoreError(e, OperationType.UPDATE, `quizzes/${finalQuizId}`);
      });

      // Write private correct answers
      const privateData = { correctAnswers };
      await setDoc(doc(db, 'quizzes', finalQuizId, 'private', 'hostOnly'), privateData, { merge: true }).catch(e => {
        handleFirestoreError(e, OperationType.UPDATE, `quizzes/${finalQuizId}/private/hostOnly`);
      });

      navigate('/host');
    } catch (err) {
      console.error(err);
      alert("Failed to save quiz. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans pb-12">
      <header className="bg-white shadow-sm sticky top-0 z-50 p-4 border-b border-gray-200">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/host')}
              className="text-gray-500 hover:bg-gray-100 p-2 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="text-2xl font-black text-gray-800 outline-none hover:bg-gray-100 focus:bg-gray-100 px-3 py-1 rounded-lg w-full max-w-sm" 
            />
          </div>
          <div className="flex gap-4">
            <button
              onClick={exportQuiz}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-md border-b-4 border-blue-900 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2"
            >
              <Download size={20} />
              Export JSON
            </button>
            <button
              onClick={saveQuiz}
              disabled={isSaving}
              className="bg-[#26890c] hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg shadow-md border-b-4 border-green-900 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2"
            >
              <Save size={20} />
              {isSaving ? 'Saving...' : 'Save & Exit'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full px-4 mt-8 space-y-6">
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-gray-400 uppercase tracking-widest text-sm">Question {qIndex + 1}</h3>
              <button
                onClick={() => removeQuestion(qIndex)}
                className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                disabled={questions.length === 1}
              >
                <Trash2 size={20} />
              </button>
            </div>

            <input
              type="text"
              placeholder="Start typing your question..."
              value={q.text}
              onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
              className="w-full text-xl font-bold p-4 bg-gray-50 rounded-xl mb-4 border-2 border-transparent focus:border-gray-300 focus:outline-none focus:bg-white transition-colors"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 bg-gray-50 p-4 rounded-xl">
              <div>
                <label className="text-sm font-bold text-gray-500 mb-2 block">Time Limit</label>
                <select
                  value={q.timeLimit}
                  onChange={(e) => updateQuestion(qIndex, 'timeLimit', parseInt(e.target.value))}
                  className="w-full p-2 border-2 border-gray-200 font-bold text-gray-700 rounded-lg bg-white focus:outline-none focus:border-gray-400"
                >
                  <option value={10}>10 seconds</option>
                  <option value={20}>20 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>60 seconds</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-500 mb-2 block">Question Type</label>
                <select
                  value={q.type || 'single'}
                  onChange={(e) => updateQuestion(qIndex, 'type', e.target.value)}
                  className="w-full p-2 border-2 border-gray-200 font-bold text-gray-700 rounded-lg bg-white focus:outline-none focus:border-gray-400"
                >
                  <option value="single">Single Select</option>
                  <option value="multiple">Multi-Select</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-500 mb-2 block">Points</label>
                <select
                  value={q.pointsMultiplier || 1}
                  onChange={(e) => updateQuestion(qIndex, 'pointsMultiplier', parseInt(e.target.value))}
                  className="w-full p-2 border-2 border-gray-200 font-bold text-gray-700 rounded-lg bg-white focus:outline-none focus:border-gray-400"
                >
                  <option value={1}>Standard (1x)</option>
                  <option value={2}>Double (2x)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {q.options.map((opt, oIndex) => {
                const colors = ['bg-[#e21b3c] hover:opacity-90', 'bg-[#1368ce] hover:opacity-90', 'bg-[#d89e00] hover:opacity-90', 'bg-[#26890c] hover:opacity-90'];
                
                const isCorrect = Array.isArray(correctAnswers[qIndex]) 
                  ? (correctAnswers[qIndex] as number[]).includes(oIndex)
                  : correctAnswers[qIndex] === oIndex;

                return (
                  <div key={oIndex} className="relative flex items-center group">
                    <input
                      type="text"
                      placeholder={`Answer ${oIndex + 1}`}
                      value={opt}
                      onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                      className={`w-full p-4 pl-12 rounded-xl text-white font-bold placeholder-white/70 focus:outline-none border-b-4 border-black/20 focus:border-b-0 focus:translate-y-1 transition-all shadow-sm ${colors[oIndex]} ${isCorrect ? 'ring-4 ring-offset-2 ring-gray-800' : ''}`}
                    />
                    <button
                      title="Mark as correct"
                      onClick={() => {
                        const newCA = [...correctAnswers];
                        if (q.type === 'multiple') {
                           let currentArr = Array.isArray(newCA[qIndex]) ? [...(newCA[qIndex] as number[])] : [newCA[qIndex] as number];
                           if (currentArr.includes(oIndex)) {
                             currentArr = currentArr.filter(c => c !== oIndex);
                           } else {
                             currentArr.push(oIndex);
                           }
                           newCA[qIndex] = currentArr;
                        } else {
                           newCA[qIndex] = oIndex;
                        }
                        setCorrectAnswers(newCA);
                      }}
                      className={`absolute left-3 w-8 h-8 flex items-center justify-center ${q.type === 'multiple' ? 'rounded-md' : 'rounded-full'} border-2 transition-all shadow-sm ${isCorrect ? 'bg-white text-green-500 border-white' : 'bg-black/20 text-white/50 border-white/30 hover:border-white hover:text-white group-hover:bg-black/30'}`}
                    >
                      {isCorrect && '✓'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <button
          onClick={addQuestion}
          className="w-full py-6 bg-white border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center text-gray-500 hover:text-[#46178f] hover:border-[#46178f] transition-all gap-2 font-bold"
        >
          <PlusCircle size={28} />
          Add Question
        </button>
      </main>
    </div>
  );
}
