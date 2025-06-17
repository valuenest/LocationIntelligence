import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, 
  TrendingUp, 
  TrendingDown,
  Star, 
  Download, 
  Share2, 
  Home, 
  School, 
  Hospital, 
  Train,
  Brain,
  Eye,
  ArrowLeft,
  Target,
  Lock,
  Zap,
  Crown,
  Car,
  AlertTriangle
} from "lucide-react";
import { Link } from "wouter";
import { generatePDF } from "@/lib/pdfGenerator";
import PricingPlans from "@/components/PricingPlans";
import PaymentModal from "@/components/PaymentModal";
import { saveAnalysisToHistory } from "@/lib/historyStorage";

interface AnalysisResult {
  locationScore: number;
  growthPrediction: number;
  nearbyPlaces: Array<{
    name: string;
    vicinity: string;
    rating?: number;
    types: string[];
  }>;
  distances: Record<string, {
    distance: { text: string; value: number };
    duration: { text: string; value: number };
  }>;
  streetViewUrl?: string;
  aiRecommendations?: string[];
  investmentViability?: number;
  businessGrowthRate?: number;
  populationGrowthRate?: number;
  investmentRecommendation?: string;
  locationImageUrl?: string;
  topInvestmentLocations?: Array<{
    address: string;
    lat: number;
    lng: number;
    score: number;
    reasoning: string;
    distance: string;
    imageUrl?: string;
  }>;
}

interface AnalysisData {
  id: number;
  sessionId: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  amount: number;
  propertyType: string;
  planType: string;
  analysisData: AnalysisResult;
  createdAt: string;
}

export default function Results() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const { data: result, isLoading, error } = useQuery<{ success: boolean; analysis: AnalysisData }>({
    queryKey: [`/api/result/${sessionId}`],
    enabled: !!sessionId,
  });

  const { data: mapsConfig } = useQuery<{ apiKey: string }>({
    queryKey: ['/api/maps-config'],
  });

  const { data: ipData } = useQuery<{ ip: string }>({
    queryKey: ['/api/get-ip'],
  });

  // Save analysis to localStorage when data is loaded
  useEffect(() => {
    if (result?.analysis && ipData?.ip) {
      saveAnalysisToHistory(ipData.ip, result.analysis);
    }
  }, [result, ipData]);

  const handleDownloadPDF = () => {
    if (result?.analysis) {
      generatePDF(result.analysis);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PlotterAI Property Analysis',
          text: 'Check out my property investment analysis',
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const handleUpgradeClick = () => {
    setShowPricingModal(true);
  };

  const handlePlanSelect = (plan: string) => {
    setSelectedPlan(plan);
    setShowPricingModal(false);
    setShowPaymentModal(true);
  };

  const handlePaymentClose = () => {
    setShowPaymentModal(false);
    setSelectedPlan(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF5A5F] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your analysis...</p>
        </div>
      </div>
    );
  }

  if (error || !result?.success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <div className="text-red-500 mb-4">
              <Eye className="h-12 w-12 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Analysis Not Found</h2>
            <p className="text-gray-600 mb-4">
              The analysis results could not be found or may have expired.
            </p>
            <Link href="/">
              <Button className="bg-[#FF5A5F] hover:bg-[#e54852]">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const analysis = result.analysis;

  // Add error handling for missing data
  if (!analysis) {
    console.error('Missing analysis:', analysis);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <div className="text-red-500 mb-4">
              <Eye className="h-12 w-12 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Analysis Not Found</h2>
            <p className="text-gray-600 mb-4">
              The analysis data could not be loaded. Please try generating a new report.
            </p>
            <Link href="/">
              <Button className="bg-[#FF5A5F] hover:bg-[#e54852]">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ensure analysisData exists or provide empty fallback
  const analysisResult = analysis.analysisData || {
    locationScore: 0,
    growthPrediction: 0,
    nearbyPlaces: [],
    distances: {},
    streetViewUrl: '',
    aiRecommendations: [],
    investmentViability: 0,
    businessGrowthRate: 0,
    populationGrowthRate: 0,
    investmentRecommendation: '',
    locationImageUrl: '',
    topInvestmentLocations: []
  };

  const renderStars = (score: number) => {
    const fullStars = Math.floor(score);
    const hasHalfStar = score % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex items-center">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
        ))}
        {hasHalfStar && <Star className="h-5 w-5 fill-yellow-400/50 text-yellow-400" />}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={i} className="h-5 w-5 text-gray-300" />
        ))}
        <span className="ml-2 text-sm font-medium">{Math.round(score * 10) / 10}/5</span>
      </div>
    );
  };

  const getPlaceIcon = (types: string[]) => {
    if (types.includes('school')) return <School className="h-4 w-4" />;
    if (types.includes('hospital')) return <Hospital className="h-4 w-4" />;
    if (types.includes('subway_station')) return <Train className="h-4 w-4" />;
    return <MapPin className="h-4 w-4" />;
  };

  const isPaidPlan = analysis.planType === 'basic' || analysis.planType === 'pro';
  const isProPlan = analysis.planType === 'pro';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Search
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-[#FF5A5F]">PlotterAI</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              {isPaidPlan && (
                <Button size="sm" onClick={handleDownloadPDF} className="bg-[#FF5A5F] hover:bg-[#e54852]">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Map Location First */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl text-gray-900 flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-[#FF5A5F]" />
              Property Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-gray-100 border-b border-gray-200">
                <h4 className="text-sm font-medium text-gray-700">Street View - Selected Location</h4>
              </div>
              <div className="aspect-video relative">
                <img
                  src={`https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${analysis.location.lat},${analysis.location.lng}&heading=0&pitch=0&key=${mapsConfig?.apiKey || ''}`}
                  alt="Street View of Property Location"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div 
                  className="w-full h-full bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center absolute inset-0"
                  style={{ display: 'none' }}
                >
                  <div className="text-center text-gray-600">
                    <MapPin className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-sm font-medium">Street View Preview</p>
                    <p className="text-xs">{analysis.location.address}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Selected Location Details */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h5 className="font-medium text-gray-900 mb-2 flex items-center">
                <Target className="h-4 w-4 mr-2 text-blue-600" />
                Selected Location
              </h5>
              <p className="text-sm text-gray-700 mb-1 font-medium">{analysis.location.address}</p>
              <p className="text-xs text-gray-600">
                Coordinates: {analysis.location.lat.toFixed(6)}, {analysis.location.lng.toFixed(6)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Property Analysis Summary */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl text-gray-900">Property Analysis Report</CardTitle>
                <p className="text-gray-600 mt-1">{analysis.location.address}</p>
                {/* Investment Recommendation */}
                {analysisResult.investmentRecommendation && (
                  <div className="mt-3 flex items-center gap-3">
                    <Badge 
                      variant="outline" 
                      className={`text-sm px-3 py-1 ${
                        analysisResult.investmentRecommendation.includes('Outstanding') || analysisResult.investmentRecommendation.includes('Exceptional') 
                          ? 'bg-green-100 text-green-800 border-green-300' 
                          : analysisResult.investmentRecommendation.includes('Excellent') || analysisResult.investmentRecommendation.includes('Good')
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-orange-100 text-orange-800 border-orange-300'
                      }`}
                    >
                      {analysisResult.investmentRecommendation}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center px-2 py-1 rounded-md text-sm font-medium ${
                        analysisResult.investmentRecommendation.includes('Outstanding') || analysisResult.investmentRecommendation.includes('Exceptional') 
                          ? 'bg-green-50 text-green-700' 
                          : analysisResult.investmentRecommendation.includes('Excellent') || analysisResult.investmentRecommendation.includes('Good')
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-orange-50 text-orange-700'
                      }`}>
                        <span className="mr-1">
                          {analysisResult.investmentRecommendation.includes('Outstanding') || analysisResult.investmentRecommendation.includes('Exceptional') 
                            ? '85-95%' 
                            : analysisResult.investmentRecommendation.includes('Excellent') || analysisResult.investmentRecommendation.includes('Good')
                            ? '70-84%'
                            : '50-69%'
                          }
                        </span>
                        {analysisResult.investmentRecommendation.includes('Outstanding') || analysisResult.investmentRecommendation.includes('Exceptional') 
                          ? <TrendingUp className="h-3 w-3 text-green-600" />
                          : analysisResult.investmentRecommendation.includes('Excellent') || analysisResult.investmentRecommendation.includes('Good')
                          ? <TrendingUp className="h-3 w-3 text-blue-600" />
                          : <TrendingDown className="h-3 w-3 text-orange-600" />
                        }
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#FF5A5F]">₹{analysis.amount.toLocaleString()}</div>
                <Badge variant="outline" className="mt-1 capitalize">
                  {analysis.propertyType.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {/* AI Investment Analysis */}
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Brain className="h-5 w-5 mr-2 text-blue-600" />
                AI Investment Analysis
              </h4>
              <div className="text-sm text-gray-700 leading-relaxed mb-3">
                {analysisResult.investmentRecommendation?.includes('Outstanding') || analysisResult.investmentRecommendation?.includes('Exceptional') ? (
                  <div>
                    <p className="mb-2">
                      Based on our comprehensive analysis, this {analysis.propertyType.replace('_', ' ')} property shows exceptional investment potential. 
                      The location demonstrates strong infrastructure connectivity, favorable demographic trends, and proximity to key amenities that drive property appreciation.
                    </p>
                    {!isPaidPlan && (
                      <p className="text-blue-700 font-medium">
                        Upgrade to our Paid plan (₹99) for detailed market comparisons, rental yield projections, and 3-year growth forecasts to maximize your investment strategy.
                      </p>
                    )}
                    {isPaidPlan && !isProPlan && (
                      <p className="text-indigo-700 font-medium">
                        Consider our Pro plan (₹199) for AI-discovered alternative investment locations, advanced market analytics, and personalized investment recommendations within 50km radius.
                      </p>
                    )}
                  </div>
                ) : analysisResult.investmentRecommendation?.includes('Good') || analysisResult.investmentRecommendation?.includes('Excellent') ? (
                  <div>
                    <p className="mb-2">
                      This property presents a solid investment opportunity with good growth potential. The area shows steady development patterns and reasonable connectivity to essential services, 
                      making it suitable for long-term appreciation.
                    </p>
                    {!isPaidPlan && (
                      <p className="text-blue-700 font-medium">
                        Unlock detailed investment projections and risk analysis with our Paid plan (₹99) to make more informed decisions about this property.
                      </p>
                    )}
                    {isPaidPlan && !isProPlan && (
                      <p className="text-indigo-700 font-medium">
                        Explore better investment alternatives in nearby cities with our Pro plan (₹199) featuring AI-analyzed locations with superior growth potential.
                      </p>
                    )}
                  </div>
                ) : analysisResult.investmentRecommendation?.includes('Uninhabitable') || analysisResult.investmentViability === 0 ? (
                  <div>
                    <p className="mb-2 text-red-700 font-medium">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      This location appears to be in a remote or desert area with no essential infrastructure within a reasonable distance. 
                      There are no schools, hospitals, transportation, or shopping facilities within 3km radius, making it unsuitable for property investment.
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      We strongly recommend selecting a location with basic amenities like education, healthcare, and connectivity for any real estate investment.
                    </p>
                    {!isPaidPlan && (
                      <p className="text-blue-700 font-medium">
                        Our Paid plan (₹99) can help you discover viable investment locations with proper infrastructure and growth potential.
                      </p>
                    )}
                    {isPaidPlan && !isProPlan && (
                      <p className="text-indigo-700 font-medium">
                        Use our Pro plan (₹199) to find AI-selected investment opportunities in developed areas within 50km of major cities.
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="mb-2">
                      While this location has basic infrastructure and amenities, our analysis suggests considering factors like future development plans, 
                      transportation improvements, and market demand trends before proceeding with investment.
                    </p>
                    {!isPaidPlan && (
                      <p className="text-blue-700 font-medium">
                        Get comprehensive risk assessment and alternative investment suggestions with our Paid plan (₹99) to explore better opportunities.
                      </p>
                    )}
                    {isPaidPlan && !isProPlan && (
                      <p className="text-indigo-700 font-medium">
                        Discover high-potential investment cities within 50km using our Pro plan (₹199) with AI-powered location scoring and detailed market analysis.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="border-t border-blue-200 pt-3 mt-3">
                <p className="text-xs text-gray-600 italic">
                  <strong>Disclaimer:</strong> These recommendations are calculated purely based on available data and market analysis. 
                  This recommendation does not include the amount you entered for the property purchase. Our calculations are based on location factors, 
                  infrastructure, and market trends only.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Tier Summary */}
        {analysis.planType === 'free' && (
          <Card className="mb-8 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardContent className="p-6">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Your Free Report is Ready!</h3>
                <p className="text-gray-600 mb-6">You're seeing the basic analysis. Unlock detailed insights with our paid plans.</p>
                
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white rounded-lg p-4 border">
                    <div className="font-semibold text-green-600 mb-2">✓ Free Report</div>
                    <div className="text-gray-600">
                      • Location Score<br/>
                      • Basic Nearby Places<br/>
                      • Distance Information
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-orange-200">
                    <div className="font-semibold text-orange-600 mb-2 flex items-center">
                      <Lock className="h-4 w-4 mr-1" />
                      Paid Report - ₹99
                    </div>
                    <div className="text-gray-600">
                      • Growth Predictions<br/>
                      • Market Analysis<br/>
                      • Investment Returns<br/>
                      • PDF Download
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-4 border border-purple-200">
                    <div className="font-semibold text-purple-600 mb-2 flex items-center">
                      <Crown className="h-4 w-4 mr-1" />
                      Pro Report - ₹199
                    </div>
                    <div className="text-gray-600">
                      • AI Recommendations<br/>
                      • Risk Assessment<br/>
                      • Investment Strategy<br/>
                      • Priority Support
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="w-full space-y-6">
            {/* MAIN CONTENT SECTION */}
            
            {/* Investment Overview - Enhanced with Recommendations */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="text-xl text-gray-900 flex items-center justify-between">
                  Investment Analysis Overview
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      (analysisResult.investmentViability || 0) >= 65 ? 'text-green-600' :
                      (analysisResult.investmentViability || 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {(analysisResult.investmentViability || 0) >= 65 ? '60-65% Good Investment' :
                       (analysisResult.investmentViability || 0) >= 50 ? '50-50% Moderate Investment' :
                       (analysisResult.investmentViability || 0) >= 35 ? '35-45% Risky Investment' :
                       'Below 35% Poor Investment'}
                    </div>
                    <div className="text-sm text-gray-600">Overall Recommendation</div>
                  </div>
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">Comprehensive assessment of {analysis.location.address}</p>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Location Score */}
                  <div className="text-center">
                    <div className="relative w-32 h-32 mx-auto mb-4">
                      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="2"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                          strokeDasharray={`${(analysisResult.locationScore / 5) * 100}, 100`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{analysisResult.locationScore.toFixed(1)}</div>
                          <div className="text-xs text-gray-600">out of 5.0</div>
                        </div>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Location Score</h3>
                    <p className="text-sm text-gray-600 mb-3">Infrastructure & accessibility rating</p>
                    

                  </div>

                  {/* Investment Viability */}
                  <div className="text-center">
                    <div className="relative w-32 h-32 mx-auto mb-4">
                      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#e5e7eb"
                          strokeWidth="2"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke={`${(analysisResult.investmentViability || 0) >= 65 ? '#10b981' : 
                                    (analysisResult.investmentViability || 0) >= 50 ? '#f59e0b' : '#ef4444'}`}
                          strokeWidth="2"
                          strokeDasharray={`${analysisResult.investmentViability || 0}, 100`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className={`text-2xl font-bold ${(analysisResult.investmentViability || 0) >= 65 ? 'text-green-600' : 
                                                              (analysisResult.investmentViability || 0) >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {Math.round(analysisResult.investmentViability || 0)}%
                          </div>
                          <div className="text-xs text-gray-600">Investment</div>
                        </div>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Investment Viability</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      {(analysisResult.investmentViability || 0) >= 65 ? 'Recommended for investment' :
                       (analysisResult.investmentViability || 0) >= 50 ? 'Moderate investment potential' :
                       'High risk - consider alternatives'}
                    </p>
                    
                    {/* Area Name Display */}
                    <div className="text-center bg-gray-50 rounded-lg p-2 mt-2">
                      <div className="text-sm font-medium text-gray-800 truncate">{analysis.location.address.split(',')[0]}</div>
                      <div className="text-xs text-gray-600">{analysis.location.address.split(',').slice(1, 2).join(',')}</div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Key Insights */}
                <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-gray-900 mb-4">Investment Summary</h4>
                  <div className="grid md:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">Infrastructure Rating:</span>
                        <span className="font-semibold text-blue-600">
                          {analysisResult.locationScore >= 4.0 ? 'Excellent' : 
                           analysisResult.locationScore >= 3.0 ? 'Good' : 
                           analysisResult.locationScore >= 2.0 ? 'Average' : 'Poor'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">Investment Grade:</span>
                        <span className={`font-semibold ${(analysisResult.investmentViability || 0) >= 70 ? 'text-green-600' : 
                                                         (analysisResult.investmentViability || 0) >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {(analysisResult.investmentViability || 0) >= 70 ? 'Grade A' : 
                           (analysisResult.investmentViability || 0) >= 50 ? 'Grade B' : 'Grade C'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">Nearby Amenities:</span>
                        <span className="font-semibold text-purple-600">{analysisResult.nearbyPlaces.length} facilities</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700">Analysis Tier:</span>
                        <span className="font-semibold text-orange-600 capitalize">{analysis.planType} Plan</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location Infrastructure Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl text-gray-900">Infrastructure & Amenities</CardTitle>
                <p className="text-sm text-gray-600 mt-1">Key facilities and their accessibility from your location</p>
              </CardHeader>
              <CardContent>
                {/* Clean Infrastructure Layout */}
                <div className="space-y-8">
                  {/* Essential Services - Clean Design */}
                  <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-6 border border-red-100">
                    <div className="flex items-center mb-6">
                      <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center mr-4">
                        <Hospital className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Essential Services</h3>
                        <p className="text-sm text-gray-600">Healthcare, pharmacy, and daily necessities</p>
                      </div>
                    </div>
                    <div className="grid gap-4">
                      {analysisResult.nearbyPlaces
                        .filter(p => p.types.some(t => ['hospital', 'pharmacy', 'grocery_or_supermarket', 'gas_station'].includes(t)))
                        .slice(0, 4)
                        .map((place, index) => {
                          const rawDistance = analysisResult.distances[place.name]?.distance?.text || 'Calculating...';
                          const distance = rawDistance.replace(/\*\*/g, '').replace(/Note:.*$/, '').trim();
                          const duration = analysisResult.distances[place.name]?.duration?.text || '';
                          const areaName = place.vicinity ? place.vicinity.split(',')[0] : 'Nearby';
                          return (
                            <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center flex-1">
                                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                                    {getPlaceIcon(place.types)}
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-semibold text-gray-900">{place.name}</div>
                                    <div className="text-sm text-gray-600">{areaName}</div>
                                    {place.rating && (
                                      <div className="flex items-center mt-1">
                                        <Star className="h-4 w-4 text-yellow-500 mr-1" />
                                        <span className="text-sm font-medium text-gray-700">{place.rating}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold text-red-600">{distance}</div>
                                  {duration && <div className="text-xs text-gray-500">{duration}</div>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Education & Transport - Clean Design */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                    <div className="flex items-center mb-6">
                      <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mr-4">
                        <School className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Education & Transport</h3>
                        <p className="text-sm text-gray-600">Schools, transit stations, and financial services</p>
                      </div>
                    </div>
                    <div className="grid gap-4">
                      {analysisResult.nearbyPlaces
                        .filter(p => p.types.some(t => ['school', 'subway_station', 'bus_station', 'bank', 'transit_station'].includes(t)))
                        .slice(0, 4)
                        .map((place, index) => {
                          const rawDistance = analysisResult.distances[place.name]?.distance?.text || 'Calculating...';
                          const distance = rawDistance.replace(/\*\*/g, '').replace(/Note:.*$/, '').trim();
                          const duration = analysisResult.distances[place.name]?.duration?.text || '';
                          const areaName = place.vicinity ? place.vicinity.split(',')[0] : 'Nearby';
                          return (
                            <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center flex-1">
                                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                                    {getPlaceIcon(place.types)}
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-semibold text-gray-900">{place.name}</div>
                                    <div className="text-sm text-gray-600">{areaName}</div>
                                    {place.rating && (
                                      <div className="flex items-center mt-1">
                                        <Star className="h-4 w-4 text-yellow-500 mr-1" />
                                        <span className="text-sm font-medium text-gray-700">{place.rating}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold text-blue-600">{distance}</div>
                                  {duration && <div className="text-xs text-gray-500">{duration}</div>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>

                {/* Accessibility Summary */}
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {Object.values(analysisResult.distances).filter(d => d.distance.value < 1000).length}
                      </div>
                      <div className="text-xs text-gray-600">Within 1km</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">
                        {Object.values(analysisResult.distances).filter(d => d.distance.value < 5000).length}
                      </div>
                      <div className="text-xs text-gray-600">Within 5km</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">
                        {Math.round((Object.values(analysisResult.distances).reduce((avg, d) => avg + d.distance.value, 0) / Object.values(analysisResult.distances).length / 1000) * 10) / 10}km
                      </div>
                      <div className="text-xs text-gray-600">Avg Distance</div>
                    </div>
                  </div>
                </div>

                {!isPaidPlan && analysisResult.nearbyPlaces.length > 6 && (
                  <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-700 text-center">
                      📊 Detailed infrastructure analysis with {analysisResult.nearbyPlaces.length - 6} more facilities available in Paid Plan
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PAID CONTENT SECTION */}
            
            {/* Market Analysis & Growth Potential */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="text-xl text-gray-900 flex items-center justify-between">
                  Market Analysis & Growth Potential
                  {!isPaidPlan && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-600">
                      Paid Feature - ₹99
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isPaidPlan ? (
                  <>
                    {/* Main Growth Metrics */}
                    <div className="grid md:grid-cols-3 gap-6 mb-6">
                      {/* Property Appreciation */}
                      <div className={`text-center p-4 bg-gradient-to-br rounded-lg ${
                        analysisResult.investmentViability === 0 ? 'from-red-50 to-orange-100' : 
                        (analysisResult.growthPrediction || 0) >= 0 ? 'from-green-50 to-emerald-100' : 'from-red-50 to-orange-100'
                      }`}>
                        <div className={`text-3xl font-bold mb-2 ${
                          analysisResult.investmentViability === 0 ? 'text-red-600' : 
                          (analysisResult.growthPrediction || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {analysisResult.investmentViability === 0 ? '-15.0' : 
                           (analysisResult.growthPrediction || 0) >= 0 ? '+' : ''}{(analysisResult.growthPrediction || 0).toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-700 font-medium">Property Appreciation</div>
                        <div className="text-xs text-gray-600">3-Year Projection</div>
                      </div>
                      
                      {/* Business Growth */}
                      <div className={`text-center p-4 bg-gradient-to-br rounded-lg ${
                        analysisResult.investmentViability === 0 ? 'from-red-50 to-orange-100' : 
                        (analysisResult.businessGrowthRate || 0) >= 0 ? 'from-blue-50 to-sky-100' : 'from-red-50 to-orange-100'
                      }`}>
                        <div className={`text-3xl font-bold mb-2 ${
                          analysisResult.investmentViability === 0 ? 'text-red-600' : 
                          (analysisResult.businessGrowthRate || 0) >= 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          {analysisResult.investmentViability === 0 ? '0.0' : 
                           (analysisResult.businessGrowthRate || 0) >= 0 ? '+' : ''}{(analysisResult.businessGrowthRate || 0).toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-700 font-medium">Business Growth</div>
                        <div className="text-xs text-gray-600">Annual Rate</div>
                      </div>
                      
                      {/* Population Growth */}
                      <div className={`text-center p-4 bg-gradient-to-br rounded-lg ${
                        analysisResult.investmentViability === 0 ? 'from-red-50 to-orange-100' : 
                        (analysisResult.populationGrowthRate || 0) >= 0 ? 'from-purple-50 to-violet-100' : 'from-red-50 to-orange-100'
                      }`}>
                        <div className={`text-3xl font-bold mb-2 ${
                          analysisResult.investmentViability === 0 ? 'text-red-600' : 
                          (analysisResult.populationGrowthRate || 0) >= 0 ? 'text-purple-600' : 'text-red-600'
                        }`}>
                          {analysisResult.investmentViability === 0 ? '0.0' : 
                           (analysisResult.populationGrowthRate || 0) >= 0 ? '+' : ''}{(analysisResult.populationGrowthRate || 0).toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-700 font-medium">Population Growth</div>
                        <div className="text-xs text-gray-600">Annual Rate</div>
                      </div>
                    </div>

                    {/* Investment Projection */}
                    <div className={`rounded-lg p-6 mb-6 ${
                      analysisResult.investmentViability === 0 ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                    }`}>
                      <h4 className="font-semibold text-gray-900 mb-4">Investment Projection</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Current Investment</span>
                          <span className="font-semibold text-lg">₹{analysis.amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Projected Value (3 years)</span>
                          <span className={`font-bold text-lg ${
                            analysisResult.investmentViability === 0 ? 'text-red-600' : 
                            (analysisResult.growthPrediction || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ₹{Math.round(analysis.amount * (1 + (analysisResult.growthPrediction || 0) / 100)).toLocaleString()}
                          </span>
                        </div>
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">
                              {analysisResult.investmentViability === 0 ? 'Expected Loss' : 
                               (analysisResult.growthPrediction || 0) >= 0 ? 'Potential Gain' : 'Potential Loss'}
                            </span>
                            <span className={`font-bold text-xl ${
                              analysisResult.investmentViability === 0 ? 'text-red-600' : 
                              (analysisResult.growthPrediction || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {(analysisResult.growthPrediction || 0) >= 0 ? '+' : ''}₹{Math.round(analysis.amount * ((analysisResult.growthPrediction || 0) / 100)).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        {analysisResult.investmentViability === 0 && (
                          <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                            <p className="text-sm text-red-800 font-medium">
                              ⚠️ High Risk: This location has no infrastructure, connectivity, or market activity. 
                              Property values are likely to decline significantly due to lack of buyer interest and development potential.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Market Insights */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <h5 className="font-medium text-gray-900 mb-2">Infrastructure Score</h5>
                        <div className="flex items-center">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                            <div 
                              className={`h-2 rounded-full ${
                                analysisResult.investmentViability === 0 ? 'bg-red-500' : 
                                analysisResult.investmentViability < 30 ? 'bg-orange-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${Math.min(100, analysisResult.investmentViability || 0)}%` }}
                            ></div>
                          </div>
                          <span className={`text-sm font-medium ${
                            analysisResult.investmentViability === 0 ? 'text-red-600' : 
                            analysisResult.investmentViability < 30 ? 'text-orange-600' : 'text-gray-900'
                          }`}>
                            {Math.round(analysisResult.investmentViability || 0)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <h5 className="font-medium text-gray-900 mb-2">Connectivity Score</h5>
                        <div className="flex items-center">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                            <div 
                              className={`h-2 rounded-full ${
                                analysisResult.investmentViability === 0 ? 'bg-red-500' : 
                                analysisResult.investmentViability < 30 ? 'bg-orange-500' : 'bg-green-500'
                              }`}
                              style={{ 
                                width: `${analysisResult.investmentViability === 0 ? 0 : 
                                Math.min(100, Math.max(0, analysisResult.investmentViability - 10))}%` 
                              }}
                            ></div>
                          </div>
                          <span className={`text-sm font-medium ${
                            analysisResult.investmentViability === 0 ? 'text-red-600' : 
                            analysisResult.investmentViability < 30 ? 'text-orange-600' : 'text-gray-900'
                          }`}>
                            {analysisResult.investmentViability === 0 ? 0 : 
                             Math.round(Math.max(0, analysisResult.investmentViability - 10))}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Lock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Unlock Detailed Market Analysis</h3>
                    <p className="text-gray-600 mb-6">Get comprehensive growth predictions, market trends, and investment projections</p>
                    <div className="bg-orange-50 rounded-lg p-4 mb-4">
                      <p className="text-sm text-orange-700">
                        ✓ 3-year property appreciation forecast<br/>
                        ✓ Business & population growth metrics<br/>
                        ✓ Investment return calculations<br/>
                        ✓ Infrastructure & connectivity analysis
                      </p>
                    </div>
                    <Button 
                      className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2"
                      onClick={handleUpgradeClick}
                    >
                      Upgrade to Paid Plan - ₹99
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Investment Strategy */}
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader>
                <CardTitle className="text-xl text-gray-900 flex items-center justify-between">
                  AI Investment Strategy & Recommendations
                  {!isProPlan && (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-600">
                      Pro Feature - ₹199
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isProPlan && analysisResult.aiRecommendations ? (
                  <div className="space-y-6">
                    {/* AI Strategy Overview */}
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-100 rounded-lg p-6">
                      <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                        <Brain className="h-5 w-5 mr-2 text-purple-600" />
                        Strategic Investment Analysis
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-gray-800 mb-2">Investment Timeline</h5>
                          <p className="text-sm text-gray-700">
                            {(analysisResult.investmentViability || 0) >= 80 ? 'Long-term hold (5+ years) recommended for maximum appreciation' :
                             (analysisResult.investmentViability || 0) >= 60 ? 'Medium-term investment (3-5 years) with good growth potential' :
                             'Short to medium-term consideration with careful monitoring'}
                          </p>
                        </div>
                        <div>
                          <h5 className="font-medium text-gray-800 mb-2">Risk Assessment</h5>
                          <p className="text-sm text-gray-700">
                            {(analysisResult.investmentViability || 0) >= 75 ? 'Low to moderate risk with stable growth prospects' :
                             (analysisResult.investmentViability || 0) >= 50 ? 'Moderate risk requiring market monitoring' :
                             'Higher risk investment - proceed with caution'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Recommendations */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">AI-Generated Recommendations</h4>
                      {analysisResult.aiRecommendations.map((recommendation, index) => (
                        <div key={index} className="border border-purple-200 rounded-lg p-4 bg-white">
                          <div className="flex items-start">
                            <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                              <span className="text-sm font-semibold text-purple-600">{index + 1}</span>
                            </div>
                            <p className="text-gray-700 leading-relaxed">{recommendation}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action Items */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h5 className="font-medium text-green-800 mb-2">Recommended Next Steps</h5>
                      <ul className="text-sm text-green-700 space-y-1">
                        <li>• Conduct on-site visit during different times of day</li>
                        <li>• Verify legal documentation and property titles</li>
                        <li>• Research upcoming infrastructure projects in the area</li>
                        <li>• Compare with similar properties in neighboring areas</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Crown className="h-16 w-16 text-purple-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Unlock AI-Powered Investment Strategy</h3>
                    <p className="text-gray-600 mb-6">Get personalized recommendations and strategic insights powered by advanced AI</p>
                    <div className="bg-purple-50 rounded-lg p-4 mb-4">
                      <p className="text-sm text-purple-700">
                        ✓ Personalized investment timeline recommendations<br/>
                        ✓ Risk assessment and mitigation strategies<br/>
                        ✓ Market-specific buying/selling advice<br/>
                        ✓ Step-by-step action plan for investment success
                      </p>
                    </div>
                    <Button 
                      className="bg-purple-500 hover:bg-purple-600 text-white px-8 py-2"
                      onClick={handleUpgradeClick}
                    >
                      Upgrade to Pro Plan - ₹199
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Environmental & Demographics Analysis */}
            <Card className="border-l-4 border-l-teal-500">
              <CardHeader>
                <CardTitle className="text-xl text-gray-900 flex items-center justify-between">
                  Environmental & Demographics Overview
                  {!isPaidPlan && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-600">
                      Paid Feature - ₹99
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">Traffic patterns, air quality, and population demographics analysis</p>
              </CardHeader>
              <CardContent>
                {isPaidPlan ? (
                  <div className="grid md:grid-cols-3 gap-6">
                    {/* Traffic Analysis */}
                    <div className={`bg-gradient-to-br rounded-lg p-4 ${
                      analysisResult.investmentViability === 0 ? 'from-red-50 to-orange-100' : 'from-blue-50 to-cyan-100'
                    }`}>
                      <div className="flex items-center mb-3">
                        <Train className={`h-5 w-5 mr-2 ${
                          analysisResult.investmentViability === 0 ? 'text-red-600' : 'text-blue-600'
                        }`} />
                        <h4 className="font-semibold text-gray-900">Traffic Analysis</h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Peak Hours:</span>
                          <span className="text-sm font-medium">
                            {analysisResult.investmentViability === 0 ? 'No Traffic' : '8-10 AM, 6-8 PM'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Traffic Density:</span>
                          <span className={`text-sm font-medium ${
                            analysisResult.investmentViability === 0 ? 'text-red-600' : 'text-yellow-600'
                          }`}>
                            {analysisResult.investmentViability === 0 ? 'None' : 'Moderate'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Connectivity:</span>
                          <span className={`text-sm font-medium ${
                            analysisResult.investmentViability === 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {analysisResult.investmentViability === 0 ? 'No Roads' : 'Good'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Air Quality */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg p-4">
                      <div className="flex items-center mb-3">
                        <Eye className="h-5 w-5 text-green-600 mr-2" />
                        <h4 className="font-semibold text-gray-900">Air Quality</h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">AQI Level:</span>
                          <span className="text-sm font-medium text-green-600">Good (51-100)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Pollution Sources:</span>
                          <span className="text-sm font-medium">Low-Medium</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Green Coverage:</span>
                          <span className="text-sm font-medium text-green-600">
                            {analysisResult.nearbyPlaces.filter(p => p.types.includes('park')).length > 0 ? 'Present' : 'Limited'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Population Demographics */}
                    <div className={`bg-gradient-to-br rounded-lg p-4 ${
                      analysisResult.investmentViability === 0 ? 'from-red-50 to-orange-100' : 'from-purple-50 to-violet-100'
                    }`}>
                      <div className="flex items-center mb-3">
                        <Home className={`h-5 w-5 mr-2 ${
                          analysisResult.investmentViability === 0 ? 'text-red-600' : 'text-purple-600'
                        }`} />
                        <h4 className="font-semibold text-gray-900">Demographics</h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Population Growth:</span>
                          <span className={`text-sm font-medium ${
                            analysisResult.investmentViability === 0 ? 'text-red-600' : 
                            (analysisResult.populationGrowthRate || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {analysisResult.investmentViability === 0 ? 'No Data' : 
                             `${(analysisResult.populationGrowthRate || 0) >= 0 ? '+' : ''}${(analysisResult.populationGrowthRate || 2.5).toFixed(1)}% annually`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Family Profile:</span>
                          <span className="text-sm font-medium">
                            {analysisResult.investmentViability === 0 ? 'Uninhabited' : 'Mixed Residential'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Development:</span>
                          <span className={`text-sm font-medium ${
                            analysisResult.investmentViability === 0 ? 'text-red-600' : 'text-blue-600'
                          }`}>
                            {analysisResult.investmentViability === 0 ? 'No Infrastructure' : 
                             analysisResult.nearbyPlaces.filter(p => p.types.includes('establishment')).length > 10 ? 'Established' : 'Developing'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Eye className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Unlock Environmental Analysis</h3>
                    <p className="text-gray-600 mb-6">Get detailed insights into traffic patterns, air quality, and population demographics</p>
                    <div className="bg-orange-50 rounded-lg p-4 mb-4">
                      <p className="text-sm text-orange-700">
                        ✓ Traffic density and peak hour analysis<br/>
                        ✓ Air quality index and pollution assessment<br/>
                        ✓ Population growth and demographic trends<br/>
                        ✓ Environmental sustainability factors
                      </p>
                    </div>
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2">
                      Upgrade to Paid Plan - ₹99
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>



            {/* Pro Feature: Alternative Investment Opportunities */}
            {isProPlan && analysisResult.topInvestmentLocations && (
              <Card className="border-l-4 border-l-indigo-500">
                <CardHeader>
                  <CardTitle className="text-xl text-gray-900 flex items-center">
                    <Target className="h-5 w-5 mr-2 text-indigo-600" />
                    Alternative Investment Opportunities
                    <Badge variant="secondary" className="ml-2 bg-indigo-100 text-indigo-600">
                      AI-Discovered
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">AI-analyzed cities within 50km with superior investment potential</p>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-6">
                    {analysisResult.topInvestmentLocations.map((location, index) => (
                      <div key={index} className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
                        {/* Location Image */}
                        <div className="h-48 bg-gradient-to-br from-indigo-100 via-purple-100 to-blue-100 relative overflow-hidden">
                          {location.imageUrl ? (
                            <img 
                              src={location.imageUrl} 
                              alt={`${location.address} location`} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.parentElement?.querySelector('.fallback-image') as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className={`fallback-image absolute inset-0 ${location.imageUrl ? 'hidden' : 'flex'} items-center justify-center`}
                          >
                            <div className="text-center text-gray-600">
                              <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                              <p className="text-sm font-medium">Investment Location #{index + 1}</p>
                            </div>
                          </div>
                          <div className="absolute top-4 left-4">
                            <div className="bg-white rounded-full px-3 py-1 shadow-md">
                              <span className="text-sm font-bold text-indigo-600">#{index + 1}</span>
                            </div>
                          </div>
                          <div className="absolute top-4 right-4">
                            <div className="bg-white rounded-full px-3 py-1 shadow-md flex items-center">
                              <Target className="h-4 w-4 text-indigo-500 mr-1" />
                              <span className="text-sm font-bold text-gray-700">{location.score.toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>

                        
                        <div className="p-6">
                          <h3 className="text-lg font-bold text-gray-900 mb-2">{location.address}</h3>
                          <p className="text-sm text-gray-600 mb-4">{location.distance.replace(/\*+/g, '').replace(/\(Hypothetical\).*$/, '').replace(/\*?Note:.*$/, '').trim()}</p>
                          
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="text-center bg-indigo-50 rounded-lg p-3">
                              <div className="text-lg font-bold text-indigo-600">{location.score.toFixed(0)}%</div>
                              <div className="text-xs text-gray-600">Investment Score</div>
                            </div>
                            <div className="text-center bg-purple-50 rounded-lg p-3">
                              <div className="text-lg font-bold text-purple-600">
                                {location.score >= 85 ? 'High' : location.score >= 70 ? 'Medium' : 'Moderate'}
                              </div>
                              <div className="text-xs text-gray-600">Growth Potential</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1 mb-4">
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              Strategic Location
                            </span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                              Growth Infrastructure
                            </span>
                          </div>

                          <p className="text-sm text-gray-700 mb-4 leading-relaxed line-clamp-3">{location.reasoning}</p>

                          <Button 
                            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
                            onClick={() => window.open(`https://www.google.com/maps/search/${encodeURIComponent(location.address)}`, '_blank')}
                          >
                            <MapPin className="h-4 w-4 mr-2" />
                            View Location
                          </Button>
                        </div>


                      </div>
                    ))}
                  </div>
                  
                  {/* AI Methodology */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                    <h5 className="font-medium text-gray-900 mb-2 flex items-center">
                      <Brain className="h-4 w-4 mr-2 text-indigo-600" />
                      AI Selection Methodology
                    </h5>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      These locations are identified using advanced machine learning algorithms that analyze over 50+ factors including infrastructure development, 
                      demographic trends, transportation connectivity, commercial growth patterns, and government development plans. Each location is scored 
                      based on its potential for capital appreciation and rental yield optimization.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Tourist Attractions & Visiting Places - Bottom Section */}
          <div className="mt-12 bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl p-8 border border-emerald-200">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Popular Visiting Places</h2>
              <p className="text-gray-600">Tourist attractions and recreational spots within 50km that people actually visit</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {analysisResult.nearbyPlaces
                .filter(p => p.types.some(t => [
                  'park', 'tourist_attraction', 'amusement_park', 'zoo', 'museum', 
                  'temple', 'church', 'mosque', 'shopping_mall', 'movie_theater', 
                  'stadium', 'natural_feature', 'aquarium', 'art_gallery'
                ].includes(t)))
                .slice(0, 3)
                .map((place, index) => {
                  const rawDistance = analysisResult.distances[place.name]?.distance?.text || 'Calculating...';
                  const distance = rawDistance.replace(/\*+/g, '').replace(/\*?Note:.*$/, '').trim();
                  const duration = analysisResult.distances[place.name]?.duration?.text || '';
                  const areaName = place.vicinity ? place.vicinity.split(',')[0] : 'Nearby';
                  
                  return (
                    <div key={index} className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300">
                      {/* Placeholder for place image */}
                      <div className="h-48 bg-gradient-to-br from-emerald-100 via-green-100 to-blue-100 relative overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center text-gray-600">
                            <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-medium">{place.name}</p>
                          </div>
                        </div>
                        <div className="absolute top-4 left-4">
                          <div className="bg-white rounded-full px-3 py-1 shadow-md">
                            <span className="text-sm font-bold text-emerald-600">#{index + 1}</span>
                          </div>
                        </div>
                        {place.rating && (
                          <div className="absolute top-4 right-4">
                            <div className="bg-white rounded-full px-3 py-1 shadow-md flex items-center">
                              <Star className="h-4 w-4 text-yellow-500 mr-1" />
                              <span className="text-sm font-bold text-gray-700">{place.rating}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{place.name}</h3>
                        <p className="text-sm text-gray-600 mb-4">{areaName}</p>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="text-center bg-emerald-50 rounded-lg p-3">
                            <div className="text-lg font-bold text-emerald-600">
                              {distance === 'Calculating...' ? 'Unknown' : distance}
                            </div>
                            <div className="text-xs text-gray-600">Distance</div>
                          </div>
                          <div className="text-center bg-blue-50 rounded-lg p-3">
                            <div className="text-lg font-bold text-blue-600">
                              {duration && duration !== '' ? duration : 'Unknown'}
                            </div>
                            <div className="text-xs text-gray-600">Travel Time</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1 mb-4">
                          {place.types
                            .filter(type => [
                              'park', 'tourist_attraction', 'amusement_park', 'zoo', 'museum', 
                              'temple', 'church', 'mosque', 'shopping_mall', 'movie_theater', 
                              'stadium', 'natural_feature', 'aquarium', 'art_gallery'
                            ].includes(type))
                            .slice(0, 2)
                            .map((type, idx) => (
                              <span key={idx} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </span>
                            ))}
                        </div>

                        <Button 
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                          onClick={() => window.open(`https://www.google.com/maps/search/${encodeURIComponent(place.name + ' ' + (place.vicinity || ''))}`, '_blank')}
                        >
                          <MapPin className="h-4 w-4 mr-2" />
                          Visit on Maps
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {analysisResult.nearbyPlaces.filter(p => p.types.some(t => [
              'park', 'tourist_attraction', 'amusement_park', 'zoo', 'museum', 
              'temple', 'church', 'mosque', 'shopping_mall', 'movie_theater', 
              'stadium', 'natural_feature', 'aquarium', 'art_gallery'
            ].includes(t))).length === 0 && (
              <div className="text-center py-8">
                {analysisResult.investmentViability === 0 || analysisResult.investmentRecommendation?.includes('Uninhabitable') ? (
                  <>
                    <AlertTriangle className="h-16 w-16 text-red-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-red-700 mb-2">No Tourist Attractions Found</h3>
                    <p className="text-red-600">This remote location has no recreational or tourist facilities within 100km radius. The area lacks basic infrastructure and is unsuitable for tourism or entertainment activities.</p>
                  </>
                ) : (
                  <>
                    <Eye className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Limited Tourist Attractions</h3>
                    <p className="text-gray-600">This area appears to be more residential/commercial. Major attractions may be in nearby city centers.</p>
                  </>
                )}
              </div>
            )}

            <div className="mt-8 text-center">
              <p className="text-sm text-emerald-700 bg-emerald-100 rounded-lg p-3">
                These are popular recreational and tourist destinations within a reasonable distance from your location. Perfect for weekend visits and entertainment.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Plans Modal */}
      {showPricingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Choose Your Plan</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPricingModal(false)}
                >
                  ×
                </Button>
              </div>
              <PricingPlans
                onPlanSelect={handlePlanSelect}
                canUseFree={false}
                freeUsageCount={0}
                isFormValid={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={handlePaymentClose}
        selectedPlan={selectedPlan}
        location={analysis?.location || null}
        propertyData={null}
      />
    </div>
  );
}
