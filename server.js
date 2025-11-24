const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const app = express();
const saltRounds = 10;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'landingpage.html'));
});

app.post('/signup', (req, res) => {
    const userData = req.body;
    const userPassword = userData.password;

    bcrypt.hash(userPassword, saltRounds, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        userData.password = hash;
        console.log('Received signup data:', userData);

        const filePath = path.join(__dirname, 'private', 'users.json');
        let users = [];

        if (fs.existsSync(filePath)) {
            try {
            const fileData = fs.readFileSync(filePath, 'utf8');
            users = fileData ? JSON.parse(fileData) : [];
        }     
        catch (err) {
        console.error('Error parsing users.json:', err);
        users = [];
        }
    }
    users.push(userData);
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
    res.json({ message: 'User data saved successfully' });
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const filePath = path.join(__dirname, 'private', 'users.json');
    if (!fs.existsSync(filePath)) {
        return res.status(400).json({ message: 'Invalid username or password' });
    }
    try {const users = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const user = users.find(u => u.username === username);
    if (!user) {
        return res.status(400).json({ message: 'Invalid username or password' });
    }
    bcrypt.compare(password, user.password, (err, result) => {
        if (err) {
            console.error('error comparing passwords:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        if (result) {
            res.json({ message: 'Login successful' });
        } 
        else {
            res.status(400).json({ message: 'Invalid username or password' });
        }});
    } catch (err) {
        console.error('Error reading users.json:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
