/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The window.process.env object with API keys is now expected to be
// initialized in a <script> tag in index.html before this script runs.
// That script in index.html should contain placeholder values that
// MUST be replaced by actual keys by your Google Cloud Run service
// when it serves the index.html file.

import { GoogleGenAI, GenerateImagesResponse, GenerateContentResponse, Part } from "@google/genai";
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// --- Supabase Client Initialization ---
// Prioritize keys injected by server.js for deployed environments
const deployedSupabaseUrl = window.process?.env?.SUPABASE_URL;
const deployedSupabaseAnonKey = window.process?.env?.SUPABASE_ANON_KEY;

// Fallback to Vite env variables for local development
const localDevSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const localDevSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Placeholders from index.html script tag
const supabaseUrlPlaceholder = "__REPLACE_WITH_YOUR_SUPABASE_URL__";
const supabaseAnonKeyPlaceholder = "__REPLACE_WITH_YOUR_SUPABASE_ANON_KEY__";

let supabaseUrl: string | undefined = undefined;
let supabaseAnonKey: string | undefined = undefined;
let supabaseSourceInfo: string = "unknown";

if (deployedSupabaseUrl && deployedSupabaseUrl.trim() !== '' && deployedSupabaseUrl !== supabaseUrlPlaceholder) {
    supabaseUrl = deployedSupabaseUrl;
    supabaseSourceInfo = "server-injected";
} else if (localDevSupabaseUrl && localDevSupabaseUrl.trim() !== '' && localDevSupabaseUrl !== supabaseUrlPlaceholder) {
    supabaseUrl = localDevSupabaseUrl;
    supabaseSourceInfo = "vite-env";
}

if (deployedSupabaseAnonKey && deployedSupabaseAnonKey.trim() !== '' && deployedSupabaseAnonKey !== supabaseAnonKeyPlaceholder) {
    supabaseAnonKey = deployedSupabaseAnonKey;
    // supabaseSourceInfo will be set by URL check, or confirm it matches
    if (supabaseSourceInfo === "unknown" && supabaseUrl) supabaseSourceInfo = "server-injected (key only)"; 
} else if (localDevSupabaseAnonKey && localDevSupabaseAnonKey.trim() !== '' && localDevSupabaseAnonKey !== supabaseAnonKeyPlaceholder) {
    supabaseAnonKey = localDevSupabaseAnonKey;
    if (supabaseSourceInfo === "unknown" && supabaseUrl) supabaseSourceInfo = "vite-env (key only)";
}

let supabase: SupabaseClient | null = null;
let supabaseInitializationError: string | null = null;

if (supabaseUrl && supabaseAnonKey) {
    console.log(`Attempting to initialize Supabase client with keys from: ${supabaseSourceInfo}`);
    try {
        supabase = createClient(supabaseUrl, supabaseAnonKey);
        console.log("Supabase client initialized successfully with keys from:", supabaseSourceInfo, supabase);
    } catch (e: any) {
        console.error(`Error initializing Supabase client with keys from ${supabaseSourceInfo}:`, e);
        supabaseInitializationError = `Authentication service failed to initialize: ${e.message}. (Source: ${supabaseSourceInfo})`;
    }
} else {
    let missingReason = "";
    if (!supabaseUrl) {
        missingReason += "Supabase URL is missing or is a placeholder. ";
    }
    if (!supabaseAnonKey) {
        missingReason += "Supabase Anon Key is missing or is a placeholder. ";
    }
    supabaseInitializationError = `Critical error: ${missingReason}`;
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        supabaseInitializationError += "For local development, ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.";
    }
    else {
        supabaseInitializationError += "For deployed environments, verify SUPABASE_URL and SUPABASE_ANON_KEY in Cloud Run service configuration and server injection.";
    }
    console.error(supabaseInitializationError, {
        urlUsed: supabaseUrl,
        keyUsed: supabaseAnonKey,
        urlSource: deployedSupabaseUrl ? 'server-injected' : (localDevSupabaseUrl ? 'vite-env' : 'not-found'),
        keySource: deployedSupabaseAnonKey ? 'server-injected' : (localDevSupabaseAnonKey ? 'vite-env' : 'not-found')
    });
}

// --- Global AI Instance ---
let ai: GoogleGenAI | null = null;


// --- Auth Elements ---
const loginPage = document.getElementById('login-page') as HTMLDivElement;
const appContent = document.getElementById('app-content') as HTMLDivElement;
const loginButton = document.getElementById('login-button') as HTMLButtonElement;
const logoutButton = document.getElementById('logout-button') as HTMLButtonElement;
const authErrorMessage = document.getElementById('auth-error-message') as HTMLParagraphElement;
const userGreetingElement = document.getElementById('user-greeting') as HTMLParagraphElement;

// --- Theme Switcher Elements ---
const themeToggle = document.getElementById('theme-toggle') as HTMLInputElement;

// --- Mode Switching Elements ---
const tabSingle = document.getElementById('tab-single') as HTMLButtonElement;
const tabSequence = document.getElementById('tab-sequence') as HTMLButtonElement;
const tabHistory = document.getElementById('tab-history') as HTMLButtonElement;
const tabSettings = document.getElementById('tab-settings') as HTMLButtonElement;
const singleImageModeDiv = document.getElementById('single-image-mode') as HTMLDivElement;
const sequenceModeDiv = document.getElementById('sequence-mode') as HTMLDivElement;
const historyModeDiv = document.getElementById('history-mode') as HTMLDivElement;
const settingsModeDiv = document.getElementById('settings-mode') as HTMLDivElement;


// --- Single Image Mode Elements ---
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const buttonText = generateButton?.querySelector('.button-text') as HTMLSpanElement;
const buttonIcon = generateButton?.querySelector('.button-icon') as HTMLSpanElement;
const buttonSpinner = generateButton?.querySelector('.spinner') as HTMLSpanElement;
const voiceInputButtonSingle = document.getElementById('voice-input-button-single') as HTMLButtonElement;

const loadingIndicator = document.getElementById('loading-indicator') as HTMLDivElement;
const loadingMessageElement = document.getElementById('loading-message') as HTMLParagraphElement;
const errorMessageElement = document.getElementById('error-message') as HTMLDivElement;
const imageDisplayArea = document.getElementById('image-display-area') as HTMLDivElement;
const imageActionsBar = document.getElementById('image-actions-bar') as HTMLDivElement;
const downloadImageButton = document.getElementById('download-image-button') as HTMLButtonElement;
const fullscreenImageButton = document.getElementById('fullscreen-image-button') as HTMLButtonElement;
const editPromptButton = document.getElementById('edit-prompt-button') as HTMLButtonElement;

const triggerImageInputSingle = document.getElementById('trigger-image-input-single') as HTMLButtonElement;
const imageInput = document.getElementById('image-input') as HTMLInputElement;
const imagePreviewContainer = document.getElementById('image-preview-container') as HTMLDivElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const removeImageButton = document.getElementById('remove-image-button') as HTMLButtonElement;

// Aspect Ratio and Style elements
const styleButton = document.getElementById('style-button') as HTMLButtonElement;
const styleButtonText = document.getElementById('style-button-text') as HTMLSpanElement;
const styleOptionsPopup = document.getElementById('style-options-popup') as HTMLDivElement;
const aspectRatioButton = document.getElementById('aspect-ratio-button') as HTMLButtonElement;
const aspectRatioButtonText = document.getElementById('aspect-ratio-button-text') as HTMLSpanElement;
const aspectRatioOptionsPopup = document.getElementById('aspect-ratio-options-popup') as HTMLDivElement;


let lastSuccessfulPrompt: string = '';
let lastSuccessfulImageBase64: string | null = null;
let lastSuccessfulImageMimeType: string | null = null;
let currentSelectedFileBase64: string | null = null;
let currentSelectedFileMimeType: string | null = null;
let currentSingleImageURL: string | null = null; // For download/fullscreen
let currentSelectedStyle: string | null = null;
let currentSelectedAspectRatio: string | null = null;


// --- Sequence Mode Elements ---
const triggerImageInputSequence = document.getElementById('trigger-image-input-sequence') as HTMLButtonElement;
const imageInputSequence = document.getElementById('image-input-sequence') as HTMLInputElement;
const imagePreviewContainerSequence = document.getElementById('image-preview-container-sequence') as HTMLDivElement;
const imagePreviewSequence = document.getElementById('image-preview-sequence') as HTMLImageElement;
const removeImageButtonSequence = document.getElementById('remove-image-button-sequence') as HTMLButtonElement;
const basePromptInputSequence = document.getElementById('base-prompt-input-sequence') as HTMLTextAreaElement;
const animationInstructionInput = document.getElementById('animation-instruction-input') as HTMLTextAreaElement;
const numFramesInput = document.getElementById('num-frames-input') as HTMLInputElement;
const generateSequenceButton = document.getElementById('generate-sequence-button') as HTMLButtonElement;
const buttonTextSequence = generateSequenceButton?.querySelector('.button-text') as HTMLSpanElement;
const buttonIconSequence = generateSequenceButton?.querySelector('.button-icon') as HTMLSpanElement;
const buttonSpinnerSequence = generateSequenceButton?.querySelector('.spinner') as HTMLSpanElement;
const voiceInputButtonSequence = document.getElementById('voice-input-button-sequence') as HTMLButtonElement;

const loadingIndicatorSequence = document.getElementById('loading-indicator-sequence') as HTMLDivElement;
const loadingMessageSequenceElement = document.getElementById('loading-message-sequence') as HTMLParagraphElement;
const errorMessageSequenceElement = document.getElementById('error-message-sequence') as HTMLDivElement;
const sequenceDisplayArea = document.getElementById('sequence-display-area') as HTMLDivElement;

let currentSelectedFileBase64Sequence: string | null = null;
let currentSelectedFileMimeTypeSequence: string | null = null;

// --- History Mode Elements ---
const historyItemsContainer = document.getElementById('history-items-container') as HTMLDivElement;
const emptyHistoryMessage = document.getElementById('empty-history-message') as HTMLParagraphElement;
const clearHistoryButton = document.getElementById('clear-history-button') as HTMLButtonElement;
const loadingHistoryIndicator = document.getElementById('loading-history-indicator') as HTMLDivElement;

// --- Settings Mode Elements ---
const userEmailDisplay = document.getElementById('user-email-display') as HTMLParagraphElement;
const userDisplayNameInput = document.getElementById('user-display-name-input') as HTMLInputElement;
const saveUserSettingsButton = document.getElementById('save-user-settings-button') as HTMLButtonElement;
const settingsFeedbackMessage = document.getElementById('settings-feedback-message') as HTMLParagraphElement;
// const defaultAspectRatioSelect = document.getElementById('default-aspect-ratio-select') as HTMLSelectElement;
// const defaultStyleSelect = document.getElementById('default-style-select') as HTMLSelectElement;

// --- Fullscreen Modal Elements ---
const fullscreenModal = document.getElementById('fullscreen-modal') as HTMLDivElement;
const fullscreenImage = document.getElementById('fullscreen-image') as HTMLImageElement;
const closeFullscreenModalButton = document.getElementById('close-fullscreen-modal-button') as HTMLButtonElement;


// --- Global State ---
let currentUser: User | null = null;
let currentMode: 'single' | 'sequence' | 'history' | 'settings' = 'single';
const HISTORY_TABLE_NAME = 'image_history';

// --- History Data Structures (align with Supabase table) ---
interface HistoryItemBase {
    id: string; // UUID from Supabase
    created_at: string; // Timestamp from Supabase
    mode: 'single' | 'sequence';
    user_base_image_data?: string | null; // Base64 of user-uploaded base image
    user_base_image_mime_type?: string | null;
}
interface SingleHistoryItemDB extends HistoryItemBase {
    mode: 'single';
    user_prompt: string;
    effective_prompt: string;
    image_url: string; // Base64 of generated image
    selected_aspect_ratio?: string | null;
    selected_style?: string | null;
}
interface SequenceHistoryItemDB extends HistoryItemBase {
    mode: 'sequence';
    user_base_prompt: string;
    effective_base_prompt: string;
    animation_instruction: string;
    num_frames: number;
    image_urls: string[]; // Array of Base64 for generated frames
}
type HistoryItemDB = SingleHistoryItemDB | SequenceHistoryItemDB;

// --- Constants for Styles and Aspect Ratios ---
const STYLES = [
    { name: 'Default', value: null },
    { name: 'Photorealistic', value: 'photorealistic' },
    { name: 'Cinematic', value: 'cinematic lighting' },
    { name: 'Anime', value: 'anime art style' },
    { name: 'Illustration', value: 'illustration style' },
    { name: 'Pixel Art', value: 'pixel art' },
    { name: 'Watercolor', value: 'watercolor painting' },
    { name: 'Abstract', value: 'abstract art' },
    { name: 'Line Art', value: 'line art drawing' },
    { name: 'Low Poly', value: 'low poly 3D render' },
];
const ASPECT_RATIOS = [
    { name: 'Original', value: null },
    { name: '1:1 Square', value: '1:1' },
    { name: '16:9 Landscape', value: '16:9' },
    { name: '9:16 Portrait', value: '9:16' },
    { name: '4:3 Standard', value: '4:3' },
    { name: '3:4 Portrait', value: '3:4' },
    { name: '3:2 Landscape', value: '3:2' },
    { name: '2:3 Portrait', value: '2:3' },
];


// --- Voice Input (Speech Recognition) --- 

// Check for browser support
const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
let recognition: any | null = null; // Use 'any' to bypass persistent type issues

if (SpeechRecognitionAPI) {
    console.log("Speech Recognition API is supported.");
    recognition = new SpeechRecognitionAPI();
    recognition.continuous = false; // Process single utterances
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => { // Use 'any' for event type
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        console.log("Voice transcript:", transcript);
        // Determine active textarea and append transcript
        if (currentMode === 'single' && promptInput) {
            promptInput.value += (promptInput.value.length > 0 ? ' ' : '') + transcript;
            stopVoiceRecognition(voiceInputButtonSingle);
        } else if (currentMode === 'sequence' && basePromptInputSequence) {
            // Potentially, we might want to direct to animationInstructionInput if base is filled
            // For now, let's assume it appends to the one most likely being edited or the base prompt.
            basePromptInputSequence.value += (basePromptInputSequence.value.length > 0 ? ' ' : '') + transcript;
            stopVoiceRecognition(voiceInputButtonSequence);
        }
    };

    recognition.onerror = (event: any) => { // Use 'any' for event type
        console.error("Speech recognition error:", event.error);
        let errorMessage = "Voice recognition error: " + event.error;
        if (event.error === 'no-speech') {
            errorMessage = "No speech was detected. Please try again.";
        } else if (event.error === 'audio-capture') {
            errorMessage = "Microphone problem. Ensure it's enabled and not in use by another app.";
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { // Added 'service-not-allowed' for broader compatibility
            errorMessage = "Microphone access denied. Please allow microphone permission in your browser settings.";
        }
        // Display error appropriately (e.g., in the main error display for the current mode)
        if (currentMode === 'single') {
            displayError(errorMessage);
            if(voiceInputButtonSingle) stopVoiceRecognition(voiceInputButtonSingle);
        } else if (currentMode === 'sequence') {
            displayErrorSequence(errorMessage);
            if(voiceInputButtonSequence) stopVoiceRecognition(voiceInputButtonSequence);
        }
    };

    recognition.onend = () => {
        console.log("Speech recognition ended.");
        // Ensure UI is reset if recognition ends unexpectedly
        if (voiceInputButtonSingle?.classList.contains('listening')) {
            stopVoiceRecognition(voiceInputButtonSingle);
        }
        if (voiceInputButtonSequence?.classList.contains('listening')) {
            stopVoiceRecognition(voiceInputButtonSequence);
        }
    };

} else {
    console.warn("Speech Recognition API is not supported in this browser.");
    // Disable voice input buttons if API is not supported
    if (voiceInputButtonSingle) voiceInputButtonSingle.disabled = true;
    if (voiceInputButtonSequence) voiceInputButtonSequence.disabled = true;
    // Optionally, hide the buttons or show a message to inform the user
    const voiceDisabledMessage = "Voice input is not supported in this browser.";
    if (voiceInputButtonSingle) {
        voiceInputButtonSingle.title = voiceDisabledMessage;
        // You could also add a visual cue or replace the icon
    }
    if (voiceInputButtonSequence) {
        voiceInputButtonSequence.title = voiceDisabledMessage;
    }
}

function startVoiceRecognition(button: HTMLButtonElement | null, targetTextarea: HTMLTextAreaElement | null) {
    if (!recognition || !button || !targetTextarea) return;

    if (button.classList.contains('listening')) {
        stopVoiceRecognition(button);
        return;
    }

    try {
        recognition.start();
        button.classList.add('listening');
        button.setAttribute('aria-pressed', 'true');
        button.innerHTML = '<span class="material-symbols-outlined">settings_voice</span>'; // Change icon to indicate listening
        console.log("Speech recognition started.");
    } catch (e) {
        console.error("Error starting speech recognition:", e);
        button.classList.remove('listening');
        button.setAttribute('aria-pressed', 'false');
        button.innerHTML = '<span class="material-symbols-outlined">mic</span>'; // Reset icon
    }
}

function stopVoiceRecognition(button: HTMLButtonElement | null) {
    if (!recognition || !button) return;
    if (button.classList.contains('listening')) { // Only stop if it was actually listening
        recognition.stop();
        console.log("Speech recognition stopped by function call.");
    }
    button.classList.remove('listening');
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = '<span class="material-symbols-outlined">mic</span>'; // Reset icon
}

// Event Listeners for voice input buttons
if (voiceInputButtonSingle && promptInput) {
    voiceInputButtonSingle.addEventListener('click', () => {
        if (!SpeechRecognitionAPI) { // Check against the API constructor we defined
            displayError("Voice input is not supported in this browser.");
            return;
        }
        startVoiceRecognition(voiceInputButtonSingle, promptInput);
    });
}

if (voiceInputButtonSequence && basePromptInputSequence) {
    voiceInputButtonSequence.addEventListener('click', () => {
        if (!SpeechRecognitionAPI) { // Check against the API constructor we defined
            displayErrorSequence("Voice input is not supported in this browser.");
            return;
        }
        // For sequence, decide which textarea to target. For now, base prompt.
        startVoiceRecognition(voiceInputButtonSequence, basePromptInputSequence);
    });
}

// --- End Voice Input ---

// --- Theme Management ---
function applyTheme(theme: 'light' | 'dark') {
    const lightVars = {
        '--bg-primary': 'var(--bg-primary-light)', '--bg-secondary': 'var(--bg-secondary-light)',
        '--bg-tertiary': 'var(--bg-tertiary-light)', '--text-primary': 'var(--text-primary-light)',
        '--text-secondary': 'var(--text-secondary-light)', '--text-placeholder': 'var(--text-placeholder-light)',
        '--accent-primary': 'var(--accent-primary-light)', '--accent-primary-hover': 'var(--accent-primary-hover-light)',
        '--input-bg': 'var(--input-bg-light)', '--input-border': 'var(--input-border-light)',
        '--button-text-primary': 'var(--button-text-primary-light)', '--button-disabled-bg': 'var(--button-disabled-bg-light)',
        '--button-disabled-text': 'var(--button-disabled-text-light)', '--error-bg': 'var(--error-bg-light)',
        '--error-text': 'var(--error-text-light)', '--error-border': 'var(--error-border-light)',
        '--shadow-color-rgb': 'var(--shadow-color-rgb-light)', '--spinner-light': 'var(--spinner-light)',
        '--spinner-graphic-bg': 'var(--spinner-graphic-bg-light)', '--spinner-graphic-fg': 'var(--spinner-graphic-fg-light)',
        '--tab-inactive-color': 'var(--tab-inactive-color-light)', '--tab-active-color': 'var(--tab-active-color-light)',
        '--tab-border': 'var(--tab-border-light)', '--image-preview-remove-bg': 'var(--image-preview-remove-bg-light)',
        '--image-preview-remove-hover-bg': 'var(--image-preview-remove-hover-bg-light)', '--image-preview-remove-text': 'var(--image-preview-remove-text-light)',
        '--toggle-track-bg': 'var(--toggle-track-bg-light)', '--toggle-thumb-bg': 'var(--toggle-thumb-bg-light)',
        '--icon-color': 'var(--icon-color-light)', '--title-icon-color': 'var(--title-icon-color-light)',
        '--input-container-bg': 'var(--input-container-bg-light)', '--accessory-button-bg': 'var(--accessory-button-bg-light)',
        '--accessory-button-text': 'var(--accessory-button-text-light)', '--accessory-button-hover-bg': 'var(--accessory-button-hover-bg-light)',
        '--generate-button-bg': 'var(--generate-button-bg-light)', '--generate-button-text': 'var(--generate-button-text-light)',
        '--generate-button-hover-bg': 'var(--generate-button-hover-bg-light)', '--edit-button-bg': 'var(--edit-button-bg-light)',
        '--edit-button-text': 'var(--edit-button-text-light)', '--edit-button-border': 'var(--edit-button-border-light)',
        '--history-item-bg': 'var(--history-item-bg-light)', '--history-item-border': 'var(--history-item-border-light)',
        '--button-primary-bg': 'var(--button-primary-bg-light)', '--button-primary-text': 'var(--button-primary-text-light)',
        '--button-primary-hover-bg': 'var(--button-primary-hover-bg-light)',
        '--dropdown-bg': 'var(--dropdown-bg-light)', '--dropdown-border': 'var(--dropdown-border-light)',
        '--dropdown-item-hover-bg': 'var(--dropdown-item-hover-bg-light)',
        '--image-action-button-bg': 'var(--image-action-button-bg-light)', '--image-action-button-text': 'var(--image-action-button-text-light)',
        '--image-action-button-hover-bg': 'var(--image-action-button-hover-bg-light)',
    };
    const darkVars = {
        '--bg-primary': 'var(--bg-primary-dark)', '--bg-secondary': 'var(--bg-secondary-dark)',
        '--input-container-bg': 'var(--input-container-bg-dark)', '--text-primary': 'var(--text-primary-dark)',
        '--text-secondary': 'var(--text-secondary-dark)', '--text-placeholder': 'var(--text-placeholder-dark)',
        '--accent-primary': 'var(--accent-primary-dark)', '--accent-primary-hover': 'var(--accent-primary-hover-dark)',
        '--input-bg': 'var(--input-bg-dark)', '--input-border': 'var(--input-border-dark)',
        '--button-text-primary': 'var(--button-text-primary-dark)', '--button-disabled-bg': 'var(--button-disabled-bg-dark)',
        '--button-disabled-text': 'var(--button-disabled-text-dark)', '--error-bg': 'var(--error-bg-dark)',
        '--error-text': 'var(--error-text-dark)', '--error-border': 'var(--error-border-dark)',
        '--shadow-color-rgb': 'var(--shadow-color-rgb-dark)', '--spinner-dark': 'var(--spinner-dark)',
        '--spinner-graphic-bg': 'var(--spinner-graphic-bg-dark)', '--spinner-graphic-fg': 'var(--spinner-graphic-fg-dark)',
        '--tab-inactive-color': 'var(--tab-inactive-color-dark)', '--tab-active-color': 'var(--tab-active-color-dark)',
        '--tab-border': 'var(--tab-border-dark)', '--image-preview-remove-bg': 'var(--image-preview-remove-bg-dark)',
        '--image-preview-remove-hover-bg': 'var(--image-preview-remove-hover-bg-dark)', '--image-preview-remove-text': 'var(--image-preview-remove-text-dark)',
        '--toggle-track-bg': 'var(--toggle-track-bg-dark)', '--toggle-thumb-bg': 'var(--toggle-thumb-bg-dark)',
        '--icon-color': 'var(--icon-color-dark)', '--title-icon-color': 'var(--title-icon-color-dark)',
        '--accessory-button-bg': 'var(--accessory-button-bg-dark)', '--accessory-button-text': 'var(--accessory-button-text-dark)',
        '--accessory-button-hover-bg': 'var(--accessory-button-hover-bg-dark)', '--generate-button-bg': 'var(--generate-button-bg-dark)',
        '--generate-button-text': 'var(--generate-button-text-dark)', '--generate-button-hover-bg': 'var(--generate-button-hover-bg-dark)',
        '--edit-button-bg': 'var(--edit-button-bg-dark)', '--edit-button-text': 'var(--edit-button-text-dark)',
        '--edit-button-border': 'var(--edit-button-border-dark)', '--history-item-bg': 'var(--history-item-bg-dark)',
        '--history-item-border': 'var(--history-item-border-dark)', '--button-primary-bg': 'var(--button-primary-bg-dark)',
        '--button-primary-text': 'var(--button-primary-text-dark)', '--button-primary-hover-bg': 'var(--button-primary-hover-bg-dark)',
        '--dropdown-bg': 'var(--dropdown-bg-dark)', '--dropdown-border': 'var(--dropdown-border-dark)',
        '--dropdown-item-hover-bg': 'var(--dropdown-item-hover-bg-dark)',
        '--image-action-button-bg': 'var(--image-action-button-bg-dark)', '--image-action-button-text': 'var(--image-action-button-text-dark)',
        '--image-action-button-hover-bg': 'var(--image-action-button-hover-bg-dark)',
    };

    const varsToApply = theme === 'dark' ? darkVars : lightVars;
    for (const [property, value] of Object.entries(varsToApply)) {
        document.documentElement.style.setProperty(property, value);
    }

    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('theme', theme);
    if (themeToggle) {
        themeToggle.checked = theme === 'dark';
    }
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (prefersDark) {
        applyTheme('dark');
    } else {
        applyTheme('light'); // Default to light
    }
    if (themeToggle) {
        themeToggle.addEventListener('change', () => {
            applyTheme(themeToggle.checked ? 'dark' : 'light');
        });
    }
}

// --- AI Initialization ---
function initializeAI() {
    // Log exactly what the client-side sees immediately
    console.log("CLIENT initializeAI: window.process.env.API_KEY is:", window.process?.env?.API_KEY);
    console.log("CLIENT initializeAI: import.meta.env.VITE_API_KEY is:", import.meta.env.VITE_API_KEY);

    const deployedApiKey = window.process?.env?.API_KEY;
    const localDevApiKey = import.meta.env.VITE_API_KEY;
    // This is the placeholder value in index.html's script tag before server.js replaces it.
    const placeholderValueInHtml = "__REPLACE_WITH_YOUR_GEMINI_API_KEY__";

    let geminiApiKey: string | undefined = undefined;
    let apiKeySourceInfo: string = "unknown";

    // 1. Try the key injected by server.js (for deployed environments)
    // It should not be the placeholder if server.js successfully replaced it.
    // It also shouldn't be an empty string (if server.js replaced placeholder with empty due to missing env var).
    if (deployedApiKey && deployedApiKey.trim() !== '' && deployedApiKey !== placeholderValueInHtml) {
        geminiApiKey = deployedApiKey;
        apiKeySourceInfo = "server-injected";
    }
    // 2. Fallback to Vite's build-time environment variable (for local development)
    // This also should not be the placeholder.
    else if (localDevApiKey && localDevApiKey.trim() !== '' && localDevApiKey !== placeholderValueInHtml) {
        geminiApiKey = localDevApiKey;
        apiKeySourceInfo = "vite-env";
    }

    let errorMsg = "";

    if (geminiApiKey) {
        try {
            ai = new GoogleGenAI({ apiKey: geminiApiKey });
            console.log(`AI Initialized successfully using API key from: ${apiKeySourceInfo}`);
        } catch (error) {
            console.error("Failed to initialize GoogleGenAI with the API key:", error);
            ai = null;
            // Provide a more specific error if possible
            errorMsg = `Error initializing AI service: ${error instanceof Error ? error.message : 'Invalid API Key format.'} (Source: ${apiKeySourceInfo}). Please check your API Key.`;
        }
    } else {
        ai = null; // Explicitly set to null if no valid key
        errorMsg = "Gemini API Key is not found or is a placeholder. ";
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
            errorMsg += "For local development, ensure VITE_API_KEY is set correctly in your .env file.";
        } else {
            errorMsg += "For deployed environments, please verify that the API_KEY environment variable is correctly set in your Cloud Run service configuration and that the server is able to inject it.";
        }
        console.error(errorMsg, {
            evaluatedDeployedKey: deployedApiKey,
            evaluatedLocalDevKey: localDevApiKey,
            placeholder: placeholderValueInHtml
        });
    }
    
    if (errorMsg) {
        if (authErrorMessage && loginPage && loginPage.style.display === 'flex'){
             authErrorMessage.textContent = errorMsg; 
             authErrorMessage.style.display = 'block';
        } else if (currentMode === 'single' && errorMessageElement) {
            displayError(errorMsg);
        } else if (currentMode === 'sequence' && errorMessageSequenceElement) {
            displayErrorSequence(errorMsg);
        }
    }

    // Update UI based on AI state
    const aiReady = !!ai;
    if (generateButton) generateButton.disabled = !aiReady;
    if (triggerImageInputSingle) triggerImageInputSingle.disabled = !aiReady;
    if (generateSequenceButton) generateSequenceButton.disabled = !aiReady;
    if (triggerImageInputSequence) triggerImageInputSequence.disabled = !aiReady;
    
    if (!aiReady) {
        if(promptInput) promptInput.placeholder = "AI Service not available. Check API Key configuration in index.html (ensure server replaced placeholder).";
        if(basePromptInputSequence) basePromptInputSequence.placeholder = "AI Service not available. Check API Key (ensure server replaced placeholder).";
    } else {
        if(promptInput) promptInput.placeholder = "Describe an image and click generate...";
        if(basePromptInputSequence) basePromptInputSequence.placeholder = "Describe the base scene or subject...";
    }
}


// --- Authentication Logic ---
async function handleGoogleLogin() {
    if (!supabase) { 
        if (authErrorMessage && supabaseInitializationError) {
            authErrorMessage.textContent = supabaseInitializationError;
            authErrorMessage.style.display = 'block';
        } else if (authErrorMessage) {
            authErrorMessage.textContent = "Authentication service is unavailable. Check Supabase configuration in index.html (ensure server replaced placeholders).";
            authErrorMessage.style.display = 'block';
        }
        return;
    }
    if (authErrorMessage) authErrorMessage.style.display = 'none';
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname, 
            },
        });
        if (error) throw error;
    } catch (error: any) {
        console.error('Error during Google login:', error);
        if (authErrorMessage) {
            authErrorMessage.textContent = `Login failed: ${error.message || 'Unknown error'}`;
            authErrorMessage.style.display = 'block';
        }
    }
}

async function handleLogout() {
    if (!supabase) return;
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // onAuthStateChange will handle UI updates
    } catch (error: any) {
        console.error('Error during logout:', error);
    }
}

function updateUIForAuthState(user: User | null) {
    currentUser = user; // Update global state first

    if (user) { // User is logged in
        if (loginPage) loginPage.style.display = 'none';
        if (appContent) appContent.style.display = 'block';
        if (logoutButton) logoutButton.style.display = 'inline-flex';
        if (authErrorMessage) authErrorMessage.style.display = 'none'; 
        
        // Display greeting
        if (userGreetingElement) {
            const displayName = currentUser?.user_metadata?.display_name;
            if (displayName && displayName.trim() !== '') {
                userGreetingElement.textContent = `Welcome back, ${displayName}!`;
            } else {
                userGreetingElement.textContent = "Hello there!"; // Default if no display name
            }
            userGreetingElement.style.display = 'block';
        }
        
        initializeAI(); 
                
        if (currentMode === 'history') {
            loadAndDisplayHistory(); 
        } else if (currentMode === 'settings') {
            loadUserSettings();
        }
    } else { // User is null (logged out or no session)
        if (loginPage) loginPage.style.display = 'flex'; 
        if (appContent) appContent.style.display = 'none';
        if (logoutButton) logoutButton.style.display = 'none';
        if (userGreetingElement) userGreetingElement.style.display = 'none'; // Hide greeting
        
        clearAllInputsAndResults();
        if (historyItemsContainer) historyItemsContainer.innerHTML = '';
        if (emptyHistoryMessage) emptyHistoryMessage.style.display = 'block';

        if (supabaseInitializationError && authErrorMessage) {
            authErrorMessage.textContent = supabaseInitializationError;
            authErrorMessage.style.display = 'block';
        }
        if (loginButton) { 
            loginButton.disabled = !!supabaseInitializationError;
        }
        initializeAI(); 
    }
}


// --- Mode Switching Logic ---
function switchMode(newMode: 'single' | 'sequence' | 'history' | 'settings') {
    currentMode = newMode;
    const tabs = [tabSingle, tabSequence, tabHistory, tabSettings].filter(t => t); 
    const modes = [singleImageModeDiv, sequenceModeDiv, historyModeDiv, settingsModeDiv].filter(m => m);

    tabs.forEach(tab => {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
    });
    modes.forEach(modeDiv => {
        modeDiv.classList.remove('active');
        modeDiv.style.display = 'none';
        modeDiv.removeAttribute('tabindex');
    });

    let activeTab: HTMLButtonElement | undefined;
    let activeModeDiv: HTMLDivElement | undefined;

    if (newMode === 'single') {
        activeTab = tabSingle;
        activeModeDiv = singleImageModeDiv;
    } else if (newMode === 'sequence') {
        activeTab = tabSequence;
        activeModeDiv = sequenceModeDiv;
    } else if (newMode === 'history') {
        activeTab = tabHistory;
        activeModeDiv = historyModeDiv;
        if (currentUser && historyItemsContainer && !historyItemsContainer.hasChildNodes() && loadingHistoryIndicator?.style.display === 'none') {
             if(emptyHistoryMessage) emptyHistoryMessage.style.display = 'block';
        } else if (!currentUser && emptyHistoryMessage) {
             if (historyItemsContainer) historyItemsContainer.innerHTML = '';
             emptyHistoryMessage.style.display = 'block';
        }
    } else if (newMode === 'settings') {
        activeTab = tabSettings;
        activeModeDiv = settingsModeDiv;
        if (currentUser) {
            loadUserSettings();
        }
    }


    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.setAttribute('aria-selected', 'true');
    }
    if (activeModeDiv) {
        activeModeDiv.classList.add('active');
        activeModeDiv.style.display = 'block';
        activeModeDiv.setAttribute('tabindex', '0'); 
    }
    // Re-check AI status message for the current tab. This is important
    // as initializeAI() might display errors in specific error message elements
    // based on the currentMode.
    initializeAI();
}

if (tabSingle) tabSingle.addEventListener('click', () => switchMode('single'));
if (tabSequence) tabSequence.addEventListener('click', () => switchMode('sequence'));
if (tabHistory) tabHistory.addEventListener('click', () => {
    switchMode('history');
    if (currentUser) {
        loadAndDisplayHistory();
    }
});
if (tabSettings) tabSettings.addEventListener('click', () => switchMode('settings'));


function clearAllInputsAndResults() {
    if (promptInput) promptInput.value = '';
    clearImageSelection();
    clearPreviousState();
    if (basePromptInputSequence) basePromptInputSequence.value = '';
    if (animationInstructionInput) animationInstructionInput.value = '';
    if (numFramesInput) numFramesInput.value = '3';
    clearImageSelectionSequence();
    clearPreviousStateSequence();
    currentSelectedStyle = null;
    currentSelectedAspectRatio = null;
    updateStyleButtonDisplay();
    updateAspectRatioButtonDisplay();
    closeAllPopups();
}


// --- Single Image Mode Functions ---
if(triggerImageInputSingle) triggerImageInputSingle.addEventListener('click', () => imageInput?.click());
if (imageInput) imageInput.addEventListener('change', (event) => handleImageFileChange(event, 'single'));
if (removeImageButton) removeImageButton.addEventListener('click', clearImageSelection);

function clearImageSelection() {
    if (imageInput) imageInput.value = ''; 
    currentSelectedFileBase64 = null;
    currentSelectedFileMimeType = null;
    if (imagePreview) imagePreview.src = '#';
    if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
}

if (generateButton) generateButton.addEventListener('click', async () => {
    if (!ai) {
        initializeAI(); // Re-check and display error if AI isn't ready
        return;
    }
    if (!currentUser) {
        displayError("You must be logged in to generate images.");
        return; 
    }
    const currentUserId = currentUser.id; // Capture User ID

    const userPrompt = promptInput.value.trim();
    if (!userPrompt && !currentSelectedFileBase64) {
        displayError("Please enter an image description or upload an image.");
        return;
    }
     if (!userPrompt && currentSelectedFileBase64) {
        displayError("Please provide a prompt to go with the uploaded image.");
        return;
    }

    clearPreviousState();
    setLoadingState(true, "Preparing your request...");

    let finalPromptForImagen = userPrompt;
    let userBaseImageForHistory: { data: string; mimeType: string } | undefined = undefined;

    try {
        if (currentSelectedFileBase64 && currentSelectedFileMimeType) {
            setLoadingState(true, "Analyzing your image and prompt...");
            const base64Data = currentSelectedFileBase64.split(',')[1];
            if (!base64Data) {
                throw new Error("Invalid image data format for API.");
            }
            const imagePart: Part = { inlineData: { mimeType: currentSelectedFileMimeType, data: base64Data } };
            const textPartForAnalysis: Part = { text: `You are an expert prompt engineer. Analyze the provided image and the user's instruction. Your goal is to generate a new, highly detailed text prompt that combines insights from the image with the user's request. This new prompt will be used by a separate text-to-image generation model. User's instruction: "${userPrompt}"` };

            const analysisResponse: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-04-17',
                contents: { parts: [imagePart, textPartForAnalysis] },
            });
            
            finalPromptForImagen = analysisResponse.text?.trim() || ""; // Safely access .text and provide fallback
            if (!finalPromptForImagen) {
                throw new Error("Failed to generate an enhanced prompt from the image and text. The analysis returned an empty response.");
            }
            userBaseImageForHistory = { data: currentSelectedFileBase64, mimeType: currentSelectedFileMimeType };
        }
        
        // Append style and aspect ratio to the prompt for Imagen
        let promptSuffix = "";
        if (currentSelectedStyle) {
            promptSuffix += `, ${currentSelectedStyle}`;
        }
        if (currentSelectedAspectRatio) {
            promptSuffix += `, aspect ratio ${currentSelectedAspectRatio}`;
        }
        if (promptSuffix) {
            finalPromptForImagen += promptSuffix;
        }
        
        setLoadingState(true, "Generating your image...");
        const response: GenerateImagesResponse = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: finalPromptForImagen,
            config: { numberOfImages: 1, outputMimeType: 'image/jpeg' },
        });
        
        if (response.generatedImages && response.generatedImages.length > 0) {
            const image = response.generatedImages[0];
            if (image.image && image.image.imageBytes) {
                const base64ImageBytes: string = image.image.imageBytes;
                const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
                currentSingleImageURL = imageUrl;
                displayImage(imageUrl, finalPromptForImagen);
                lastSuccessfulPrompt = userPrompt; 
                lastSuccessfulImageBase64 = currentSelectedFileBase64;
                lastSuccessfulImageMimeType = currentSelectedFileMimeType;

                const historyEntry: Omit<SingleHistoryItemDB, 'id' | 'created_at'> = {
                    mode: 'single',
                    user_prompt: userPrompt,
                    effective_prompt: finalPromptForImagen, // This is the prompt sent to Imagen
                    image_url: imageUrl,
                    user_base_image_data: userBaseImageForHistory?.data ?? null,
                    user_base_image_mime_type: userBaseImageForHistory?.mimeType ?? null,
                    selected_aspect_ratio: currentSelectedAspectRatio,
                    selected_style: currentSelectedStyle
                };
                await addHistoryItem(historyEntry, currentUserId); // Pass captured User ID

            } else { throw new Error("Image data is missing in the response."); }
        } else { throw new Error("No images were generated. The response might be empty or contain safety blocks. Try a different prompt or image."); }

    } catch (error: any) {
        handleGenerateError(error, displayError);
    } finally {
        setLoadingState(false);
    }
});

if (editPromptButton) editPromptButton.addEventListener('click', () => {
    if (promptInput) promptInput.value = lastSuccessfulPrompt;
    if (lastSuccessfulImageBase64 && lastSuccessfulImageMimeType) {
        currentSelectedFileBase64 = lastSuccessfulImageBase64;
        currentSelectedFileMimeType = lastSuccessfulImageMimeType;
        if (imagePreview) imagePreview.src = currentSelectedFileBase64;
        if (imagePreviewContainer) imagePreviewContainer.style.display = 'block';
    } else {
        clearImageSelection();
    }
    // Restore AR and Style from history if they were part of the last successful generation
    // This requires fetching the last history item or storing them with lastSuccessful...
    // For simplicity, we'll let reuseHistoryItem handle this for now when editing via history.
    // Here, we just reset them for a fresh edit if they were set.
    currentSelectedAspectRatio = null;
    currentSelectedStyle = null;
    updateAspectRatioButtonDisplay();
    updateStyleButtonDisplay();

    if (promptInput) {
        promptInput.focus();
        promptInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
});

function setLoadingState(isLoading: boolean, message?: string) {
    if (generateButton) generateButton.disabled = isLoading || !ai; // Also consider AI state
    if (promptInput) promptInput.disabled = isLoading;
    if (triggerImageInputSingle) triggerImageInputSingle.disabled = isLoading || !ai;
    if (styleButton) styleButton.disabled = isLoading || !ai;
    if (aspectRatioButton) aspectRatioButton.disabled = isLoading || !ai;

    
    if (buttonText) buttonText.style.display = isLoading ? 'none' : 'inline-block';
    if (buttonIcon) buttonIcon.style.display = isLoading ? 'none' : 'inline-block';
    if (buttonSpinner) buttonSpinner.style.display = isLoading ? 'inline-block' : 'none';
    
    if (loadingIndicator) loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    if (isLoading && message && loadingMessageElement) loadingMessageElement.textContent = message;
    
    if (isLoading) {
        if (imageDisplayArea) imageDisplayArea.innerHTML = ''; 
        if (imageActionsBar) imageActionsBar.style.display = 'none';
        if (errorMessageElement) errorMessageElement.style.display = 'none';
        if (editPromptButton) editPromptButton.style.display = 'none';
        closeAllPopups();
    }
}

function displayError(message: string) {
    if (errorMessageElement) {
        errorMessageElement.textContent = message;
        errorMessageElement.style.display = 'block';
    }
    if (imageDisplayArea) imageDisplayArea.innerHTML = '';
    if (imageActionsBar) imageActionsBar.style.display = 'none';
    if (editPromptButton) editPromptButton.style.display = 'none';
    if (loadingIndicator) loadingIndicator.style.display = 'none';
}

function displayImage(imageUrl: string, altText: string) {
    if (!imageDisplayArea || !imageActionsBar) return;
    imageDisplayArea.innerHTML = ''; 
    const imgElement = document.createElement('img');
    imgElement.src = imageUrl;
    imgElement.alt = altText || "Generated image";
    imgElement.onload = () => {
      currentSingleImageURL = imageUrl; // Ensure it's set on load for actions
    }; 
    imgElement.onerror = () => {
        displayError("Failed to load the generated image.");
        if (editPromptButton) editPromptButton.style.display = 'none';
        if (imageActionsBar) imageActionsBar.style.display = 'none';
    };
    imageDisplayArea.appendChild(imgElement);
    if (errorMessageElement) errorMessageElement.style.display = 'none';
    if (editPromptButton) editPromptButton.style.display = 'flex'; 
    if (imageActionsBar) imageActionsBar.style.display = 'flex';
}

function clearPreviousState() {
    if (errorMessageElement) {
        errorMessageElement.style.display = 'none';
        errorMessageElement.textContent = '';
    }
    if (imageDisplayArea) imageDisplayArea.innerHTML = '';
    if (imageActionsBar) imageActionsBar.style.display = 'none';
    if (editPromptButton) editPromptButton.style.display = 'none';
    if (loadingIndicator) loadingIndicator.style.display = 'none';
}

// --- Sequence Mode Functions ---
if(triggerImageInputSequence) triggerImageInputSequence.addEventListener('click', () => imageInputSequence?.click());
if(imageInputSequence) imageInputSequence.addEventListener('change', (event) => handleImageFileChange(event, 'sequence'));
if(removeImageButtonSequence) removeImageButtonSequence.addEventListener('click', clearImageSelectionSequence);

function clearImageSelectionSequence() {
    if (imageInputSequence) imageInputSequence.value = ''; 
    currentSelectedFileBase64Sequence = null;
    currentSelectedFileMimeTypeSequence = null;
    if (imagePreviewSequence) imagePreviewSequence.src = '#';
    if (imagePreviewContainerSequence) imagePreviewContainerSequence.style.display = 'none';
}

if (generateSequenceButton) generateSequenceButton.addEventListener('click', async () => {
    if (!ai) {
        initializeAI(); // Re-check and display error
        return;
    }
     if (!currentUser) {
        displayErrorSequence("You must be logged in to generate image sequences.");
        return;
    }
    const currentUserId = currentUser.id; // Capture User ID

    const userBasePrompt = basePromptInputSequence.value.trim();
    const animationInstruction = animationInstructionInput.value.trim();
    const numFrames = parseInt(numFramesInput.value, 10);

    if (!userBasePrompt) {
        displayErrorSequence("Please enter a base scene/subject prompt.");
        return;
    }
    if (!animationInstruction) {
        displayErrorSequence("Please enter an animation/evolution instruction.");
        return;
    }
    if (isNaN(numFrames) || numFrames < 2 || numFrames > 10) {
        displayErrorSequence("Number of frames must be between 2 and 10.");
        return;
    }

    clearPreviousStateSequence();
    setLoadingStateSequence(true, `Preparing sequence (0/${numFrames})...`);

    let effectiveBasePromptForSequence = userBasePrompt;
    const generatedFrameUrls: string[] = [];
    let userBaseImageForHistorySequence: { data: string; mimeType: string } | undefined = undefined;

    try {
        if (currentSelectedFileBase64Sequence && currentSelectedFileMimeTypeSequence) {
            setLoadingStateSequence(true, `Analyzing base image (0/${numFrames})...`);
            const base64Data = currentSelectedFileBase64Sequence.split(',')[1];
            if (!base64Data) {
                throw new Error("Invalid base image data format for API.");
            }
            const imagePart: Part = { inlineData: { mimeType: currentSelectedFileMimeTypeSequence, data: base64Data } };
            const textPartForAnalysis: Part = { text: `You are an expert prompt engineer.Analyze the provided image and the user's base instruction. Your goal is to generate a single, highly detailed text prompt describing the initial scene based on the image and instruction. This description will be the foundation for an animated sequence. User's base instruction: "${userBasePrompt}"` };
            
            const analysisResponse: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-04-17',
                contents: { parts: [imagePart, textPartForAnalysis] },
            });
            
            effectiveBasePromptForSequence = analysisResponse.text?.trim() || ""; // Safely access .text and provide fallback
            if (!effectiveBasePromptForSequence) {
                throw new Error("Failed to generate an enhanced prompt from the base image and text for the sequence. The analysis returned an empty response.");
            }
            userBaseImageForHistorySequence = { data: currentSelectedFileBase64Sequence, mimeType: currentSelectedFileMimeTypeSequence };
        }

        for (let i = 1; i <= numFrames; i++) {
            setLoadingStateSequence(true, `Generating frame ${i} of ${numFrames}...`);
            const framePrompt = `${effectiveBasePromptForSequence}. ${animationInstruction}. This is frame ${i} of ${numFrames} in an animated sequence. Consider the previous frames to ensure smooth transitions.`;
            
            const response: GenerateImagesResponse = await ai.models.generateImages({
                model: 'imagen-3.0-generate-002',
                prompt: framePrompt,
                config: { numberOfImages: 1, outputMimeType: 'image/jpeg' },
            });

            if (response.generatedImages && response.generatedImages.length > 0) {
                const image = response.generatedImages[0];
                if (image.image && image.image.imageBytes) {
                    const base64ImageBytes: string = image.image.imageBytes;
                    const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
                    displaySequenceImage(imageUrl, `Frame ${i} of ${numFrames}: ${userBasePrompt.substring(0,30)}...`);
                    generatedFrameUrls.push(imageUrl);
                } else {
                    throw new Error(`Image data missing for frame ${i}.`);
                }
            } else {
                throw new Error(`No image generated for frame ${i}. Response might be empty or contain safety blocks. Try adjusting prompts.`);
            }
        }
        setLoadingStateSequence(false, `Sequence complete! ${numFrames} frames generated.`);
        
                const historyEntry: Omit<SequenceHistoryItemDB, 'id' | 'created_at'> = {
                    mode: 'sequence',
                    user_base_prompt: userBasePrompt,
                    effective_base_prompt: effectiveBasePromptForSequence,
                    animation_instruction: animationInstruction,
                    num_frames: numFrames,
                    image_urls: generatedFrameUrls,
                    user_base_image_data: userBaseImageForHistorySequence?.data ?? null,
                    user_base_image_mime_type: userBaseImageForHistorySequence?.mimeType ?? null
                };
        await addHistoryItem(historyEntry, currentUserId); // Pass captured User ID

    } catch (error: any) {
        console.error("Error during sequence generation process:", error);
        handleGenerateError(error, displayErrorSequence);
         setLoadingStateSequence(false); 
    } finally {
        const isLoading = buttonSpinnerSequence?.style.display === 'inline-block';
        if (isLoading && errorMessageSequenceElement?.style.display !== 'block' && !loadingMessageSequenceElement?.textContent?.startsWith("Sequence complete!")) {
             setLoadingStateSequence(false);
        } else if (!isLoading) {
             // Already in a non-loading state
        } else {
            if(generateSequenceButton) generateSequenceButton.disabled = false || !ai;
            if(basePromptInputSequence) basePromptInputSequence.disabled = false;
            if(animationInstructionInput) animationInstructionInput.disabled = false;
            if(numFramesInput) numFramesInput.disabled = false;
            if(triggerImageInputSequence) triggerImageInputSequence.disabled = false || !ai;
        }
    }
});


function setLoadingStateSequence(isLoading: boolean, message?: string) {
    if(generateSequenceButton) generateSequenceButton.disabled = isLoading || !ai;
    if(basePromptInputSequence) basePromptInputSequence.disabled = isLoading;
    if(animationInstructionInput) animationInstructionInput.disabled = isLoading;
    if(numFramesInput) numFramesInput.disabled = isLoading;
    if(triggerImageInputSequence) triggerImageInputSequence.disabled = isLoading || !ai;

    if (buttonTextSequence) buttonTextSequence.style.display = isLoading ? 'none' : 'inline-block';
    if (buttonIconSequence) buttonIconSequence.style.display = isLoading ? 'none' : 'inline-block';
    if (buttonSpinnerSequence) buttonSpinnerSequence.style.display = isLoading ? 'inline-block' : 'none';

    if (isLoading) {
        if (loadingMessageSequenceElement) loadingMessageSequenceElement.textContent = message || "Processing sequence...";
        if (message && (message.startsWith("Preparing") || message.startsWith("Analyzing"))) {
             if (sequenceDisplayArea) sequenceDisplayArea.innerHTML = ''; 
        }
        if (loadingIndicatorSequence) loadingIndicatorSequence.style.display = 'flex';
        if (errorMessageSequenceElement) errorMessageSequenceElement.style.display = 'none';
    } else { 
        if (message && message.startsWith("Sequence complete!")) {
            if (loadingMessageSequenceElement) loadingMessageSequenceElement.textContent = message;
            if (loadingIndicatorSequence) loadingIndicatorSequence.style.display = 'flex'; 
            if (errorMessageSequenceElement) errorMessageSequenceElement.style.display = 'none';
            if (buttonTextSequence) buttonTextSequence.style.display = 'inline-block';
            if (buttonIconSequence) buttonIconSequence.style.display = 'inline-block';
            if (buttonSpinnerSequence) buttonSpinnerSequence.style.display = 'none';
        } else if (!message && errorMessageSequenceElement?.style.display !== 'block') {
             if(loadingIndicatorSequence?.style.display === 'flex' && !loadingMessageSequenceElement?.textContent?.startsWith("Sequence complete!")) {
                if(loadingIndicatorSequence) loadingIndicatorSequence.style.display = 'none';
             }
        }
    }
}


function displayErrorSequence(message: string) {
    if (errorMessageSequenceElement) {
        errorMessageSequenceElement.textContent = message;
        errorMessageSequenceElement.style.display = 'block';
    }
    if (loadingIndicatorSequence) loadingIndicatorSequence.style.display = 'none';
}

function displaySequenceImage(imageUrl: string, altText: string) {
    if (!sequenceDisplayArea) return;

    const frameContainer = document.createElement('div');
    frameContainer.classList.add('sequence-frame-container');

    const imgElement = document.createElement('img');
    imgElement.src = imageUrl;
    imgElement.alt = altText || "Generated sequence image";
    imgElement.classList.add('sequence-frame'); 
    imgElement.onerror = () => {
        frameContainer.innerHTML = ''; // Clear previous content
        const errorFrame = document.createElement('div');
        errorFrame.classList.add('sequence-frame-error'); // Use appropriate class
        errorFrame.textContent = `Error loading: ${altText.split(':')[0]}`; 
        frameContainer.appendChild(errorFrame);
    };
    frameContainer.appendChild(imgElement);

    const downloadButton = document.createElement('button');
    downloadButton.classList.add('sequence-frame-download-button');
    downloadButton.setAttribute('aria-label', `Download ${altText}`);
    downloadButton.innerHTML = `<span class="material-symbols-outlined">download</span>`;
    downloadButton.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadGeneratedImage(imageUrl, `${altText.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpeg`);
    });
    frameContainer.appendChild(downloadButton);
    
    sequenceDisplayArea.appendChild(frameContainer);
    if (errorMessageSequenceElement) errorMessageSequenceElement.style.display = 'none'; 
}

function clearPreviousStateSequence() {
    if (errorMessageSequenceElement) {
        errorMessageSequenceElement.style.display = 'none';
        errorMessageSequenceElement.textContent = '';
    }
    if (sequenceDisplayArea) sequenceDisplayArea.innerHTML = '';
    if (loadingIndicatorSequence) loadingIndicatorSequence.style.display = 'none';
}

// --- Shared Functions ---
function handleImageFileChange(event: Event, mode: 'single' | 'sequence') {
    const file = (event.target as HTMLInputElement).files?.[0];
    const displayErr = mode === 'single' ? displayError : displayErrorSequence;
    const clearSel = mode === 'single' ? clearImageSelection : clearImageSelectionSequence;
    
    if (file) {
        if (file.size > 4 * 1024 * 1024) { 
            displayErr("Image size should not exceed 4MB.");
            clearSel();
            (event.target as HTMLInputElement).value = ''; 
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            if (mode === 'single') {
                currentSelectedFileBase64 = result;
                currentSelectedFileMimeType = file.type;
                if (imagePreview) imagePreview.src = result;
                if (imagePreviewContainer) imagePreviewContainer.style.display = 'block';
            } else {
                currentSelectedFileBase64Sequence = result;
                currentSelectedFileMimeTypeSequence = file.type;
                if (imagePreviewSequence) imagePreviewSequence.src = result;
                if (imagePreviewContainerSequence) imagePreviewContainerSequence.style.display = 'block';
            }
        };
        reader.onerror = () => {
            displayErr("Failed to read the image file.");
            clearSel();
        };
        reader.readAsDataURL(file);
    }
}

function handleGenerateError(error: any, displayFn: (message: string) => void) {
    console.error("Error during generation process or saving history:", error);
    let message: string | null = null;

    if (error.message) {
        if (error.message.startsWith("Failed to save history item")) {
            try {
                const detailsJson = error.message.substring("Failed to save history item: ".length);
                const parsedDetails = JSON.parse(detailsJson);
                const specificError = parsedDetails.message || "Load failed"; 
                message = `Failed to save to history: ${specificError}. Please check your network connection. The image may have been generated but not saved to history.`;
            } catch (e) {
                message = "Failed to save to history. Please check your network connection. The image may have been generated but not saved to history.";
            }
        }
    }

    if (message === null) {
        let specificGenerationErrorMessage = "An error occurred during image generation."; // Default for other generation errors
        if (error.message) {
            specificGenerationErrorMessage = error.message; // Use the original error message if available
        }

        const apiKey = import.meta.env.VITE_API_KEY; 
        const apiKeyPlaceholder = "__REPLACE_WITH_YOUR_GEMINI_API_KEY__";

        if (!apiKey || apiKey === apiKeyPlaceholder || apiKey.trim() === '') {
            specificGenerationErrorMessage = `Gemini API Key is not configured correctly. Ensure VITE_API_KEY is set in your .env file for local Vite development.`;
            ai = null; 
            initializeAI();
        } else if (error.message?.includes("API key not valid") || error.message?.includes("API_KEY_INVALID") || error.message?.includes("PermissionDenied")) {
            specificGenerationErrorMessage = "The Gemini API key provided is not valid or has insufficient permissions. Please check the key in your Google Cloud environment or generate a new one from Google AI Studio.";
            ai = null; 
            initializeAI();
        } else if (error.toString().includes("billing")) {
            specificGenerationErrorMessage = "There might be an issue with billing for the project associated with your API Key. Please check your Google Cloud console.";
        } else if (error.toString().includes("quota")) {
            specificGenerationErrorMessage = "You have exceeded your API quota with the current API Key. Please try again later or check your quota limits.";
        } else if (error.toString().includes("safety policy") || error.message?.includes("SAFETY")) {
            specificGenerationErrorMessage = "The request was blocked due to safety policy. Please modify your prompt or image.";
        } else if (error.toString().includes("Invalid image data")) {
            specificGenerationErrorMessage = "The uploaded image data is invalid or unsupported. Please try a different image (e.g., PNG, JPEG).";
        } else if (error.toString().includes("ReadableStream uploading is not supported")) {
            specificGenerationErrorMessage = "Error: The server proxy (on Google Cloud Run) does not support the way image data is being sent. This is an issue with the proxy configuration and not the frontend. (Details: ReadableStream uploading not supported)";
        }
        message = specificGenerationErrorMessage;
    }

    displayFn(message); // message is guaranteed to be a string here
}

// --- Image Action Functions (Download, Fullscreen) ---
function downloadGeneratedImage(imageUrl: string | null, filename = "generated_image.jpeg") {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function openFullscreenImageView(imageUrl: string | null) {
    if (!imageUrl || !fullscreenModal || !fullscreenImage) return;
    fullscreenImage.src = imageUrl;
    fullscreenModal.style.display = 'flex';
    fullscreenModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
}

function closeFullscreenImageView() {
    if (!fullscreenModal) return;
    fullscreenModal.style.display = 'none';
    fullscreenModal.setAttribute('aria-hidden', 'true');
    if (fullscreenImage) fullscreenImage.src = '#'; // Clear image
    document.body.style.overflow = ''; // Restore background scroll
}

if (downloadImageButton) downloadImageButton.addEventListener('click', () => downloadGeneratedImage(currentSingleImageURL));
if (fullscreenImageButton) fullscreenImageButton.addEventListener('click', () => openFullscreenImageView(currentSingleImageURL));
if (closeFullscreenModalButton) closeFullscreenModalButton.addEventListener('click', closeFullscreenImageView);
if (fullscreenModal) { // Close on Escape key
    fullscreenModal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeFullscreenImageView();
        }
    });
    fullscreenModal.addEventListener('click', (event) => { // Close on clicking backdrop (optional)
        if (event.target === fullscreenModal) {
            closeFullscreenImageView();
        }
    });
}

// --- Aspect Ratio and Style Dropdown Logic ---
function populateDropdown(popupElement: HTMLElement, items: Array<{name: string, value: string | null}>, selectCallback: (value: string | null, name: string) => void, currentSelectedValue: string | null) {
    if (!popupElement) return;
    popupElement.innerHTML = '';
    items.forEach(item => {
        const button = document.createElement('button');
        button.classList.add('dropdown-item');
        button.textContent = item.name;
        button.setAttribute('role', 'option');
        button.setAttribute('data-value', item.value ?? '');
        if (item.value === currentSelectedValue) {
            button.classList.add('selected');
            button.setAttribute('aria-selected', 'true');
        } else {
            button.setAttribute('aria-selected', 'false');
        }
        button.addEventListener('click', () => {
            selectCallback(item.value, item.name); // name is passed here
            // Visually update selection
            popupElement.querySelectorAll('.dropdown-item').forEach(el => {
                el.classList.remove('selected');
                el.setAttribute('aria-selected', 'false');
            });
            button.classList.add('selected');
            button.setAttribute('aria-selected', 'true');
            closeAllPopups(); // Close popup after selection
        });
        popupElement.appendChild(button);
    });
}

function togglePopup(buttonElement: HTMLButtonElement, popupElement: HTMLElement) {
    const isActive = popupElement.classList.contains('active');
    closeAllPopups(); // Close any other open popups
    if (!isActive) {
        popupElement.classList.add('active');
        buttonElement.setAttribute('aria-expanded', 'true');
    }
}

function closeAllPopups() {
    [styleOptionsPopup, aspectRatioOptionsPopup].forEach(popup => {
        if (popup) popup.classList.remove('active');
    });
    if (styleButton) styleButton.setAttribute('aria-expanded', 'false');
    if (aspectRatioButton) aspectRatioButton.setAttribute('aria-expanded', 'false');
}

function updateStyleButtonDisplay() {
    if (styleButtonText) {
        const selected = STYLES.find(s => s.value === currentSelectedStyle);
        styleButtonText.textContent = selected && selected.value ? `Style: ${selected.name}` : 'Style';
    }
}
function updateAspectRatioButtonDisplay() {
     if (aspectRatioButtonText) {
        const selected = ASPECT_RATIOS.find(ar => ar.value === currentSelectedAspectRatio);
        aspectRatioButtonText.textContent = selected && selected.value ? `AR: ${selected.name.split(' ')[0]}` : 'Aspect Ratio';
    }
}

if (styleButton && styleOptionsPopup) {
    styleButton.addEventListener('click', (e) => {
        e.stopPropagation();
        populateDropdown(styleOptionsPopup, STYLES, (value, _name) => { // _name signifies unused parameter
            currentSelectedStyle = value;
            updateStyleButtonDisplay();
        }, currentSelectedStyle);
        togglePopup(styleButton, styleOptionsPopup);
    });
}

if (aspectRatioButton && aspectRatioOptionsPopup) {
    aspectRatioButton.addEventListener('click', (e) => {
        e.stopPropagation();
        populateDropdown(aspectRatioOptionsPopup, ASPECT_RATIOS, (value, _name) => { // _name signifies unused parameter
            currentSelectedAspectRatio = value;
            updateAspectRatioButtonDisplay();
        }, currentSelectedAspectRatio);
        togglePopup(aspectRatioButton, aspectRatioOptionsPopup);
    });
}
// Close popups when clicking outside
document.addEventListener('click', (event) => {
    if (
        styleOptionsPopup && !styleOptionsPopup.contains(event.target as Node) && !styleButton?.contains(event.target as Node) &&
        aspectRatioOptionsPopup && !aspectRatioOptionsPopup.contains(event.target as Node) && !aspectRatioButton?.contains(event.target as Node)
    ) {
        closeAllPopups();
    }
});


// --- History Functions (Supabase) ---
async function addHistoryItem(itemData: Omit<HistoryItemDB, 'id' | 'created_at'>, userId: string | null) { // Added userId parameter
    console.log("Attempting to add history item. Supabase client:", supabase, "User ID:", userId);
    if (!supabase || !userId) {
        console.error("Cannot add history item: Supabase client or User ID is not available.", { supabaseExists: !!supabase, userIdExists: !!userId });
        // Throw an error to ensure the calling function's error handler can inform the user.
        if (!supabase) throw new Error("History service (Supabase) not available. Cannot save history.");
        if (!userId) throw new Error("User session invalid or ended. Cannot save history.");
        return; // Should be unreachable due to throws
    }

    try {
        const itemToInsert = { ...itemData, user_id: userId }; // Use the passed userId

        console.log("Inserting history item:", itemToInsert);
        const { data, error: supabaseError } = await supabase
            .from(HISTORY_TABLE_NAME)
            .insert([itemToInsert])
            .select();
        
        if (supabaseError) {
            console.error("Supabase error adding history item:", supabaseError);
            throw supabaseError; // Re-throw to be caught by the generation function's error handler
        }
        console.log("History item added successfully to Supabase. Response data:", data);
    } catch (error: any) { // Catches re-thrown supabaseError or other errors in the try block
        console.error("Error in addHistoryItem's try block or Supabase error:", error);
        // Ensure the error propagates to handleGenerateError
        if (error instanceof Error) {
            throw error;
        } else {
            // Attempt to stringify non-Error objects for better error message
            let errorMessage = "Failed to save history item";
            try {
                errorMessage += `: ${JSON.stringify(error)}`;
            } catch (e) {
                // Fallback if JSON.stringify fails (e.g., circular structures)
                errorMessage += `: Unknown error object`;
            }
            throw new Error(errorMessage);
        }
    }
}

async function deleteHistoryItem(itemId: string) {
    if (!supabase || !currentUser) return;
    try {
        const { error } = await supabase.from(HISTORY_TABLE_NAME).delete().match({ id: itemId, user_id: currentUser.id });
        if (error) throw error;
        loadAndDisplayHistory(); 
    } catch (error: any) {
        console.error("Error deleting history item from Supabase:", error);
    }
}

async function clearAllHistory() {
    if (!supabase || !currentUser) return;
    if (confirm("Are you sure you want to delete all your history items? This cannot be undone.")) {
        try {
            const { error } = await supabase.from(HISTORY_TABLE_NAME).delete().match({ user_id: currentUser.id });
            if (error) throw error;
            loadAndDisplayHistory(); 
        } catch (error: any) {
            console.error("Error clearing history from Supabase:", error);
        }
    }
}
if (clearHistoryButton) clearHistoryButton.addEventListener('click', clearAllHistory);


function createHistoryItemElement(item: HistoryItemDB): HTMLElement {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('history-item');
    itemDiv.setAttribute('data-id', item.id);
    itemDiv.setAttribute('role', 'listitem');

    const thumbnailWrapper = document.createElement('div');
    thumbnailWrapper.classList.add('history-item-thumbnail-wrapper');

    if (item.mode === 'single') {
        const singleItem = item as SingleHistoryItemDB;
        const img = document.createElement('img');
        img.classList.add('history-item-thumbnail');
        img.src = singleItem.image_url;
        img.alt = `Generated: ${singleItem.effective_prompt.substring(0, 50)}...`;
        thumbnailWrapper.appendChild(img);

        const thumbActions = document.createElement('div');
        thumbActions.classList.add('history-item-thumbnail-actions');
        
        const downloadBtn = document.createElement('button');
        downloadBtn.classList.add('image-action-button');
        downloadBtn.setAttribute('aria-label', 'Download image');
        downloadBtn.innerHTML = `<span class="material-symbols-outlined">download</span>`;
        downloadBtn.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            downloadGeneratedImage(singleItem.image_url, `history_${singleItem.id.substring(0,8)}.jpeg`);
        });
        thumbActions.appendChild(downloadBtn);

        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.classList.add('image-action-button');
        fullscreenBtn.setAttribute('aria-label', 'View image fullscreen');
        fullscreenBtn.innerHTML = `<span class="material-symbols-outlined">fullscreen</span>`;
        fullscreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openFullscreenImageView(singleItem.image_url);
        });
        thumbActions.appendChild(fullscreenBtn);
        thumbnailWrapper.appendChild(thumbActions);

    } else if (item.mode === 'sequence') {
        const seqItem = item as SequenceHistoryItemDB;
        const seqThumbsDiv = document.createElement('div');
        seqThumbsDiv.classList.add('history-item-sequence-thumbnails');
        seqItem.image_urls.slice(0, 4).forEach((url, index) => {
            const frameContainer = document.createElement('div');
            frameContainer.classList.add('sequence-frame-container');
            const img = document.createElement('img');
            img.src = url;
            img.alt = `Frame ${index + 1} of sequence: ${seqItem.effective_base_prompt.substring(0,30)}...`;
            img.classList.add('sequence-frame');
            frameContainer.appendChild(img);

            const downloadBtn = document.createElement('button');
            downloadBtn.classList.add('sequence-frame-download-button');
            downloadBtn.setAttribute('aria-label', `Download frame ${index + 1}`);
            downloadBtn.innerHTML = `<span class="material-symbols-outlined">download</span>`;
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                downloadGeneratedImage(url, `history_seq_${seqItem.id.substring(0,4)}_frame${index+1}.jpeg`);
            });
            frameContainer.appendChild(downloadBtn);
            seqThumbsDiv.appendChild(frameContainer);
        });
        thumbnailWrapper.appendChild(seqThumbsDiv);
    }
    itemDiv.appendChild(thumbnailWrapper);

    const detailsDiv = document.createElement('div');
    detailsDiv.classList.add('history-item-details');

    const promptP = document.createElement('p');
    promptP.classList.add('history-item-prompt');
    promptP.textContent = item.mode === 'single' ? (item as SingleHistoryItemDB).user_prompt : `${(item as SequenceHistoryItemDB).user_base_prompt} → ${(item as SequenceHistoryItemDB).animation_instruction}`;
    detailsDiv.appendChild(promptP);

    if (item.mode === 'single' && ((item as SingleHistoryItemDB).selected_style || (item as SingleHistoryItemDB).selected_aspect_ratio)) {
        const metaDiv = document.createElement('div');
        metaDiv.classList.add('history-item-meta');
        const single = item as SingleHistoryItemDB;
        if (single.selected_style) {
            const styleName = STYLES.find(s => s.value === single.selected_style)?.name || single.selected_style;
            const styleSpan = document.createElement('span');
            styleSpan.textContent = `Style: ${styleName}`;
            metaDiv.appendChild(styleSpan);
        }
        if (single.selected_aspect_ratio) {
             const arName = ASPECT_RATIOS.find(ar => ar.value === single.selected_aspect_ratio)?.name || single.selected_aspect_ratio;
            const arSpan = document.createElement('span');
            arSpan.textContent = `AR: ${arName.split(' ')[0]}`;
            metaDiv.appendChild(arSpan);
        }
        detailsDiv.appendChild(metaDiv);
    }


    const timestampP = document.createElement('p');
    timestampP.classList.add('history-item-timestamp');
    timestampP.textContent = new Date(item.created_at).toLocaleString();
    detailsDiv.appendChild(timestampP);

    const actionsDiv = document.createElement('div');
    actionsDiv.classList.add('history-item-actions');

    const reuseButton = document.createElement('button');
    reuseButton.classList.add('accessory-button');
    reuseButton.innerHTML = `<span class="material-symbols-outlined accessory-icon" aria-hidden="true">replay</span> Reuse`;
    reuseButton.setAttribute('aria-label', `Reuse prompt for ${item.mode === 'single' ? 'single image' : 'sequence'}`);
    reuseButton.addEventListener('click', () => reuseHistoryItem(item));
    actionsDiv.appendChild(reuseButton);

    const deleteButton = document.createElement('button');
    deleteButton.classList.add('accessory-button');
    deleteButton.innerHTML = `<span class="material-symbols-outlined accessory-icon" aria-hidden="true">delete</span> Delete`;
    deleteButton.setAttribute('aria-label', `Delete history item`);
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation(); 
        deleteHistoryItem(item.id);
    });
    actionsDiv.appendChild(deleteButton);
    
    detailsDiv.appendChild(actionsDiv);
    itemDiv.appendChild(detailsDiv);

    return itemDiv;
}

function reuseHistoryItem(item: HistoryItemDB) {
    if (item.mode === 'single') {
        const singleItem = item as SingleHistoryItemDB;
        if (promptInput) promptInput.value = singleItem.user_prompt;
        clearImageSelection(); 
        if (singleItem.user_base_image_data && singleItem.user_base_image_mime_type) {
            currentSelectedFileBase64 = singleItem.user_base_image_data;
            currentSelectedFileMimeType = singleItem.user_base_image_mime_type;
            if(imagePreview) imagePreview.src = currentSelectedFileBase64;
            if(imagePreviewContainer) imagePreviewContainer.style.display = 'block';
        }
        currentSelectedStyle = singleItem.selected_style ?? null;
        currentSelectedAspectRatio = singleItem.selected_aspect_ratio ?? null;
        updateStyleButtonDisplay();
        updateAspectRatioButtonDisplay();

        switchMode('single');
        if (promptInput) promptInput.focus();
    } else if (item.mode === 'sequence') {
        const sequenceItem = item as SequenceHistoryItemDB;
        if (basePromptInputSequence) basePromptInputSequence.value = sequenceItem.user_base_prompt;
        if (animationInstructionInput) animationInstructionInput.value = sequenceItem.animation_instruction;
        if (numFramesInput) numFramesInput.value = sequenceItem.num_frames.toString();
        clearImageSelectionSequence();
        if (sequenceItem.user_base_image_data && sequenceItem.user_base_image_mime_type) {
            currentSelectedFileBase64Sequence = sequenceItem.user_base_image_data;
            currentSelectedFileMimeTypeSequence = sequenceItem.user_base_image_mime_type;
            if(imagePreviewSequence) imagePreviewSequence.src = currentSelectedFileBase64Sequence;
            if(imagePreviewContainerSequence) imagePreviewContainerSequence.style.display = 'block';
        }
        switchMode('sequence');
        if (basePromptInputSequence) basePromptInputSequence.focus();
    }
}


async function loadAndDisplayHistory() {
    console.log("Attempting to load history. Supabase client:", supabase, "Current user:", currentUser); // Log
    if (!historyItemsContainer || !emptyHistoryMessage || !supabase || !currentUser || !loadingHistoryIndicator) {
        console.error("Cannot load history: One or more required elements/clients are missing or user not logged in.");
        if(emptyHistoryMessage && !currentUser) emptyHistoryMessage.style.display = 'block'; // Show empty if no user
        if(loadingHistoryIndicator) loadingHistoryIndicator.style.display = 'none';
        return;
    }

    historyItemsContainer.innerHTML = ''; 
    emptyHistoryMessage.style.display = 'none';
    loadingHistoryIndicator.style.display = 'flex';

    try {
        console.log(`Fetching history for user: ${currentUser.id}`); // Log
        const { data, error, status, count } = await supabase // Destructure more info
            .from(HISTORY_TABLE_NAME)
            .select('*', { count: 'exact' }) // Request count
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        console.log("Supabase history fetch response:", { data, error, status, count }); // Log response

        if (error) {
            console.error("Supabase error loading history:", error); // Log specific Supabase error
            throw error;
        }

        if (data && data.length === 0) {
            emptyHistoryMessage.style.display = 'block';
            emptyHistoryMessage.textContent = "Your image generation history is empty. Create some images to see them here!";
            historyItemsContainer.style.display = 'none';
            console.log("History is empty for the user."); // Log
        } else if (data) {
            emptyHistoryMessage.style.display = 'none';
            historyItemsContainer.style.display = 'grid'; 
            data.forEach(item => {
                const itemElement = createHistoryItemElement(item as HistoryItemDB);
                historyItemsContainer.appendChild(itemElement);
            });
            console.log(`Displayed ${data.length} history items.`); // Log
        }
    } catch (error: any) {
        console.error("General error in loadAndDisplayHistory function:", error); // Log any other error
        emptyHistoryMessage.textContent = "Could not load history. Please try again later. Check console for details.";
        emptyHistoryMessage.style.display = 'block';
        historyItemsContainer.style.display = 'none';
    } finally {
        loadingHistoryIndicator.style.display = 'none';
    }
}

// --- Settings Functions ---
async function loadUserSettings() {
    if (!currentUser || !userEmailDisplay || !userDisplayNameInput) return;
    userEmailDisplay.textContent = currentUser.email || 'N/A';
    userDisplayNameInput.value = currentUser.user_metadata?.display_name || ''; 
    if(settingsFeedbackMessage) settingsFeedbackMessage.style.display = 'none';
}

async function saveUserSettings() {
    if (!supabase || !currentUser || !userDisplayNameInput || !saveUserSettingsButton || !settingsFeedbackMessage) return;
    
    const newDisplayName = userDisplayNameInput.value.trim();
    saveUserSettingsButton.disabled = true;
    settingsFeedbackMessage.style.display = 'none';

    try {
        const { data, error } = await supabase.auth.updateUser({
            data: { display_name: newDisplayName }
        });
        if (error) throw error;
        
        if (data.user) {
            currentUser = data.user; // IMPORTANT: Update local currentUser with the fresh user object from Supabase
        }
        
        settingsFeedbackMessage.textContent = 'Settings saved successfully!';
        settingsFeedbackMessage.className = 'feedback-message success';
               settingsFeedbackMessage.style.display = 'block';

        // Update greeting message immediately
        if (userGreetingElement) {
            if (newDisplayName) {
                userGreetingElement.textContent = `Welcome back, ${newDisplayName}!`;
            } else {
                userGreetingElement.textContent = "Hello there!";
            }
        }

    } catch (error: any) {
        console.error("Error saving user settings:", error);
        settingsFeedbackMessage.textContent = `Error: ${error.message || 'Could not save settings.'}`;
        settingsFeedbackMessage.className = 'feedback-message error';
        settingsFeedbackMessage.style.display = 'block';
    } finally {
        saveUserSettingsButton.disabled = false;
        setTimeout(() => { if(settingsFeedbackMessage) settingsFeedbackMessage.style.display = 'none'; }, 3000);
    }
}
if (saveUserSettingsButton) saveUserSettingsButton.addEventListener('click', saveUserSettings);


// --- Initial UI Setup and Checks ---
function checkElements(): boolean {
    const allElementVariables = [
        loginPage, appContent, loginButton, logoutButton, authErrorMessage, userGreetingElement, // Added userGreeting
        themeToggle,
        tabSingle, tabSequence, tabHistory, tabSettings, singleImageModeDiv, sequenceModeDiv, historyModeDiv, settingsModeDiv,
        promptInput, generateButton, loadingIndicator, loadingMessageElement,
        errorMessageElement, imageDisplayArea, imageActionsBar, downloadImageButton, fullscreenImageButton, editPromptButton,
        triggerImageInputSingle, imageInput, imagePreviewContainer, imagePreview, removeImageButton,
        styleButton, styleOptionsPopup, aspectRatioButton, aspectRatioOptionsPopup,
        triggerImageInputSequence, imageInputSequence, imagePreviewContainerSequence,
        imagePreviewSequence, removeImageButtonSequence, basePromptInputSequence, animationInstructionInput,
        numFramesInput, generateSequenceButton,
        loadingIndicatorSequence, loadingMessageSequenceElement, errorMessageSequenceElement, sequenceDisplayArea,
        historyItemsContainer, emptyHistoryMessage, clearHistoryButton, loadingHistoryIndicator,
        userEmailDisplay, userDisplayNameInput, saveUserSettingsButton, settingsFeedbackMessage,
        fullscreenModal, fullscreenImage, closeFullscreenModalButton,
    ];

    const elementNames = [
        'loginPage', 'appContent', 'loginButton', 'logoutButton', 'authErrorMessage', 'userGreetingElement', // Added userGreeting
        'themeToggle',
        'tabSingle', 'tabSequence', 'tabHistory', 'tabSettings', 'singleImageModeDiv', 'sequenceModeDiv', 'historyModeDiv', 'settingsModeDiv',
        'promptInput', 'generateButton', 'loadingIndicator', 'loadingMessageElement',
        'errorMessageElement', 'imageDisplayArea', 'imageActionsBar', 'downloadImageButton', 'fullscreenImageButton', 'editPromptButton',
        'triggerImageInputSingle', 'imageInput', 'imagePreviewContainer', 'imagePreview', 'removeImageButton',
        'styleButton', 'styleOptionsPopup', 'aspectRatioButton', 'aspectRatioOptionsPopup',
        'triggerImageInputSequence', 'imageInputSequence', 'imagePreviewContainerSequence',
        'imagePreviewSequence', 'removeImageButtonSequence', 'basePromptInputSequence', 'animationInstructionInput',
        'numFramesInput', 'generateSequenceButton',
        'loadingIndicatorSequence', 'loadingMessageSequenceElement', 'errorMessageSequenceElement', 'sequenceDisplayArea',
        'historyItemsContainer', 'emptyHistoryMessage', 'clearHistoryButton', 'loadingHistoryIndicator',
        'userEmailDisplay', 'userDisplayNameInput', 'saveUserSettingsButton', 'settingsFeedbackMessage',
        'fullscreenModal', 'fullscreenImage', 'closeFullscreenModalButton',
    ];

    const allPresent = allElementVariables.every((el, index) => {
        if (!el) {
            console.error(`UI element missing: ${elementNames[index]}`);
            return false;
        }
        return true;
    });

    if (!allPresent) {
        const errorMsg = "Application UI is not set up correctly. Critical elements are missing.";
         try {
            if (authErrorMessage && loginPage && (loginPage.style.display === 'flex' || loginPage.style.display === '')) { 
                 authErrorMessage.textContent = errorMsg;
                 authErrorMessage.style.display = 'block';
            } else if (errorMessageElement && singleImageModeDiv && singleImageModeDiv.style.display === 'block') { // Display in active mode
                displayError(errorMsg);
            } else if (errorMessageSequenceElement && sequenceModeDiv && sequenceModeDiv.style.display === 'block') {
                displayErrorSequence(errorMsg);
            } else {
                const body = document.querySelector('body');
                if (body) {
                    body.innerHTML = `<div style="padding: 20px; text-align: center; color: red; font-family: sans-serif;">
                                        <h1>Application Error</h1>
                                        <p>Could not initialize the application due to missing UI components. Please check the console for details.</p>
                                      </div>`;
                }
            }
        } catch(e) {
             console.error("Further error displaying critical UI setup error:", e);
             alert(errorMsg); 
        
        }
        if (generateButton) generateButton.disabled = true;
        if (generateSequenceButton) generateSequenceButton.disabled = true;
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    if (checkElements()) {
        initializeTheme();
        // AI and Supabase initialization are now more closely tied to auth state and DOM content.
        // Initialize Supabase related UI first.
        if (loginButton && supabase) { 
            loginButton.addEventListener('click', handleGoogleLogin);
            loginButton.disabled = false; 
            if (authErrorMessage && supabaseInitializationError && authErrorMessage.textContent === supabaseInitializationError) { 
                 authErrorMessage.textContent = ''; authErrorMessage.style.display = 'none';
            }
        } else if (loginButton && supabaseInitializationError) { 
            loginButton.disabled = true;
             if (authErrorMessage) { 
                authErrorMessage.textContent = supabaseInitializationError;
                authErrorMessage.style.display = 'block';
            }
        } else if (loginButton) { // Fallback if supabase object is null for other reasons
            loginButton.disabled = true;
            if (authErrorMessage && !supabaseInitializationError) { 
                 authErrorMessage.textContent = "Auth service could not be set up. Check Supabase configuration in index.html (ensure server replaced placeholders).";
                 authErrorMessage.style.display = 'block';
            } else if (authErrorMessage && supabaseInitializationError) {
                 authErrorMessage.textContent = supabaseInitializationError;
                 authErrorMessage.style.display = 'block';
            }
        }


        if (logoutButton && supabase) {
            logoutButton.addEventListener('click', handleLogout);
        }

        // Initialize AI here to catch key issues early, even before login attempt.
        // updateUIForAuthState will call it again if user logs in, which is fine.
        initializeAI(); 

        if (supabase) {
            supabase.auth.onAuthStateChange((event, session) => {
                const user = session?.user ?? null;
                updateUIForAuthState(user); // This will also call initializeAI() if user logs in

                if (user) { 
                    const hash = window.location.hash;
                    if (hash.includes('access_token') || hash.includes('error_description')) {
                        history.replaceState(null, '', window.location.pathname + window.location.search);
                    }

                    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                        if (currentMode === 'settings') {
                            loadUserSettings();
                        } else if (currentMode === 'history') {
                            loadAndDisplayHistory();
                        }
                    }
                } else { // User is null, ensure UI reflects that AI might be unavailable due to key issues
                    initializeAI(); // (Re)check AI keys, show errors on login if needed
                }
            });
        } else { // Supabase itself failed to initialize (already handled by supabaseInitializationError messages)
            updateUIForAuthState(null); // Show login page
            initializeAI(); // Attempt AI init to show API key errors on login if any
            if (authErrorMessage && supabaseInitializationError){ // Re-ensure error shown
                authErrorMessage.textContent = supabaseInitializationError;
                authErrorMessage.style.display = 'block';
            }
        }
        // Initialize button displays
        updateStyleButtonDisplay();
        updateAspectRatioButtonDisplay();
        // Default to single mode display if no auth redirects are happening
        if(!window.location.hash.includes('access_token') && !window.location.hash.includes('error_description')) {
            switchMode('single'); 
        }

    } else {
        console.error("DOM check failed. Application cannot start correctly.");
    }
});
