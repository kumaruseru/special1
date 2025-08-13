// Shared JavaScript functions for all pages

// Load user info from localStorage
function loadUserInfo() {
    // Try both userInfo (new) and userData (from login)
    let userInfo = localStorage.getItem('userInfo') || localStorage.getItem('userData');
    if (userInfo) {
        try {
            const user = JSON.parse(userInfo);
            
            // Update user name
            const userNameEl = document.getElementById('user-name');
            if (userNameEl && user.firstName && user.lastName) {
                userNameEl.textContent = `${user.firstName} ${user.lastName}`;
            } else if (userNameEl && user.fullName) {
                userNameEl.textContent = user.fullName;
            }
            
            // Update user email
            const userEmailEl = document.getElementById('user-email');
            if (userEmailEl && user.email) {
                userEmailEl.textContent = `@${user.email.split('@')[0]}`;
            }
            
            // Update user avatar with first letter
            const userAvatarEl = document.getElementById('user-avatar');
            if (userAvatarEl) {
                let firstLetter = 'U';
                if (user.firstName) {
                    firstLetter = user.firstName.charAt(0).toUpperCase();
                } else if (user.fullName) {
                    firstLetter = user.fullName.charAt(0).toUpperCase();
                } else if (user.email) {
                    firstLetter = user.email.charAt(0).toUpperCase();
                }
                userAvatarEl.src = `https://placehold.co/48x48/4F46E5/FFFFFF?text=${firstLetter}`;
            }
            
        } catch (error) {
            console.error('Error parsing user info:', error);
        }
    }
}

// Check authentication
function checkAuth() {
    // Try all possible token names
    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('cosmic_token');
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    
    console.log('Auth check:', { token: !!token, isLoggedIn });
    
    // Sync token to standard 'token' key if found under different name
    if (token && !localStorage.getItem('token')) {
        localStorage.setItem('token', token);
        console.log('Token synced to standard key');
    }
    
    if (!token || isLoggedIn !== 'true') {
        // Redirect to login if not authenticated
        const currentPath = window.location.pathname;
        console.log('Not authenticated, current path:', currentPath);
        if (!currentPath.includes('login.html') && !currentPath.includes('register.html')) {
            console.log('Redirecting to login...');
            window.location.href = '/pages/login.html';
        }
        return false;
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
    
    // Check authentication first
    if (checkAuth()) {
        // Load user info
        loadUserInfo();
        
        // Add logout event listener
        const logoutButton = document.querySelector('.logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', logout);
        }
    }
});
