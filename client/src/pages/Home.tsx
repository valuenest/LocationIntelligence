import { useState } from "react";
import { Button } from "@/components/ui/button";
import LocationInput from "@/components/LocationInput";
import PropertyForm from "@/components/PropertyForm";
import PricingPlans from "@/components/PricingPlans";
import SampleAnalysis from "@/components/SampleAnalysis";
import PaymentModal from "@/components/PaymentModal";
import { useQuery } from "@tanstack/react-query";
import { MapPin, TrendingUp, Brain } from "lucide-react";

interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

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

export default function Home() {
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [propertyData, setPropertyData] = useState<PropertyFormData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const { data: usageStatus } = useQuery<{ success: boolean; usage: { canUseFree: boolean; freeUsageCount: number; maxFreeUsage: number } }>({
    queryKey: ['/api/usage-status'],
    refetchInterval: false,
  });

  const canUseFree = usageStatus?.usage?.canUseFree ?? true;
  const freeUsageCount = usageStatus?.usage?.freeUsageCount ?? 0;

  const handleLocationSelect = (location: LocationData) => {
    setSelectedLocation(location);
  };

  const handlePropertySubmit = async (data: PropertyFormData) => {
    setPropertyData(data);
    
    // Automatically trigger free analysis when property form is submitted
    if (selectedLocation) {
      await handleFreeAnalysis(data);
    } else {
      alert('Please select a location first');
    }
  };

  const handlePlanSelect = (plan: string) => {
    setSelectedPlan(plan);
    if (plan === 'paid' || plan === 'pro') {
      setPaymentModalOpen(true);
    } else {
      // Handle free plan directly
      handleFreeAnalysis();
    }
  };

  const handleFreeAnalysis = async (formData?: PropertyFormData) => {
    const dataToUse = formData || propertyData;
    
    if (!selectedLocation || !dataToUse) {
      alert('Please select a location and enter property details first');
      return;
    }

    if (!canUseFree) {
      alert('Daily free usage limit exceeded. Please upgrade to a paid plan.');
      return;
    }

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: selectedLocation,
          amount: dataToUse.amount,
          propertyType: dataToUse.propertyType,
          planType: 'free',
        }),
      });

      const result = await response.json();
      if (result.success) {
        window.location.href = `/results/${result.sessionId}`;
      } else {
        alert(result.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Failed to perform analysis');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-[#FF5A5F]">PlotterAI</h1>
            </div>
            <div className="hidden md:block">
              <Button className="bg-[#FF5A5F] hover:bg-[#e54852] text-white px-6 py-2 rounded-full">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="gradient-bg py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6">
              Smartest Way to <span className="text-[#FF5A5F]">Judge Land Value</span>
            </h1>
            <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
              Make informed real estate decisions with AI-powered location intelligence. Analyze property investments, get growth predictions, and discover hidden opportunities.
            </p>
          </div>
        </div>
      </section>

      {/* Main Input Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl airbnb-shadow-lg p-8 lg:p-12 border border-gray-100">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              Analyze Your Property Investment
            </h2>
            
            <LocationInput onLocationSelect={handleLocationSelect} selectedLocation={selectedLocation} />
            
            <div className="mt-8">
              <PropertyForm onSubmit={handlePropertySubmit} />
            </div>
          </div>
        </div>
      </section>

      {/* Usage Status */}
      {!canUseFree && (
        <section className="py-8 bg-red-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-red-600 font-semibold">
                Daily free usage limit reached ({freeUsageCount}/3). Upgrade to continue analyzing properties.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Pricing Plans */}
      <PricingPlans 
        onPlanSelect={handlePlanSelect} 
        canUseFree={canUseFree}
        freeUsageCount={freeUsageCount}
        isFormValid={!!selectedLocation && !!propertyData}
      />

      {/* Sample Analysis */}
      <SampleAnalysis />

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold text-[#FF5A5F] mb-4">PlotterAI</h3>
              <p className="text-gray-400">Making real estate investments smarter with AI-powered location intelligence.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Disclaimer</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 PlotterAI. All rights reserved. No personal data is stored or shared.</p>
          </div>
        </div>
      </footer>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        selectedPlan={selectedPlan}
        location={selectedLocation}
        propertyData={propertyData}
      />

      {/* Floating Action Button for Mobile */}
      <div className="fixed bottom-6 right-6 md:hidden z-50">
        <Button className="bg-[#FF5A5F] hover:bg-[#e54852] text-white w-16 h-16 rounded-full airbnb-shadow-lg">
          <TrendingUp className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
