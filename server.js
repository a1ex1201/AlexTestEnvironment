const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const app = express();
var session = require('express-session');
const { time } = require('console');
const { randomInt } = require('crypto');
const saltRounds = 10;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
let postIdnum = 0;

app.use(session({
    secret: process.env.SESSION_SECRET || 'TofJ3EluF22QPoYVkQmg7N7BWVDwhr6F',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 
    }
}));



app.use(express.static(path.join(__dirname, 'public')));


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'landingpage.html'));
});
app.post('/signup', (req, res) => {
    const userData = req.body;
    const userPassword = userData.password;
    userData.admin=false;
    bcrypt.hash(userPassword, saltRounds, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        userData.password = hash;
        console.log('\x1b[35;40;1m','Received signup data:', userData, "\n admin:", userData.admin);

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
            req.session.user = { username: user.username, email: user.email };
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('Error saving session:', saveErr);
                    return res.status(500).json({ message: 'Internal server error' });
                }
                console.log('\x1b[32;40;1m','User logged in: @',req.session.user.username, "|| admin:", user.admin);
                res.json({ message: 'Login successful', username: req.session.user.username });
            });
        } 
        else {
            res.status(400).json({ message: 'Invalid username or password' });
        }});
    } catch (err) {
        console.error('Error reading users.json:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});


app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.status(403).json({ message: 'You must log in first!' });
    }
    res.json({ message: 'Welcome to your dashboard', username: req.session.user.username, email: req.session.user.email  });
});


app.post('/submitPost', (req, res) => {
    if (!req.session.user) {
        return res.status(403).json({ message: 'You must log in first!' });
    }
    const postData = {...req.body, username: req.session.user.username, timestamp: new Date().toISOString(), postId: postIdnum.toString()};
    postIdnum++;
    const filePath = path.join(__dirname, 'private', 'posts.json');
    let posts = [];
    if (fs.existsSync(filePath)) {
        try {
            const fileData = fs.readFileSync(filePath, 'utf8');
            posts = fileData ? JSON.parse(fileData) : [];
        }     
        catch (err) {
        console.error('Error parsing posts.json:', err);
        posts = [];
        }
    }
    posts.push(postData);
    fs.writeFileSync(filePath, JSON.stringify(posts, null, 2));
    res.json({ message: 'Post saved successfully' });
    console.log('\x1b[36;40;1m','New post submitted by', req.session.user.username, "@", postData.timestamp);
});

app.get('/getPosts', (req, res) => {
    if (!req.session.user) {
        return res.status(403).json({ message: 'You must log in first!' });
    }
    const filePath = path.join(__dirname, 'private', 'posts.json');
    let posts = [];

    if (fs.existsSync(filePath)) {
        try {
            const fileData = fs.readFileSync(filePath, 'utf8');
            posts = fileData ? JSON.parse(fileData) : [];
        }
        catch (err) {
            console.error('Error parsing posts.json:', err);
            posts = [];
        }
        res.json(posts.reverse());
    }});


app.get('/logout', (req, res) => {
    console.log('\x1b[31;40;1m','User logged out', req.session.user.username);
    req.session.destroy(err => {
        if(err) return res.status(500).json({ message: 'Internal server error' });
        res.json({ message: 'Logout successful' });
    });
}); 

app.get('/getUserPosts', (req, res) => {
    if (!req.session.user) {
        return res.status(403).json({ message: 'You must log in first!' });
    }
    const filePath = path.join(__dirname, 'private', 'posts.json');
    let posts = [];

    if (fs.existsSync(filePath)) {
        try {
            const fileData = fs.readFileSync(filePath, 'utf8');
            posts = fileData ? JSON.parse(fileData) : [];
        }
        catch (err) {
            console.error('Error parsing posts.json:', err);
        }
    }
        const userPosts = posts.filter(post => post.username === req.session.user.username);
        res.json(userPosts.reverse());
});

app.delete('/deletePost/:postId', (req, res) => {
    if (!req.session.user) {
        return res.status(403).json({ message: 'You must log in first!' });
    }
    const postId = req.params.postId;
    const filePath = path.join(__dirname, 'private', 'posts.json');
    let posts = [];
    if (fs.existsSync(filePath)) {
        try {
            const fileData = fs.readFileSync(filePath, 'utf8');
            posts = fileData ? JSON.parse(fileData) : [];
        }
        catch (err) {
            console.error('Error parsing posts.json:', err);
            posts = [];
        }
    }
    const postIndex = posts.findIndex(post => post.postId === postId && post.username === req.session.user.username);
    if (postIndex === -1) {
        return res.status(404).json({ message: 'Post not found or you do not have permission to delete this post' });
    }
    posts.splice(postIndex, 1);
    fs.writeFileSync(filePath, JSON.stringify(posts, null, 2));
    res.json({ message: 'Post deleted successfully' });
    console.log('\x1b[31;40;1m','Post deleted by', req.session.user.username, "Post ID:", postId);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log('\x1b[33;40;1m',`Server is running on http://localhost:${PORT}`, );
});
