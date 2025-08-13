// --- Profile Data Loading ---
async function loadProfileData() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.error('No authentication token found');
            window.location.href = '../pages/login.html';
            return;
        }

        const response = await fetch('/api/profile/me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success && data.user) {
            updateProfileUI(data.user);
        } else {
            console.error('Failed to load profile:', data.message);
            showNotification('Không thể tải thông tin hồ sơ', 'error');
        }

    } catch (error) {
        console.error('Error loading profile data:', error);
        showNotification('Lỗi kết nối. Vui lòng thử lại!', 'error');
    }
}

function updateProfileUI(user) {
    // Update profile header
    const profileAvatar = document.getElementById('profile-main-avatar');
    const profileName = document.getElementById('profile-main-name');
    const profileUsername = document.getElementById('profile-main-username');
    const profileBio = document.getElementById('profile-main-bio');
    
    if (profileAvatar) profileAvatar.src = user.avatar;
    if (profileName) profileName.textContent = user.name;
    if (profileUsername) profileUsername.textContent = `@${user.username}`;
    if (profileBio) profileBio.textContent = user.bio;

    // Update join date
    const joinDateElement = document.getElementById('profile-join-date');
    if (joinDateElement) {
        const joinDate = new Date(user.joinDate);
        joinDateElement.textContent = `Tham gia tháng ${joinDate.getMonth() + 1}, ${joinDate.getFullYear()}`;
    }

    // Update statistics
    const followingElement = document.getElementById('profile-following');
    const followersElement = document.getElementById('profile-followers');
    
    if (followingElement) {
        followingElement.innerHTML = `<span class="font-bold text-white">${user.stats.following}</span> <span class="text-gray-400">Đang theo dõi</span>`;
    }
    if (followersElement) {
        followersElement.innerHTML = `<span class="font-bold text-white">${user.stats.followers}</span> <span class="text-gray-400">Người theo dõi</span>`;
    }

    // Update sidebar user info
    const sidebarAvatar = document.getElementById('user-avatar');
    const sidebarName = document.getElementById('user-name');
    const sidebarEmail = document.getElementById('user-email');
    
    if (sidebarAvatar) sidebarAvatar.src = user.avatar;
    if (sidebarName) sidebarName.textContent = user.name;
    if (sidebarEmail) sidebarEmail.textContent = `@${user.username}`;
    
    // Update posts section with user avatar and name
    updatePostsSection(user);
}

function updatePostsSection(user) {
    // Update specific post avatars and names using IDs
    const postAvatar1 = document.getElementById('post-avatar-1');
    const postAvatar2 = document.getElementById('post-avatar-2');
    const postName1 = document.getElementById('post-name-1');
    const postName2 = document.getElementById('post-name-2');
    
    if (postAvatar1) postAvatar1.src = user.avatar;
    if (postAvatar2) postAvatar2.src = user.avatar;
    if (postName1) postName1.textContent = user.name;
    if (postName2) postName2.textContent = user.name;
}

function showNotification(message, type = 'info') {
    // Simple notification implementation
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white ${
        type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// --- Page Navigation Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // Load profile data first
    loadProfileData();
    
    const mainNav = document.getElementById('main-nav');
    const navLinks = mainNav.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page-content');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Only prevent default if it's an internal page transition (href="#")
            if (link.getAttribute('href') === '#' && link.dataset.page) {
                e.preventDefault();
                const targetPageId = link.dataset.page;

                // Hide all page content
                pages.forEach(page => {
                    page.classList.add('hidden');
                });

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
            }
            // If href is set to a real URL, let the default navigation happen
        });
    });
});


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
    // Adjust camera based on scroll position to create a parallax effect
    camera.position.z = 1 + (document.documentElement.scrollTop || document.body.scrollTop) * 0.001;
    renderer.render(scene, camera);
};
animate();
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
