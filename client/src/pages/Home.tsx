import { useState } from "react";
import { Button } from "@/components/ui/button";
import LocationInput from "@/components/LocationInput";
import PropertyFormCompact from "../components/PropertyFormCompact";
import SampleAnalysis from "../components/SampleAnalysis";
import PricingPlans from "../components/PricingPlans";
import { SEOContent } from "../components/SEOContent";
import PaymentModal from "@/components/PaymentModal";
import AnalysisLoadingModal from "@/components/AnalysisLoadingModal";
import UsageLimitModal from "@/components/UsageLimitModal";
import ValidationModal from "@/components/ValidationModal";
import { useQuery } from "@tanstack/react-query";
import { MapPin, TrendingUp, Brain } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [pricingModalOpen, setPricingModalOpen] = useState(false);

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
        const validation = result.validation;

        console.log('Validation result:', validation);
        console.log('Should show popup:', !validation.isValid || validation.riskLevel === 'high' || validation.issues.length > 0);

        // Always show validation popup if there are issues
        if (!validation.isValid || validation.issues.length > 0 || validation.riskLevel === 'high') {
          console.log('Showing validation popup');
          setValidationResult(validation);
          setPendingFormData(data);
          setValidationModalOpen(true);
        } else {
          // Property data is realistic and valid - proceed directly to analysis
          console.log('Proceeding with analysis - no issues found');
          proceedWithAnalysis(data);
        }
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

    // Always prompt user to select plan type first using pricing modal
    setPricingModalOpen(true);
  };

  const handlePropertySubmit = async (data: PropertyFormData) => {
    if (!selectedLocation) {
      alert('Please select a location first');
      return;
    }

    console.log('Form submitted, starting validation for:', selectedLocation.address);
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
    if (propertyData) {
      // Skip payment for now - proceed directly with analysis for all plans
      handleAnalysisWithPlan(propertyData, plan);
    }
  };

  const handleUsageLimitPlanSelect = (plan: string) => {
    setUsageLimitModalOpen(false);
    setSelectedPlan(plan);
    setPaymentModalOpen(true);
  };

  const handleAnalysisWithPlan = async (formData: PropertyFormData, planType: string) => {
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
          planType: planType,
          propertyDetails: {
            currency: formData.currency,
            country: formData.country,
            propertySize: formData.propertySize,
            sizeUnit: formData.sizeUnit,
            propertyAge: formData.propertyAge,
            bedrooms: formData.bedrooms,
            furnished: formData.furnished,
            floor: formData.floor,
            parkingSpaces: formData.parkingSpaces,
          }
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

  const handleFreeAnalysis = async (formData: PropertyFormData) => {
    return handleAnalysisWithPlan(formData, 'free');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* SEO Optimized Header Section */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-4">
              Value<span className="text-[#FF5A5F]">Nest</span> AI
            </h1>
            <h2 className="text-xl lg:text-2xl text-gray-600 max-w-4xl mx-auto mb-4">
              #1 AI-Powered Real Estate Location Intelligence & Property Investment Analysis Platform
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-6">
              Revolutionary artificial intelligence technology for real estate investment decisions. Get instant property analysis, crime rate assessment, growth predictions, and market insights to make smarter real estate investments.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                AI Real Estate Analytics
              </div>
              <div className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Property Investment Intelligence
              </div>
              <div className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Crime Rate & Safety Analysis
              </div>
              <div className="flex items-center">
                <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Market Growth Predictions
              </div>
              <div className="flex items-center"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Form Header */}
          <div className="bg-gradient-to-r from-[#FF5A5F] to-[#FC642D] px-4 sm:px-6 lg:px-8 py-16 text-center">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              Analyze Your Property Investment
            </h2>
            <p className="text-white/90 text-xl max-w-3xl mx-auto leading-relaxed">
              Get AI-powered insights on location value, crime rates, growth predictions, and investment potential
            </p>
          </div>

          {/* Form Content */}
          <div className="px-4 sm:px-6 lg:px-8 py-16">
            <div className="space-y-16">
              {/* Location Selection */}
              <div>
                <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                  Select Property Location
                </h3>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-12 rounded-2xl border border-blue-100">
                  <LocationInput onLocationSelect={handleLocationSelect} selectedLocation={selectedLocation} />
                </div>
              </div>

              {/* Property Details Form */}
              <div>
                <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                  Property Details
                </h3>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-12 rounded-2xl border border-green-100">
                  <PropertyFormCompact onSubmit={handlePropertySubmit} selectedLocation={selectedLocation} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

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

      {/* Sample Analysis */}
      <SampleAnalysis />

      {/* SEO Optimized Content */}
      <SEOContent />

      {/* Pricing Plans */}
      <PricingPlans
        onPlanSelect={handlePlanSelect}
        canUseFree={canUseFree}
        freeUsageCount={freeUsageCount}
        isFormValid={!!selectedLocation && !!propertyData}
      />

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

      {/* Pricing Modal */}
      <Dialog open={pricingModalOpen} onOpenChange={setPricingModalOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-0 bg-gradient-to-br from-gray-50 to-blue-50">
          <DialogHeader className="px-8 pt-8 pb-4 text-center">
            <DialogTitle className="text-3xl font-bold text-gray-900 mb-2">
              Choose Your Analysis Plan
            </DialogTitle>
            <p className="text-lg text-gray-600">
              Get comprehensive insights for your property investment decision
            </p>
          </DialogHeader>
          
          <div className="px-6 pb-8">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <PricingPlans
                onPlanSelect={(plan) => {
                  setSelectedPlan(plan);
                  setPricingModalOpen(false);
                  if (propertyData) {
                    handleAnalysisWithPlan(propertyData, plan);
                  }
                }}
                canUseFree={canUseFree}
                freeUsageCount={freeUsageCount}
                isFormValid={true}
              />
            </div>
            
            {/* Additional Trust Indicators */}
            <div className="mt-6 text-center">
              <div className="flex justify-center items-center space-x-8 text-sm text-gray-600">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Secure Payment
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Instant Analysis
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  AI-Powered Insights
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Analysis Loading Modal */}
      <AnalysisLoadingModal isOpen={analysisLoading} />

      {/* Floating Action Button for Mobile */}
      <div className="fixed bottom-6 right-6 md:hidden z-50">
        <Button className="bg-[#FF5A5F] hover:bg-[#e54852] text-white w-16 h-16 rounded-full airbnb-shadow-lg">
          <TrendingUp className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}