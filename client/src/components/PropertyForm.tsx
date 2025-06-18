import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IndianRupee, MapPin, Home, Building, Factory, TreePine, Layers, DollarSign } from "lucide-react";
import { currencyRates, countryToCurrency, detectUserCountry } from "@/lib/currencyConverter";

interface PropertyFormData {
  amount: number;
  propertyType: string;
  currency: string;
  country: string;
  propertySize: number;
  sizeUnit: string;
  propertyAge: string;
  bedrooms: number;
  furnished: string;
  floor: string;
  parkingSpaces: number;
}

interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

interface PropertyFormProps {
  onSubmit: (data: PropertyFormData) => void;
  selectedLocation?: LocationData | null;
}

interface Country {
  code: string;
  name: string;
  currency: string;
  symbol: string;
}

// Generate countries list from currency data
  const countries: Country[] = Object.entries(countryToCurrency).map(([countryCode, currencyCode]) => {
    const currency = currencyRates[currencyCode];
    return {
      code: countryCode,
      name: countryCode === 'US' ? 'United States' : 
            countryCode === 'GB' ? 'United Kingdom' :
            countryCode === 'AE' ? 'UAE' :
            countryCode === 'DE' ? 'Germany' :
            countryCode === 'FR' ? 'France' :
            countryCode === 'IN' ? 'India' :
            countryCode === 'CA' ? 'Canada' :
            countryCode === 'AU' ? 'Australia' :
            countryCode === 'SG' ? 'Singapore' :
            countryCode === 'JP' ? 'Japan' :
            countryCode === 'CN' ? 'China' :
            countryCode === 'KR' ? 'South Korea' :
            countryCode === 'TH' ? 'Thailand' :
            countryCode === 'MY' ? 'Malaysia' :
            countryCode === 'ID' ? 'Indonesia' :
            countryCode === 'PH' ? 'Philippines' :
            countryCode === 'VN' ? 'Vietnam' :
            countryCode === 'BD' ? 'Bangladesh' :
            countryCode === 'PK' ? 'Pakistan' :
            countryCode === 'LK' ? 'Sri Lanka' :
            countryCode === 'NP' ? 'Nepal' :
            countryCode === 'ZA' ? 'South Africa' :
            countryCode === 'EG' ? 'Egypt' :
            countryCode === 'NG' ? 'Nigeria' :
            countryCode === 'KE' ? 'Kenya' :
            countryCode === 'BR' ? 'Brazil' :
            countryCode === 'MX' ? 'Mexico' :
            countryCode === 'CL' ? 'Chile' :
            countryCode === 'CO' ? 'Colombia' :
            countryCode === 'PE' ? 'Peru' :
            countryCode === 'RU' ? 'Russia' :
            countryCode === 'TR' ? 'Turkey' :
            countryCode === 'IL' ? 'Israel' :
            countryCode === 'SA' ? 'Saudi Arabia' :
            countryCode,
      currency: currencyCode,
      symbol: currency.symbol
    };
  }).filter((country, index, self) => 
    // Remove duplicates and prioritize common countries
    index === self.findIndex(c => c.code === country.code)
  ).sort((a, b) => {
    // Prioritize common countries
    const priority = ['IN', 'US', 'GB', 'CA', 'AU', 'SG', 'AE', 'DE', 'FR', 'JP'];
    const aPriority = priority.indexOf(a.code);
    const bPriority = priority.indexOf(b.code);

    if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;
    return a.name.localeCompare(b.name);
  }).slice(0, 30); // Limit to top 30 countries

export default function PropertyForm({ onSubmit, selectedLocation }: PropertyFormProps) {
  const [amount, setAmount] = useState<string>('');
  const [propertyType, setPropertyType] = useState<string>('');
  const [propertySize, setPropertySize] = useState<string>('');
  const [sizeUnit, setSizeUnit] = useState<string>('sqft');
  const [propertyAge, setPropertyAge] = useState<string>('');
  const [bedrooms, setBedrooms] = useState<string>('');
  const [furnished, setFurnished] = useState<string>('');
  const [floor, setFloor] = useState<string>('');
  const [parkingSpaces, setParkingSpaces] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  // Removed price validation as per requirements

  // Auto-detect country based on user's location
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const countryCode = data.country_code;

        const detectedCountry = countries.find(c => c.code === countryCode);
        if (detectedCountry) {
          setSelectedCountry(detectedCountry);
        }
      } catch (error) {
        // Fallback to India if detection fails
        console.log('Country detection failed, using default');
      }
    };

    detectCountry();
  }, []);

  const handleCountryChange = (countryCode: string) => {
    const country = countries.find(c => c.code === countryCode);
    if (country) {
      setSelectedCountry(country);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation for all property types
    if (!amount || !propertyType || !propertySize) {
      alert('Please fill in all required fields');
      return;
    }

    // Conditional validation based on property type
    if (propertyType === 'apartment' || propertyType === 'house') {
      if (!propertyAge || !bedrooms || !furnished || !parkingSpaces) {
        alert('Please fill in all property details');
        return;
      }
      if (propertyType === 'apartment' && !floor) {
        alert('Please select the floor for apartment');
        return;
      }
    }

    if (propertyType === 'commercial' && !parkingSpaces) {
      alert('Please select parking spaces for commercial property');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    // Set default values for conditional fields
    const formData = {
      amount: numericAmount,
      propertyType,
      currency: selectedCountry.currency,
      country: selectedCountry.name,
      propertySize: parseFloat(propertySize),
      sizeUnit,
      propertyAge: propertyAge || 'not-applicable',
      bedrooms: parseInt(bedrooms) || 0,
      furnished: furnished || 'not-applicable',
      floor: floor || 'not-applicable',
      parkingSpaces: parseInt(parkingSpaces) || 0,
    };

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Amount Input with Currency */}
      <div>
        <Label htmlFor="amount" className="text-lg font-medium text-gray-900 mb-3 flex items-center">
          <IndianRupee className="text-[#FC642D] mr-2" />
          Property Amount
        </Label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg">
              {selectedCountry.symbol}
            </span>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-12 pr-4 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FC642D] focus:border-transparent"
              min="0"
              step="1000"
            />
          </div>
          <div className="w-32">
            <Select value={selectedCountry.code} onValueChange={handleCountryChange}>
              <SelectTrigger className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FC642D] focus:border-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Property Type */}
      <div>
        <Label htmlFor="propertyType" className="text-lg font-medium text-gray-900 mb-3 flex items-center">
          <Home className="text-[#00A699] mr-2" />
          Property Type
        </Label>
        <Select value={propertyType} onValueChange={setPropertyType}>
          <SelectTrigger id="propertyType" className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00A699] focus:border-transparent">
            <SelectValue placeholder="Select property type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plot">Residential Plot</SelectItem>
            <SelectItem value="farmland">Farm Land</SelectItem>
            <SelectItem value="house">Independent House</SelectItem>
            <SelectItem value="apartment">Apartment</SelectItem>
            <SelectItem value="commercial">Commercial Space</SelectItem>
            <SelectItem value="warehouse">Warehouse</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Property Size */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Label htmlFor="propertySize" className="text-lg font-medium text-gray-900 mb-3 block">
            Property Size
          </Label>
          <Input
            id="propertySize"
            type="number"
            placeholder="Enter size"
            value={propertySize}
            onChange={(e) => setPropertySize(e.target.value)}
            className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00A699] focus:border-transparent"
            min="1"
          />
        </div>
        <div>
          <Label htmlFor="sizeUnit" className="text-lg font-medium text-gray-900 mb-3 block">
            Unit
          </Label>
          <Select value={sizeUnit} onValueChange={setSizeUnit}>
            <SelectTrigger id="sizeUnit" className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00A699] focus:border-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sqft">Sq Ft</SelectItem>
              <SelectItem value="sqm">Sq Meter</SelectItem>
              <SelectItem value="acres">Acres</SelectItem>
              <SelectItem value="hectares">Hectares</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>



      {/* Conditional Property Details Based on Type */}
      {(propertyType === 'apartment' || propertyType === 'house') && (
        <>
          {/* Property Details Grid for Built Properties */}
          <div className="grid grid-cols-2 gap-4">
            {/* Property Age */}
            <div>
              <Label htmlFor="propertyAge" className="text-lg font-medium text-gray-900 mb-3 block">
                Property Age
              </Label>
              <Select value={propertyAge} onValueChange={setPropertyAge}>
                <SelectTrigger id="propertyAge" className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00A699] focus:border-transparent">
                  <SelectValue placeholder="Select age..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Under Construction</SelectItem>
                  <SelectItem value="0-1">0-1 Years</SelectItem>
                  <SelectItem value="1-5">1-5 Years</SelectItem>
                  <SelectItem value="5-10">5-10 Years</SelectItem>
                  <SelectItem value="10-20">10-20 Years</SelectItem>
                  <SelectItem value="20+">20+ Years</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bedrooms */}
            <div>
              <Label htmlFor="bedrooms" className="text-lg font-medium text-gray-900 mb-3 block">
                Bedrooms
              </Label>
              <Select value={bedrooms} onValueChange={setBedrooms}>
                <SelectTrigger id="bedrooms" className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00A699] focus:border-transparent">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Studio/No Bedroom</SelectItem>
                  <SelectItem value="1">1 BHK</SelectItem>
                  <SelectItem value="2">2 BHK</SelectItem>
                  <SelectItem value="3">3 BHK</SelectItem>
                  <SelectItem value="4">4 BHK</SelectItem>
                  <SelectItem value="5">5+ BHK</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Furnished Status */}
            <div>
              <Label htmlFor="furnished" className="text-lg font-medium text-gray-900 mb-3 block">
                Furnished Status
              </Label>
              <Select value={furnished} onValueChange={setFurnished}>
                <SelectTrigger id="furnished" className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00A699] focus:border-transparent">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unfurnished">Unfurnished</SelectItem>
                  <SelectItem value="semi-furnished">Semi-Furnished</SelectItem>
                  <SelectItem value="fully-furnished">Fully Furnished</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Floor - Only for Apartments */}
            {propertyType === 'apartment' && (
              <div>
                <Label htmlFor="floor" className="text-lg font-medium text-gray-900 mb-3 block">
                  Floor
                </Label>
                <Select value={floor} onValueChange={setFloor}>
                  <SelectTrigger id="floor" className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00A699] focus:border-transparent">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ground">Ground Floor</SelectItem>
                    <SelectItem value="1-3">1st to 3rd Floor</SelectItem>
                    <SelectItem value="4-7">4th to 7th Floor</SelectItem>
                    <SelectItem value="8-15">8th to 15th Floor</SelectItem>
                    <SelectItem value="16+">16th Floor & Above</SelectItem>
                    <SelectItem value="penthouse">Penthouse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Parking Spaces for Built Properties */}
          <div>
            <Label htmlFor="parkingSpaces" className="text-lg font-medium text-gray-900 mb-3 block">
              Parking Spaces
            </Label>
            <Select value={parkingSpaces} onValueChange={setParkingSpaces}>
              <SelectTrigger id="parkingSpaces" className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00A699] focus:border-transparent">
                <SelectValue placeholder="Select parking..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No Parking</SelectItem>
                <SelectItem value="1">1 Parking Space</SelectItem>
                <SelectItem value="2">2 Parking Spaces</SelectItem>
                <SelectItem value="3">3 Parking Spaces</SelectItem>
                <SelectItem value="4">4+ Parking Spaces</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Additional fields for Commercial properties */}
      {propertyType === 'commercial' && (
        <div>
          <Label htmlFor="parkingSpaces" className="text-lg font-medium text-gray-900 mb-3 block">
            Parking Spaces
          </Label>
          <Select value={parkingSpaces} onValueChange={setParkingSpaces}>
            <SelectTrigger id="parkingSpaces" className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00A699] focus:border-transparent">
              <SelectValue placeholder="Select parking..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">No Parking</SelectItem>
              <SelectItem value="5">5-10 Spaces</SelectItem>
              <SelectItem value="15">15-25 Spaces</SelectItem>
              <SelectItem value="30">30+ Spaces</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full bg-[#FF5A5F] hover:bg-[#e54852] text-white py-4 rounded-xl font-semibold text-lg transition-colors duration-200"
      >
        Analyse My Property
      </Button>
    </form>
  );
}