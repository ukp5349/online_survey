// Enhanced Survey Platform with All Features
let currentUser = null;
let surveys = { active: [], past: [] };
let isLoading = false;
let isSingleSurveyView = false;

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
  setupEventListeners();
  
  // Check if we're viewing a single survey
  const path = window.location.pathname;
  if (path.startsWith('/survey/')) {
    const surveyId = path.split('/survey/')[1];
    isSingleSurveyView = true;
    loadSingleSurvey(surveyId);
  } else {
    loadSurveys();
  }
});

function initializeApp() {
  // Check if user is logged in
  currentUser = localStorage.getItem("surveyUser");
  if (currentUser) {
    showUserInfo();
    showCreateSurveySection();
  } else {
    showLoginForm();
  }
  
  // Set minimum date for expiry input
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById("expiryDate").min = now.toISOString().slice(0, 16);
}

function setupEventListeners() {
  // Past surveys toggle
  const toggleBtn = document.getElementById("togglePastSurveys");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", togglePastSurveys);
  }
  
  // Survey form submission
  const surveyForm = document.getElementById("surveyForm");
  if (surveyForm) {
    surveyForm.addEventListener("submit", handleSurveyCreation);
  }
  
  // Modal close on outside click
  window.addEventListener("click", (e) => {
    const modal = document.getElementById("profileModal");
    if (e.target === modal) {
      closeProfile();
    }
    
    // Close profile dropdown when clicking outside
    const dropdown = document.getElementById("profileDropdown");
    const avatar = document.getElementById("profileAvatar");
    if (dropdown && avatar && !avatar.contains(e.target) && !dropdown.contains(e.target)) {
      closeProfileDropdown();
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.form) {
        activeElement.form.dispatchEvent(new Event("submit"));
      }
    }
  });
}

// Authentication Functions
function login() {
  const username = document.getElementById("usernameInput").value.trim();
  if (!username) {
    showErrorToast("Please enter a username!");
    return;
  }
  
  if (username.length < 3) {
    showErrorToast("Username must be at least 3 characters long!");
    return;
  }
  
  currentUser = username;
  localStorage.setItem("surveyUser", username);
  showUserInfo();
  showCreateSurveySection();
  loadSurveys();
  showSuccessToast(`Welcome, ${username}!`);
}

function logout() {
  currentUser = null;
  localStorage.removeItem("surveyUser");
  localStorage.removeItem("surveyVotes");
  showLoginForm();
  hideCreateSurveySection();
  closeProfileDropdown();
  
  if (isSingleSurveyView) {
    // If on single survey view, redirect to main page
    window.location.href = "/";
  } else {
    loadSurveys();
  }
  
  showSuccessToast("Logged out successfully!");
}

function showLoginForm() {
  document.getElementById("loginForm").style.display = "flex";
  document.getElementById("userInfo").style.display = "none";
}

function showUserInfo() {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("userInfo").style.display = "flex";
  
  // Set username display (first word only)
  const displayUsername = document.getElementById("displayUsername");
  const firstWord = currentUser.split(' ')[0];
  displayUsername.textContent = firstWord;
}

function showCreateSurveySection() {
  document.getElementById("createSurveySection").style.display = "block";
}

function hideCreateSurveySection() {
  const section = document.getElementById("createSurveySection");
  if (section) {
    section.style.display = "none";
  }
}

// Profile Dropdown Functions
function toggleProfileDropdown() {
  const dropdown = document.getElementById("profileDropdown");
  if (dropdown) {
    dropdown.classList.toggle("show");
  }
}

function closeProfileDropdown() {
  const dropdown = document.getElementById("profileDropdown");
  if (dropdown) {
    dropdown.classList.remove("show");
  }
}

// Survey Type Handling
function handleSurveyTypeChange() {
  const type = document.getElementById("surveyType").value;
  const optionsGroup = document.getElementById("optionsGroup");
  
  if (type === "multiple") {
    optionsGroup.style.display = "block";
  } else {
    optionsGroup.style.display = "none";
  }
}

// Survey Management
async function loadSurveys() {
  try {
    // Show loading skeleton
    showLoadingSkeleton();
    
    const response = await fetch("/api/surveys");
    surveys = await response.json();
    
    if (isSingleSurveyView) {
      // Hide sections not needed for single survey view
      const pastSection = document.querySelector(".past-surveys-section");
      const newSection = document.querySelector(".new-survey-section");
      if (pastSection) pastSection.style.display = "none";
      if (newSection) newSection.style.display = "none";
    }
    
    // Hide loading skeleton
    hideLoadingSkeleton();
    
    renderActiveSurveys();
    renderPastSurveys();
  } catch (error) {
    console.error("Error loading surveys:", error);
    hideLoadingSkeleton();
    showErrorToast("Error loading surveys. Please try again.");
  }
}

function showLoadingSkeleton() {
  const activeSkeleton = document.getElementById("activeLoadingSkeleton");
  const pastSkeleton = document.getElementById("pastLoadingSkeleton");
  
  if (activeSkeleton) activeSkeleton.style.display = "grid";
  if (pastSkeleton) pastSkeleton.style.display = "grid";
}

function hideLoadingSkeleton() {
  const activeSkeleton = document.getElementById("activeLoadingSkeleton");
  const pastSkeleton = document.getElementById("pastLoadingSkeleton");
  
  if (activeSkeleton) activeSkeleton.style.display = "none";
  if (pastSkeleton) pastSkeleton.style.display = "none";
}

// Load single survey for direct link access
async function loadSingleSurvey(surveyId) {
  try {
    const response = await fetch(`/api/surveys/${surveyId}`);
    if (!response.ok) {
      throw new Error("Survey not found");
    }
    
    const survey = await response.json();
    
    // Hide sections not needed for single survey view
    document.querySelector(".past-surveys-section").style.display = "none";
    document.querySelector(".new-survey-section").style.display = "none";
    
    // Create single survey view
    const container = document.getElementById("activeSurveys");
    const emptyState = document.getElementById("activeEmptyState");
    
    container.innerHTML = "";
    emptyState.style.display = "none";
    
    const surveyCard = createSurveyCard(survey, survey.status === "ended" || (survey.expiryDate && new Date(survey.expiryDate) < new Date()) ? "past" : "active");
    container.appendChild(surveyCard);
    
    // Add back to main page button
    const backButton = document.createElement("div");
    backButton.className = "back-to-main";
    backButton.innerHTML = `
      <a href="/" class="back-btn">
        <i class="fas fa-arrow-left"></i> Back to All Surveys
      </a>
    `;
    container.parentNode.insertBefore(backButton, container);
    
  } catch (error) {
    console.error("Error loading survey:", error);
    showErrorToast("Survey not found or error loading survey.");
  }
}

function renderActiveSurveys() {
  const container = document.getElementById("activeSurveys");
  const emptyState = document.getElementById("activeEmptyState");
  
  if (surveys.active.length === 0) {
    container.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }
  
  emptyState.style.display = "none";
  container.innerHTML = "";
  
  surveys.active.forEach(survey => {
    const surveyCard = createSurveyCard(survey, "active");
    container.appendChild(surveyCard);
  });
}

function renderPastSurveys() {
  const container = document.getElementById("pastSurveys");
  const emptyState = document.getElementById("pastEmptyState");
  
  if (surveys.past.length === 0) {
    container.innerHTML = "";
    emptyState.style.display = "block";
    return;
  }
  
  emptyState.style.display = "none";
    container.innerHTML = "";

  surveys.past.forEach(survey => {
    const surveyCard = createSurveyCard(survey, "past");
    container.appendChild(surveyCard);
  });
}

function createSurveyCard(survey, type) {
  const card = document.createElement("div");
  card.className = `survey-card ${type === "past" ? "ended" : ""}`;
  card.setAttribute('data-survey-id', survey._id);
  
  const hasVoted = hasUserVoted(survey._id);
  const isExpired = survey.expiryDate && new Date(survey.expiryDate) < new Date();
  const isEnded = survey.status === "ended";
  const canEnd = currentUser === survey.createdBy && !isEnded && !isExpired;
  const isPastSurvey = type === "past" || isEnded || isExpired;

        let optionsHTML = "";
  let chartHTML = "";
  
  if (survey.type === "rating") {
    optionsHTML = createRatingOptions(survey, hasVoted || isEnded || isExpired);
  } else {
    optionsHTML = createMultipleChoiceOptions(survey, hasVoted || isEnded || isExpired);
  }
  
  // Only show chart for past/ended surveys
  const totalVotes = survey.options.reduce((sum, opt) => sum + opt.votes, 0);
  if (totalVotes > 0 && isPastSurvey) {
    chartHTML = `<div class="chart-container"><canvas id="chart-${survey._id}"></canvas></div>`;
  }
  
  card.innerHTML = `
    <div class="survey-header">
      <div>
        ${survey.title ? `<div class="survey-title">${survey.title}</div>` : ""}
        <div class="survey-question">${survey.question}</div>
      </div>
      <div class="survey-meta">
        <div class="survey-type">${getSurveyTypeLabel(survey.type)}</div>
        <div class="survey-creator">by ${survey.createdBy}</div>
        ${isExpired ? '<div class="survey-expiry">Expired</div>' : ''}
        ${isEnded ? '<div class="survey-ended">Ended</div>' : ''}
        ${survey.expiryDate ? `<div>Expires: ${new Date(survey.expiryDate).toLocaleDateString()}</div>` : ''}
      </div>
    </div>
    
    <div class="survey-options">
      ${optionsHTML}
    </div>
    
    ${chartHTML}
    
    <div class="survey-actions">
      ${!hasVoted && !isEnded && !isExpired ? 
        `<button class="vote-btn" onclick="voteSurvey('${survey._id}')">
          <i class="fas fa-vote-yea"></i> Vote Now
        </button>` : 
        `<button class="vote-btn" disabled>
          <i class="fas fa-check"></i> ${hasVoted ? 'Voted' : isEnded ? 'Ended' : 'Expired'}
        </button>`
      }
      ${!isSingleSurveyView ? 
        `<button class="share-btn" onclick="shareSurvey('${survey._id}')">
          <i class="fas fa-share"></i> Share
        </button>` : ''
      }
      ${canEnd ? 
        `<button class="end-survey-btn" onclick="endSurvey('${survey._id}')">
          <i class="fas fa-stop"></i> End Survey
        </button>` : ''
      }
      ${isPastSurvey && currentUser === survey.createdBy ? 
        `<button class="delete-survey-btn" onclick="deleteSurvey('${survey._id}')">
          <i class="fas fa-trash"></i> Delete
        </button>` : ''
      }
    </div>
  `;
  
  // Create chart if there are votes and it's a past survey
  if (totalVotes > 0 && isPastSurvey) {
    setTimeout(() => createChart(survey), 100);
  }
  
  // Add star rating interactions for rating surveys
  if (survey.type === "rating" && !(hasVoted || isEnded || isExpired)) {
    setTimeout(() => setupStarRating(survey._id), 100);
  }
  
  return card;
}

function createMultipleChoiceOptions(survey, disabled) {
  const totalVotes = survey.options.reduce((sum, opt) => sum + opt.votes, 0);
  
  return survey.options.map(opt => {
    const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
    
    return `
      <div class="option-item">
        <label class="option-label">
          <input type="radio" name="vote-${survey._id}" value="${opt.text}" ${disabled ? 'disabled' : ''}>
          <span class="option-text">${opt.text}</span>
          <div class="progress-container">
            <div class="progress-bar" style="width: ${percentage}%">
              <span class="progress-percentage">${percentage}%</span>
            </div>
          </div>
        </label>
      </div>
    `;
  }).join("");
}

function createRatingOptions(survey, disabled) {
  const totalVotes = survey.options.reduce((sum, opt) => sum + opt.votes, 0);
  
  return `
    <div class="rating-options" data-survey-id="${survey._id}">
      ${survey.options.map((opt, index) => {
        const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
        const rating = index + 1;
        
        return `
          <div class="rating-option">
            <input type="radio" name="vote-${survey._id}" value="${rating}" id="rating-${survey._id}-${rating}" ${disabled ? 'disabled' : ''}>
            <label for="rating-${survey._id}-${rating}" class="rating-star" data-rating="${rating}">★</label>
            <div class="progress-container">
              <div class="progress-bar" style="width: ${percentage}%">
                <span class="progress-percentage">${percentage}%</span>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function createChart(survey) {
  const canvas = document.getElementById(`chart-${survey._id}`);
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  const totalVotes = survey.options.reduce((sum, opt) => sum + opt.votes, 0);
  
  if (totalVotes === 0) return;
  
  const labels = survey.options.map(opt => {
    if (survey.type === "rating") {
      const rating = survey.options.indexOf(opt) + 1;
      return `${rating} Star${rating > 1 ? 's' : ''}`;
    }
    return opt.text;
  });
  
  const data = survey.options.map(opt => opt.votes);
  const colors = [
    '#0077ff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#20c997'
  ];
  
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors.slice(0, data.length),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true
          }
        }
      }
    }
  });
}

// Voting Functions
function hasUserVoted(surveyId) {
  const votes = JSON.parse(localStorage.getItem("surveyVotes") || "{}");
  return votes[surveyId] || false;
}

function markUserVoted(surveyId) {
  const votes = JSON.parse(localStorage.getItem("surveyVotes") || "{}");
  votes[surveyId] = true;
  localStorage.setItem("surveyVotes", JSON.stringify(votes));
}

async function voteSurvey(surveyId) {
  if (isLoading) return;
  
  const survey = [...surveys.active, ...surveys.past].find(s => s._id === surveyId);
  if (!survey) return;
  
  let selectedValue = null;
  
  if (survey.type === "rating") {
    const selected = document.querySelector(`input[name="vote-${surveyId}"]:checked`);
    if (!selected) {
      showErrorToast("Please select a rating!");
      return;
    }
    selectedValue = parseInt(selected.value);
  } else {
    const selected = document.querySelector(`input[name="vote-${surveyId}"]:checked`);
    if (!selected) {
      showErrorToast("Please select an option!");
      return;
    }
    selectedValue = selected.value;
  }
  
  const voteBtn = document.querySelector(`button[onclick="voteSurvey('${surveyId}')"]`);
  const originalText = voteBtn.innerHTML;
  
  try {
    addLoadingState(voteBtn);
    voteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Voting...';
    
    const response = await fetch(`/api/surveys/${surveyId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        option: selectedValue,
        rating: survey.type === "rating" ? selectedValue : undefined,
        username: currentUser
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Vote failed");
    }
    
    // Mark as voted locally
    markUserVoted(surveyId);
    
    // Update UI with animation
    voteBtn.innerHTML = '<i class="fas fa-check"></i> Voted!';
    voteBtn.style.background = "var(--success-green)";
    voteBtn.disabled = true;
    
    // Animate progress bars
    setTimeout(() => {
      animateProgressBars();
    }, 100);
    
    // Reload surveys
    await loadSurveys();
    
    showSuccessToast("Thank you for voting!");
    
  } catch (error) {
    console.error("Error voting:", error);
    showErrorToast(error.message || "Error submitting vote. Please try again.");
  } finally {
    removeLoadingState(voteBtn);
    if (!voteBtn.disabled) {
      voteBtn.innerHTML = originalText;
      voteBtn.style.background = "";
    }
  }
}

async function endSurvey(surveyId) {
  if (!currentUser) return;
  
  showConfirmation(
    "End Survey",
    "Are you sure you want to end this survey? This action cannot be undone.",
    async () => {
      try {
        const response = await fetch(`/api/surveys/${surveyId}/end`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ createdBy: currentUser })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to end survey");
        }
        
        showSuccessToast("Survey ended successfully!");
        await loadSurveys();
        
      } catch (error) {
        console.error("Error ending survey:", error);
        showErrorToast(error.message || "Error ending survey. Please try again.");
      }
    }
  );
}

async function deleteSurvey(surveyId) {
  if (!currentUser) return;
  
  showConfirmation(
    "Delete Survey",
    "Are you sure you want to delete this survey? This action cannot be undone and all votes will be lost.",
    async () => {
      try {
        const response = await fetch(`/api/surveys/${surveyId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ createdBy: currentUser })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to delete survey");
        }
        
        showSuccessToast("Survey deleted successfully!");
        
        // Animate survey card removal
        const surveyCard = document.querySelector(`[data-survey-id="${surveyId}"]`);
        if (surveyCard) {
          surveyCard.style.transform = "scale(0.95)";
          surveyCard.style.opacity = "0";
          setTimeout(async () => {
            await loadSurveys();
          }, 300);
        } else {
          await loadSurveys();
        }
        
      } catch (error) {
        console.error("Error deleting survey:", error);
        showErrorToast(error.message || "Error deleting survey. Please try again.");
      }
    }
  );
}

// Survey Creation
async function handleSurveyCreation(e) {
    e.preventDefault();

  if (!currentUser) {
    showErrorToast("Please log in to create surveys!");
    return;
  }
  
  if (isLoading) return;
  
  // Custom validation before proceeding
  const validationError = validateSurveyForm();
  if (validationError) {
    showErrorToast(validationError);
    return;
  }
  
  const submitBtn = document.querySelector(".create-survey-btn");
  const originalText = submitBtn.innerHTML;
  
  try {
    addLoadingState(submitBtn);
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    
    const title = document.getElementById("surveyTitle").value.trim();
    const question = document.getElementById("question").value.trim();
    const type = document.getElementById("surveyType").value;
    const expiryDate = document.getElementById("expiryDate").value;
    
    let options = [];
    if (type === "multiple") {
      options = getValidOptions();
    }
    
    const surveyData = {
      title: title || undefined,
      question,
      type,
      options: type === "multiple" ? options : undefined,
      createdBy: currentUser,
      expiryDate: expiryDate || undefined
    };
    
    const response = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      body: JSON.stringify(surveyData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create survey");
    }
    
    // Reset form
    document.getElementById("surveyForm").reset();
    document.getElementById("optionsGroup").style.display = "none";
    
    // Reset options container to default state
    document.getElementById("optionsContainer").innerHTML = `
      <input type="text" name="options" placeholder="Option 1">
      <input type="text" name="options" placeholder="Option 2">
    `;
    
    // Show success feedback with animation
    submitBtn.innerHTML = '<i class="fas fa-check"></i> Created!';
    submitBtn.style.background = "var(--success-green)";
    submitBtn.style.transform = "scale(1.05)";
    
    // Reload surveys
    await loadSurveys();
    
    // Scroll to surveys section with smooth animation
    document.querySelector(".surveys-section").scrollIntoView({ 
      behavior: "smooth",
      block: "start"
    });
    
    showSuccessToast("Survey created successfully!");
    
  } catch (error) {
    console.error("Error creating survey:", error);
    showErrorToast(error.message || "Error creating survey. Please try again.");
  } finally {
    removeLoadingState(submitBtn);
    submitBtn.innerHTML = originalText;
    submitBtn.style.background = "";
  }
}

// Custom validation function
function validateSurveyForm() {
  const question = document.getElementById("question").value.trim();
  const type = document.getElementById("surveyType").value;
  
  // Check if question is provided
  if (!question) {
    return "Please enter a survey question!";
  }
  
  // Check if survey type is selected
  if (!type) {
    return "Please select a survey type!";
  }
  
  // For multiple choice surveys, validate options
  if (type === "multiple") {
    const validOptions = getValidOptions();
    
    if (validOptions.length < 2) {
      return "Please add at least 2 valid options for multiple choice surveys!";
    }
    
    if (validOptions.length > 6) {
      return "Maximum 6 options allowed for multiple choice surveys!";
    }
    
    // Check for duplicate options
    const uniqueOptions = [...new Set(validOptions.map(opt => opt.toLowerCase().trim()))];
    if (uniqueOptions.length !== validOptions.length) {
      return "Please ensure all options are unique!";
    }
  }
  
  return null; // No validation errors
}

// Get valid options (visible and non-empty)
function getValidOptions() {
  const allOptionInputs = document.querySelectorAll('input[name="options"]');
  const validOptions = [];
  
  allOptionInputs.forEach(input => {
    // Check if input is visible and has a value
    const isVisible = input.offsetParent !== null && 
                     input.style.display !== 'none' && 
                     input.style.visibility !== 'hidden';
    const hasValue = input.value.trim().length > 0;
    
    if (isVisible && hasValue) {
      validOptions.push(input.value.trim());
    }
  });
  
  return validOptions;
}

function addOption() {
  const container = document.getElementById("optionsContainer");
  const optionCount = container.children.length + 1;
  
  if (optionCount > 6) {
    showErrorToast("Maximum 6 options allowed!");
    return;
  }
  
  const input = document.createElement("input");
  input.type = "text";
  input.name = "options";
  input.placeholder = `Option ${optionCount}`;
  // Note: No 'required' attribute - we handle validation manually
  
  // Add animation
  input.style.opacity = "0";
  input.style.transform = "translateY(-10px)";
  
  container.appendChild(input);
  
  setTimeout(() => {
    input.style.transition = "all 0.3s ease";
    input.style.opacity = "1";
    input.style.transform = "translateY(0)";
    input.focus();
  }, 10);
}

// Past Surveys Toggle
function togglePastSurveys() {
  const pastSurveys = document.getElementById("pastSurveys");
  const toggleBtn = document.getElementById("togglePastSurveys");
  const icon = toggleBtn.querySelector("i");
  
  if (pastSurveys.classList.contains("collapsed")) {
    pastSurveys.classList.remove("collapsed");
    toggleBtn.classList.add("rotated");
    icon.className = "fas fa-chevron-up";
  } else {
    pastSurveys.classList.add("collapsed");
    toggleBtn.classList.remove("rotated");
    icon.className = "fas fa-chevron-down";
  }
}

// User Profile
async function showProfile() {
  if (!currentUser) return;
  
  try {
    closeProfileDropdown();
    
    // Update profile header with full username
    document.getElementById("profileUsername").textContent = currentUser;
    
    // Show loading state
    document.getElementById("surveysCreated").textContent = "Loading...";
    document.getElementById("totalVotes").textContent = "Loading...";
    document.getElementById("userSurveys").innerHTML = '<div class="loading-text">Loading...</div>';
    document.getElementById("userVotes").innerHTML = '<div class="loading-text">Loading...</div>';
    
    // Show modal first
    document.getElementById("profileModal").style.display = "block";
    
    // Load user stats
    const statsResponse = await fetch(`/api/users/${currentUser}/stats`);
    if (!statsResponse.ok) {
      throw new Error(`Failed to load stats: ${statsResponse.status}`);
    }
    const stats = await statsResponse.json();
    
    document.getElementById("surveysCreated").textContent = stats.surveysCreated || 0;
    document.getElementById("totalVotes").textContent = stats.totalVotes || 0;
    
    // Load user surveys
    const surveysResponse = await fetch(`/api/users/${currentUser}/surveys`);
    if (!surveysResponse.ok) {
      throw new Error(`Failed to load surveys: ${surveysResponse.status}`);
    }
    const userSurveys = await surveysResponse.json();
    renderUserSurveys(userSurveys);
    
    // Load voting history
    const votesResponse = await fetch(`/api/users/${currentUser}/votes`);
    if (!votesResponse.ok) {
      throw new Error(`Failed to load votes: ${votesResponse.status}`);
    }
    const userVotes = await votesResponse.json();
    renderUserVotes(userVotes);
    
  } catch (error) {
    console.error("Error loading profile:", error);
    showErrorToast(`Error loading profile: ${error.message}`);
    
    // Show error state in modal
    document.getElementById("surveysCreated").textContent = "Error";
    document.getElementById("totalVotes").textContent = "Error";
    document.getElementById("userSurveys").innerHTML = '<div class="loading-text">Failed to load surveys</div>';
    document.getElementById("userVotes").innerHTML = '<div class="loading-text">Failed to load votes</div>';
  }
}

function renderUserSurveys(surveys) {
  const container = document.getElementById("userSurveys");
  
  if (surveys.length === 0) {
    container.innerHTML = '<div class="loading-text">No surveys created yet</div>';
    return;
  }
  
  container.innerHTML = surveys.map(survey => {
    const isExpired = survey.expiryDate && new Date(survey.expiryDate) < new Date();
    const isEnded = survey.status === "ended";
    const status = isEnded ? "ended" : isExpired ? "ended" : "active";
    const statusText = isEnded ? "Ended" : isExpired ? "Ended" : "Active";
    
    return `
      <div class="profile-survey-item">
        <div class="profile-survey-title">${survey.title || survey.question}</div>
        <div class="profile-survey-meta">
          <span>${new Date(survey.created_at).toLocaleDateString()}</span>
          <span class="profile-survey-status ${status}">${statusText}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderUserVotes(votes) {
  const container = document.getElementById("userVotes");
  
  if (votes.length === 0) {
    container.innerHTML = '<div class="loading-text">No voting history available</div>';
    return;
  }
  
  container.innerHTML = votes.map(vote => {
    return `
      <div class="profile-vote-item">
        <div class="profile-vote-title">${vote.surveyTitle || vote.surveyQuestion}</div>
        <div class="profile-vote-meta">
          <span>Voted: ${vote.option}</span>
          <span>${new Date(vote.votedAt).toLocaleDateString()}</span>
        </div>
      </div>
    `;
  }).join("");
}

function closeProfile() {
  document.getElementById("profileModal").style.display = "none";
}

// Utility Functions
function getSurveyTypeLabel(type) {
  const labels = {
    "yesno": "Yes/No",
    "multiple": "Multiple Choice",
    "rating": "Rating"
  };
  return labels[type] || type;
}

function addLoadingState(element) {
  element.classList.add("loading");
  isLoading = true;
}

function removeLoadingState(element) {
  element.classList.remove("loading");
  isLoading = false;
}

function showSuccessToast(message) {
  showToast(message, "success");
}

function showErrorToast(message) {
  showToast(message, "error");
}

function showToast(message, type = "success") {
  const toast = document.getElementById(type === "error" ? "errorToast" : "successToast");
  const span = toast.querySelector("span");
  span.textContent = message;
  
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// Star Rating Interaction
function setupStarRating(surveyId) {
  const ratingContainer = document.querySelector(`[data-survey-id="${surveyId}"]`);
  if (!ratingContainer) return;
  
  const stars = ratingContainer.querySelectorAll('.rating-star');
  let selectedRating = 0;
  
  stars.forEach((star, index) => {
    const rating = index + 1;
    
    // Click handler
    star.addEventListener('click', () => {
      selectedRating = rating;
      updateStarDisplay(stars, selectedRating);
    });
    
    // Hover handlers
    star.addEventListener('mouseenter', () => {
      if (!star.previousElementSibling.disabled) {
        updateStarDisplay(stars, rating, true);
      }
    });
  });
  
  // Mouse leave handler
  ratingContainer.addEventListener('mouseleave', () => {
    updateStarDisplay(stars, selectedRating);
  });
}

function updateStarDisplay(stars, rating, isHover = false) {
  stars.forEach((star, index) => {
    const starRating = index + 1;
    star.classList.remove('active', 'selected');
    
    if (starRating <= rating) {
      star.classList.add(isHover ? 'active' : 'selected');
    }
  });
}

// Confirmation Modal Functions
function showConfirmation(title, message, onConfirm) {
  const modal = document.getElementById('confirmationModal');
  const titleEl = document.getElementById('confirmationTitle');
  const messageEl = document.getElementById('confirmationMessage');
  const confirmBtn = document.getElementById('confirmBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  
  titleEl.textContent = title;
  messageEl.textContent = message;
  
  // Remove existing event listeners
  const newConfirmBtn = confirmBtn.cloneNode(true);
  const newCancelBtn = cancelBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
  
  // Add new event listeners
  newConfirmBtn.addEventListener('click', () => {
    hideConfirmation();
    onConfirm();
  });
  
  newCancelBtn.addEventListener('click', hideConfirmation);
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      hideConfirmation();
    }
  });
  
  modal.classList.add('show');
}

function hideConfirmation() {
  const modal = document.getElementById('confirmationModal');
  modal.classList.remove('show');
}

// Animation for progress bars
function animateProgressBars() {
  const progressBars = document.querySelectorAll(".progress-bar");
  progressBars.forEach(bar => {
    const width = bar.style.width;
    bar.style.width = "0%";
    setTimeout(() => {
      bar.style.width = width;
    }, 100);
  });
}

// Share Survey Function
function shareSurvey(surveyId) {
  const surveyUrl = `${window.location.origin}/survey/${surveyId}`;
  
  if (navigator.share) {
    // Use native share API if available
    navigator.share({
      title: 'Survey Link',
      text: 'Check out this survey!',
      url: surveyUrl
    }).catch(err => {
      console.log('Error sharing:', err);
      copyToClipboard(surveyUrl);
    });
  } else {
    // Fallback to clipboard
    copyToClipboard(surveyUrl);
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showSuccessToast("Survey link copied to clipboard!");
    }).catch(err => {
      console.error('Failed to copy: ', err);
      fallbackCopyTextToClipboard(text);
    });
  } else {
    fallbackCopyTextToClipboard(text);
  }
}

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showSuccessToast("Survey link copied to clipboard!");
    } else {
      showErrorToast("Failed to copy link. Please copy manually: " + text);
    }
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
    showErrorToast("Failed to copy link. Please copy manually: " + text);
  }
  
  document.body.removeChild(textArea);
}

// Auto-refresh surveys every 30 seconds (only on main page)
setInterval(() => {
  if (currentUser && !isSingleSurveyView) {
    loadSurveys();
  }
}, 30000);