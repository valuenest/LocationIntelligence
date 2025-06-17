import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Edit3 } from "lucide-react";
import { useGoogleMaps } from "@/hooks/useGeolocation";

declare global {
  interface Window {
    google: any;
  }
}

interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

interface LocationInputProps {
  onLocationSelect: (location: LocationData) => void;
  selectedLocation: LocationData | null;
}

export default function LocationInput({ onLocationSelect, selectedLocation }: LocationInputProps) {
  const [manualAddress, setManualAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isLoaded, loadError } = useGoogleMaps();

  const handleManualAddressSubmit = async () => {
    if (!manualAddress.trim()) return;

    setIsLoading(true);
    try {
      if (window.google && window.google.maps) {
        const geocoder = new window.google.maps.Geocoder();
        const result = await geocoder.geocode({ address: manualAddress });
        
        if (result.results && result.results.length > 0) {
          const location = result.results[0].geometry.location;
          const address = result.results[0].formatted_address;
          
          const locationData = {
            lat: location.lat(),
            lng: location.lng(),
            address: address,
          };
          
          onLocationSelect(locationData);
          
          // Update the map to show the new location
          if (mapRef.current) {
            const map = (mapRef.current as any).__googleMap;
            const marker = (mapRef.current as any).__googleMarker;
            
            if (map && marker) {
              map.setCenter(locationData);
              map.setZoom(15);
              marker.setPosition(locationData);
            }
          }
          
          setManualAddress(''); // Clear the input
        } else {
          alert('Address not found. Please try a different address.');
        }
      } else {
        alert('Google Maps is not loaded yet. Please wait and try again.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Failed to geocode address. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize Google Map
  useEffect(() => {
    if (isLoaded && mapRef.current && window.google) {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 28.6139, lng: 77.2090 }, // Delhi coordinates
        zoom: 18, // Plot-level zoom for precise location selection
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: false,
        mapTypeId: 'satellite', // Satellite view for better plot identification
      });

      const marker = new window.google.maps.Marker({
        map: map,
        draggable: true,
        title: 'Property Location',
        position: { lat: 28.6139, lng: 77.2090 },
      });

      // Store references for later use
      (mapRef.current as any).__googleMap = map;
      (mapRef.current as any).__googleMarker = marker;

      // Handle map click
      map.addListener('click', async (event: any) => {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        
        marker.setPosition({ lat, lng });
        
        // Reverse geocode to get address
        try {
          const geocoder = new window.google.maps.Geocoder();
          const result = await geocoder.geocode({ location: { lat, lng } });
          
          if (result.results && result.results.length > 0) {
            const address = result.results[0].formatted_address;
            onLocationSelect({ lat, lng, address });
          }
        } catch (error) {
          console.error('Reverse geocoding error:', error);
        }
      });

      // Handle marker drag
      marker.addListener('dragend', async () => {
        const position = marker.getPosition();
        if (position) {
          const lat = position.lat();
          const lng = position.lng();
          
          try {
            const geocoder = new window.google.maps.Geocoder();
            const result = await geocoder.geocode({ location: { lat, lng } });
            
            if (result.results && result.results.length > 0) {
              const address = result.results[0].formatted_address;
              onLocationSelect({ lat, lng, address });
            }
          } catch (error) {
            console.error('Reverse geocoding error:', error);
          }
        }
      });
    }
  }, [isLoaded, onLocationSelect]);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (isLoaded && inputRef.current && window.google) {
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        fields: ['formatted_address', 'geometry.location'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (place.geometry && place.geometry.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const address = place.formatted_address || '';
          
          const locationData = { lat, lng, address };
          onLocationSelect(locationData);
          
          // Update the map to show the new location
          if (mapRef.current) {
            const map = (mapRef.current as any).__googleMap;
            const marker = (mapRef.current as any).__googleMarker;
            
            if (map && marker) {
              map.setCenter(locationData);
              map.setZoom(15);
              marker.setPosition(locationData);
            }
          }
          
          setManualAddress(''); // Clear the input
        }
      });
    }
  }, [isLoaded, onLocationSelect]);

  // Update map when selected location changes from parent
  useEffect(() => {
    if (selectedLocation && mapRef.current && isLoaded) {
      const map = (mapRef.current as any).__googleMap;
      const marker = (mapRef.current as any).__googleMarker;
      
      if (map && marker) {
        map.setCenter({ lat: selectedLocation.lat, lng: selectedLocation.lng });
        map.setZoom(15);
        marker.setPosition({ lat: selectedLocation.lat, lng: selectedLocation.lng });
      }
    }
  }, [selectedLocation, isLoaded]);

  if (loadError) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load Google Maps. Please check your internet connection.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Instruction Text */}
      <div className="text-center mb-6">
        <h3 className="text-2xl font-semibold text-gray-900 mb-2">Select Property Location</h3>
        <p className="text-gray-600">Click on the map to pin your location or search for an address below</p>
      </div>

      {/* Map Container - Always Visible */}
      <div className="mb-6">
        {isLoaded ? (
          <div ref={mapRef} className="h-80 w-full rounded-lg border border-gray-300 shadow-sm" />
        ) : (
          <div className="h-80 w-full rounded-lg border border-gray-300 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5A5F] mx-auto mb-2"></div>
              <p className="text-gray-500">Loading map...</p>
            </div>
          </div>
        )}
      </div>

      {/* Search Bar Below Map */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center mb-3">
          <Edit3 className="text-[#00A699] mr-2" />
          <span className="font-medium text-gray-900">Or search for an address</span>
        </div>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Enter your property address..."
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleManualAddressSubmit();
              }
            }}
          />
          <Button 
            onClick={handleManualAddressSubmit}
            disabled={!manualAddress.trim() || isLoading}
            className="bg-[#00A699] hover:bg-[#008a7f]"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              'Search'
            )}
          </Button>
        </div>
      </div>

      {/* Selected Location Display with Street View */}
      {selectedLocation && (
        <div className="space-y-4">
          {/* Location Details */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <MapPin className="text-green-600 mr-2" />
              <span className="font-medium text-green-800">Selected Location:</span>
            </div>
            <p className="text-green-700 mt-1">{selectedLocation.address}</p>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-green-600">
                Lat: {selectedLocation.lat.toFixed(6)}, Lng: {selectedLocation.lng.toFixed(6)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setManualAddress(selectedLocation.address)}
                className="text-green-700 border-green-300 hover:bg-green-100"
              >
                <Edit3 className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </div>
          </div>


        </div>
      )}
    </div>
  );
}
