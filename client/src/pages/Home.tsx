import { useState } from "react";
import { Button } from "@/components/ui/button";
import LocationInput from "@/components/LocationInput";
import PropertyForm from "@/components/PropertyForm";
import PricingPlans from "@/components/PricingPlans";
import SampleAnalysis from "@/components/SampleAnalysis";
import PaymentModal from "@/components/PaymentModal";
import AnalysisLoadingModal from "@/components/AnalysisLoadingModal";
import UsageLimitModal from "@/components/UsageLimitModal";
import ValidationModal from "@/components/ValidationModal";
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
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [usageLimitModalOpen, setUsageLimitModalOpen] = useState(false);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [pendingFormData, setPendingFormData] = useState<PropertyFormData | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const { data: usageStatus } = useQuery<{ success: boolean; usage: { canUseFree: boolean; freeUsageCount: number; maxFreeUsage: number } }>({
    queryKey: ['/api/usage-status'],
    refetchInterval: false,
  });

  const canUseFree = usageStatus?.usage?.canUseFree ?? true;
  const freeUsageCount = usageStatus?.usage?.freeUsageCount ?? 0;

  const handleLocationSelect = (location: LocationData) => {
    setSelectedLocation(location);
  };

  const performValidation = async (data: PropertyFormData) => {
    if (!selectedLocation) return;

    setIsValidating(true);
    try {
      const response = await fetch('/api/validate-inputs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: selectedLocation,
          propertyData: data
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setValidationResult(result.validation);
        setPendingFormData(data);
        setValidationModalOpen(true);
      } else {
        // If validation fails, proceed with the original flow
        proceedWithAnalysis(data);
      }
    } catch (error) {
      console.error('Validation error:', error);
      // If validation fails, proceed with the original flow
      proceedWithAnalysis(data);
    } finally {
      setIsValidating(false);
    }
  };

  const proceedWithAnalysis = (data: PropertyFormData) => {
    setPropertyData(data);
    
    // Check if user can use free analysis or needs to pay
    if (!canUseFree) {
      setUsageLimitModalOpen(true);
      return;
    }
    
    // Proceed with free analysis
    if (selectedLocation) {
      handleFreeAnalysis(data);
    } else {
      alert('Please select a location first');
    }
  };

  const handlePropertySubmit = async (data: PropertyFormData) => {
    if (!selectedLocation) {
      alert('Please select a location first');
      return;
    }
    
    // Perform smart validation before proceeding
    await performValidation(data);
  };

  const handleValidationProceed = () => {
    if (pendingFormData) {
      proceedWithAnalysis(pendingFormData);
      setValidationModalOpen(false);
      setValidationResult(null);
      setPendingFormData(null);
    }
  };

  const handlePlanSelect = (plan: string) => {
    setSelectedPlan(plan);
    if (plan === 'paid' || plan === 'pro') {
      setPaymentModalOpen(true);
    } else if (propertyData) {
      // Handle free plan directly
      handleFreeAnalysis(propertyData);
    }
  };

  const handleUsageLimitPlanSelect = (plan: string) => {
    setUsageLimitModalOpen(false);
    setSelectedPlan(plan);
    setPaymentModalOpen(true);
  };

  const handleFreeAnalysis = async (formData: PropertyFormData) => {
    if (!selectedLocation) {
      alert('Please select a location first');
      return;
    }

    setAnalysisLoading(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: selectedLocation,
          amount: formData.amount,
          propertyType: formData.propertyType,
          propertySize: formData.propertySize,
          sizeUnit: formData.sizeUnit,
          propertyAge: formData.propertyAge,
          bedrooms: formData.bedrooms,
          furnished: formData.furnished,
          floor: formData.floor,
          parkingSpaces: formData.parkingSpaces,
          planType: 'free',
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Ensure minimum loading time for better UX
        setTimeout(() => {
          setAnalysisLoading(false);
          window.location.href = `/results/${result.sessionId}`;
        }, 4500);
      } else {
        setAnalysisLoading(false);
        alert(result.error || 'Analysis failed');
      }
    } catch (error) {
      setAnalysisLoading(false);
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
              <PropertyForm onSubmit={handlePropertySubmit} selectedLocation={selectedLocation} />
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

      {/* Analysis Loading Modal */}
      <AnalysisLoadingModal isOpen={analysisLoading} />

      {/* Usage Limit Modal */}
      <UsageLimitModal
        isOpen={usageLimitModalOpen}
        onClose={() => setUsageLimitModalOpen(false)}
        onSelectPlan={handleUsageLimitPlanSelect}
        freeUsageCount={freeUsageCount}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        selectedPlan={selectedPlan}
        location={selectedLocation}
        propertyData={propertyData}
      />

      {/* Validation Modal */}
      <ValidationModal
        isOpen={validationModalOpen}
        onClose={() => setValidationModalOpen(false)}
        onProceed={handleValidationProceed}
        validation={validationResult}
        isLoading={isValidating}
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
