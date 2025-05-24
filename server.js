require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// Log all environment variables available to the server process for debugging
console.log("Server starting. Available environment variables (subset for privacy):");
console.log(`SERVER_PORT (from process.env.PORT): ${process.env.PORT}`);
console.log(`SERVER_API_KEY (from process.env.API_KEY): ${process.env.API_KEY ? 'SET' : 'NOT SET or EMPTY'}`);
console.log(`SERVER_SUPABASE_URL (from process.env.SUPABASE_URL): ${process.env.SUPABASE_URL ? 'SET' : 'NOT SET or EMPTY'}`);
console.log(`SERVER_SUPABASE_ANON_KEY (from process.env.SUPABASE_ANON_KEY): ${process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET or EMPTY'}`);

// Handle the root path: serve dist/index.html with injected environment variables
// THIS MUST COME BEFORE THE GENERAL express.static that might serve index.html by default
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html'); // Serve the built HTML from the dist folder
  fs.readFile(indexPath, 'utf8', (err, htmlData) => {
    if (err) {
      console.error('Error reading dist/index.html:', err);
      return res.status(500).send('Internal Server Error reading HTML file.');
    }

    // Read environment variables (provided by Cloud Run)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const apiKey = process.env.API_KEY;

    // Log the apiKey value being used for replacement
    console.log(`SERVER (in app.get('/')): API_KEY from process.env to be injected: '${apiKey ? apiKey.substring(0, 10) + "..." : "NOT SET or EMPTY"}'`);
    console.log(`SERVER (in app.get('/')): Does htmlData contain '__REPLACE_WITH_YOUR_GEMINI_API_KEY__'? : ${htmlData.includes('__REPLACE_WITH_YOUR_GEMINI_API_KEY__')}`);

    let populatedHtml = htmlData;
    let apiKeyReplaced = false;

    if (supabaseUrl && supabaseUrl.trim() !== '') {
      populatedHtml = populatedHtml.replace(/__REPLACE_WITH_YOUR_SUPABASE_URL__/g, supabaseUrl);
    } else {
      console.warn('SERVER WARNING (in app.get('/')): SUPABASE_URL environment variable is not set or is empty. Placeholder will not be replaced.');
      populatedHtml = populatedHtml.replace(/__REPLACE_WITH_YOUR_SUPABASE_URL__/g, '');
    }

    if (supabaseAnonKey && supabaseAnonKey.trim() !== '') {
      populatedHtml = populatedHtml.replace(/__REPLACE_WITH_YOUR_SUPABASE_ANON_KEY__/g, supabaseAnonKey);
    } else {
      console.warn('SERVER WARNING (in app.get('/')): SUPABASE_ANON_KEY environment variable is not set or is empty. Placeholder will not be replaced.');
      populatedHtml = populatedHtml.replace(/__REPLACE_WITH_YOUR_SUPABASE_ANON_KEY__/g, '');
    }

    if (apiKey && apiKey.trim() !== '') {
      const originalHtmlLength = populatedHtml.length;
      populatedHtml = populatedHtml.replace(/__REPLACE_WITH_YOUR_GEMINI_API_KEY__/g, apiKey);
      if (populatedHtml.length !== originalHtmlLength || !populatedHtml.includes('__REPLACE_WITH_YOUR_GEMINI_API_KEY__')) {
        apiKeyReplaced = true;
      }
      console.log(`SERVER (in app.get('/')): API_KEY placeholder replacement attempted. Was it successful? ${apiKeyReplaced}`);
    } else {
      console.warn('SERVER WARNING (in app.get('/')): API_KEY environment variable is not set or is empty. Placeholder will not be replaced.');
      populatedHtml = populatedHtml.replace(/__REPLACE_WITH_YOUR_GEMINI_API_KEY__/g, ''); // Replace with empty string if API_KEY is missing
      console.log("SERVER (in app.get('/')): API_KEY placeholder replaced with empty string due to missing env var.");
    }
    
    res.setHeader('Content-Type', 'text/html');
    res.send(populatedHtml);
  });
});

// Serve static files from the 'dist' directory (where Vite places build assets)
// This will serve assets like CSS, JS, images from the 'dist' folder.
// Because app.get('/') is defined above, it will handle the root path before this middleware.
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    // For ES modules (JS files in dist/assets), 'application/javascript' is standard.
    // Vite handles CSS content types correctly by default when served from 'dist'.
    if (filePath.endsWith('.js')) { 
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

app.listen(port, () => {
  console.log(`Server listening on port ${port}. Ensure environment variables (SUPABASE_URL, SUPABASE_ANON_KEY, API_KEY) are correctly set in your Cloud Run service configuration and that the service has been redeployed.`);
});
