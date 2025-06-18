import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const countries: Country[] = [
  { code: 'IN', name: 'India', currency: 'INR', symbol: '₹' },
  { code: 'US', name: 'United States', currency: 'USD', symbol: '$' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£' },
  { code: 'AE', name: 'UAE', currency: 'AED', symbol: 'د.إ' },
  { code: 'AU', name: 'Australia', currency: 'AUD', symbol: 'A$' },
  { code: 'CA', name: 'Canada', currency: 'CAD', symbol: 'C$' },
];

export default function PropertyFormCompact({ onSubmit, selectedLocation }: PropertyFormProps) {
  const [amount, setAmount] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [propertySize, setPropertySize] = useState('');
  const [sizeUnit, setSizeUnit] = useState('sqft');
  const [propertyAge, setPropertyAge] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [furnished, setFurnished] = useState('');
  const [floor, setFloor] = useState('');
  const [parkingSpaces, setParkingSpaces] = useState('0');

  const handleCountryChange = (countryCode: string) => {
    const country = countries.find(c => c.code === countryCode);
    if (country) {
      setSelectedCountry(country);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedLocation) {
      alert('Please select a location first');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (!propertyType) {
      alert('Please select a property type');
      return;
    }

    const formData = {
      amount: numericAmount,
      propertyType,
      currency: selectedCountry.currency,
      country: selectedCountry.name,
      propertySize: parseFloat(propertySize) || 1000,
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Budget & Country Row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount" className="text-sm font-medium text-gray-700 mb-1.5 block">
            Budget ({selectedCountry.symbol})
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">
              {selectedCountry.symbol}
            </span>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-8 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5A5F] focus:border-transparent"
              placeholder="Enter amount"
              required
            />
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Country
          </Label>
          <Select value={selectedCountry.code} onValueChange={handleCountryChange}>
            <SelectTrigger className="w-full py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5A5F] focus:border-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Property Type & Size Row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="propertyType" className="text-sm font-medium text-gray-700 mb-1.5 block">
            Property Type
          </Label>
          <Select value={propertyType} onValueChange={setPropertyType} required>
            <SelectTrigger className="w-full py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5A5F] focus:border-transparent">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apartment">Apartment</SelectItem>
              <SelectItem value="house">House</SelectItem>
              <SelectItem value="villa">Villa</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="land">Land/Plot</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="propertySize" className="text-sm font-medium text-gray-700 mb-1.5 block">
            Size ({sizeUnit})
          </Label>
          <div className="flex gap-2">
            <Input
              id="propertySize"
              type="number"
              value={propertySize}
              onChange={(e) => setPropertySize(e.target.value)}
              className="flex-1 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5A5F] focus:border-transparent"
              placeholder="1000"
            />
            <Select value={sizeUnit} onValueChange={setSizeUnit}>
              <SelectTrigger className="w-20 py-2.5 text-sm border border-gray-300 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sqft">sqft</SelectItem>
                <SelectItem value="sqm">sqm</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Conditional Fields for Non-Land Properties */}
      {propertyType && propertyType !== 'land' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="bedrooms" className="text-sm font-medium text-gray-700 mb-1.5 block">
              Bedrooms
            </Label>
            <Select value={bedrooms} onValueChange={setBedrooms}>
              <SelectTrigger className="w-full py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5A5F] focus:border-transparent">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Studio</SelectItem>
                <SelectItem value="1">1 BHK</SelectItem>
                <SelectItem value="2">2 BHK</SelectItem>
                <SelectItem value="3">3 BHK</SelectItem>
                <SelectItem value="4">4+ BHK</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="propertyAge" className="text-sm font-medium text-gray-700 mb-1.5 block">
              Property Age
            </Label>
            <Select value={propertyAge} onValueChange={setPropertyAge}>
              <SelectTrigger className="w-full py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5A5F] focus:border-transparent">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Under Construction</SelectItem>
                <SelectItem value="0-5">0-5 Years</SelectItem>
                <SelectItem value="5-10">5-10 Years</SelectItem>
                <SelectItem value="10-20">10-20 Years</SelectItem>
                <SelectItem value="20+">20+ Years</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-2">
        <Button
          type="submit"
          className="w-full bg-[#FF5A5F] hover:bg-[#e54852] text-white py-3 rounded-lg font-semibold text-base transition-colors duration-200 shadow-lg hover:shadow-xl"
        >
          🔍 Analyze Property Investment
        </Button>
      </div>
    </form>
  );
}