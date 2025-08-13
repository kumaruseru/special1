// Security utilities
function generateSalt() {
    return CryptoJS.lib.WordArray.random(128/8).toString();
}

function hashPasswordWithSalt(password, salt) {
    return CryptoJS.SHA256(password + salt).toString();
}

document.addEventListener('DOMContentLoaded', () => {
    // --- 3D BACKGROUND LOGIC ---
    const init3DScene = () => {
        const canvas = document.getElementById('bg-canvas');
        if (!canvas) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.position.z = 10;

        const starGeometry = new THREE.SphereGeometry(1.5, 64, 64);
        const starMaterial = new THREE.MeshBasicMaterial({ color: 0xADD8E6, transparent: true, opacity: 0.9 });
        const star = new THREE.Mesh(starGeometry, starMaterial);
        
        const coronaGeometry = new THREE.SphereGeometry(1.7, 64, 64);
        const coronaMaterial = new THREE.MeshBasicMaterial({ color: 0x00BFFF, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
        const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
        
        const starGroup = new THREE.Group();
        starGroup.add(star);
        starGroup.add(corona);
        scene.add(starGroup);

        const starfieldGeometry = new THREE.BufferGeometry();
        const starfieldCount = 8000;
        const starfieldPos = new Float32Array(starfieldCount * 3);
        for(let i = 0; i < starfieldCount * 3; i++) {
            starfieldPos[i] = (Math.random() - 0.5) * 100;
        }
        starfieldGeometry.setAttribute('position', new THREE.BufferAttribute(starfieldPos, 3));
        const starfieldMaterial = new THREE.PointsMaterial({ size: 0.05, color: 0xFFFFFF, transparent: true, opacity: 0.8 });
        const starfield = new THREE.Points(starfieldGeometry, starfieldMaterial);
        scene.add(starfield);

        const nebulaGeometry = new THREE.BufferGeometry();
        const nebulaCount = 200;
        const nebulaPos = new Float32Array(nebulaCount * 3);
        const nebulaColors = new Float32Array(nebulaCount * 3);
        const nebulaColor = new THREE.Color();
        for(let i = 0; i < nebulaCount; i++) {
            const i3 = i * 3;
            nebulaPos[i3] = (Math.random() - 0.5) * 50;
            nebulaPos[i3 + 1] = (Math.random() - 0.5) * 30;
            nebulaPos[i3 + 2] = (Math.random() - 0.5) * 30 - 20;
            nebulaColor.set(Math.random() > 0.5 ? 0x8A2BE2 : 0x00BFFF);
            nebulaColor.toArray(nebulaColors, i3);
        }
        nebulaGeometry.setAttribute('position', new THREE.BufferAttribute(nebulaPos, 3));
        nebulaGeometry.setAttribute('color', new THREE.BufferAttribute(nebulaColors, 3));
        
        const createNebulaTexture = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 128; canvas.height = 128;
            const context = canvas.getContext('2d');
            const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
            gradient.addColorStop(0, 'rgba(255,255,255,1)');
            gradient.addColorStop(0.2, 'rgba(255,255,255,0.7)');
            gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, 128, 128);
            return new THREE.CanvasTexture(canvas);
        }

        const nebulaMaterial = new THREE.PointsMaterial({
            size: 15, map: createNebulaTexture(), transparent: true,
            blending: THREE.AdditiveBlending, opacity: 0.2,
            vertexColors: true, depthWrite: false,
        });
        const nebula = new THREE.Points(nebulaGeometry, nebulaMaterial);
        scene.add(nebula);

        let mouseX = 0, mouseY = 0;
        document.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX - window.innerWidth / 2) / 100;
            mouseY = (event.clientY - window.innerHeight / 2) / 100;
        });

        const clock = new THREE.Clock();
        const animate = () => {
            requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();
            starGroup.rotation.y = elapsedTime * 0.1;
            starGroup.rotation.x = elapsedTime * 0.05;
            nebula.rotation.y = elapsedTime * 0.02;
            camera.position.x += (mouseX - camera.position.x) * 0.02;
            camera.position.y += (-mouseY - camera.position.y) * 0.02;
            camera.lookAt(scene.position);
            renderer.render(scene, camera);
        };
        animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    };

    // --- CUSTOM SELECT LOGIC ---
    const initCustomSelects = () => {
        const currentYear = new Date().getFullYear();
        const optionsData = {
            day: Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: i + 1 })),
            month: Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` })),
            year: Array.from({ length: 100 }, (_, i) => ({ value: currentYear - i, label: currentYear - i })),
            gender: [
                { value: 'male', label: 'Nam' },
                { value: 'female', label: 'Nữ' },
                { value: 'other', label: 'Khác' }
            ]
        };

        document.querySelectorAll('.custom-select').forEach(selectWrapper => {
            const trigger = selectWrapper.querySelector('.custom-select-trigger');
            const panel = selectWrapper.querySelector('.custom-select-panel');
            const displaySpan = trigger.querySelector('span');
            const type = panel.getAttribute('data-type');
            
            optionsData[type].forEach(optionData => {
                const optionEl = document.createElement('div');
                optionEl.className = 'custom-select-option';
                optionEl.textContent = optionData.label;
                optionEl.setAttribute('data-value', optionData.value);
                panel.appendChild(optionEl);
            });

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.custom-select-panel.open').forEach(openPanel => {
                    if(openPanel !== panel) openPanel.classList.remove('open');
                });
                panel.classList.toggle('open');
            });
            
            panel.addEventListener('click', (e) => {
                if (e.target.classList.contains('custom-select-option')) {
                    displaySpan.textContent = e.target.textContent;
                    displaySpan.classList.remove('text-gray-400');
                    displaySpan.classList.add('text-white');
                    panel.classList.remove('open');
                }
            });
        });

        window.addEventListener('click', () => {
            document.querySelectorAll('.custom-select-panel.open').forEach(panel => {
                panel.classList.remove('open');
            });
        });
    };

    // --- INITIALIZATION ---
    init3DScene();
    initCustomSelects();
    initRegisterForm();
});

// --- REGISTER FORM LOGIC ---
function initRegisterForm() {
    const registerButton = document.querySelector('.form-button');
    const inputs = {
        firstName: document.querySelector('input[placeholder*="Tên"]'),
        lastName: document.querySelector('input[placeholder*="Họ"]'),
        email: document.querySelector('input[type="email"]'),
        password: document.querySelectorAll('input[type="password"]')[0],
        confirmPassword: document.querySelectorAll('input[type="password"]')[1]
    };

    if (registerButton) {
        registerButton.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = {
                firstName: inputs.firstName?.value.trim() || '',
                lastName: inputs.lastName?.value.trim() || '',
                email: inputs.email?.value.trim() || '',
                password: inputs.password?.value || '',
                confirmPassword: inputs.confirmPassword?.value || '',
                gender: getSelectedValue('gender'),
                birthDate: {
                    day: getSelectedValue('day'),
                    month: getSelectedValue('month'),
                    year: getSelectedValue('year')
                }
            };
            
            // Validate form
            const validation = validateForm(formData);
            if (!validation.isValid) {
                alert(validation.message);
                return;
            }
            
            // Show loading state
            registerButton.textContent = 'Đang tạo tài khoản...';
            registerButton.disabled = true;
            
            // Generate salt and hash passwords
            const salt = generateSalt();
            const hashedPassword = hashPasswordWithSalt(formData.password, salt);
            const hashedConfirmPassword = hashPasswordWithSalt(formData.confirmPassword, salt);
            
            const hashedFormData = {
                ...formData,
                password: hashedPassword,
                confirmPassword: hashedConfirmPassword,
                salt: salt // Include salt for server-side verification
            };
            
            // Call registration API
            fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(hashedFormData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Store login state
                    localStorage.setItem('isLoggedIn', 'true');
                    localStorage.setItem('userEmail', data.user.email);
                    localStorage.setItem('userName', data.user.fullName);
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('userData', JSON.stringify(data.user));
                    
                    // Show success message
                    alert('🎉 ' + data.message + ' Chào mừng bạn đến với vũ trụ!');
                    
                    // Redirect to home page
                    window.location.href = '../index.html';
                } else {
                    // Show error message
                    alert('❌ ' + data.message);
                    
                    // Reset button state
                    registerButton.textContent = 'Tạo Tài Khoản';
                    registerButton.disabled = false;
                }
            })
            .catch(error => {
                console.error('Registration error:', error);
                alert('❌ Có lỗi xảy ra. Vui lòng thử lại sau!');
                
                // Reset button state
                registerButton.textContent = 'Tạo Tài Khoản';
                registerButton.disabled = false;
            });
        });
    }

    // Handle Enter key press
    Object.values(inputs).forEach(input => {
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    registerButton.click();
                }
            });
        }
    });
}

// Helper function to get selected value from custom select
function getSelectedValue(type) {
    const panel = document.querySelector(`[data-type="${type}"]`);
    if (!panel) return '';
    
    const trigger = panel.parentElement.querySelector('.custom-select-trigger span');
    const selectedText = trigger.textContent;
    
    if (selectedText.includes('Chọn') || trigger.classList.contains('text-gray-400')) {
        return '';
    }
    
    // Extract value based on type
    if (type === 'gender') {
        if (selectedText === 'Nam') return 'male';
        if (selectedText === 'Nữ') return 'female';
        if (selectedText === 'Khác') return 'other';
    } else if (type === 'month') {
        return selectedText.replace('Tháng ', '');
    } else {
        return selectedText;
    }
    
    return '';
}

// Form validation function
function validateForm(data) {
    // Check required fields
    if (!data.firstName) {
        return { isValid: false, message: 'Vui lòng nhập tên!' };
    }
    
    if (!data.lastName) {
        return { isValid: false, message: 'Vui lòng nhập họ!' };
    }
    
    if (!data.email) {
        return { isValid: false, message: 'Vui lòng nhập email!' };
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        return { isValid: false, message: 'Email không hợp lệ!' };
    }
    
    // Check if email is already registered
    const existingUser = localStorage.getItem('registeredUser');
    if (existingUser) {
        const user = JSON.parse(existingUser);
        if (user.email === data.email) {
            return { isValid: false, message: 'Email này đã được đăng ký!' };
        }
    }
    
    if (!data.password) {
        return { isValid: false, message: 'Vui lòng nhập mật khẩu!' };
    }
    
    if (data.password.length < 6) {
        return { isValid: false, message: 'Mật khẩu phải có ít nhất 6 ký tự!' };
    }
    
    if (!data.confirmPassword) {
        return { isValid: false, message: 'Vui lòng nhập lại mật khẩu!' };
    }
    
    if (data.password !== data.confirmPassword) {
        return { isValid: false, message: 'Mật khẩu không khớp!' };
    }
    
    if (!data.gender) {
        return { isValid: false, message: 'Vui lòng chọn giới tính!' };
    }
    
    if (!data.birthDate.day || !data.birthDate.month || !data.birthDate.year) {
        return { isValid: false, message: 'Vui lòng chọn đầy đủ ngày sinh!' };
    }
    
    // Validate age (must be at least 13 years old)
    const birthDate = new Date(data.birthDate.year, data.birthDate.month - 1, data.birthDate.day);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (age < 13 || (age === 13 && monthDiff < 0) || 
        (age === 13 && monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        return { isValid: false, message: 'Bạn phải từ 13 tuổi trở lên để đăng ký!' };
    }
    
    return { isValid: true, message: '' };
}

// Generate unique user ID
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}