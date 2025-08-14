// Shared JavaScript functions for all pages

// Load user info from localStorage
function loadUserInfo() {
    console.log('🔍 Loading user info...');
    
    // Try all possible user data sources
    let userInfo = localStorage.getItem('userInfo') || localStorage.getItem('userData');
    let userName = localStorage.getItem('userName');
    let userEmail = localStorage.getItem('userEmail');
    
    console.log('Available user data:', {
        userInfo: !!userInfo,
        userName: userName,
        userEmail: userEmail,
        localStorage_keys: Object.keys(localStorage)
    });
    
    if (userInfo) {
        try {
            const user = JSON.parse(userInfo);
            console.log('Parsed user object:', user);
            
            // Update user name
            const userNameEl = document.getElementById('user-name');
            if (userNameEl) {
                let displayName = 'Loading...';
                if (user.firstName && user.lastName) {
                    displayName = `${user.firstName} ${user.lastName}`;
                } else if (user.fullName) {
                    displayName = user.fullName;
                } else if (user.name) {
                    displayName = user.name;
                } else if (userName) {
                    displayName = userName;
                }
                userNameEl.textContent = displayName;
                console.log('✅ Updated user name to:', displayName);
            }
            
            // Update user email
            const userEmailEl = document.getElementById('user-email');
            if (userEmailEl) {
                let displayEmail = '@user';
                if (user.email) {
                    displayEmail = `@${user.email.split('@')[0]}`;
                } else if (userEmail) {
                    displayEmail = `@${userEmail.split('@')[0]}`;
                }
                userEmailEl.textContent = displayEmail;
                console.log('✅ Updated user email to:', displayEmail);
            }
            
            // Update user avatar with first letter
            const userAvatarEl = document.getElementById('user-avatar');
            if (userAvatarEl) {
                let firstLetter = 'U';
                if (user.firstName) {
                    firstLetter = user.firstName.charAt(0).toUpperCase();
                } else if (user.fullName) {
                    firstLetter = user.fullName.charAt(0).toUpperCase();
                } else if (user.name) {
                    firstLetter = user.name.charAt(0).toUpperCase();
                } else if (user.email) {
                    firstLetter = user.email.charAt(0).toUpperCase();
                } else if (userEmail) {
                    firstLetter = userEmail.charAt(0).toUpperCase();
                }
                userAvatarEl.src = `https://placehold.co/48x48/4F46E5/FFFFFF?text=${firstLetter}`;
                console.log('✅ Updated avatar with letter:', firstLetter);
            }
            
        } catch (error) {
            console.error('❌ Error parsing user info:', error);
        }
    } else {
        console.warn('⚠️ No user info found in localStorage');
        // Still try to use individual fields if available
        const userNameEl = document.getElementById('user-name');
        const userEmailEl = document.getElementById('user-email');
        
        if (userNameEl && userName) {
            userNameEl.textContent = userName;
            console.log('✅ Fallback: Updated user name to:', userName);
        }
        
        if (userEmailEl && userEmail) {
            userEmailEl.textContent = `@${userEmail.split('@')[0]}`;
            console.log('✅ Fallback: Updated user email');
        }
    }
}

// Check authentication
function checkAuth() {
    // Try all possible token names
    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('cosmic_token');
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const userName = localStorage.getItem('userName');
    const userEmail = localStorage.getItem('userEmail');
    
    console.log('Auth check:', { 
        token: !!token, 
        isLoggedIn,
        userName,
        userEmail,
        hasUserData: !!(userName && userEmail)
    });
    
    // Sync token to standard 'token' key if found under different name
    if (token && !localStorage.getItem('token')) {
        localStorage.setItem('token', token);
        console.log('Token synced to standard key');
    }
    
    // If we have user data but no token, user might be in demo mode
    if (!token && (userName || userEmail)) {
        console.log('🔄 User has data but no token - allowing demo mode access');
        return true; // Allow access for demo/guest users
    }
    
    // Check if token exists and is valid
    if (!token) {
        // Only redirect if we also don't have user data
        if (!userName && !userEmail) {
            const currentPath = window.location.pathname;
            console.log('No token or user data found, current path:', currentPath);
            if (!currentPath.includes('login.html') && !currentPath.includes('register.html')) {
                console.log('Redirecting to login...');
                window.location.href = '/pages/login.html';
            }
        }
        return false;
    }
    
    // If we have a token, check if it's expired
    try {
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        const isExpired = tokenData.exp && (tokenData.exp * 1000 < Date.now());
        
        if (isExpired) {
            console.log('Token expired, but checking if we have user data for demo mode...');
            if (userName || userEmail) {
                console.log('🔄 Keeping user in demo mode despite expired token');
                return true;
            } else {
                console.log('Token expired and no user data, clearing and redirecting...');
                localStorage.removeItem('authToken');
                localStorage.removeItem('token');
                localStorage.removeItem('cosmic_token');
                localStorage.removeItem('isLoggedIn');
                window.location.href = '/pages/login.html';
                return false;
            }
        }
    } catch (e) {
        console.warn('Token validation failed:', e.message, '- allowing access anyway');
        // Don't redirect on token parse error - might be a non-JWT token
    }
    
    console.log('Authentication successful');
    return true;
}

// Logout function
function logout() {
    // Clear all auth-related items
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('cosmic_token');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('userData');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('view_profile');
    localStorage.removeItem('chat_with_user');
    
    window.location.href = '/pages/login.html';
}

// Initialize shared functionality when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    // Debug localStorage contents
    console.log('localStorage contents:', {
        token: localStorage.getItem('token'),
        authToken: localStorage.getItem('authToken'),
        cosmic_token: localStorage.getItem('cosmic_token'),
        isLoggedIn: localStorage.getItem('isLoggedIn'),
        userInfo: localStorage.getItem('userInfo'),
        userData: localStorage.getItem('userData')
    });
    
    // Check if we should skip auth check for certain pages
    const currentPath = window.location.pathname;
    const skipAuthPages = ['discovery.html'];
    const shouldSkipAuth = skipAuthPages.some(page => currentPath.includes(page));
    
    if (!shouldSkipAuth) {
        // Check authentication for protected pages
        if (checkAuth()) {
            // Load user info
            loadUserInfo();
        }
    } else {
        console.log('Skipping auth check for:', currentPath);
        // Still load user info if available for guest mode
        loadUserInfo();
    }
    
    // Add logout event listener
    const logoutButton = document.querySelector('.logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
});
