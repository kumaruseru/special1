// Test user registration
fetch('https://special-n8pm.onrender.com/api/register', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        name: 'Test User',
        email: 'nghiaht2810@gmail.com',
        password: 'test123'
    })
})
.then(response => response.json())
.then(data => {
    console.log('Registration result:', data);
    
    if (data.success) {
        // Store test user data
        localStorage.setItem('testToken', data.token);
        localStorage.setItem('authToken', data.token); // For TelegramAuth
        localStorage.setItem('userName', data.user.name);
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('userId', data.user.id);
        
        console.log('✅ Test user created and tokens stored!');
        console.log('User:', data.user);
        console.log('Token:', data.token.slice(0, 20) + '...');
        
        // Now test token refresh
        return fetch('https://special-n8pm.onrender.com/api/refresh-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'nghiaht2810@gmail.com'
            })
        });
    } else {
        throw new Error(data.message || 'Registration failed');
    }
})
.then(response => response.json())
.then(data => {
    console.log('Token refresh result:', data);
    if (data.success) {
        console.log('✅ Token refresh working!');
        console.log('Refreshed token:', data.token.slice(0, 20) + '...');
    }
})
.catch(error => {
    console.error('❌ Error:', error);
});
