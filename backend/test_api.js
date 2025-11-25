const http = require('http');

function testPostUser() {
    const data = JSON.stringify({
        full_name: "Test User",
        dob: "1990-01-01",
        mobile: "1234567890"
    });

    const options = {
        hostname: 'localhost',
        port: 8000,
        path: '/users',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = http.request(options, res => {
        console.log(`POST /users: ${res.statusCode}`);
        res.on('data', d => {
            process.stdout.write(d);
            console.log('\n');
            const response = JSON.parse(d);
            if (response.user_id) {
                testGetUser(response.user_id);
            }
        });
    });

    req.on('error', error => {
        console.error(error);
    });

    req.write(data);
    req.end();
}

function testGetUser(userId) {
    const options = {
        hostname: 'localhost',
        port: 8000,
        path: `/users/${userId}`,
        method: 'GET'
    };

    const req = http.request(options, res => {
        console.log(`GET /users/${userId}: ${res.statusCode}`);
        res.on('data', d => {
            process.stdout.write(d);
            console.log('\n');
        });
    });

    req.on('error', error => {
        console.error(error);
    });

    req.end();
}

testPostUser();
