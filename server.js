// Enhanced Survey Platform Backend - Production Ready
require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
mongoose.set('strictQuery', true);
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true, // Allow all origins in development
  credentials: true
}));
app.use(express.static(path.join(__dirname, "public")));

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/survey_platform';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ Connected to Mongo DB");
})
.catch((error) => {
  console.error("❌ MongoDB connection error:", error);
  process.exit(1);
});

// Mongoose schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  surveysCreated: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Survey' }],
  surveysVoted: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Survey' }],
  createdAt: { type: Date, default: Date.now }
});

const surveySchema = new mongoose.Schema({
  title: String,
  question: { type: String, required: true },
  type: { type: String, required: true, enum: ['yesno', 'multiple', 'rating'] },
  options: [{
    text: String,
    votes: { type: Number, default: 0 }
  }],
  createdBy: { type: String, required: true },
  status: { type: String, default: 'active', enum: ['active', 'ended'] },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  expiryDate: Date,
  totalVotes: { type: Number, default: 0 }
});

const voteSchema = new mongoose.Schema({
  surveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true },
  username: { type: String, required: true },
  option: { type: String, required: true },
  votedAt: { type: Date, default: Date.now }
});

// Create indexes
userSchema.index({ username: 1 });
surveySchema.index({ createdBy: 1 });
surveySchema.index({ created_at: -1 });
voteSchema.index({ surveyId: 1, username: 1 });

const User = mongoose.model('User', userSchema);
const Survey = mongoose.model('Survey', surveySchema);
const Vote = mongoose.model('Vote', voteSchema);

// Helper function to ensure user exists in database
async function ensureUserExists(username) {
  let user = await User.findOne({ username });
  if (!user) {
    user = new User({
      username,
      surveysCreated: [],
      surveysVoted: []
    });
    await user.save();
  }
  return user;
}

// Helper function to check daily survey limit (removed - no limits)
async function checkDailyLimit(username) {
  return true; // No limits on survey creation
}

// Get all surveys (active and past)
app.get("/api/surveys", async (req, res) => {
  try {
    const surveys = await Survey.find().sort({ 
      created_at: -1,
      totalVotes: -1 
    });
    
    // Separate active and past surveys
    const now = new Date();
    const activeSurveys = surveys.filter(survey => {
      if (survey.status === "ended") return false;
      if (survey.expiryDate && new Date(survey.expiryDate) < now) return false;
      return true;
    });
    
    const pastSurveys = surveys.filter(survey => {
      if (survey.status === "ended") return true;
      if (survey.expiryDate && new Date(survey.expiryDate) < now) return true;
      return false;
    }).sort((a, b) => {
      // Sort past surveys by end date (most recent first)
      const aEndDate = a.status === "ended" ? a.updated_at || a.created_at : a.expiryDate || a.created_at;
      const bEndDate = b.status === "ended" ? b.updated_at || b.created_at : b.expiryDate || b.created_at;
      return new Date(bEndDate) - new Date(aEndDate);
    });
    
    res.json({ active: activeSurveys, past: pastSurveys });
  } catch (error) {
    console.error("Error fetching surveys:", error);
    res.status(500).json({ error: "Failed to fetch surveys" });
  }
});

// Get a single survey by ID
app.get("/api/surveys/:id", async (req, res) => {
  try {
    const surveyId = req.params.id;
    const survey = await Survey.findById(surveyId);
    
    if (!survey) {
      return res.status(404).json({ error: "Survey not found" });
    }
    
    res.json(survey);
  } catch (error) {
    console.error("Error fetching survey:", error);
    res.status(500).json({ error: "Failed to fetch survey" });
  }
});

// Create a new survey
app.post("/api/surveys", async (req, res) => {
  try {
    const { title, question, type, options, createdBy, expiryDate } = req.body;
    
    if (!createdBy) {
      return res.status(400).json({ error: "Username required to create survey" });
    }
    
    // Ensure user exists in database
    await ensureUserExists(createdBy);
    
    // Check daily limit
    const canCreate = await checkDailyLimit(createdBy);
    if (!canCreate) {
      return res.status(429).json({ error: "Daily survey limit reached (3 surveys per day)" });
    }
    
    let surveyOptions = [];
    
    // Handle different survey types
    switch (type) {
      case "yesno":
        surveyOptions = [
          { text: "Yes", votes: 0 },
          { text: "No", votes: 0 }
        ];
        break;
      case "multiple":
        surveyOptions = options.map(opt => ({ text: opt, votes: 0 }));
        break;
      case "rating":
        surveyOptions = [
          { text: "1 Star", votes: 0 },
          { text: "2 Stars", votes: 0 },
          { text: "3 Stars", votes: 0 },
          { text: "4 Stars", votes: 0 },
          { text: "5 Stars", votes: 0 }
        ];
        break;
      default:
        return res.status(400).json({ error: "Invalid survey type" });
    }
    
    const survey = new Survey({
      title: title || question,
      question,
      type,
      options: surveyOptions,
      createdBy,
      status: "active",
      created_at: new Date(),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      totalVotes: 0
    });
    
    const savedSurvey = await survey.save();
    
    // Update user's surveysCreated array
    await User.findOneAndUpdate(
      { username: createdBy },
      { $addToSet: { surveysCreated: savedSurvey._id } }
    );
    
    res.json({ message: "Survey created successfully!", survey: savedSurvey });
  } catch (error) {
    console.error("Error creating survey:", error);
    res.status(500).json({ error: "Failed to create survey" });
  }
});

// Vote on a survey option
app.post("/api/surveys/:id/vote", async (req, res) => {
  try {
    const { option, rating, username } = req.body;
    const surveyId = req.params.id;
    
    // Check if survey exists and is active
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({ error: "Survey not found" });
    }
    
    if (survey.status === "ended") {
      return res.status(400).json({ error: "Survey has ended" });
    }
    
    // Check if survey has expired
    if (survey.expiryDate && new Date(survey.expiryDate) < new Date()) {
      return res.status(400).json({ error: "Survey has expired" });
    }
    
    // Check if user has already voted (if username provided)
    if (username) {
      const existingVote = await Vote.findOne({ 
        surveyId: surveyId, 
        username: username 
      });
      if (existingVote) {
        return res.status(400).json({ error: "You have already voted on this survey" });
      }
    }
    
    // Find the option to update
    let optionToUpdate = null;
    if (survey.type === "rating" && rating) {
      optionToUpdate = survey.options.find(opt => opt.text === `${rating} Star${rating > 1 ? 's' : ''}`);
    } else {
      optionToUpdate = survey.options.find(opt => opt.text === option);
    }
    
    if (!optionToUpdate) {
      return res.status(400).json({ error: "Invalid option selected" });
    }
    
    // Update the vote count
    optionToUpdate.votes += 1;
    survey.totalVotes += 1;
    await survey.save();
    
    // Record the vote if username provided
    if (username) {
      // Ensure user exists in database
      await ensureUserExists(username);
      
      // Record the vote
      const vote = new Vote({
        surveyId: surveyId,
        username: username,
        option: option || `${rating} Star${rating > 1 ? 's' : ''}`,
        votedAt: new Date()
      });
      await vote.save();
      
      // Update user's surveysVoted array (prevent duplicates with $addToSet)
      await User.findOneAndUpdate(
        { username: username },
        { $addToSet: { surveysVoted: surveyId } }
      );
    }
    
    const updated = await Survey.findById(surveyId);
    res.json(updated);
  } catch (error) {
    console.error("Error voting:", error);
    res.status(500).json({ error: "Failed to vote" });
  }
});

// End a survey
app.post("/api/surveys/:id/end", async (req, res) => {
  try {
    const { createdBy } = req.body;
    const surveyId = req.params.id;
    
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({ error: "Survey not found" });
    }
    
    if (survey.createdBy !== createdBy) {
      return res.status(403).json({ error: "Only survey creator can end survey" });
    }
    
    await Survey.findByIdAndUpdate(
      surveyId,
      { $set: { status: "ended", updated_at: new Date() } }
    );
    
    res.json({ message: "Survey ended successfully" });
  } catch (error) {
    console.error("Error ending survey:", error);
    res.status(500).json({ error: "Failed to end survey" });
  }
});

// Delete a survey
app.delete("/api/surveys/:id", async (req, res) => {
  try {
    const { createdBy } = req.body;
    const surveyId = req.params.id;
    
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return res.status(404).json({ error: "Survey not found" });
    }
    
    if (survey.createdBy !== createdBy) {
      return res.status(403).json({ error: "Only survey creator can delete survey" });
    }
    
    // Delete the survey
    await Survey.findByIdAndDelete(surveyId);
    
    // Remove survey ID from user's surveysCreated array
    await User.findOneAndUpdate(
      { username: createdBy },
      { $pull: { surveysCreated: surveyId } }
    );
    
    // Delete all votes for this survey
    await Vote.deleteMany({ surveyId: surveyId });
    
    res.json({ message: "Survey deleted successfully" });
  } catch (error) {
    console.error("Error deleting survey:", error);
    res.status(500).json({ error: "Failed to delete survey" });
  }
});

// Get user stats
app.get("/api/users/:username/stats", async (req, res) => {
  try {
    const { username } = req.params;
    
    // Check if user exists
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Get surveys created count from user's surveysCreated array
    const surveysCreated = user.surveysCreated ? user.surveysCreated.length : 0;
    
    // Get total votes count from votes collection
    const totalVotes = await Vote.countDocuments({ username: username });
    
    res.json({
      surveysCreated,
      totalVotes
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ error: "Failed to fetch user stats" });
  }
});

// Check if user has voted on a survey
app.get("/api/surveys/:id/voted", async (req, res) => {
  try {
    const { username } = req.query;
    const surveyId = req.params.id;
    
    if (!username) {
      return res.json({ hasVoted: false });
    }
    
    const existingVote = await Vote.findOne({ 
      surveyId: surveyId, 
      username: username 
    });
    
    res.json({ hasVoted: !!existingVote });
  } catch (error) {
    console.error("Error checking vote status:", error);
    res.status(500).json({ error: "Failed to check vote status" });
  }
});

// Get user's created surveys
app.get("/api/users/:username/surveys", async (req, res) => {
  try {
    const { username } = req.params;
    
    // Check if user exists
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Get surveys using the user's surveysCreated array
    const surveyIds = user.surveysCreated || [];
    const surveys = await Survey.find({ 
      _id: { $in: surveyIds } 
    }).sort({ created_at: -1 });
    
    res.json(surveys);
  } catch (error) {
    console.error("Error fetching user surveys:", error);
    res.status(500).json({ error: "Failed to fetch user surveys" });
  }
});

// Get user's voting history
app.get("/api/users/:username/votes", async (req, res) => {
  try {
    const { username } = req.params;
    
    // Check if user exists
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Get all votes by this user with survey details
    const votes = await Vote.aggregate([
      { $match: { username: username } },
      { $lookup: {
        from: "surveys",
        localField: "surveyId",
        foreignField: "_id",
        as: "survey"
      }},
      { $unwind: "$survey" },
      { $project: {
        surveyId: 1,
        option: 1,
        votedAt: 1,
        surveyTitle: "$survey.title",
        surveyQuestion: "$survey.question"
      }},
      { $sort: { votedAt: -1 } }
    ]);
    
    res.json(votes);
  } catch (error) {
    console.error("Error fetching user votes:", error);
    res.status(500).json({ error: "Failed to fetch user votes" });
  }
});

// Serve survey page with dynamic meta tags
app.get("/survey/:id", async (req, res) => {
  try {
    const surveyId = req.params.id;
    const survey = await Survey.findById(surveyId);
    
    if (!survey) {
      return res.status(404).sendFile(path.join(__dirname, "public", "index.html"));
    }
    
    const isExpired = survey.expiryDate && new Date(survey.expiryDate) < new Date();
    const isEnded = survey.status === "ended";
    const isActive = !isEnded && !isExpired;
    
    const metaTitle = survey.title || survey.question;
    const metaDescription = isActive 
      ? `Vote on this survey: ${survey.question}` 
      : `View results for: ${survey.question}`;
    
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${metaTitle}</title>
        <meta name="description" content="${metaDescription}">
        
        <!-- OpenGraph Meta Tags -->
        <meta property="og:title" content="${metaTitle}">
        <meta property="og:description" content="${metaDescription}">
        <meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}">
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="Survey Platform">
        
        <!-- Twitter Card Meta Tags -->
        <meta name="twitter:card" content="summary">
        <meta name="twitter:title" content="${metaTitle}">
        <meta name="twitter:description" content="${metaDescription}">
        
        <link rel="stylesheet" href="/style.css">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      </head>
      <body>
        <div class="container">
          <header class="main-header">
            <h1><i class="fas fa-poll"></i> Online Survey Platform</h1>
            <p class="subtitle">Create and participate in surveys with real-time results</p>
            
            <!-- User Authentication Section -->
            <div id="authSection" class="auth-section">
              <div id="loginForm" class="auth-form">
                <input type="text" id="usernameInput" placeholder="Enter username..." maxlength="20">
                <button onclick="login()" class="auth-btn login-btn">
                  <i class="fas fa-sign-in-alt"></i> Login / Register
                </button>
              </div>
              <div id="userInfo" class="user-info" style="display: none;">
                <div class="profile-dropdown">
                  <button id="profileAvatar" class="profile-avatar" onclick="toggleProfileDropdown()">
                    <span id="avatarLetter"></span>
                  </button>
                  <div id="profileDropdown" class="profile-dropdown-menu">
                    <button onclick="showProfile()" class="dropdown-item">
                      <i class="fas fa-user"></i> Profile
                    </button>
                    <button onclick="logout()" class="dropdown-item">
                      <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main>
            <!-- Active Surveys Section -->
            <section class="surveys-section">
              <h2><i class="fas fa-list"></i> Survey</h2>
              <div id="activeSurveys" class="surveys-grid"></div>
              <div id="activeEmptyState" class="empty-state" style="display: none;">
                <i class="fas fa-poll-h"></i>
                <h3>Survey not found</h3>
                <p>This survey may have been deleted or doesn't exist.</p>
              </div>
            </section>
          </main>
        </div>

        <!-- User Profile Modal -->
        <div id="profileModal" class="modal">
          <div class="modal-content">
            <div class="modal-header">
              <h3><i class="fas fa-user"></i> User Profile</h3>
              <button onclick="closeProfile()" class="close-btn">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="modal-body">
              <div class="profile-header">
                <h2 id="profileUsername">Username</h2>
              </div>
              
              <div class="profile-stats">
                <div class="stat-item">
                  <i class="fas fa-poll"></i>
                  <span class="stat-label">Surveys Created</span>
                  <span class="stat-value" id="surveysCreated">0</span>
                </div>
                <div class="stat-item">
                  <i class="fas fa-vote-yea"></i>
                  <span class="stat-label">Total Votes</span>
                  <span class="stat-value" id="totalVotes">0</span>
                </div>
              </div>
              
              <div class="profile-sections">
                <div class="profile-section">
                  <h5><i class="fas fa-plus-circle"></i> Your Surveys</h5>
                  <div id="userSurveys" class="profile-surveys-list">
                    <div class="loading-text">Loading...</div>
                  </div>
                </div>
                
                <div class="profile-section">
                  <h5><i class="fas fa-vote-yea"></i> Your Votes</h5>
                  <div id="userVotes" class="profile-votes-list">
                    <div class="loading-text">Loading...</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Success Message Toast -->
        <div id="successToast" class="toast">
          <i class="fas fa-check-circle"></i>
          <span>Survey created successfully!</span>
        </div>

        <!-- Error Message Toast -->
        <div id="errorToast" class="toast error">
          <i class="fas fa-exclamation-circle"></i>
          <span>An error occurred!</span>
        </div>

        <!-- Confirmation Modal -->
        <div id="confirmationModal" class="confirmation-modal">
          <div class="confirmation-content">
            <div class="confirmation-icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="confirmation-title" id="confirmationTitle">Confirm Action</div>
            <div class="confirmation-message" id="confirmationMessage">Are you sure you want to proceed?</div>
            <div class="confirmation-actions">
              <button class="confirm-btn" id="confirmBtn">
                <i class="fas fa-check"></i> Confirm
              </button>
              <button class="cancel-btn" id="cancelBtn">
                <i class="fas fa-times"></i> Cancel
              </button>
            </div>
          </div>
        </div>

        <script src="/script.js"></script>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error("Error serving survey page:", error);
    res.status(500).sendFile(path.join(__dirname, "public", "index.html"));
  }
});

// Serve the main page for all other routes (SPA)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📱 Local: http://localhost:${PORT}`);
  }
});
