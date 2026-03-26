async function testApi() {
    try {
        const loginRes = await fetch('http://localhost:8778/api/v1/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_name: 'puspendu',
                password: 'Push@8240'
            })
        });

        if (!loginRes.ok) {
            console.log('Login failed:', await loginRes.text());
            return;
        }

        console.log('Login successful');
        const cookieHeader = loginRes.headers.get('set-cookie');

        // Fetch admins
        const res = await fetch('http://localhost:8778/api/v1/admin/get?type=admin', {
            headers: {
                'Cookie': cookieHeader
            }
        });

        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

testApi();
