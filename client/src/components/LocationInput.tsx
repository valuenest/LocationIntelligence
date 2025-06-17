import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Edit3 } from "lucide-react";
import { useGoogleMaps } from "@/hooks/useGeolocation";

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
  const [inputMethod, setInputMethod] = useState<'map' | 'manual' | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const { isLoaded, loadError } = useGoogleMaps();

  const handleMapMethodSelect = () => {
    setInputMethod(inputMethod === 'map' ? null : 'map');
  };

  const handleManualMethodSelect = () => {
    setInputMethod(inputMethod === 'manual' ? null : 'manual');
  };

  const handleManualAddressSubmit = async () => {
    if (!manualAddress.trim()) return;

    setIsLoading(true);
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ address: manualAddress });
      
      if (result.results && result.results.length > 0) {
        const location = result.results[0].geometry.location;
        const address = result.results[0].formatted_address;
        
        onLocationSelect({
          lat: location.lat(),
          lng: location.lng(),
          address: address,
        });
      } else {
        alert('Address not found. Please try a different address.');
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
    if (isLoaded && inputMethod === 'map' && mapRef.current) {
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 28.6139, lng: 77.2090 }, // Delhi coordinates
        zoom: 10,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      const marker = new google.maps.Marker({
        map: map,
        draggable: true,
        title: 'Property Location',
      });

      // Handle map click
      map.addListener('click', async (event: any) => {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        
        marker.setPosition({ lat, lng });
        
        // Reverse geocode to get address
        try {
          const geocoder = new google.maps.Geocoder();
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
            const geocoder = new google.maps.Geocoder();
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
  }, [isLoaded, inputMethod, onLocationSelect]);

  if (loadError) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load Google Maps. Please check your internet connection.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pin on Map */}
        <div 
          className={`bg-gray-50 rounded-xl p-6 border-2 transition-colors duration-200 cursor-pointer ${
            inputMethod === 'map' ? 'border-[#FF5A5F]' : 'border-transparent hover:border-[#FF5A5F]'
          }`}
          onClick={handleMapMethodSelect}
        >
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-[#FF5A5F] rounded-full flex items-center justify-center mr-4">
              <MapPin className="text-white text-xl" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Pin on Map</h3>
          </div>
          <p className="text-gray-600">Click on the map to select your property location</p>
        </div>

        {/* Manual Entry */}
        <div 
          className={`bg-gray-50 rounded-xl p-6 border-2 transition-colors duration-200 cursor-pointer ${
            inputMethod === 'manual' ? 'border-[#00A699]' : 'border-transparent hover:border-[#00A699]'
          }`}
          onClick={handleManualMethodSelect}
        >
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-[#00A699] rounded-full flex items-center justify-center mr-4">
              <Edit3 className="text-white text-xl" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Enter Manually</h3>
          </div>
          <p className="text-gray-600">Type your property address or location</p>
        </div>
      </div>

      {/* Map Container */}
      {inputMethod === 'map' && (
        <div className="mt-6">
          {isLoaded ? (
            <div ref={mapRef} className="h-64 w-full rounded-lg border border-gray-300" />
          ) : (
            <div className="h-64 w-full rounded-lg border border-gray-300 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5A5F] mx-auto mb-2"></div>
                <p className="text-gray-500">Loading map...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Input */}
      {inputMethod === 'manual' && (
        <div className="mt-6">
          <div className="flex gap-2">
            <Input
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
      )}

      {/* Selected Location Display */}
      {selectedLocation && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <MapPin className="text-green-600 mr-2" />
            <span className="font-medium text-green-800">Selected Location:</span>
          </div>
          <p className="text-green-700 mt-1">{selectedLocation.address}</p>
        </div>
      )}
    </div>
  );
}
