const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000; // Gunakan PORT dari environment variable jika tersedia

// Middleware untuk melayani file statis dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Middleware lainnya
app.use(cors());
app.use(bodyParser.json());

const DB_PATH = path.join(__dirname, 'database.json');

// Baca database dari file
function readDB() {
    const data = fs.readFileSync(DB_PATH);
    return JSON.parse(data);
}

// Tulis ke database
function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Login User
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
    }
    res.json({ user });
});

// Register User
app.post('/api/register', (req, res) => {
    const { username, password, bio } = req.body;
    const db = readDB();
    const existingUser = db.users.find(u => u.username === username);
    if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
    }
    const newUser = {
        id: Date.now(),
        username,
        password,
        bio: bio || "",
        profilePic: "/api/placeholder/100/100",
        followers: 0,
        following: 0
    };
    db.users.push(newUser);
    writeDB(db);
    res.json({ user: newUser });
});

// Get semua stories (recent/trending)
app.get('/api/stories', (req, res) => {
    const type = req.query.type || 'recent';
    const db = readDB();
    let stories = [...db.stories];
    if (type === 'trending') {
        stories.sort((a, b) => {
            const aLikes = db.likes.filter(l => l.storyId === a.id).length;
            const bLikes = db.likes.filter(l => l.storyId === b.id).length;
            return bLikes - aLikes;
        });
    } else {
        stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    stories = stories.map(story => {
        const author = db.users.find(u => u.id === story.authorId);
        return { ...story, author };
    });
    res.json({ stories });
});

// Search Stories
app.get('/api/stories/search', (req, res) => {
    const query = req.query.q.toLowerCase();
    const db = readDB();
    const filteredStories = db.stories.filter(s =>
        s.title.toLowerCase().includes(query) ||
        s.content.toLowerCase().includes(query)
    );
    res.json({ stories: filteredStories });
});

// Get story by ID
app.get('/api/stories/:id', (req, res) => {
    const storyId = parseInt(req.params.id);
    const db = readDB();
    const story = db.stories.find(s => s.id === storyId);
    if (!story) {
        return res.status(404).json({ message: "Story not found" });
    }
    const author = db.users.find(u => u.id === story.authorId);
    res.json({ story: { ...story, author } });
});

// Create story
app.post('/api/stories', (req, res) => {
    const { title, content, authorId } = req.body;
    const db = readDB();
    const newStory = {
        id: Date.now(),
        title,
        content,
        coverImage: "/api/placeholder/800/400",
        createdAt: new Date().toISOString(),
        authorId
    };
    db.stories.push(newStory);
    writeDB(db);
    res.json({ story: newStory });
});

// Like story
app.post('/api/stories/:id/like', (req, res) => {
    const storyId = parseInt(req.params.id);
    const { userId } = req.body;
    const db = readDB();
    const existingLike = db.likes.find(l => l.storyId === storyId && l.userId === userId);
    if (existingLike) {
        db.likes = db.likes.filter(l => !(l.storyId === storyId && l.userId === userId));
    } else {
        db.likes.push({ storyId, userId });
    }
    writeDB(db);
    res.json({ liked: !existingLike });
});

// Check like status
app.get('/api/stories/:id/like/:userId', (req, res) => {
    const storyId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    const db = readDB();
    const liked = db.likes.some(l => l.storyId === storyId && l.userId === userId);
    res.json({ liked });
});

// Get comments for story
app.get('/api/comments/:storyId', (req, res) => {
    const storyId = parseInt(req.params.storyId);
    const db = readDB();
    const comments = db.comments
        .filter(c => c.storyId === storyId)
        .map(comment => {
            const user = db.users.find(u => u.id === comment.userId);
            return { ...comment, user };
        });
    res.json({ comments });
});

// Add comment
app.post('/api/comments', (req, res) => {
    const { storyId, userId, content } = req.body;
    const db = readDB();
    const newComment = {
        id: Date.now(),
        storyId,
        userId,
        content,
        createdAt: new Date().toISOString()
    };
    db.comments.push(newComment);
    writeDB(db);
    res.json({ comment: newComment });
});

// Get user stats
app.get('/api/users/:id/stats', (req, res) => {
    const userId = parseInt(req.params.id);
    const db = readDB();
    const stories = db.stories.filter(s => s.authorId === userId).length;
    const likes = db.likes.filter(l => l.userId === userId).length;
    const followers = db.likes.filter(l => l.userId === userId).length; // dummy
    res.json({
        stats: {
            followers,
            following: 0,
            stories
        }
    });
});

// Get user stories
app.get('/api/stories/user/:id', (req, res) => {
    const userId = parseInt(req.params.id);
    const db = readDB();
    const stories = db.stories
        .filter(s => s.authorId === userId)
        .map(story => {
            const author = db.users.find(u => u.id === story.authorId);
            return { ...story, author };
        });
    res.json({ stories });
});

// Fallback route untuk handle error 404
app.use((req, res) => {
    res.status(404).send("Not Found");
});

// Jalankan server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
