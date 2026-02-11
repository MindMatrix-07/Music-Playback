import 'dotenv/config';
import app from './src/app.js';

// Serve Static Assets (root for index.html etc.)
import express from 'express';
app.use(express.static('.'));

const PORT = 3001;

app.listen(PORT, () => {
    console.log(`🚀 Local Server running on http://localhost:${PORT}`);
});
