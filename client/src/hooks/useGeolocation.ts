import { useState, useEffect } from 'react';

interface GoogleMapsHook {
  isLoaded: boolean;
  loadError: Error | null;
}

export const useGoogleMaps = (): GoogleMapsHook => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }

    // Check if script is already in the DOM
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const checkLoaded = () => {
        if (window.google && window.google.maps) {
          setIsLoaded(true);
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
      return;
    }

    // Load Google Maps script with API key from server
    const loadGoogleMaps = async () => {
      try {
        // Get API key from server
        const response = await fetch('/api/maps-config');
        const config = await response.json();
        
        if (!config.apiKey) {
          throw new Error('Google Maps API key not configured');
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${config.apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => setIsLoaded(true);
        script.onerror = () => setLoadError(new Error('Failed to load Google Maps'));
        
        document.head.appendChild(script);
      } catch (error) {
        setLoadError(error as Error);
      }
    };

    loadGoogleMaps();
  }, []);

  return { isLoaded, loadError };
};

export const useCurrentLocation = () => {
  const [location, setLocation] = useState<{lat: number; lng: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLoading(false);
      },
      (error) => {
        setError(error.message);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  };

  return { location, error, loading, getCurrentLocation };
};
