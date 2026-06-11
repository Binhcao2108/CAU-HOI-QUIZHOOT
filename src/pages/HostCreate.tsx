import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Question, Quiz } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { PlusCircle, Trash2, Save, ArrowLeft } from 'lucide-react';

export default function HostCreate() {
  const [title, setTitle] = useState('My Awesome Quiz');
  const [questions, setQuestions] = useState<Question[]>([
    { text: '', options: ['', '', '', ''], timeLimit: 20 }
  ]);
  const [correctAnswers, setCorrectAnswers] = useState<number[]>([0]);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  const addQuestion = () => {
    setQuestions([...questions, { text: '', options: ['', '', '', ''], timeLimit: 20 }]);
    setCorrectAnswers([...correctAnswers, 0]);
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const newQs = [...questions];
    newQs[index] = { ...newQs[index], [field]: value };
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
    if (!auth.currentUser) return;
    try {
      setIsSaving(true);
      const quizRef = doc(collection(db, 'quizzes'));
      const quizId = quizRef.id;

      const quizData = {
        hostId: auth.currentUser.uid,
        title,
        questions,
        createdAt: serverTimestamp(),
      };

      await setDoc(quizRef, quizData).catch(e => {
        handleFirestoreError(e, OperationType.CREATE, `quizzes/${quizId}`);
      });

      // Write private correct answers
      const privateData = { correctAnswers };
      await setDoc(doc(db, 'quizzes', quizId, 'private', 'hostOnly'), privateData).catch(e => {
        handleFirestoreError(e, OperationType.CREATE, `quizzes/${quizId}/private/hostOnly`);
      });

      navigate('/host');
    } catch (err) {
      console.error(err);
      alert("Failed to save quiz. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

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
          <button
            onClick={saveQuiz}
            disabled={isSaving}
            className="bg-[#26890c] hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg shadow-md border-b-4 border-green-900 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2"
          >
            <Save size={20} />
            {isSaving ? 'Saving...' : 'Save & Exit'}
          </button>
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

            <div className="mb-4">
              <label className="text-sm font-bold text-gray-500 mb-2 block">Time Limit</label>
              <select
                value={q.timeLimit}
                onChange={(e) => updateQuestion(qIndex, 'timeLimit', parseInt(e.target.value))}
                className="p-2 border-2 border-gray-200 font-bold text-gray-700 rounded-lg bg-white focus:outline-none focus:border-gray-400"
              >
                <option value={10}>10 seconds</option>
                <option value={20}>20 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {q.options.map((opt, oIndex) => {
                const colors = ['bg-[#e21b3c] hover:opacity-90', 'bg-[#1368ce] hover:opacity-90', 'bg-[#d89e00] hover:opacity-90', 'bg-[#26890c] hover:opacity-90'];
                const isCorrect = correctAnswers[qIndex] === oIndex;
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
                        newCA[qIndex] = oIndex;
                        setCorrectAnswers(newCA);
                      }}
                      className={`absolute left-3 w-8 h-8 flex items-center justify-center rounded-full border-2 transition-all shadow-sm ${isCorrect ? 'bg-white text-green-500 border-white' : 'bg-black/20 text-white/50 border-white/30 hover:border-white hover:text-white group-hover:bg-black/30'}`}
                    >
                      ✓
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
