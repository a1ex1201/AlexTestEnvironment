const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const {time} = require('console');
const {randomInt} = require('crypto')
var session = require('express-session');

const app = express();
const saltrounds = 10;
const PORT = 3000;
let postIdnum = 0;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* */
app.use(session({
    secret: process.env.SESSION_SECRET || 'TofJ3EluF22QPoYVkQmg7N7BWVDwhr6F',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

/* serves static files from the public directory */
app.use(express.static(path.join(__dirname, 'public')));

/* serves the file landingpage.html when root url is requested */
app.get('/', (req, res) => {res.sendFile(path.join(__dirname, 'public', 'landingpage.html'))});

/* Handles signup requests and writes new user data to the current array of users in users.json*/
app.post('/signup', (req, res) => {

    /*variable setup for function*/
    const userData = req.body;
    const userPassword = userData.password;
    const filePath = path.join(__dirname, 'private', 'users.json');
    let users = [];

    /*default admin permission is false on signup*/
    userData.admin=false;

    /*password hashing via bcrypt*/
    bcrypt.hash(userPassword, saltrounds, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).json({message:'Internal server error'});
        }
        userData.password = hash;

        /*console log which provides signup details to console*/
        console.log('\x1b[35;40;1m','Recieved signup data:',userData);

    /*checks that users.json exists, reads and parses the data, appends the current array to include the new user, then overwrites users.json with the new data*/
    if(fs.existsSync(filePath)){
        try{
            const fileData = fs.readFileSync(filePath, 'utf8');
            users = fileData ? JSON.parse(fileData) : [];
        }
        catch (err){
            console.error('Error parsing users.json:', err);
            users = [];
        }
    }
        users.push(userData);
        fs.writeFileSync(filePath, JSON.stringify(users,null,2));
        res.json({message:'Signup successful'});

    });
});

/* handles login requests and checks against the current file of users before sending a response to the frontend*/
app.post('/login', (req, res) => {

    /*variable setup for function*/
    const {username,password} = req.body;
    const filePath = path.join(__dirname,'private','users.json');

    /*checks that users.json exist*/
    if(!fs.existsSync(filePath)){
        return res.status(500).json({message:'Internal server error, please try again later'});
    }
    /*parses users.json file data then checks if there is a user with that username currently stored*/
    try{const users = JSON.parse(fs.readFileSync(filePath,'utf8'));
    const user = users.find(u => u.username === username);
    if(!user) {
        return res.status(400).json({message:'Invalid username or password'});
    }

    /*password comparison using bcrypt*/
    bcrypt.compare(password, user.password, (err,result) =>{
        /*error handling if theres an error with bcrypt not allowing for comparison of hash values*/
        if (err){
            console.error('Error comparing passwords:', err);
            return res.status(500).json({message: 'Internal server error, please try again later'});
        }

        /*creates a session for the current user if hash values matched*/
        if(result){
            req.session.user = {username: user.username, email: user.email, admin: user.admin};
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('Error saving session:', saveErr);
                    return res.status(500).json({message:'Internal server error, please try again later'});
                }
                console.log('\x1b[32;40;1m','User logged in: @',req.session.user.username, "|| admin:", user.admin);
                res.json({message:'Login successful', username: req.session.user.username})
            });
        }

        /* returns message to the frontend if password hash values dont match*/
        else{
            res.status(400).json({message:'Invalid username or password'})
        }
    })}
    
    /* error handling if there is any issues with the backend function at time of login */
    catch (err){
        console.error('Error reading users.json:', err);
        return res.status(500).json({message: 'Internal server error, please try again later'})
    }
});

/*sends the users session data to the frontend*/
app.get('/dashboard', (req,res) => {

    /* checks if user is logged in by checking for existing session */
    if(!req.session.user) {
        return res.status(403).json({message:'You must log in first!'});
    }

    /* send the current user's account information to the front end */
    res.json({username:req.session.user.username, email:req.session.user.email, admin:req.session.user.admin});
});

/*handles post submission requests and stores them in the current file of posts*/
app.post('/submitPost', (req, res) => {

    /* checks if user is logged in by checking for existing session */
    if(!req.session.user) {
        return res.status(403).json({message:'You must log in first!'});
    }

    /*variable setup for current function*/
    const postData = {...req.body, username:req.session.user.username, timestamp: new Date().toISOString(), postId: postIdnum.toString(), admin:req.session.user.admin};
    const filePath = path.join(__dirname,'private','posts.json');
    let posts = [];
    postIdnum++;

    /*checks that posts.json exists then reads and parses the file data*/
    if(fs.existsSync(filePath)){
        try{
            const fileData = fs.readFileSync(filePath,'utf8');
            posts = fileData ? JSON.parse(fileData) : [];
        }

        /*error handling for issues parsing posts.json*/
        catch (err){
            console.error('Error parsing posts.json:', err);
            posts = [];
        }
    }
    /* appends the new posts data to the current array of posts then overwrites posts.json with the new data */
    posts.push(postData);
    fs.writeFileSync(filePath, JSON.stringify(posts,null,2));

    /* sends message to backend console with post submission details */
    console.log('\x1b[36;40;1m','New post submitted by', req.session.user.username, "@", postData.timestamp);
    res.json({message:'Post submitted'});
});

/*handles automatic post requests by the frontend for the main hompage, parses the file and sends it to the frontend*/
app.get('/getPosts', (req, res) => {

    /* checks if user is logged in by checking for existing session */
    if(!req.session.user) {
        return res.status(403).json({message:'You must log in first!'});
    }

    /*variable setup for current function*/
    const filePath = path.join(__dirname, 'private', 'posts.json');
    let posts = [];

    /*checks that posts.json exists then parses the file data before storing it as an array*/
    if (fs.existsSync(filePath)){
        try{
            const fileData = fs.readFileSync(filePath, 'utf8');
            posts = fileData ? JSON.parse(fileData) : [];
        }
        catch (err) {
            console.error('Error parsing post.json:', err);
            posts = [];
        }

        /* sends the array of posts to the frontend but in reverse so newer posts appear at the top*/   
        res.json(posts.reverse());
    }
});

/*handles automatic requests for posts by the frontend for the account page, parses the file and sends it to the frontend*/
app.get('/getUserPosts', (req, res) => {

    /* checks if user is logged in by checking for existing session */
    if(!req.session.user) {
        return res.status(403).json({message:'You must log in first!'});
    }

    /*variable setup for current function*/
    const filePath = path.join(__dirname, 'private', 'posts.json');
    let posts = [];

    /*checks that posts.json exists then parses the file data before storing it as an array*/
    if (fs.existsSync(filePath)){
        try{
            const fileData = fs.readFileSync(filePath, 'utf8');
            posts = fileData ? JSON.parse(fileData) : [];
        }
        catch (err) {
            console.error('Error parsing post.json:', err);
            posts = [];
        }
        
        /*filters the current array of posts for just posts where the username is the same as the current user then stores it in a seperate array*/
        const userPosts = posts.filter(post => post.username === req.session.user.username);

        /*sends the array of posts to the frontend but in reverse so newer posts appear at the top*/   
        res.json(userPosts.reverse());
    }
});

/*handles delete requests before appending the data in posts.json and then send the new data back to the frontend*/
app.delete('/deletePost/:postId', (req,res) => {
    /* checks if user is logged in by checking for existing session */
    if(!req.session.user){
        return res.status(403).json({message:'You must log in first!'})
    }

    /*variable setup for function*/
    const postId = req.params.postId;
    const filePath = path.join(__dirname, 'private', 'posts.json')
    let postIndex;
    let posts = [];

    /*checks that posts.json exists then parses the file data before storing it as an array*/
    if(fs.existsSync(filePath)){
        try { 
            const fileData = fs.readFileSync(filePath, 'utf8');
            posts = fileData ? JSON.parse(fileData): [];
        }
        catch(err){
            console.error('Error parsing posts.json:', err);
            posts = [];
        }
    }

    /*checks if the current users admin value=true, if not goes to default of only allowing delete on users own posts*/
    if ( req.session.user.admin){
        postIndex = posts.findIndex(post => post.postId === postId);
    }
    else{
        postIndex = posts.findIndex(post => post.postId === postId && post.username === req.session.user.username);
    }
    /*error handling if user attempts to delete a post that doesnt exist*/
    if(postIndex === -1){
        return res.status(404).json({message:'Post not found or you do not have permission to delete this post'})
    }

    /*removes the current post from the array of posts using .splice, then overwrites posts.json with current array*/
    posts.splice(postIndex, 1);
    fs.writeFileSync(filePath, JSON.stringify(posts, null, 2));

    /*sends a log to console with details of the post deleted and by which user*/
    console.log('\x1b[31;40;1m','Post deleted by', req.session.user.username, "Post ID:", postId);
});

/*starts up the server on port 3000*/
app.listen(PORT, () => {

    /*console log to notify of server startup*/
    console.log('\x1b[33;40;1m',`Server is running on http://localhost:${PORT}`);
});







