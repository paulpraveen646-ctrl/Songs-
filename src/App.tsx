/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Component } from 'react';
import { 
  Search, 
  Plus, 
  Share2, 
  ChevronLeft, 
  Music, 
  LogOut, 
  LogIn,
  X,
  Send,
  Loader2,
  Heart,
  BookOpen,
  WifiOff,
  CloudUpload,
  CloudCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  db, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User
} from './firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Song {
  id: string;
  title: string;
  lyrics: string;
  category: string;
  author?: string;
  createdAt: any;
  addedBy: string;
  isPending?: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends (Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl max-w-md w-full text-center border border-red-100">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <X className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-stone-800 mb-2">Something went wrong</h2>
            <p className="text-stone-500 mb-6 text-sm">
              The application encountered an unexpected error. This might be due to a connection issue or a configuration error.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-stone-900 text-white py-3 rounded-xl font-bold hover:bg-stone-800 transition-all"
            >
              Reload Application
            </button>
            {process.env.NODE_ENV === 'development' && (
              <pre className="mt-6 p-4 bg-stone-100 rounded-lg text-left text-[10px] overflow-auto max-h-40 text-stone-600 font-mono">
                {JSON.stringify(this.state.error, null, 2)}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isAddingSong, setIsAddingSong] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Form state
  const [newSong, setNewSong] = useState({
    title: '',
    lyrics: '',
    category: 'Worship',
    author: ''
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    const q = query(collection(db, 'songs'), orderBy('createdAt', 'desc'));
    const unsubscribeSongs = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const songsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isPending: doc.metadata.hasPendingWrites
      })) as Song[];
      setSongs(songsData);
    }, (err) => {
      console.error("Firestore error:", err);
      if (err.message.includes('insufficient permissions')) {
        setError("You don't have permission to view songs. Please sign in.");
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeAuth();
      unsubscribeSongs();
    };
  }, []);

  const filteredSongs = useMemo(() => {
    return songs.filter(song => 
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.lyrics.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [songs, searchQuery]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login error:", err);
      setError("Failed to sign in. Please try again.");
    }
  };

  const handleLogout = () => signOut(auth);

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      await addDoc(collection(db, 'songs'), {
        ...newSong,
        createdAt: serverTimestamp(),
        addedBy: user ? user.uid : 'anonymous'
      });
      setNewSong({ title: '', lyrics: '', category: 'Worship', author: '' });
      setIsAddingSong(false);
      setIsLoading(false);
    } catch (err) {
      console.error("Add song error:", err);
      setError("Failed to add song. Please try signing in if the issue persists.");
      setIsLoading(false);
    }
  };

  const handleShare = (song: Song) => {
    const shareText = `*${song.title}*\n\n${song.lyrics}\n\nShared via Telugu Christian Lyrics App`;
    if (navigator.share) {
      navigator.share({
        title: song.title,
        text: shareText,
        url: window.location.href
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareText);
      alert("Lyrics copied to clipboard!");
    }
  };

  if (isLoading && songs.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Music className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">ఉజ్జీవా గీతములు</h1>
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">Lyrics Library</p>
                {!isOnline && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-600 font-bold uppercase tracking-wider bg-amber-50 px-1.5 rounded">
                    <WifiOff className="w-2.5 h-2.5" /> Offline
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  const sampleSongs = [
                    {
                      title: "నీవు చేసిన ఉపకారములకు",
                      lyrics: "నీవు చేసిన ఉపకారములకు నేనేమి చెల్లింతును\nనీవు చూపిన వాత్సల్యమునకు నేనేమి అర్పింతును\n\nయేసయ్యా... నా యేసయ్యా...\nనీవు చేసిన ఉపకారములకు నేనేమి చెల్లింతును\n\n1. పాపినై యున్న నన్ను ప్రేమించితివే\nనా దోషములను నీవు క్షమించితివే\nనన్ను నీ బిడ్డగా మార్చుకొంటివే\nనీ కృపలో నన్ను భద్రపరచితివే\n\n2. శ్రమల కొలిమిలో నేనున్న వేళ\nనీ ఆదరణతో నన్ను నింపితివే\nనా కన్నీటిని నీవు తుడిచితివే\nనాకు తోడుగా నీవు నిలిచితివే",
                      category: "Worship",
                      author: "Hosanna Ministries"
                    },
                    {
                      title: "అత్యున్నతమైన సింహాసనముపై",
                      lyrics: "అత్యున్నతమైన సింహాసనముపై ఆసీనుడవైన నా దేవా\nఅత్యంత ప్రేమ స్వరూపివి నీవే ఆరాధన నీకే\n\nఆరాధన... ఆరాధన...\nఆరాధన నీకే... ఆరాధన నీకే...\n\n1. కారుణ్య సంపన్నుడా - కరుణామయుడా\nకృపా సత్య సంపూర్ణుడా - నా యేసయ్యా\nకష్టకాలములలో నా ఆశ్రయము నీవే\nకన్నీటి లోయలో నా ఆదరణ నీవే\n\n2. పరిశుద్ధుడా - పరమ తండ్రి\nపరలోక రాజ్యమునకు - అధిపతివి నీవే\nస్తుతులకు పాత్రుడా - స్తోత్రార్హుడా\nస్తుతి గానములతో నిన్ను కీర్తింతును",
                      category: "Worship",
                      author: "Hosanna Ministries"
                    },
                    {
                      title: "స్తోత్రం చెల్లింతుము",
                      lyrics: "స్తోత్రం చెల్లింతుము స్తుతి స్తోత్రం చెల్లింతుము\nయేసు నాథుని మేలులు తలచి స్తోత్రం చెల్లింతుము\n\n1. దీవించి నడిపించినావు - గత కాలమంతయు\nకృపలో భద్రపరచినావు - నీ రెక్కల చాటున\n\n2. ఆపదలెన్నో వచ్చినా - అపాయము రాకుండా\nకాపాడి కాపాడినావు - కనుపాప వలె మమ్ము\n\n3. వ్యాధి బాధలలోన - బలహీన సమయాన\nవైద్యుడవై నీవు వచ్చి - స్వస్థత నిచ్చినావు",
                      category: "Praise",
                      author: "Traditional"
                    },
                    {
                      title: "యేసు నామము జయము జయము",
                      lyrics: "యేసు నామము జయము జయము\nసాతాను శక్తులు లయము లయము\nయేసు నామము జయము జయము\n\n1. పాపము నుండి విముక్తినిచ్చును\nశాపము నుండి విడుదలనిచ్చును\nయేసు నామము జయము జయము\n\n2. రోగము నుండి స్వస్థతనిచ్చును\nదుఃఖము నుండి ఆదరణనిచ్చును\nయేసు నామము జయము జయము",
                      category: "Gospel",
                      author: "Traditional"
                    }
                  ];
                  
                  sampleSongs.forEach(async (song) => {
                    try {
                      await addDoc(collection(db, 'songs'), {
                        ...song,
                        createdAt: serverTimestamp(),
                        addedBy: user ? user.uid : 'anonymous'
                      });
                    } catch (err) {
                      console.error("Error adding sample song:", err);
                    }
                  });
                  alert("Sample Hosanna Ministries songs added!");
                }}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Import Hosanna Songs
              </button>
              <button 
                onClick={() => setIsAddingSong(true)}
                className="p-2 bg-emerald-50 text-emerald-700 rounded-full hover:bg-emerald-100 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
              
              {user ? (
                <div className="relative group">
                  <img 
                    src={user.photoURL || ''} 
                    alt={user.displayName || ''} 
                    className="w-8 h-8 rounded-full border border-stone-200"
                    referrerPolicy="no-referrer"
                  />
                  <button 
                    onClick={handleLogout}
                    className="absolute right-0 top-full mt-2 hidden group-hover:flex items-center gap-2 bg-white border border-stone-200 shadow-xl rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-stone-800 transition-all active:scale-95"
                >
                  <LogIn className="w-4 h-4" /> Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input 
            type="text"
            placeholder="Search songs, lyrics, or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-stone-200 rounded-2xl py-4 pl-12 pr-4 shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
          />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Song List */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">
            {searchQuery ? `Search Results (${filteredSongs.length})` : 'Recent Songs'}
          </h2>
          
          {filteredSongs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-stone-200">
              <BookOpen className="w-12 h-12 text-stone-200 mx-auto mb-4" />
              <p className="text-stone-400">No songs found matching your search.</p>
            </div>
          ) : (
            filteredSongs.map((song) => (
              <motion.button
                layoutId={song.id}
                key={song.id}
                onClick={() => setSelectedSong(song)}
                className="w-full text-left bg-white p-5 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md hover:border-emerald-100 transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase tracking-wide">
                      {song.category}
                    </span>
                    {song.isPending && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                        <CloudUpload className="w-3 h-3" /> Syncing...
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {song.createdAt?.toDate().toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-stone-800 group-hover:text-emerald-700 transition-colors">
                  {song.title}
                </h3>
                {song.author && (
                  <p className="text-sm text-stone-500 mt-1 italic">By {song.author}</p>
                )}
                <p className="text-sm text-stone-400 mt-3 line-clamp-2 leading-relaxed">
                  {song.lyrics}
                </p>
              </motion.button>
            ))
          )}
        </div>
      </main>

      {/* Song Detail Modal */}
      <AnimatePresence>
        {selectedSong && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 backdrop-blur-sm p-0 sm:p-4"
          >
            <motion.div 
              layoutId={selectedSong.id}
              className="bg-white w-full max-w-2xl h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <button 
                  onClick={() => setSelectedSong(null)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="text-center">
                  <h2 className="font-bold text-xl text-stone-800">{selectedSong.title}</h2>
                  <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">{selectedSong.category}</p>
                </div>
                <button 
                  onClick={() => handleShare(selectedSong)}
                  className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-full transition-colors"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 sm:p-12">
                <div className="max-w-prose mx-auto">
                  {selectedSong.author && (
                    <p className="text-center text-stone-400 italic mb-8 border-b border-stone-50 pb-4">
                      Composer: {selectedSong.author}
                    </p>
                  )}
                  <pre className="whitespace-pre-wrap font-sans text-lg sm:text-xl leading-[2] text-stone-700 text-center">
                    {selectedSong.lyrics}
                  </pre>
                  
                  <div className="mt-16 flex justify-center">
                    <Heart className="w-8 h-8 text-stone-100" />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Song Modal */}
      <AnimatePresence>
        {isAddingSong && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h2 className="font-bold text-xl">Add New Song</h2>
                <button 
                  onClick={() => setIsAddingSong(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleAddSong} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Song Title</label>
                  <input 
                    required
                    type="text"
                    value={newSong.title}
                    onChange={(e) => setNewSong({...newSong, title: e.target.value})}
                    placeholder="Enter song title..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Category</label>
                    <select 
                      value={newSong.category}
                      onChange={(e) => setNewSong({...newSong, category: e.target.value})}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    >
                      <option>Worship</option>
                      <option>Praise</option>
                      <option>Gospel</option>
                      <option>Hymn</option>
                      <option>Christmas</option>
                      <option>Easter</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Author (Optional)</label>
                    <input 
                      type="text"
                      value={newSong.author}
                      onChange={(e) => setNewSong({...newSong, author: e.target.value})}
                      placeholder="Composer name..."
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Lyrics (Telugu)</label>
                  <textarea 
                    required
                    rows={8}
                    value={newSong.lyrics}
                    onChange={(e) => setNewSong({...newSong, lyrics: e.target.value})}
                    placeholder="Paste Telugu lyrics here..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> Publish Song</>}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button for Mobile */}
      {!isAddingSong && (
        <button 
          onClick={() => setIsAddingSong(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-emerald-700 transition-all active:scale-90 z-40 sm:hidden"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}
    </div>
  );
}
