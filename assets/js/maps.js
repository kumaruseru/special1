// === OpenStreetMap Integration ===
let map;
let userMarker;
let friendMarkers = [];
let currentLayer = 'street';

// Initialize the map
function initMap() {
    // Create map centered on Ho Chi Minh City, Vietnam
    map = L.map('map', {
        center: [10.8231, 106.6297],
        zoom: 12,
        zoomControl: false
    });

    // Add zoom control to top right
    L.control.zoom({
        position: 'topright'
    }).addTo(map);

    // Street layer (default)
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    });

    // Satellite layer
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19
    });

    // Add default layer
    streetLayer.addTo(map);

    // Store layer references
    map.streetLayer = streetLayer;
    map.satelliteLayer = satelliteLayer;

    // Add sample friend markers
    addFriendMarkers();

    // Setup event listeners
    setupMapControls();

    // Try to get user location
    getUserLocation();
}

// Add friend markers to map
function addFriendMarkers() {
    // Real friends will be loaded from database
    const friends = [];

    friends.forEach(friend => {
        // Create custom icon
        const friendIcon = L.divIcon({
            className: 'friend-marker',
            html: `
                <div class="relative">
                    <div class="w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl bg-gray-900/80 backdrop-blur-sm" 
                         style="border-color: ${friend.color}">
                        ${friend.avatar}
                    </div>
                    <div class="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                </div>
            `,
            iconSize: [48, 48],
            iconAnchor: [24, 48],
            popupAnchor: [0, -48]
        });

        // Create marker
        const marker = L.marker([friend.lat, friend.lng], { icon: friendIcon })
            .addTo(map)
            .bindPopup(`
                <div class="text-center p-2">
                    <div class="font-bold text-gray-800">${friend.name}</div>
                    <div class="text-sm text-gray-600">${friend.location}</div>
                    <button class="mt-2 bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700">
                        Nhắn tin
                    </button>
                </div>
            `);

        friendMarkers.push(marker);
    });
}

// Setup map controls
function setupMapControls() {
    // Find me button
    document.getElementById('find-me-btn').addEventListener('click', getUserLocation);

    // Toggle satellite view
    document.getElementById('toggle-satellite-btn').addEventListener('click', toggleSatelliteView);
}

// Get user's current location
function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // Remove existing user marker
                if (userMarker) {
                    map.removeLayer(userMarker);
                }

                // Create user marker
                const userIcon = L.divIcon({
                    className: 'user-marker',
                    html: `
                        <div class="relative">
                            <div class="w-14 h-14 rounded-full border-3 border-blue-500 bg-blue-600 flex items-center justify-center text-white text-xl animate-pulse">
                                👤
                            </div>
                            <div class="absolute inset-0 rounded-full border-3 border-blue-400 animate-ping"></div>
                        </div>
                    `,
                    iconSize: [56, 56],
                    iconAnchor: [28, 56]
                });

                // Add user marker
                userMarker = L.marker([lat, lng], { icon: userIcon })
                    .addTo(map)
                    .bindPopup(`
                        <div class="text-center p-2">
                            <div class="font-bold text-gray-800">Vị trí của bạn</div>
                            <div class="text-sm text-gray-600">Bạn đang ở đây</div>
                        </div>
                    `);

                // Center map on user location
                map.setView([lat, lng], 15);
            },
            (error) => {
                console.error('Geolocation error:', error);
                alert('Không thể lấy vị trí của bạn. Vui lòng kiểm tra quyền truy cập vị trí.');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    } else {
        alert('Trình duyệt không hỗ trợ định vị địa lý.');
    }
}

// Toggle between street and satellite view
function toggleSatelliteView() {
    const button = document.getElementById('toggle-satellite-btn');
    
    if (currentLayer === 'street') {
        map.removeLayer(map.streetLayer);
        map.satelliteLayer.addTo(map);
        currentLayer = 'satellite';
        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l3-3 3 3"/><path d="M8 21l4-7 4 7"/><path d="M12 2v6"/><path d="M3 11h18"/></svg>
            <span class="hidden sm:inline">Đường phố</span>
        `;
        button.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        button.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
    } else {
        map.removeLayer(map.satelliteLayer);
        map.streetLayer.addTo(map);
        currentLayer = 'street';
        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.5-1.5 3.5 0 5s3.5 1.5 5 0l4-4c1.5-1.5 1.5-3.5 0-5s-3.5-1.5-5 0l-4 4z"/><path d="M18.5 7.5c1.5-1.5 1.5-3.5 0-5s-3.5-1.5-5 0l-4 4c-1.5 1.5-1.5 3.5 0 5s3.5 1.5 5 0l4-4z"/></svg>
            <span class="hidden sm:inline">Vệ tinh</span>
        `;
        button.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
        button.classList.add('bg-gray-700', 'hover:bg-gray-600');
    }
}

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', function() {
    initMap();
});

// === 3D Cosmic Background Script ===
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
    const elapsedTime = clock.getElapsedTime();
    stars.rotation.y = -mouseX * 0.00005;
    stars.rotation.x = -mouseY * 0.00005;

    // Make background scroll with page
    camera.position.z = 1 + (document.documentElement.scrollTop || document.body.scrollTop) * 0.001;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
};
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});