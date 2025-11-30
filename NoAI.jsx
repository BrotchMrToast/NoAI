import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';

// --- Global Firebase Config & Variables (MUST be present for Canvas environment) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const API_KEY = ""; // Placeholder for Gemini API key, though not used in this initial UI logic

// Helper function for exponential backoff (for API calls, though not strictly needed for basic Firestore)
const exponentialBackoffFetch = async (url, options, maxRetries = 5) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            const delay = Math.pow(2, i) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// --- Context for Firebase and User State ---
const FirebaseContext = React.createContext({
    db: null,
    auth: null,
    userId: null,
    isAuthReady: false,
    appId: appId
});

// --- Constants ---
const PLACEHOLDER_IMAGE_URLS = [
    "https://placehold.co/600x400/DCC7C1/9B7D7D?text=Authentic+Moment+1",
    "https://placehold.co/600x600/C8D6B0/7B866B?text=Authentic+Moment+2",
    "https://placehold.co/400x600/A0B9BA/657979?text=Authentic+Moment+3"
];

const PostButton = ({ handlePost }) => (
    <div className="p-4 bg-white rounded-xl shadow-lg flex items-center justify-between transition duration-300 hover:shadow-xl">
        <input
            type="text"
            placeholder="Share an authentic moment..."
            className="flex-grow bg-gray-50 p-3 border border-gray-200 rounded-lg focus:outline-none focus:border-pink-300"
            readOnly // Readonly to simulate a pre-capture thought/caption
        />
        <button
            onClick={handlePost}
            className="ml-4 p-3 bg-pink-500 text-white rounded-full shadow-lg hover:bg-pink-600 transition duration-300 transform hover:scale-105"
            title="Simulate Direct Camera Capture"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.218A2 2 0 0110.207 4h3.586a2 2 0 011.664.89l.812 1.218a2 2 0 001.664.89H20a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        </button>
    </div>
);

const PostCard = ({ post, userId, db }) => {
    const isLiked = post.likes.includes(userId);
    const likeCount = post.likes.length;
    
    // Format timestamp for display (or show 'Just now' if it's the server timestamp object)
    const formattedTime = useMemo(() => {
        if (!post.timestamp || typeof post.timestamp.toDate !== 'function') {
            return 'Just now';
        }
        return post.timestamp.toDate().toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }, [post.timestamp]);

    const handleLikeToggle = useCallback(async () => {
        if (!db || !userId) return;

        const postRef = doc(db, `/artifacts/${appId}/public/data/posts`, post.id);
        
        try {
            // Check if the user already liked the post
            const newLikes = isLiked
                ? post.likes.filter(id => id !== userId) // Remove like
                : [...post.likes, userId]; // Add like

            await updateDoc(postRef, {
                likes: newLikes
            });
        } catch (error) {
            console.error("Error toggling like:", error);
        }
    }, [db, userId, post.id, post.likes, isLiked]);

    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden my-4 border border-gray-100 transition duration-300 hover:shadow-lg">
            <div className="p-4 flex items-center justify-between border-b border-gray-100">
                <div className="font-semibold text-gray-700 text-sm">
                    User ID: <span className="text-pink-500 font-mono">{post.authorId}</span>
                </div>
                <div className="text-xs text-gray-500">{formattedTime}</div>
            </div>

            {/* Post Content */}
            <div className="relative">
                <img
                    src={post.imageUrl}
                    alt="Authentic user capture"
                    className="w-full object-cover max-h-96"
                    onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://placehold.co/600x400/f0f0f0/666?text=Image+Unavailable";
                    }}
                />
            </div>

            {/* Actions (Community-Led Surfacing) */}
            <div className="p-4 flex items-center justify-between">
                <button
                    onClick={handleLikeToggle}
                    className={`flex items-center space-x-2 text-sm font-medium transition duration-200 ${isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
                    disabled={!userId}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-5 w-5 ${isLiked ? 'fill-current' : 'hover:fill-current'}`}
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        fill="none"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    <span>{likeCount} Likes</span>
                </button>
                <div className="text-gray-600 text-sm">
                    {post.caption}
                </div>
            </div>
        </div>
    );
};

const Feed = ({ userId, db }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db || !userId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        // Path: /artifacts/{appId}/public/data/posts
        const postsCollectionRef = collection(db, `/artifacts/${appId}/public/data/posts`);
        
        // Transparent Discovery: Chronological feed (no opaque algorithms)
        const postsQuery = query(postsCollectionRef, orderBy('timestamp', 'desc'));

        const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
            const newPosts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPosts(newPosts);
            setLoading(false);
        }, (error) => {
            console.error("Firestore snapshot error:", error);
            setLoading(false);
        });

        // Cleanup the listener on component unmount
        return () => unsubscribe();
    }, [db, userId]);

    if (!userId) {
        return <div className="text-center p-8 text-gray-500">Awaiting authentication...</div>;
    }

    if (loading) {
        return <div className="text-center p-8 text-pink-500">Loading authentic moments...</div>;
    }

    if (posts.length === 0) {
        return (
            <div className="text-center p-12 text-gray-500 bg-white rounded-xl shadow-md mt-4">
                <p className="font-semibold text-lg">The feed is empty.</p>
                <p className="text-sm">Be the first to share an authentic, human-made moment!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {posts.map(post => (
                <PostCard key={post.id} post={post} userId={userId} db={db} />
            ))}
        </div>
    );
};

// --- Main App Component ---
const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [postCount, setPostCount] = useState(0);

    // 1. Firebase Initialization and Authentication
    useEffect(() => {
        if (Object.keys(firebaseConfig).length === 0) {
             console.error("Firebase config is missing. Cannot initialize Firestore.");
             return;
        }

        try {
            const firebaseApp = initializeApp(firebaseConfig);
            const firestore = getFirestore(firebaseApp);
            const firebaseAuth = getAuth(firebaseApp);
            
            // Log to debug
            // setLogLevel('debug');

            setDb(firestore);
            setAuth(firebaseAuth);

            // Authentication Listener
            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    // Try to sign in anonymously if not yet signed in or token is not provided
                    if (!initialAuthToken) {
                        await signInAnonymously(firebaseAuth);
                    }
                }
                setIsAuthReady(true);
            });

            // Use the provided custom auth token if available
            if (initialAuthToken && !firebaseAuth.currentUser) {
                signInWithCustomToken(firebaseAuth, initialAuthToken)
                    .catch(error => {
                        console.error("Custom token sign-in failed:", error);
                        signInAnonymously(firebaseAuth); // Fallback to anonymous
                    });
            } else if (!firebaseAuth.currentUser) {
                // Initial anonymous sign-in if no token is provided
                signInAnonymously(firebaseAuth)
                    .catch(error => console.error("Anonymous sign-in failed:", error));
            }


            return () => unsubscribe();
        } catch (e) {
            console.error("Firebase initialization failed:", e);
        }
    }, []);

    // 2. Function to handle a new post
    const handlePost = useCallback(async () => {
        if (!db || !userId) {
            console.warn("Database or user not ready.");
            return;
        }

        try {
            const postsCollectionRef = collection(db, `/artifacts/${appId}/public/data/posts`);
            
            // Simulate Direct Capture: Get a random placeholder image
            const randomImage = PLACEHOLDER_IMAGE_URLS[Math.floor(Math.random() * PLACEHOLDER_IMAGE_URLS.length)];
            
            setPostCount(prev => prev + 1);

            const newPost = {
                imageUrl: randomImage,
                caption: `Human-made moment #${postCount + 1}`,
                authorId: userId.substring(0, 8), // Show truncated ID for community finding
                timestamp: serverTimestamp(),
                likes: [],
            };

            await addDoc(postsCollectionRef, newPost);

        } catch (error) {
            console.error("Error adding document:", error);
        }
    }, [db, userId, postCount]);
    
    // Display full userId for community finding, as per instructions
    const displayUserId = userId || 'Signing In...';

    return (
        <FirebaseContext.Provider value={{ db, auth, userId, isAuthReady, appId }}>
            <div className="min-h-screen bg-gray-50 font-sans p-4 sm:p-8">
                <div className="max-w-xl mx-auto">
                    
                    {/* Header */}
                    <header className="text-center mb-8">
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tighter">
                            No<span className="text-pink-500">AI</span>
                        </h1>
                        <p className="text-gray-500 mt-2 text-md">
                            Reclaiming Authentic Social Media.
                        </p>
                        <p className="mt-4 text-xs text-gray-400 p-2 bg-white rounded-lg border border-gray-100">
                            Your Session ID (for sharing): <span className="font-mono text-gray-700 break-all">{displayUserId}</span>
                        </p>
                    </header>

                    {/* Post Creation Area (Simulating Direct Capture) */}
                    {isAuthReady && userId ? (
                        <PostButton handlePost={handlePost} />
                    ) : (
                        <div className="p-4 bg-yellow-100 text-yellow-800 rounded-xl text-center">
                            Authenticating session...
                        </div>
                    )}

                    {/* Feed (Transparent Discovery) */}
                    <main className="mt-8">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            Transparent Discovery Feed
                        </h2>
                        <Feed userId={userId} db={db} />
                    </main>
                </div>

                {/* Mobile Spacing */}
                <div className="h-12 sm:h-0"></div>
            </div>
        </FirebaseContext.Provider>
    );
};

export default App;
