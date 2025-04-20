/**
 * Main JavaScript for Wayfinder Job Matcher
 * Handles UI interaction and application flow
 */

// DOM Elements - these will vary based on which page we're on
const questionnaireForm = document.getElementById('questionnaire-form');
const questionsContainer = document.getElementById('questions-container');
const resultsLoading = document.getElementById('results-loading');
const resultsContent = document.getElementById('results-content');
const strengthsList = document.getElementById('strengths-list');
const workStyle = document.getElementById('work-style');
const environment = document.getElementById('environment');
const recommendationsContainer = document.getElementById('recommendations-container');

// State
let questions = [];
let assessmentId = null;

// Event Listeners - add only if the elements exist
document.addEventListener('DOMContentLoaded', init);

if (questionnaireForm) {
    questionnaireForm.addEventListener('submit', submitQuestionnaire);
}

/**
 * Initialize the application based on current page
 */
async function init() {
    // Identify which page we're on based on URL or DOM elements
    const currentPath = window.location.pathname;
    
    // Check for assessment ID in URL (for results page)
    const urlParams = new URLSearchParams(window.location.search);
    const urlAssessmentId = urlParams.get('assessment_id');
    
    if (urlAssessmentId && currentPath.includes('results.html')) {
        assessmentId = urlAssessmentId;
        await loadResults(assessmentId);
    }
    
    // On questionnaire page, start loading questions
    if (currentPath.includes('questionnaire.html') && questionsContainer) {
        startQuestionnaire();
    }
    
    // Check API health
    try {
        await apiService.checkHealth();
        console.log('API is healthy');
    } catch (error) {
        console.error('API health check failed:', error);
    }
}

/**
 * Start the questionnaire
 */
async function startQuestionnaire() {
    try {
        // Fetch questions from API
        const response = await apiService.getQuestionnaire();
        questions = response.questions;
        
        // Render questions
        renderQuestions(questions);
    } catch (error) {
        console.error('Error loading questionnaire:', error);
        questionsContainer.innerHTML = `
            <div class="alert alert-danger" role="alert">
                Error loading questions. Please try again later.
            </div>
        `;
    }
}

/**
 * Render the questionnaire questions
 * @param {Array} questions - The questionnaire questions
 */
function renderQuestions(questions) {
    // Clear loading state
    questionsContainer.innerHTML = '';
    
    // Render each question
    questions.forEach((question, index) => {
        const questionElement = document.createElement('div');
        questionElement.className = 'question-item';
        questionElement.id = `question-${question.id}`;
        
        const questionTitle = document.createElement('h3');
        questionTitle.className = 'question-title h5 mb-3';
        questionTitle.textContent = `${index + 1}. ${question.text}`;
        
        questionElement.appendChild(questionTitle);
        
        if (question.type === 'free_response') {
            // Free response (text area)
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group mb-4';
            
            const textArea = document.createElement('textarea');
            textArea.className = 'form-control';
            textArea.name = `q${question.id}`;
            textArea.id = `q${question.id}`;
            textArea.rows = 4;
            textArea.placeholder = 'Share any additional information that might help us understand your needs better...';
            if (!question.optional) textArea.required = true;
            
            formGroup.appendChild(textArea);
            questionElement.appendChild(formGroup);
        } else {
            // Multiple choice question
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'options-container';
            
            question.options.forEach(([value, text]) => {
                const optionItem = document.createElement('div');
                optionItem.className = 'option-item mb-3';
                
                const input = document.createElement('input');
                input.type = 'radio';
                input.className = 'form-check-input visually-hidden';
                input.name = `q${question.id}`;
                input.value = value;
                input.id = `q${question.id}_option${value}`;
                if (!question.optional) input.required = true;
                
                const label = document.createElement('label');
                label.className = 'form-check-label option-label';
                label.htmlFor = `q${question.id}_option${value}`;
                label.textContent = text;
                
                optionItem.appendChild(input);
                optionItem.appendChild(label);
                
                optionsContainer.appendChild(optionItem);
            });
            
            questionElement.appendChild(optionsContainer);
        }
        
        questionsContainer.appendChild(questionElement);
    });
}

/**
 * Submit the questionnaire
 * @param {Event} event - The form submission event
 */
async function submitQuestionnaire(event) {
    event.preventDefault();
    
    // Get form data
    const formData = new FormData(questionnaireForm);
    const answers = {};
    
    for (const [name, value] of formData.entries()) {
        answers[name] = value;
    }
    
    try {
        // Show loading indicator
        const submitButton = questionnaireForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';
        submitButton.disabled = true;
        
        // Submit answers to API
        const response = await apiService.submitQuestionnaire(answers);
        assessmentId = response.assessment_id;
        
        // Redirect to results page
        window.location.href = `results.html?assessment_id=${assessmentId}`;
    } catch (error) {
        console.error('Error submitting questionnaire:', error);
        
        // Restore button state
        const submitButton = questionnaireForm.querySelector('button[type="submit"]');
        submitButton.innerHTML = originalButtonText;
        submitButton.disabled = false;
        
        // Show error message
        questionsContainer.innerHTML += `
            <div class="alert alert-danger mt-3" role="alert">
                Error submitting your answers. Please try again.
            </div>
        `;
    }
}

/**
 * Load results from the API
 * @param {string} assessmentId - The assessment ID
 */
async function loadResults(assessmentId) {
    // Make sure we have the results container elements
    if (!resultsLoading || !resultsContent) return;
    
    // Show loading state
    resultsLoading.style.display = 'block';
    resultsContent.style.display = 'none';
    
    try {
        // Fetch results from API
        const results = await apiService.getResults(assessmentId);
        
        // Generate HTML from the JSON profile and render it
        renderProfileData(results.profile);
        
        // Render recommendations
        renderRecommendations(results.recommendations);
        
        // Hide loading state, show results
        resultsLoading.style.display = 'none';
        resultsContent.style.display = 'block';
    } catch (error) {
        console.error('Error loading results:', error);
        resultsLoading.style.display = 'none';
        
        // Show error message where results would be
        const resultsContainer = document.querySelector('.results-container');
        if (resultsContainer) {
            resultsContainer.innerHTML += `
                <div class="alert alert-danger" role="alert">
                    Error loading your results. Please try again later or 
                    <a href="questionnaire.html" class="alert-link">start a new assessment</a>.
                </div>
            `;
        }
    }
}

/**
 * Render profile data in the UI
 * @param {Object} profile - The profile object containing analysis data
 */
function renderProfileData(profile) {
    if (!profile) return;
    
    // Find the profile content container
    const profileContent = document.querySelector('.profile-content');
    if (!profileContent) return;
    
    // Clear existing content
    profileContent.innerHTML = '';
    
    // Create the analysis section with the structure from the template
    const analysisSection = document.createElement('div');
    analysisSection.className = 'analysis-section';
    
    // Build the HTML content for the analysis section
    let analysisHtml = `
        <h3>Work Style</h3>
        <p class="mb-2"><strong>${profile['work_style']?.description || 'Not available'}</strong></p>
        <p class="text-muted mb-4">${profile['work_style']?.explanation || ''}</p>

        <h3>Ideal Environment</h3>
        <p class="mb-2"><strong>${profile['environment']?.description || 'Not available'}</strong></p>
        <p class="text-muted mb-4">${profile['environment']?.explanation || ''}</p>

        <h3>Interaction Level</h3>
        <p class="mb-2"><strong>${profile['interaction_level']?.description || 'Not available'}</strong></p>
        <p class="text-muted mb-4">${profile['interaction_level']?.explanation || ''}</p>

        <h3>Task Preferences</h3>
        <p class="mb-2"><strong>${profile['task_preference']?.description || 'Not available'}</strong></p>
        <p class="text-muted mb-4">${profile['task_preference']?.explanation || ''}</p>
        
        <h3>Additional Insights</h3>
        <p class="mb-2"><strong>${profile.additional_insights?.description || 'No additional insights'}</strong></p>
        <p class="text-muted mb-4">${profile.additional_insights?.explanation || ''}</p>
    `;
    
    // Add the HTML to the section
    analysisSection.innerHTML = analysisHtml;
    
    // Add the analysis section to the profile content
    profileContent.appendChild(analysisSection);
    
    // If we have strengths, render them separately (keeping this part for backward compatibility)
    if (profile.strengths && profile.strengths.length > 0) {
        const strengthsSection = document.createElement('div');
        strengthsSection.className = 'mb-4';
        strengthsSection.innerHTML = `
            <h3>Strengths</h3>
            <ul id="new-strengths-list"></ul>
        `;
        
        profileContent.insertBefore(strengthsSection, profileContent.firstChild);
        
        const strengthsList = document.getElementById('new-strengths-list');
        if (strengthsList) {
            profile.strengths.forEach(strength => {
                const li = document.createElement('li');
                li.textContent = strength;
                strengthsList.appendChild(li);
            });
        }
    }
}

/**
 * Render job recommendations
 * @param {Array} recommendations - The job recommendations
 */
function renderRecommendations(recommendations) {
    if (!recommendationsContainer || !recommendations) return;
    
    // Clear existing content
    recommendationsContainer.innerHTML = '';
    
    if (recommendations.length === 0) {
        recommendationsContainer.innerHTML = `
            <div class="alert alert-info">
                No job recommendations found. Please try again with different answers.
            </div>
        `;
        return;
    }
    
    // Add each recommendation
    recommendations.forEach(job => {
        const jobCard = document.createElement('div');
        jobCard.className = 'job-card mb-4 p-4 border rounded shadow-sm';
        
        // Format score as percentage
        const score = job.match_score || job.fit_score || 0;
        const displayScore = typeof score === 'number' ? score : Math.round(parseFloat(score) * 100);
        
        // Determine badge color based on score
        let badgeColor = 'secondary';
        if (displayScore >= 80) badgeColor = 'success';
        else if (displayScore >= 60) badgeColor = 'warning';
        
        // Create job card HTML
        let cardHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <h3 class="h5 mb-1">${job.title || 'Unnamed Job'}</h3>
                    <p class="mb-1">
                        ${job.company ? `<i class="bi bi-building me-1"></i>${job.company}` : ''}
                        ${job.company && job.location ? ' - ' : ''}
                        ${job.location ? `<i class="bi bi-geo-alt me-1"></i>${job.location}` : ''}
                    </p>
                </div>
                <div class="match-score">
                    <span class="badge rounded-pill bg-${badgeColor}">
                        ${displayScore}% Match
                    </span>
                </div>
            </div>
            
            <div class="mt-3">
                <p class="text-muted mb-2">${job.description || job.reasoning || ''}</p>
            </div>
        `;
        
        // Add strengths/highlights if available
        const strengths = job.strengths || job.highlights || [];
        if (strengths.length > 0) {
            cardHTML += `
                <div class="highlights-section mt-2">
                    <p class="mb-1 small text-secondary">Why this matches your profile:</p>
                    <div class="d-flex flex-wrap">
                        ${strengths.map(strength => `
                            <span class="badge bg-light text-dark me-2 mb-1 p-2">
                                <i class="bi bi-check-circle-fill text-success me-1"></i>
                                ${strength}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // Add challenges if available
        const challenges = job.challenges || job.considerations || [];
        if (challenges.length > 0) {
            cardHTML += `
                <div class="highlights-section mt-2">
                    <p class="mb-1 small text-secondary">Potential challenges:</p>
                    <div class="d-flex flex-wrap">
                        ${challenges.map(challenge => `
                            <span class="badge bg-light text-dark me-2 mb-1 p-2">
                                <i class="bi bi-info-circle-fill text-warning me-1"></i>
                                ${challenge}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // Add job link if available
        if (job.url) {
            cardHTML += `
                <div class="mt-3">
                    <a href="${job.url}" class="btn btn-outline-primary btn-sm" target="_blank">
                        <i class="bi bi-box-arrow-up-right me-1"></i>View Full Job Posting
                    </a>
                </div>
            `;
        }
        
        jobCard.innerHTML = cardHTML;
        recommendationsContainer.appendChild(jobCard);
        
        // Add animation
        setTimeout(() => {
            jobCard.style.opacity = '0';
            jobCard.style.transform = 'translateY(20px)';
            jobCard.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            
            setTimeout(() => {
                jobCard.style.opacity = '1';
                jobCard.style.transform = 'translateY(0)';
            }, 50);
        }, 0);
    });
} 