export const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      // Wait for it to load
      const checkLoaded = () => {
        if (window.google && window.google.maps) {
          resolve();
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    
    document.head.appendChild(script);
  });
};

export const geocodeAddress = async (address: string): Promise<google.maps.GeocoderResult | null> => {
  if (!window.google) {
    throw new Error('Google Maps not loaded');
  }

  const geocoder = new google.maps.Geocoder();
  
  try {
    const response = await geocoder.geocode({ address });
    return response.results[0] || null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  if (!window.google) {
    throw new Error('Google Maps not loaded');
  }

  const geocoder = new google.maps.Geocoder();
  
  try {
    const response = await geocoder.geocode({ location: { lat, lng } });
    return response.results[0]?.formatted_address || null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
};
