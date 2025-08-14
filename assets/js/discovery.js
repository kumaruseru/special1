// --- Page Navigation Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Telegram-inspired authentication
    if (typeof TelegramAuth !== 'undefined') {
        console.log('🔐 Initializing TelegramAuth for Discovery page');
        window.telegramAuth = new TelegramAuth();
        console.log('✅ TelegramAuth initialized successfully');
    } else {
        console.warn('⚠️ TelegramAuth class not available, falling back to legacy auth');
    }

    const mainNav = document.getElementById('main-nav');
    const navLinks = mainNav.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page-content');
    const mainContent = document.getElementById('main-content');
    const rightSidebar = document.getElementById('right-sidebar');

    // Initialize Friend Search
    initializeFriendSearch();
    
    // Load sidebar suggestions
    loadSidebarSuggestions();

    // --- Navigation Logic ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Only prevent default if it's an internal page transition (href="#")
            if (link.getAttribute('href') === '#' && link.dataset.page) {
                e.preventDefault();
                const targetPageId = link.dataset.page;

                // Hide all pages
                pages.forEach(page => page.classList.add('hidden'));

                // Show the target page
                const targetPage = document.getElementById(`page-${targetPageId}`);
                if (targetPage) {
                    targetPage.classList.remove('hidden');
                }

                // Update active link style
                navLinks.forEach(navLink => {
                    navLink.classList.remove('text-white', 'bg-gray-500/20');
                    navLink.classList.add('hover:bg-gray-800/50');
                });
                link.classList.add('text-white', 'bg-gray-500/20');
                link.classList.remove('hover:bg-gray-800/50');
                
                // Adjust layout for Maps page
                if (targetPageId === 'maps') {
                    mainContent.classList.remove('lg:col-span-5');
                    mainContent.classList.add('lg:col-span-9');
                    rightSidebar.classList.add('hidden');
                } else {
                    mainContent.classList.remove('lg:col-span-9');
                    mainContent.classList.add('lg:col-span-5');
                    rightSidebar.classList.remove('hidden');
                }
            }
            // If href is set to a real URL, let the default navigation happen
        });
    });
});

// === Friend Search System ===
let currentFilter = 'all';
let searchTimeout = null;
let currentUsers = [];
let isLoading = false;

function initializeFriendSearch() {
    const searchInput = document.getElementById('friend-search-input');
    const searchResults = document.getElementById('search-results');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const trendingContent = document.getElementById('trending-content');

    if (!searchInput || !searchResults) return;

    // Load suggested users on page load
    loadSuggestedUsers();

    // Search input event
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        // Debounce search
        searchTimeout = setTimeout(() => {
            if (query.length > 0) {
                performSearch(query);
                // Hide trending content when searching
                if (trendingContent) trendingContent.style.display = 'none';
            } else {
                showEmptyState();
                // Show trending content when not searching
                if (trendingContent) trendingContent.style.display = 'block';
                // Load suggested users when search is cleared
                loadSuggestedUsers();
            }
        }, 300);
    });

    // Filter button events
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active filter
            filterButtons.forEach(btn => {
                btn.classList.remove('active', 'bg-indigo-600', 'text-white');
                btn.classList.add('bg-gray-700/50', 'text-gray-300');
            });
            
            button.classList.add('active', 'bg-indigo-600', 'text-white');
            button.classList.remove('bg-gray-700/50', 'text-gray-300');

            currentFilter = button.id.replace('filter-', '');
            
            // Re-search with current query and new filter
            const currentQuery = searchInput.value.trim();
            if (currentQuery) {
                performSearch(currentQuery);
            } else {
                loadSuggestedUsers();
            }
        });
    });
}

// Enhanced user loading with Telegram-inspired authentication
async function loadSuggestedUsers() {
    if (isLoading) return;
    
    const searchResults = document.getElementById('search-results');
    if (!searchResults) return;

    isLoading = true;

    // Show loading state
    searchResults.innerHTML = `
        <div class="text-center py-8">
            <div class="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p class="text-gray-400">Tải danh sách người dùng...</p>
        </div>
    `;

    try {
        // Use Telegram-inspired auth manager
        if (window.telegramAuth) {
            console.log('🔐 TelegramAuth: Using advanced authentication');
            
            const authState = window.telegramAuth.getAuthState();
            console.log('🔍 TelegramAuth: Current state:', authState);
            
            if (!authState.isAuthenticated) {
                console.log('❌ TelegramAuth: User not authenticated');
                window.telegramAuth.handleAuthFailure();
                return;
            }

            try {
                // Make authenticated request using TelegramAuth
                const response = await window.telegramAuth.makeAuthenticatedRequest(
                    `/api/users?limit=10&filter=${currentFilter}`
                );

                if (response.ok) {
                    const data = await response.json();
                    console.log('📊 TelegramAuth: API Response:', data);

                    if (data.success) {
                        currentUsers = data.users || [];
                        displaySearchResults(currentUsers, null, 'Gợi ý cho bạn');
                        return;
                    } else {
                        throw new Error(data.message || 'API request failed');
                    }
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                console.error('❌ TelegramAuth: API request failed:', error);
                // TelegramAuth will handle token refresh automatically
                throw error;
            }
        }

        // Fallback to original logic if TelegramAuth not available
        console.log('⚠️ TelegramAuth not available, using fallback');
        await loadSuggestedUsersLegacy();

    } catch (error) {
        console.error('Error loading suggested users:', error);
        searchResults.innerHTML = `
            <div class="text-center py-8">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 text-red-500">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p class="text-gray-400 mb-2">Không thể tải danh sách người dùng</p>
                <p class="text-gray-500 text-sm">${error.message}</p>
                <button onclick="loadSuggestedUsers()" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                    Thử lại
                </button>
            </div>
        `;
    } finally {
        isLoading = false;
    }
}

// Legacy fallback function
async function loadSuggestedUsersLegacy() {
    console.log('🔄 Using legacy authentication method');
    
    try {
        // Check all possible token names (same as shared.js)
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('cosmic_token');
        const userName = localStorage.getItem('userName');
        const userEmail = localStorage.getItem('userEmail');
        
        console.log('🔍 Discovery: Token check:', { 
            authToken: !!localStorage.getItem('authToken'),
            token: !!localStorage.getItem('token'),
            cosmic_token: !!localStorage.getItem('cosmic_token'),
            finalToken: !!token,
            userName: userName,
            userEmail: userEmail
        });
        
        // If we have user data but no token, try to refresh token first
        if (!token && (userName || userEmail)) {
            console.log('🔄 No token but have user data - trying to refresh token');
            
            try {
                // Try to refresh token using shared.js function
                if (window.tryRefreshToken) {
                    console.log('🔑 Attempting token refresh...');
                    const refreshSuccess = await window.tryRefreshToken();
                    
                    if (refreshSuccess) {
                        // Get the new token after refresh
                        const newToken = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('cosmic_token');
                        console.log('✅ Token refresh successful, new token exists:', !!newToken);
                        
                        if (newToken) {
                            // Retry API call with new token
                            const success = await loadUsersWithToken(newToken);
                            if (success) return;
                        }
                    }
                }
                
                // If refresh failed, try API without auth as fallback
                console.log('🔄 Token refresh failed, trying API without auth');
                const response = await fetch('/api/users?limit=10&filter=' + currentFilter, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('📊 API Response without auth:', data);
                    
                    if (data.success && data.users) {
                        currentUsers = data.users || [];
                        displaySearchResults(currentUsers, null, data.message || 'Gợi ý cho bạn');
                        return;
                    }
                }
            } catch (error) {
                console.log('API calls failed:', error.message);
            }
            
            // Auto redirect to login if all attempts failed
            console.log('❌ All attempts failed, redirecting to login');
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 2000);
            showLoginRequired();
            return;
        }
        
        if (!token) {
            console.warn('🔒 No authentication token found, redirecting to login');
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 2000);
            showLoginRequired();
            return;
        }

        console.log('📡 Fetching users from API...');
        const response = await fetch('/api/users?limit=10&filter=' + currentFilter, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('📡 API Response status:', response.status);
        
        if (!response.ok) {
            console.error('❌ API request failed:', response.status, response.statusText);
            // Show error message instead of mock data
            showSearchError('Không thể tải danh sách người dùng. Vui lòng thử lại sau.');
            return;
        }

        const data = await response.json();
        console.log('📊 API Response data:', data);

        if (data.success) {
            currentUsers = data.users || [];
            displaySearchResults(currentUsers, null, 'Gợi ý cho bạn');
        } else {
            throw new Error(data.message);
        }

    } catch (error) {
        console.error('Error loading suggested users:', error);
        searchResults.innerHTML = `
            <div class="text-center py-8">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 text-red-500">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p class="text-gray-400 mb-2">Không thể tải danh sách người dùng</p>
                <p class="text-gray-500 text-sm">${error.message}</p>
                <button onclick="loadSuggestedUsers()" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                    Thử lại
                </button>
            </div>
        `;
    } finally {
        isLoading = false;
    }
}

// Helper function to load users with token
async function loadUsersWithToken(token) {
    try {
        console.log('📡 Loading users with token...');
        const response = await fetch('/api/users?limit=10&filter=' + currentFilter, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('📊 API Response with token:', data);
            
            if (data.success) {
                currentUsers = data.users || [];
                displaySearchResults(currentUsers, null, 'Gợi ý cho bạn');
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error loading users with token:', error);
        return false;
    }
}

// Enhanced search with Telegram-inspired authentication
async function performSearch(query) {
    if (isLoading) return;
    
    const searchResults = document.getElementById('search-results');
    if (!searchResults) return;

    isLoading = true;

    // Show loading state
    searchResults.innerHTML = `
        <div class="text-center py-8">
            <div class="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p class="text-gray-400">Đang tìm kiếm...</p>
        </div>
    `;

    try {
        // Use Telegram-inspired auth manager
        if (window.telegramAuth) {
            console.log('🔐 TelegramAuth: Using advanced authentication for search');
            
            const authState = window.telegramAuth.getAuthState();
            console.log('🔍 TelegramAuth Search: Current state:', authState);
            
            if (!authState.isAuthenticated) {
                console.log('❌ TelegramAuth Search: User not authenticated');
                window.telegramAuth.handleAuthFailure();
                return;
            }

            try {
                // Make authenticated search request using TelegramAuth
                const response = await window.telegramAuth.makeAuthenticatedRequest(
                    `/api/users?search=${encodeURIComponent(query)}&filter=${currentFilter}&limit=20`
                );

                if (response.ok) {
                    const data = await response.json();
                    console.log('📊 TelegramAuth Search: API Response:', data);

                    if (data.success) {
                        currentUsers = data.users || [];
                        displaySearchResults(currentUsers, query);
                        return;
                    } else {
                        throw new Error(data.message || 'Search request failed');
                    }
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                console.error('❌ TelegramAuth Search: API request failed:', error);
                throw error;
            }
        }

        // Fallback to legacy search if TelegramAuth not available
        console.log('⚠️ TelegramAuth not available for search, using fallback');
        await performSearchLegacy(query);

    } catch (error) {
        console.error('Error searching users:', error);
        searchResults.innerHTML = `
            <div class="text-center py-8">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 text-red-500">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p class="text-gray-400 mb-2">Không thể tìm kiếm</p>
                <p class="text-gray-500 text-sm">${error.message}</p>
                <button onclick="performSearch('${query}')" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                    Thử lại
                </button>
            </div>
        `;
    } finally {
        isLoading = false;
    }
}

// Legacy search fallback function
async function performSearchLegacy(query) {
    console.log('🔄 Using legacy search method');
    
    try {
        // Check all possible token names (same as loadSuggestedUsers)
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('cosmic_token');
        console.log('🔍 Search: Token check:', !!token);
        
        if (!token) {
            console.warn('🔒 No authentication token found for search');
            showLoginRequired();
            return;
        }

        const response = await fetch(`/api/users?search=${encodeURIComponent(query)}&filter=${currentFilter}&limit=20`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            currentUsers = data.users || [];
            displaySearchResults(currentUsers, query);
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Legacy search failed:', error);
        throw error;
    }
}

function showLoginRequired() {
    const searchResults = document.getElementById('search-results');
    if (!searchResults) return;
    
    searchResults.innerHTML = `
        <div class="text-center py-8">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 text-yellow-500">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
            </svg>
            <p class="text-gray-400 mb-4">Vui lòng đăng nhập để xem danh sách bạn bè</p>
            <a href="../pages/login.html" class="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors">
                Đăng nhập
            </a>
        </div>
    `;
}

function showSearchError(errorMessage) {
    console.log('❌ Showing search error:', errorMessage);
    const searchResults = document.getElementById('search-results');
    if (searchResults) {
        searchResults.innerHTML = `
            <div class="text-center py-8">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 text-red-500">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p class="text-gray-400 mb-2">Không thể tải dữ liệu</p>
                <p class="text-gray-500 text-sm">${errorMessage}</p>
                <button onclick="loadSuggestedUsers()" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                    Thử lại
                </button>
            </div>
        `;
    }
}

function displaySearchResults(results, query, title = 'Kết quả tìm kiếm') {
    const searchResults = document.getElementById('search-results');
    if (!searchResults) return;

    // Safety check for results
    if (!results || !Array.isArray(results)) {
        results = [];
    }

    if (results.length === 0) {
        const emptyMessage = query ? 
            `Không tìm thấy kết quả cho "${query}"` : 
            'Không có người dùng nào';
        
        searchResults.innerHTML = `
            <div class="text-center py-8">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 text-gray-600">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="4" y1="4" x2="20" y2="20"/>
                </svg>
                <p class="text-gray-400 mb-2">${emptyMessage}</p>
                ${query ? '<p class="text-gray-500 text-sm">Hãy thử tìm kiếm với từ khóa khác</p>' : ''}
            </div>
        `;
        return;
    }

    const resultHTML = results.map(user => {
        // Determine button state based on user relationship
        let buttonHTML = '';
        if (user.isFriend) {
            buttonHTML = `<button class="friend-btn px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-full font-semibold" data-user-id="${user.id}">Bạn bè</button>`;
        } else if (user.friendRequestSent) {
            buttonHTML = `<button class="request-sent-btn px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-full font-semibold" data-user-id="${user.id}">Đã gửi</button>`;
        } else if (user.friendRequestReceived) {
            buttonHTML = `<button class="accept-request-btn px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-full font-semibold" data-user-id="${user.id}">Chấp nhận</button>`;
        } else {
            buttonHTML = `<button class="add-friend-btn px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-full font-semibold" data-user-id="${user.id}">Kết bạn</button>`;
        }

        return `
        <div class="user-card flex items-center gap-4 p-4 bg-gray-800/30 rounded-xl hover:bg-gray-700/30 transition-colors cursor-pointer" data-user-id="${user.id}">
            <div class="relative">
                <img src="${user.avatar}" alt="${user.name}" class="w-12 h-12 rounded-full object-cover"/>
                ${user.isOnline ? '<div class="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-gray-900 rounded-full"></div>' : ''}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <h4 class="font-semibold text-white truncate">${highlightMatch(user.name, query)}</h4>
                    ${user.isFriend ? '<span class="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded-full">Bạn bè</span>' : ''}
                </div>
                <p class="text-sm text-gray-400 truncate">@${highlightMatch(user.username, query)}</p>
                <p class="text-xs text-gray-500 truncate">${user.bio}</p>
                <div class="flex items-center gap-4 mt-2">
                    <span class="text-xs text-gray-500">${user.followers} followers</span>
                    ${user.isOnline ? '<span class="text-xs text-green-400">Đang hoạt động</span>' : '<span class="text-xs text-gray-500">Offline</span>'}
                    <span class="text-xs text-gray-500">Tham gia ${formatJoinDate(user.joinDate)}</span>
                </div>
            </div>
            <div class="flex gap-2">
                ${buttonHTML}
                <button class="message-btn p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors" data-user-id="${user.id}" title="Nhắn tin">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                    </svg>
                </button>
                <button class="profile-btn p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors" data-user-id="${user.id}" title="Xem hồ sơ">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                </button>
            </div>
        </div>
        `;
    }).join('');

    searchResults.innerHTML = `
        <div class="mb-4">
            <h4 class="text-lg font-semibold text-white mb-2">${title} ${query ? `(${results.length})` : `(${results.length})`}</h4>
        </div>
        ${resultHTML}
    `;

    // Add event listeners to buttons
    addSearchResultsEventListeners();
}

function formatJoinDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 7) {
        return `${diffDays} ngày trước`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} tuần trước`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} tháng trước`;
    } else {
        const years = Math.floor(diffDays / 365);
        return `${years} năm trước`;
    }
}

function highlightMatch(text, query) {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-400/30 text-yellow-300 px-1 rounded">$1</mark>');
}

function addSearchResultsEventListeners() {
    // Add friend buttons
    document.querySelectorAll('.add-friend-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = button.dataset.userId;
            addFriend(userId, button);
        });
    });

    // Friend request sent buttons
    document.querySelectorAll('.request-sent-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            // Maybe cancel request in future
            showNotification('Lời mời kết bạn đã được gửi', 'info');
        });
    });

    // Accept friend request buttons
    document.querySelectorAll('.accept-request-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = button.dataset.userId;
            acceptFriendRequest(userId, button);
        });
    });

    // Friend buttons (already friends)
    document.querySelectorAll('.friend-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = button.dataset.userId;
            removeFriend(userId, button);
        });
    });

    // Message buttons
    document.querySelectorAll('.message-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = button.dataset.userId;
            openMessage(userId);
        });
    });

    // Profile buttons
    document.querySelectorAll('.profile-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = button.dataset.userId;
            viewProfile(userId);
        });
    });

    // User cards (click to view profile)
    document.querySelectorAll('.user-card').forEach(card => {
        card.addEventListener('click', () => {
            const userId = card.dataset.userId;
            viewProfile(userId);
        });
    });
}

function addFriend(userId, buttonElement) {
    // Show loading state
    const originalText = buttonElement.textContent;
    buttonElement.textContent = 'Đang gửi...';
    buttonElement.disabled = true;

    // Send friend request to server
    sendFriendRequest(userId)
        .then(() => {
            // Update current users data locally for immediate UI feedback
            const user = currentUsers.find(u => u.id === userId);
            if (user) {
                // Mark as friend request sent
                user.friendRequestSent = true;
                
                // Update button to show request sent
                buttonElement.textContent = 'Đã gửi';
                buttonElement.className = 'request-sent-btn px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-full font-semibold';
                buttonElement.disabled = false;
                
                // Show success message
                showNotification(`Đã gửi lời mời kết bạn tới ${user.name}! 👋`, 'success');
            }
        })
        .catch((error) => {
            // Reset button on error
            buttonElement.textContent = originalText;
            buttonElement.disabled = false;
            
            console.error('Error sending friend request:', error);
            showNotification(error.message || 'Lỗi khi gửi lời mời kết bạn', 'error');
        });
}

function removeFriend(userId, buttonElement) {
    const user = currentUsers.find(u => u.id === userId);
    if (user && confirm(`Bạn có muốn hủy kết bạn với ${user.name}?`)) {
        user.isFriend = false;
        
        // Update button
        buttonElement.textContent = 'Kết bạn';
        buttonElement.className = 'add-friend-btn px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-full font-semibold';
        
        // Re-add event listener
        buttonElement.onclick = (e) => {
            e.stopPropagation();
            addFriend(userId, buttonElement);
        };

        showNotification(`Đã hủy kết bạn với ${user.name}`, 'info');

        // TODO: Send API request to backend
        // removeFriendship(userId);
    }
}

async function acceptFriendRequest(userId, buttonElement) {
    try {
        const originalText = buttonElement.textContent;
        buttonElement.textContent = 'Đang chấp nhận...';
        buttonElement.disabled = true;

        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        
        // Find the friend request from that user (we'll need to get the request ID)
        const response = await fetch('/api/friend-requests', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const friendRequest = data.friendRequests?.find(req => req.sender.id === userId);
            
            if (friendRequest) {
                // Accept the request
                const acceptResponse = await fetch(`/api/friend-requests/${friendRequest.id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ action: 'accept' })
                });

                if (acceptResponse.ok) {
                    const result = await acceptResponse.json();
                    if (result.success) {
                        // Update user data
                        const user = currentUsers.find(u => u.id === userId);
                        if (user) {
                            user.isFriend = true;
                            user.friendRequestReceived = false;
                            
                            // Update button
                            buttonElement.textContent = 'Bạn bè';
                            buttonElement.className = 'friend-btn px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-full font-semibold';
                            buttonElement.disabled = false;
                            
                            showNotification(`Đã chấp nhận lời mời kết bạn từ ${user.name}! 🎉`, 'success');
                        }
                    } else {
                        throw new Error(result.message);
                    }
                } else {
                    throw new Error('Lỗi khi chấp nhận lời mời');
                }
            } else {
                throw new Error('Không tìm thấy lời mời kết bạn');
            }
        } else {
            throw new Error('Lỗi khi tải danh sách lời mời');
        }

    } catch (error) {
        // Reset button on error
        buttonElement.textContent = 'Chấp nhận';
        buttonElement.disabled = false;
        
        console.error('Error accepting friend request:', error);
        showNotification(error.message || 'Lỗi khi chấp nhận lời mời', 'error');
    }
}

function openMessage(userId) {
    const user = currentUsers.find(u => u.id === userId);
    if (user) {
        console.log('=== OPENING MESSAGE ===');
        console.log('User data:', user);
        
        showNotification(`Đang mở tin nhắn với ${user.name}...`, 'info');
        
        // Store user data for messaging
        const userData = {
            id: user.id,
            name: user.name,
            username: user.username || user.name.toLowerCase().replace(/\s+/g, ''),
            avatar: user.avatar
        };
        
        console.log('Storing user data in localStorage:', userData);
        localStorage.setItem('message_user', JSON.stringify(userData));
        
        // Verify data was stored
        const storedData = localStorage.getItem('message_user');
        console.log('Verified stored data:', storedData);
        
        // Redirect to messages page - reduced delay
        setTimeout(() => {
            console.log('Redirecting to messages page...');
            window.location.href = 'messages.html?userId=' + user.id;
        }, 500); // Reduced from 1000ms to 500ms
    }
}

async function viewProfile(userId) {
    const user = currentUsers.find(u => u.id === userId);
    if (user) {
        showNotification(`Đang xem hồ sơ của ${user.name}...`, 'info');
        
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
                // Store user profile data and redirect to friend profile page
                localStorage.setItem('view_profile', JSON.stringify(data.user));
                setTimeout(() => {
                    window.location.href = 'friend-profile.html?userId=' + userId;
                }, 1000);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            showNotification(`Không thể tải hồ sơ của ${user.name}`, 'error');
        }
    }
}

function showEmptyState() {
    const searchResults = document.getElementById('search-results');
    if (searchResults) {
        searchResults.innerHTML = `
            <div class="text-center text-gray-400 py-8">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-4 text-gray-600">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.3-4.3"/>
                </svg>
                <p>Nhập tên hoặc username để tìm kiếm bạn bè</p>
            </div>
        `;
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300 ${
        type === 'success' ? 'bg-green-600 text-white' :
        type === 'error' ? 'bg-red-600 text-white' :
        'bg-indigo-600 text-white'
    }`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);

    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

async function loadSidebarSuggestions() {
    const sidebarSuggestions = document.getElementById('sidebar-suggestions');
    if (!sidebarSuggestions) return;

    try {
        // Check all possible token names
        let token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('cosmic_token');
        const userName = localStorage.getItem('userName');
        const userEmail = localStorage.getItem('userEmail');
        
        // If we have user data but no token, try to refresh
        if (!token && (userName || userEmail)) {
            console.log('🔄 Sidebar: No token but have user data - trying to refresh token');
            
            if (window.tryRefreshToken) {
                const refreshSuccess = await window.tryRefreshToken();
                if (refreshSuccess) {
                    token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('cosmic_token');
                }
            }
        }
        
        if (!token) {
            sidebarSuggestions.innerHTML = `
                <div class="text-center py-4">
                    <p class="text-gray-400 text-sm">Đăng nhập để xem gợi ý</p>
                </div>
            `;
            return;
        }

        const response = await fetch('/api/users?limit=5', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success && data.users.length > 0) {
            const suggestionsHTML = data.users.slice(0, 3).map(user => `
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <img src="${user.avatar}" alt="${user.name}" class="w-10 h-10 rounded-full object-cover"/>
                        <div>
                            <p class="font-semibold text-white text-sm">${user.name}</p>
                            <p class="text-xs text-gray-400">@${user.username}</p>
                        </div>
                    </div>
                    <button onclick="followUser('${user.id}')" class="secondary-button px-3 py-1 rounded-full font-semibold text-xs hover:bg-indigo-600/30 transition-colors">
                        Theo dõi
                    </button>
                </div>
            `).join('');

            sidebarSuggestions.innerHTML = suggestionsHTML;
        } else {
            sidebarSuggestions.innerHTML = `
                <div class="text-center py-4">
                    <p class="text-gray-400 text-sm">Không có gợi ý mới</p>
                </div>
            `;
        }

    } catch (error) {
        console.error('Error loading sidebar suggestions:', error);
        sidebarSuggestions.innerHTML = `
            <div class="text-center py-4">
                <p class="text-gray-400 text-sm">Lỗi tải gợi ý</p>
            </div>
        `;
    }
}

function followUser(userId) {
    showNotification('Tính năng theo dõi sẽ được triển khai sớm! 🚀', 'info');
}

// --- 3D Cosmic Background Script ---
// This part of the script runs after the main DOM content is loaded.
// It relies on the THREE object being available from the CDN script in the HTML.
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
    // Adjust camera based on scroll position to create a parallax effect
    camera.position.z = 1 + window.scrollY * 0.001;
    renderer.render(scene, camera);
};
animate();
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize page functions when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadSuggestedUsers();
    loadSidebarSuggestions();
    
    const searchInput = document.getElementById('friend-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.trim();
            if (query.length >= 2) {
                performSearch(query);
            } else if (query.length === 0) {
                loadSuggestedUsers();
            }
        });
    }

    // Add filter button event listeners
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
});

// Friend request functions
async function sendFriendRequest(userId) {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    
    if (!token) {
        throw new Error('Bạn cần đăng nhập để gửi lời mời kết bạn');
    }

    const response = await fetch('/api/friend-requests', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            receiverId: userId,
            message: 'Chào bạn! Tôi muốn kết bạn với bạn.'
        })
    });

    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.message);
    }
    
    return result;
}
