const crypto = require('crypto');

// Sample users to create
const sampleUsers = [
    {
        firstName: 'Linh',
        lastName: 'Nguyễn',
        email: 'linh.nguyen@cosmic.space',
        password: 'password123',
        gender: 'female',
        birthDate: { day: 15, month: 3, year: 1998 }
    },
    {
        firstName: 'Minh',
        lastName: 'Trần',
        email: 'minh.tran@cosmic.space',
        password: 'password123',
        gender: 'male',
        birthDate: { day: 22, month: 7, year: 1995 }
    },
    {
        firstName: 'Hương',
        lastName: 'Lê',
        email: 'huong.le@cosmic.space',
        password: 'password123',
        gender: 'female',
        birthDate: { day: 8, month: 11, year: 1999 }
    },
    {
        firstName: 'Đức',
        lastName: 'Phạm',
        email: 'duc.pham@cosmic.space',
        password: 'password123',
        gender: 'male',
        birthDate: { day: 30, month: 5, year: 1996 }
    },
    {
        firstName: 'Thảo',
        lastName: 'Võ',
        email: 'thao.vo@cosmic.space',
        password: 'password123',
        gender: 'female',
        birthDate: { day: 12, month: 9, year: 1997 }
    },
    {
        firstName: 'Hoàng',
        lastName: 'Đinh',
        email: 'hoang.dinh@cosmic.space',
        password: 'password123',
        gender: 'male',
        birthDate: { day: 3, month: 1, year: 2000 }
    },
    {
        firstName: 'Mai',
        lastName: 'Bùi',
        email: 'mai.bui@cosmic.space',
        password: 'password123',
        gender: 'female',
        birthDate: { day: 25, month: 12, year: 1994 }
    },
    {
        firstName: 'Nam',
        lastName: 'Lý',
        email: 'nam.ly@cosmic.space',
        password: 'password123',
        gender: 'male',
        birthDate: { day: 18, month: 4, year: 1998 }
    }
];

async function createUser(userData) {
    try {
        // Generate salt and hash password (like frontend does)
        const salt = crypto.randomBytes(16).toString('hex');
        const hashedPassword = crypto.pbkdf2Sync(userData.password, salt, 100000, 32, 'sha256').toString('hex');

        const response = await fetch('http://localhost:3000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...userData,
                password: hashedPassword,
                confirmPassword: hashedPassword,
                salt: salt
            })
        });

        const result = await response.json();
        
        if (result.success) {
            console.log(`✅ Created user: ${userData.firstName} ${userData.lastName} (${userData.email})`);
        } else {
            console.log(`❌ Failed to create user ${userData.email}: ${result.message}`);
        }
        
        return result;
    } catch (error) {
        console.error(`💥 Error creating user ${userData.email}:`, error.message);
        return { success: false, error: error.message };
    }
}

async function seedUsers() {
    console.log('🌱 Starting to seed users...\n');
    
    for (const userData of sampleUsers) {
        await createUser(userData);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n🎉 User seeding completed!');
}

// Check if this script is being run directly
if (require.main === module) {
    seedUsers();
}

module.exports = { seedUsers, sampleUsers };
