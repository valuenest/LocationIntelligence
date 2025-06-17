interface AnalysisHistory {
  sessionId: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  amount: number;
  propertyType: string;
  planType: string;
  analysisData: any;
  createdAt: string;
  id: number;
}

export const saveAnalysisToHistory = (ipAddress: string, analysisData: AnalysisHistory) => {
  try {
    const storageKey = `analysis_history_${ipAddress}`;
    const existingHistory = localStorage.getItem(storageKey);
    let history: AnalysisHistory[] = [];

    if (existingHistory) {
      history = JSON.parse(existingHistory);
    }

    // Check if this analysis already exists
    const existingIndex = history.findIndex(item => item.sessionId === analysisData.sessionId);
    
    if (existingIndex >= 0) {
      // Update existing analysis
      history[existingIndex] = analysisData;
    } else {
      // Add new analysis to the beginning of the array
      history.unshift(analysisData);
    }

    // Keep only the last 50 analyses to prevent localStorage from growing too large
    if (history.length > 50) {
      history = history.slice(0, 50);
    }

    localStorage.setItem(storageKey, JSON.stringify(history));
  } catch (error) {
    console.error('Error saving analysis to history:', error);
  }
};

export const getAnalysisHistory = (ipAddress: string): AnalysisHistory[] => {
  try {
    const storageKey = `analysis_history_${ipAddress}`;
    const savedHistory = localStorage.getItem(storageKey);
    if (savedHistory) {
      return JSON.parse(savedHistory);
    }
  } catch (error) {
    console.error('Error loading analysis history:', error);
  }
  return [];
};

export const removeAnalysisFromHistory = (ipAddress: string, sessionId: string) => {
  try {
    const storageKey = `analysis_history_${ipAddress}`;
    const existingHistory = localStorage.getItem(storageKey);
    if (existingHistory) {
      let history: AnalysisHistory[] = JSON.parse(existingHistory);
      history = history.filter(item => item.sessionId !== sessionId);
      localStorage.setItem(storageKey, JSON.stringify(history));
    }
  } catch (error) {
    console.error('Error removing analysis from history:', error);
  }
};

export const clearAnalysisHistory = (ipAddress: string) => {
  try {
    const storageKey = `analysis_history_${ipAddress}`;
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error('Error clearing analysis history:', error);
  }
};