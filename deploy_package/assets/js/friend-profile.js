const App = () => {
    const [userProfile, setUserProfile] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [isFollowing, setIsFollowing] = React.useState(false);

    React.useEffect(() => {
        // Get user ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('userId');
        
        // Get profile data from localStorage
        const profileData = localStorage.getItem('view_profile');
        
        if (profileData) {
            try {
                const profile = JSON.parse(profileData);
                setUserProfile(profile);
                setLoading(false);
                // Check if already following (you can add API call here)
                setIsFollowing(profile.isFollowing || false);
            } catch (error) {
                console.error('Error parsing profile data:', error);
                setLoading(false);
            }
        } else if (userId) {
            // If no localStorage data, fetch from API
            fetchUserProfile(userId);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchUserProfile = async (userId) => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (data.success) {
                setUserProfile(data.user);
                setIsFollowing(data.user.isFollowing || false);
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
        setLoading(false);
    };

    const handleFollow = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/users/${userProfile.id}/follow`, {
                method: isFollowing ? 'DELETE' : 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                setIsFollowing(!isFollowing);
                // Update follower count
                setUserProfile(prev => ({
                    ...prev,
                    followers: prev.followers + (isFollowing ? -1 : 1)
                }));
            }
        } catch (error) {
            console.error('Error following/unfollowing user:', error);
        }
    };

    const handleMessage = () => {
        console.log('=== HANDLE MESSAGE CLICKED ===');
        console.log('User profile:', userProfile);
        
        // Store user data for messaging and redirect
        const userData = {
            id: userProfile.id,
            name: userProfile.name,
            username: userProfile.username,
            avatar: userProfile.avatar
        };
        
        console.log('Storing user data:', userData);
        localStorage.setItem('message_user', JSON.stringify(userData));
        
        console.log('Redirecting to messages page...');
        window.location.href = 'messages.html?userId=' + userProfile.id;
    };

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('view_profile');
        window.location.href = '../pages/login.html';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    if (!userProfile) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-white text-xl">User not found</div>
            </div>
        );
    }

    return (
        <div className="relative z-10 container mx-auto grid grid-cols-12 gap-8 px-4 py-8">
            <aside className="col-span-12 lg:col-span-3 h-fit sticky top-8">
                <div className="glass-pane p-4 rounded-2xl space-y-2">
                    <a href="#" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800/50 transition-colors">
                        <img src={userProfile.avatar || "https://placehold.co/48x48/4F46E5/FFFFFF?text=" + (userProfile.name ? userProfile.name.charAt(0) : 'U')} alt="User Avatar" className="w-12 h-12 rounded-full border-2 border-indigo-500"/>
                        <div>
                            <h3 className="font-bold text-lg text-white">{userProfile.name || 'Unknown User'}</h3>
                            <p className="text-sm text-gray-400">@{userProfile.username || 'unknown'}</p>
                        </div>
                    </a>
                    <hr className="border-gray-700/50"/>
                    <nav className="flex flex-col space-y-2">
                        <a href="../pages/home.html" className="flex items-center gap-3 px-4 py-3 rounded-lg font-semibold hover:bg-gray-800/50 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            <span>Trang chủ</span>
                        </a>
                        <a href="../pages/discovery.html" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800/50 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                            <span>Khám phá</span>
                        </a>
                        <a href="../pages/messages.html" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800/50 transition-colors">
                             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            <span>Tin nhắn</span>
                        </a>
                        <a href="../pages/maps.html" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-800/50 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            <span>Bản đồ</span>
                        </a>
                         <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg text-white font-semibold bg-gray-500/20">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <span>Hồ sơ</span>
                        </a>
                    </nav>
                    <hr className="border-gray-700/50 pt-2"/>
                    <button 
                        onClick={handleLogout}
                        className="w-full logout-button font-bold py-3 rounded-lg flex items-center justify-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            <main className="col-span-12 lg:col-span-9 space-y-6">
                <div className="glass-pane rounded-2xl">
                    <div>
                        <div className="h-48 md:h-64 bg-cover bg-center rounded-t-2xl" style={{backgroundImage: userProfile.coverImage ? `url('${userProfile.coverImage}')` : "url('https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=2072&auto=format&fit=crop')"}}></div>
                        <div className="p-4">
                            <div className="flex justify-between items-start">
                                <img src={userProfile.avatar || "https://placehold.co/128x128/8A2BE2/FFFFFF?text=" + (userProfile.name ? userProfile.name.charAt(0) : 'U')} alt="User Avatar" className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-gray-900 -mt-16 sm:-mt-20"/>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={handleFollow}
                                        className="main-button px-4 py-2 rounded-full font-semibold text-sm">
                                        {isFollowing ? 'Bỏ theo dõi' : 'Theo dõi'}
                                    </button>
                                    <button 
                                        onClick={handleMessage}
                                        className="secondary-button p-2 rounded-full" 
                                        title="Nhắn tin">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                    </button>
                                </div>
                            </div>
                            <div className="mt-2">
                                <h2 className="text-2xl sm:text-3xl font-bold text-white">{userProfile.name || 'Unknown User'}</h2>
                                <p className="text-sm text-gray-400">@{userProfile.username || 'unknown'}</p>
                            </div>
                            <p className="mt-4 text-gray-300">{userProfile.bio || 'Chưa có tiểu sử.'}</p>
                            <div className="flex items-center gap-6 mt-4 text-sm text-gray-400">
                                <div className="flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
                                    <span>Tham gia {userProfile.joinDate || 'N/A'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-6 mt-4 text-sm">
                                <p><span className="font-bold text-white">{userProfile.following || 0}</span> <span className="text-gray-400">Đang theo dõi</span></p>
                                <p><span className="font-bold text-white">{userProfile.followers || 0}</span> <span className="text-gray-400">Người theo dõi</span></p>
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-gray-700/50 flex">
                        <button className="flex-1 p-4 font-semibold text-white relative">
                            Bài viết
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-blue-500 rounded-full"></div>
                        </button>
                        <button className="flex-1 p-4 font-semibold text-gray-400 hover:bg-gray-800/50 transition-colors">Phương tiện</button>
                        <button className="flex-1 p-4 font-semibold text-gray-400 hover:bg-gray-800/50 transition-colors">Lượt thích</button>
                    </div>
                </div>

                <div className="glass-pane p-4 rounded-2xl">
                     <div className="flex flex-col gap-4">
                        <div className="bg-gray-800/30 rounded-lg overflow-hidden">
                            <div className="p-4">
                                <div className="flex items-center gap-4 mb-4">
                                    <img src="https://placehold.co/40x40/8A2BE2/FFFFFF?text=C" alt="User Avatar" className="w-10 h-10 rounded-full"/>
                                    <div>
                                        <h4 className="font-bold text-white">Cosmo Explorer</h4>
                                        <p className="text-xs text-gray-400">1 ngày trước</p>
                                    </div>
                                </div>
                                <p>Một góc nhìn khác về tinh vân Đầu Ngựa. Thật đáng kinh ngạc!</p>
                                <img src="https://images.unsplash.com/photo-1504333638930-c8787321eee0?q=80&w=2070&auto=format&fit=crop" alt="Horsehead Nebula" className="mt-4 w-full h-auto rounded-xl border border-gray-700/50"/>
                            </div>
                            <div className="flex justify-around p-2 border-t border-gray-700/50">
                                <button className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-800/50 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                                    <span>2.5k</span>
                                </button>
                                <button className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-800/50 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                    <span>412</span>
                                </button>
                                <button className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-800/50 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>
                                    <span>230</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));

// --- 3D Cosmic Background Script ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.z = 1;
const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('cosmic-bg'),
    antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
const starGeo = new THREE.BufferGeometry();
const starCount = 6000;
const posArray = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 600;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const starMaterial = new THREE.PointsMaterial({
    size: 0.5,
    color: 0xaaaaaa,
    transparent: true,
});
const stars = new THREE.Points(starGeo, starMaterial);
scene.add(stars);
let mouseX = 0;
let mouseY = 0;
document.addEventListener('mousemove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
});
const clock = new THREE.Clock();
const animate = () => {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();
    stars.rotation.y = -mouseX * 0.00005;
    stars.rotation.x = -mouseY * 0.00005;
    camera.position.z = 1 + (document.documentElement.scrollTop || document.body.scrollTop) * 0.001;
    renderer.render(scene, camera);
};
animate();
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Render React App
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
