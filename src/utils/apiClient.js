// src/utils/apiClient.js

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api`;

export const apiClient = async (endpoint, options = {}) => {
  // 1. Check if the body is a FormData object (used for file uploads)
  const isFormData = options.body instanceof FormData;

  // 2. Set headers dynamically
  const headers = {
    'Accept': 'application/json',
    ...options.headers,
  };

  const token = localStorage.getItem('lendogo_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // ONLY set Content-Type to JSON if we are NOT sending files.
  // If it's FormData, the browser MUST set the header automatically to create the boundary!
  if (isFormData) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  } else if (!headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  // 3. Merge default options with any custom options you pass in
  const config = {
    ...options,
    headers,
    // 👇 CRITICAL: This forces the browser to send the httpOnly cookie!
    credentials: 'include', 
  };

  try {
    // 4. Make the actual request
    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    const rawText = await response.text();
    
    let data = {};
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        data = { message: rawText };
      }
    }

    // 5. Handle global 401 Unauthorized (e.g., token expired)
    if (response.status === 401) {
      console.warn("Session expired or unauthorized. Logging out...");
      // Optional: You can trigger a global event here to force the user to the login screen
      // window.dispatchEvent(new Event('auth-unauthorized'));
    }

    // 6. If it failed, throw an error so your components can catch it
    if (!response.ok) {
      throw new Error(data.error || `HTTP Error: ${response.status}`);
    }

    // 7. Return the clean data
    return data;

  } catch (error) {
    console.error(`API Client Error [${endpoint}]:`, error.message);
    throw error;
  }
};