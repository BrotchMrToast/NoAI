import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

// --- Global Firebase Config & Variables ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

// --- Mock Data ---
const DUMMY_USERS = [
    { id: 'user_maya', name: 'Maya Creative', handle: '@maya_art', avatar: 'https://placehold.co/100x100/FFB7B2/ffffff?text=M', bio: 'Digital purist. 📸' },
    { id: 'user_liam', name: 'Liam Analog', handle: '@liam_film', avatar: 'https://placehold.co/100x100/B5EAD7/ffffff?text=L', bio: 'Film grain & reality.' },
    { id: 'user_sarah', name: 'Sarah Real', handle: '@sarah_life', avatar: 'https://placehold.co/100x100/E2F0CB/ffffff?text=S', bio: 'No filters, just life.' },
];

// Mock posts to populate the feed immediately for testing "Following" features
const MOCK_POSTS = [
    { id: 'mock_1', authorId: 'user_maya', authorName: 'Maya Creative', authorAvatar: 'https://placehold.co/100x100/FFB7B2/ffffff?text=M', imageUrl: 'https://placehold.co/600x400/FFB7B2/ffffff?text=Sketching+in+Park', caption: 'Sunday morning sketches. No AI, just ink.', timestamp: { toDate: () => new Date(Date.now() - 3600000) }, likes: ['user_liam'] },
    { id: 'mock_2', authorId: 'user_liam', authorName: 'Liam Analog', authorAvatar: 'https://placehold.co/100x100/B5EAD7/ffffff?text=L', imageUrl: 'https://placehold.co/600x400/B5EAD7/ffffff?text=Old+Camera', caption: 'Found this beauty at the flea market.', timestamp: { toDate: () => new Date(Date.now() - 7200000) }, likes: [] },
    { id: 'mock_3', authorId: 'user_sarah', authorName: 'Sarah Real', authorAvatar: 'https://placehold.co/100x100/E2F0CB/ffffff?text=S', imageUrl: 'https://placehold.co/600x400/E2F0CB/ffffff?text=Coffee+Spill', caption: 'Oops. Authentic mess.', timestamp: { toDate: () => new Date(Date.now() - 10800000) }, likes: ['user_maya', 'user_liam'] },
];

// --- Helper Components ---
const Button = ({ onClick, children, variant = 'primary', className = '', ...props }) => {
    const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 transform active:scale-95 focus:outline-none flex items-center justify-center";
    const variants = {
        primary: "bg-pink-500 text-white hover:bg-pink-600 shadow-md hover:shadow-lg",
        secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
        outline: "border-2 border-pink-500 text-pink-500 hover:bg-pink-50",
        ghost: "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
    };
    return (
        <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
            {children}
        </button>
    );
};

// --- Image Editor Component ---
const ImageEditor = ({ onSave, onCancel }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [filter, setFilter] = useState('none');
    const [isDrawing, setIsDrawing] = useState(false);
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const fileInputRef = useRef(null);

    const filters = [
        { name: 'Normal', value: 'none' },
        { name: 'Warm', value: 'sepia(40%) contrast(110%) brightness(110%)' },
        { name: 'Cool', value: 'hue-rotate(180deg) sepia(20%)' },
        { name: 'B&W', value: 'grayscale(100%) contrast(120%)' },
        { name: 'Vintage', value: 'sepia(60%) contrast(110%) saturate(80%)' },
    ];

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => setImageSrc(event.target.result);
            reader.readAsDataURL(file);
        }
    };

    // Initialize Canvas
    useEffect(() => {
        if (imageSrc && canvasRef.current) {
            const canvas = canvasRef.current;
            const img = new Image();
            img.src = imageSrc;
            img.onload = () => {
                const maxWidth = 800;
                const scale = img.width > maxWidth ? maxWidth / img.width : 1;
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                
                const ctx = canvas.getContext('2d');
                ctx.lineCap = "round";
                ctx.strokeStyle = "#ec4899";
                ctx.lineWidth = 5;
                contextRef.current = ctx;
                ctx.clearRect(0, 0, canvas.width, canvas.height); 
            };
        }
    }, [imageSrc]);

    const startDrawing = ({ nativeEvent }) => {
        if (!contextRef.current) return;
        const { offsetX, offsetY } = getCoordinates(nativeEvent);
        contextRef.current.beginPath();
        contextRef.current.moveTo(offsetX, offsetY);
        setIsDrawing(true);
    };

    const draw = ({ nativeEvent }) => {
        if (!isDrawing) return;
        const { offsetX, offsetY } = getCoordinates(nativeEvent);
        contextRef.current.lineTo(offsetX, offsetY);
        contextRef.current.stroke();
    };

    const stopDrawing = () => {
        if (!contextRef.current) return;
        contextRef.current.closePath();
        setIsDrawing(false);
    };

    const getCoordinates = (event) => {
        if (event.touches && event.touches[0]) {
             const rect = canvasRef.current.getBoundingClientRect();
             const scaleX = canvasRef.current.width / rect.width;
             const scaleY = canvasRef.current.height / rect.height;
             return {
                 offsetX: (event.touches[0].clientX - rect.left) * scaleX,
                 offsetY: (event.touches[0].clientY - rect.top) * scaleY
             };
        }
        return { offsetX: event.offsetX, offsetY: event.offsetY };
    };

    const handleSave = () => {
        if (!imageSrc) return;
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        const img = new Image();
        img.src = imageSrc;
        
        img.onload = () => {
            const maxWidth = 800;
            const scale = img.width > maxWidth ? maxWidth / img.width : 1;
            tempCanvas.width = img.width * scale;
            tempCanvas.height = img.height * scale;

            ctx.filter = filter; 
            ctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
            ctx.filter = 'none'; 

            if (canvasRef.current) {
                ctx.drawImage(canvasRef.current, 0, 0);
            }
            onSave(tempCanvas.toDataURL('image/jpeg', 0.8));
        };
    };

    if (!imageSrc) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 bg-gray-50">
                <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl border-2 border-dashed border-gray-200 text-center">
                    <div className="mb-6 text-pink-500 bg-pink-50 w-20 h-20 mx-auto rounded-full flex items-center justify-center">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.218A2 2 0 0110.207 4h3.586a2 2 0 011.664.89l.812 1.218a2 2 0 001.664.89H20a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Create Authentic Content</h3>
                    <p className="text-gray-500 mb-8">Take a photo directly or upload one. <br/>No AI generation allowed.</p>
                    
                    <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                    />
                    <div className="space-y-3">
                        <Button onClick={() => fileInputRef.current.click()} className="w-full py-3 text-lg">
                            Open Camera / Upload
                        </Button>
                        <Button variant="ghost" onClick={onCancel} className="w-full">
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-lg flex flex-col h-[calc(100vh-100px)] sm:h-[800px]">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Edit Mode</h3>
                <button onClick={() => setImageSrc(null)} className="text-gray-400 hover:text-gray-600 text-sm font-medium">Reset</button>
            </div>

            {/* Canvas Area */}
            <div className="relative flex-grow bg-gray-900 overflow-hidden flex items-center justify-center">
                <img src={imageSrc} alt="Original" className="absolute inset-0 w-full h-full object-contain pointer-events-none" style={{ filter: filter }} />
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 z-10 touch-none cursor-crosshair w-full h-full object-contain"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
            </div>

            {/* Tools */}
            <div className="p-4 bg-white border-t border-gray-100 space-y-4">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filters</span>
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Non-Generative</span>
                    </div>
                    <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                        {filters.map(f => (
                            <button
                                key={f.name}
                                onClick={() => setFilter(f.value)}
                                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f.value ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                            >
                                {f.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <Button onClick={handleSave} className="flex-1 py-3 text-lg shadow-pink-200">
                        Post Authentic Moment
                    </Button>
                    <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                </div>
            </div>
        </div>
    );
};

// --- Login Screen ---
const LoginScreen = ({ onLogin }) => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="bg-pink-500 p-10 text-center">
                    <h1 className="text-5xl font-black text-white tracking-tighter mb-2">NoAI</h1>
                    <p className="text-pink-100 font-medium">Reclaiming Authentic Social Media</p>
                </div>
                
                <div className="p-8 space-y-6">
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                        <p className="text-sm text-blue-800 font-bold mb-1">Prototype Access</p>
                        <p className="text-xs text-blue-600">Use the credentials below to enter the secure environment.</p>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Username</label>
                            <div className="bg-gray-100 border-2 border-transparent focus-within:border-pink-500 rounded-xl px-4 py-3 flex items-center text-gray-700 font-mono text-sm">
                                demo_user_01
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Password</label>
                             <div className="bg-gray-100 border-2 border-transparent focus-within:border-pink-500 rounded-xl px-4 py-3 flex items-center text-gray-700 font-mono text-sm">
                                ••••••••••••••••
                            </div>
                        </div>
                    </div>

                    <Button onClick={onLogin} className="w-full py-4 text-lg font-bold shadow-pink-300">
                        Log In Securely
                    </Button>
                    
                    <p className="text-center text-xs text-gray-400">
                        By entering, you confirm that you are human.
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- Main App ---
const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [user, setUser] = useState(null);
    const [view, setView] = useState('login'); 
    const [realPosts, setRealPosts] = useState([]);
    const [following, setFollowing] = useState(() => {
        // Persist following state for the session
        const saved = localStorage.getItem('noai_following');
        return saved ? JSON.parse(saved) : [];
    });
    const [feedType, setFeedType] = useState('global'); // 'global' or 'following'
    const [isLoading, setIsLoading] = useState(true);

    // 1. Initialize Firebase
    useEffect(() => {
        const init = async () => {
             if (Object.keys(firebaseConfig).length === 0) return;
             const app = initializeApp(firebaseConfig);
             setDb(getFirestore(app));
             const authInstance = getAuth(app);
             setAuth(authInstance);

             onAuthStateChanged(authInstance, (u) => {
                 if (u) {
                     setUser(u);
                     if (view === 'login') setView('feed');
                 } else {
                     setView('login');
                 }
                 setIsLoading(false);
             });
        };
        init();
    }, []);

    // 2. Fetch Real Posts
    useEffect(() => {
        if (!db || !user) return;
        const q = query(collection(db, `/artifacts/${appId}/public/data/posts`), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRealPosts(fetchedPosts);
        });
        return () => unsubscribe();
    }, [db, user]);

    // 3. Persist Following
    useEffect(() => {
        localStorage.setItem('noai_following', JSON.stringify(following));
    }, [following]);

    // 4. Combined Feed Logic (Real + Mock)
    const combinedFeed = useMemo(() => {
        // Merge real posts and mock posts
        // For real posts, timestamps are Firestore objects. For mocks, they are Date objects/functions.
        // We need a uniform sort.
        const allPosts = [...realPosts, ...MOCK_POSTS];
        
        return allPosts.sort((a, b) => {
            const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(0);
            const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(0);
            return timeB - timeA; // Descending
        });
    }, [realPosts]);

    const displayPosts = useMemo(() => {
        if (feedType === 'global') return combinedFeed;
        return combinedFeed.filter(p => following.includes(p.authorId) || (user && p.authorId === user.uid));
    }, [feedType, combinedFeed, following, user]);

    // 5. Handlers
    const handleLogin = async () => {
        if (!auth) return;
        try {
            await signInAnonymously(auth);
            if (auth.currentUser) {
                updateProfile(auth.currentUser, { displayName: 'Demo User', photoURL: 'https://placehold.co/100x100/333/fff?text=ME' });
            }
        } catch (e) {
            console.error(e);
            alert("Login failed (Prototype Error).");
        }
    };

    const handleLogout = () => signOut(auth);

    const handlePost = async (imageDataUrl) => {
        if (!db || !user) return;
        try {
            await addDoc(collection(db, `/artifacts/${appId}/public/data/posts`), {
                authorId: user.uid,
                authorName: user.displayName || 'Demo User',
                authorAvatar: user.photoURL,
                imageUrl: imageDataUrl,
                caption: "Just captured this #nofilter #noai",
                timestamp: serverTimestamp(),
                likes: []
            });
            setView('feed');
            setFeedType('global'); // Switch to global so they see their post
        } catch (e) {
            console.error("Post error:", e);
        }
    };

    const toggleFollow = (dummyId) => {
        setFollowing(prev => prev.includes(dummyId) ? prev.filter(id => id !== dummyId) : [...prev, dummyId]);
    };

    const toggleLike = async (post) => {
        // If it's a real post (has no 'mock' prefix in ID usually, but mock posts have manual IDs)
        // For this prototype, we only persist likes to Real posts in Firestore. 
        // Mock post likes are local-only (visual).
        if (!post.id.startsWith('mock_') && db && user) {
             const postRef = doc(db, `/artifacts/${appId}/public/data/posts`, post.id);
             const isLiked = post.likes && post.likes.includes(user.uid);
             await updateDoc(postRef, { likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) });
        }
    };

    if (isLoading) return <div className="min-h-screen flex items-center justify-center text-pink-500 font-bold animate-pulse">Loading NoAI...</div>;
    if (view === 'login') return <LoginScreen onLogin={handleLogin} />;

    return (
        <div className="min-h-screen bg-gray-50 pb-20 sm:pb-0 font-sans">
            {/* Top Navigation */}
            <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex justify-between items-center">
                <div onClick={() => setView('feed')} className="cursor-pointer group">
                    <h1 className="text-2xl font-black tracking-tighter text-gray-900 group-hover:text-pink-500 transition-colors">
                        No<span className="text-pink-500 group-hover:text-gray-900 transition-colors">AI</span>
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleLogout} className="text-xs font-bold text-gray-400 hover:text-red-500 uppercase tracking-wider">Logout</button>
                </div>
            </header>

            <main className="max-w-xl mx-auto p-4">
                {view === 'editor' && <ImageEditor onSave={handlePost} onCancel={() => setView('feed')} />}
                
                {view === 'people' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold text-gray-900">Community</h2>
                            <Button variant="ghost" onClick={() => setView('feed')}>Close</Button>
                        </div>
                        <div className="grid gap-4">
                            {DUMMY_USERS.map(u => {
                                const isFollowing = following.includes(u.id);
                                return (
                                    <div key={u.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between transition hover:shadow-md">
                                        <div className="flex items-center space-x-4">
                                            <img src={u.avatar} alt={u.name} className="w-14 h-14 rounded-full border-2 border-gray-100" />
                                            <div>
                                                <div className="font-bold text-gray-900 text-lg">{u.name}</div>
                                                <div className="text-xs text-pink-500 font-bold mb-1">{u.handle}</div>
                                                <div className="text-xs text-gray-500">{u.bio}</div>
                                            </div>
                                        </div>
                                        <Button 
                                            variant={isFollowing ? "outline" : "primary"} 
                                            onClick={() => toggleFollow(u.id)} 
                                            className={isFollowing ? "bg-pink-50" : ""}
                                        >
                                            {isFollowing ? 'Following' : 'Follow'}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {view === 'feed' && (
                    <div className="space-y-6">
                        {/* Feed Toggles */}
                        <div className="flex p-1 bg-gray-200 rounded-xl">
                            <button 
                                onClick={() => setFeedType('global')}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${feedType === 'global' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Global Discovery
                            </button>
                            <button 
                                onClick={() => setFeedType('following')}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${feedType === 'following' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Following
                            </button>
                        </div>

                        {/* Compose Trigger */}
                        <div onClick={() => setView('editor')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 cursor-pointer hover:bg-gray-50 transition group">
                            <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-pink-500 group-hover:bg-pink-500 group-hover:text-white transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.218A2 2 0 0110.207 4h3.586a2 2 0 011.664.89l.812 1.218a2 2 0 001.664.89H20a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                </svg>
                            </div>
                            <span className="text-gray-400 font-medium text-lg">Share an authentic moment...</span>
                        </div>

                        {/* Posts List */}
                        <div className="space-y-6">
                            {displayPosts.map(post => {
                                const isLiked = post.likes && post.likes.includes(user.uid);
                                // Is this a mock post or real?
                                const isMock = post.id.startsWith('mock_');
                                
                                return (
                                    <div key={post.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                        {/* Post Header */}
                                        <div className="p-4 flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <img 
                                                    src={post.authorAvatar || 'https://placehold.co/100x100/333/fff?text=?'} 
                                                    className="w-10 h-10 rounded-full border border-gray-100 object-cover" 
                                                    alt="avatar"
                                                />
                                                <div>
                                                    <div className="font-bold text-gray-900 leading-tight">{post.authorName}</div>
                                                    <div className="text-xs text-gray-400">
                                                        {post.timestamp?.toDate ? post.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                                                    </div>
                                                </div>
                                            </div>
                                            {isMock && <span className="px-2 py-1 bg-gray-100 text-gray-400 text-[10px] font-bold uppercase rounded-md">Featured</span>}
                                        </div>

                                        {/* Image */}
                                        <div className="relative bg-gray-100">
                                             <img src={post.imageUrl} className="w-full h-auto object-contain max-h-[500px]" loading="lazy" alt="post" />
                                        </div>

                                        {/* Actions & Caption */}
                                        <div className="p-4">
                                            <div className="flex items-center space-x-4 mb-3">
                                                <button 
                                                    onClick={() => toggleLike(post)}
                                                    className={`flex items-center space-x-1.5 transition-colors ${isLiked ? 'text-pink-500' : 'text-gray-500 hover:text-pink-500'}`}
                                                    disabled={isMock && true /* simple toggle for mock visual only? or disabled */}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 ${isLiked ? 'fill-current' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                    </svg>
                                                    <span className="font-bold text-lg">{post.likes ? post.likes.length : 0}</span>
                                                </button>
                                            </div>
                                            <div className="text-gray-900 leading-relaxed">
                                                <span className="font-bold mr-2">{post.authorName}</span>
                                                {post.caption}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {displayPosts.length === 0 && (
                                <div className="text-center py-16 px-4">
                                    <div className="text-gray-300 mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900">No moments here yet.</h3>
                                    <p className="text-gray-500 mt-2">
                                        {feedType === 'following' 
                                            ? "Try following more people in the Community tab." 
                                            : "Be the first to capture something authentic."}
                                    </p>
                                    {feedType === 'following' && (
                                        <Button variant="outline" onClick={() => setView('people')} className="mt-6 mx-auto">
                                            Find People
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
            
            {/* Mobile Navigation */}
            {view !== 'login' && view !== 'editor' && (
                <div className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex justify-around p-3 pb-safe z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <button onClick={() => setView('feed')} className={`flex flex-col items-center space-y-1 ${view === 'feed' ? 'text-pink-500' : 'text-gray-400'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                        <span className="text-[10px] font-bold">Feed</span>
                    </button>
                    <button onClick={() => setView('editor')} className="text-white bg-pink-500 p-3 rounded-full -mt-8 border-4 border-white shadow-lg transform transition active:scale-95">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                    <button onClick={() => setView('people')} className={`flex flex-col items-center space-y-1 ${view === 'people' ? 'text-pink-500' : 'text-gray-400'}`}>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                         <span className="text-[10px] font-bold">Community</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default App;


