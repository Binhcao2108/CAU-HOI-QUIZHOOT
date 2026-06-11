import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { ArrowLeft, Save } from 'lucide-react';

export default function PlayerJoin() {
  const { pin } = useParams<{ pin: string }>();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Validate PIN
    if (!pin) return;
    getDoc(doc(db, 'rooms', pin)).then(snap => {
      if (!snap.exists()) {
        setError('Room not found');
      }
    }).catch(e => setError('Error finding room'));
  }, [pin]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || !nickname.trim() || error) return;
    setLoading(true);
    try {
      // 1. Anon Sign In or Use current user
      let playerId = auth.currentUser?.uid;
      if (!playerId) {
        try {
          const cred = await signInAnonymously(auth);
          playerId = cred.user.uid;
        } catch (authErr) {
          console.warn("Anonymous auth failed, using a generated random ID instead.", authErr);
          playerId = 'anon_' + Math.random().toString(36).substring(2, 15);
        }
      }
      
      sessionStorage.setItem('quizhoot_playerId', playerId);

      // 2. Create player document
      const playerRef = doc(db, 'rooms', pin, 'players', playerId);
      await setDoc(playerRef, {
        roomId: pin,
        nickname: nickname.trim(),
        score: 0,
        joinedAt: serverTimestamp()
      });

      // 3. Navigate
      navigate(`/play/${pin}`);
    } catch (err: any) {
      console.error(err);
      setError('Failed to join game: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#46178f] flex items-center justify-center p-4 font-sans select-none relative">
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
        <h1 className="text-3xl font-black text-[#333] mb-6 italic tracking-tighter">QUIZHOOT!</h1>
        {error && (
          <div className="text-red-500 font-bold mb-4">{error}</div>
        )}
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="bg-gray-100 p-4 rounded-xl font-bold text-gray-400 tracking-widest text-lg border-2 border-dashed border-gray-200">
            PIN: {pin}
          </div>
            <input
              type="text"
              required
              maxLength={20}
              placeholder="Nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full p-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#46178f] transition-colors text-xl text-center font-bold"
            />
            <button
              type="submit"
              disabled={loading || !nickname.trim()}
              className="w-full bg-[#333] hover:bg-black disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all text-xl shadow-lg border-b-4 border-black/20 active:border-b-0 active:translate-y-1"
            >
              Enter
            </button>
        </form>
      </div>
    </div>
  );
}
