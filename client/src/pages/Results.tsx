import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, 
  TrendingUp, 
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
  Lock,
  Zap,
  Crown,
  Target
} from "lucide-react";
import { Link } from "wouter";
import { generatePDF } from "@/lib/pdfGenerator";

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

  const { data: result, isLoading, error } = useQuery<{ success: boolean; analysis: AnalysisData }>({
    queryKey: [`/api/result/${sessionId}`],
    enabled: !!sessionId,
  });

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
  const analysisResult = analysis.analysisData;

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
        <span className="ml-2 text-sm font-medium">{score.toFixed(1)}/5</span>
      </div>
    );
  };

  const getPlaceIcon = (types: string[]) => {
    if (types.includes('school')) return <School className="h-4 w-4" />;
    if (types.includes('hospital')) return <Hospital className="h-4 w-4" />;
    if (types.includes('subway_station')) return <Train className="h-4 w-4" />;
    return <MapPin className="h-4 w-4" />;
  };

  const isPaidPlan = analysis.planType === 'paid' || analysis.planType === 'pro';
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Property Summary */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl text-gray-900">Property Analysis Report</CardTitle>
                <p className="text-gray-600 mt-1">{analysis.location.address}</p>
                {/* Investment Recommendation */}
                {analysisResult.investmentRecommendation && (
                  <div className="mt-3">
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
          {/* Location Image */}
          {analysisResult.locationImageUrl && (
            <CardContent className="pt-0">
              <img 
                src={analysisResult.locationImageUrl} 
                alt="Location Overview" 
                className="w-full h-64 object-cover rounded-lg border"
                onError={(e) => {
                  // Hide image if it fails to load
                  e.currentTarget.style.display = 'none';
                  // Show fallback map placeholder
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) (fallback as any).style.display = 'flex';
                }}
              />
              <div 
                className="w-full h-64 bg-gradient-to-br from-blue-100 to-green-100 rounded-lg border flex items-center justify-center"
                style={{ display: 'none' }}
              >
                <div className="text-center text-gray-600">
                  <MapPin className="h-12 w-12 mx-auto mb-2" />
                  <p className="text-sm">Location: {analysis.location.address}</p>
                </div>
              </div>
            </CardContent>
          )}
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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Analysis */}
          <div className="lg:col-span-2 space-y-6">
            {/* FREE CONTENT SECTION */}
            
            {/* Investment Overview - Redesigned */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="text-xl text-gray-900">Investment Analysis Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Investment Score */}
                  <div className="text-center">
                    <div className="relative w-24 h-24 mx-auto mb-4">
                      <svg className="transform -rotate-90 w-24 h-24">
                        <circle cx="12" cy="12" r="10" transform="translate(36,36)" 
                                stroke="#e5e7eb" strokeWidth="2" fill="transparent" />
                        <circle cx="12" cy="12" r="10" transform="translate(36,36)"
                                stroke="#3b82f6" strokeWidth="2" fill="transparent"
                                strokeDasharray={`${(analysisResult.locationScore / 5) * 62.83} 62.83`}
                                strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-blue-600">{analysisResult.locationScore.toFixed(1)}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">Location Score (out of 5.0)</p>
                  </div>
                  
                  {/* Investment Viability */}
                  {analysisResult.investmentViability && (
                    <div className="text-center">
                      <div className="relative w-24 h-24 mx-auto mb-4">
                        <svg className="transform -rotate-90 w-24 h-24">
                          <circle cx="12" cy="12" r="10" transform="translate(36,36)" 
                                  stroke="#e5e7eb" strokeWidth="2" fill="transparent" />
                          <circle cx="12" cy="12" r="10" transform="translate(36,36)"
                                  stroke="#10b981" strokeWidth="2" fill="transparent"
                                  strokeDasharray={`${(analysisResult.investmentViability / 100) * 62.83} 62.83`}
                                  strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-bold text-green-600">{analysisResult.investmentViability}%</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">Investment Viability</p>
                    </div>
                  )}
                </div>
                
                {/* Quick Stats */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold text-gray-900">{analysisResult.nearbyPlaces.length}</div>
                      <div className="text-xs text-gray-600">Nearby Places</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900">
                        {Object.values(analysisResult.distances).filter(d => d.distance.value < 2000).length}
                      </div>
                      <div className="text-xs text-gray-600">Within 2km</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-gray-900">
                        {analysis.planType.charAt(0).toUpperCase() + analysis.planType.slice(1)}
                      </div>
                      <div className="text-xs text-gray-600">Plan Type</div>
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
                {/* Category-wise breakdown */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Essential Services */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                      Essential Services
                    </h4>
                    <div className="space-y-2">
                      {analysisResult.nearbyPlaces
                        .filter(p => p.types.some(t => ['hospital', 'pharmacy', 'grocery_or_supermarket', 'gas_station'].includes(t)))
                        .slice(0, 3)
                        .map((place, index) => {
                          const distance = analysisResult.distances[place.name]?.distance?.text || 'N/A';
                          return (
                            <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                              <div className="flex items-center">
                                {getPlaceIcon(place.types)}
                                <span className="ml-2 text-sm text-gray-700">{place.name}</span>
                              </div>
                              <span className="text-sm font-medium text-gray-900">{distance}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Education & Transport */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                      Education & Transport
                    </h4>
                    <div className="space-y-2">
                      {analysisResult.nearbyPlaces
                        .filter(p => p.types.some(t => ['school', 'subway_station', 'bus_station', 'bank'].includes(t)))
                        .slice(0, 3)
                        .map((place, index) => {
                          const distance = analysisResult.distances[place.name]?.distance?.text || 'N/A';
                          return (
                            <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                              <div className="flex items-center">
                                {getPlaceIcon(place.types)}
                                <span className="ml-2 text-sm text-gray-700">{place.name}</span>
                              </div>
                              <span className="text-sm font-medium text-gray-900">{distance}</span>
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
                        {Math.round(Object.values(analysisResult.distances).reduce((avg, d) => avg + d.distance.value, 0) / Object.values(analysisResult.distances).length / 1000 * 10) / 10}km
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
                      <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg">
                        <div className="text-3xl font-bold text-green-600 mb-2">
                          +{analysisResult.growthPrediction?.toFixed(1) || '0.0'}%
                        </div>
                        <div className="text-sm text-gray-700 font-medium">Property Appreciation</div>
                        <div className="text-xs text-gray-600">3-Year Projection</div>
                      </div>
                      
                      {/* Business Growth */}
                      {analysisResult.businessGrowthRate && (
                        <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-sky-100 rounded-lg">
                          <div className="text-3xl font-bold text-blue-600 mb-2">
                            {analysisResult.businessGrowthRate?.toFixed(1) || '0.0'}%
                          </div>
                          <div className="text-sm text-gray-700 font-medium">Business Growth</div>
                          <div className="text-xs text-gray-600">Annual Rate</div>
                        </div>
                      )}
                      
                      {/* Population Growth */}
                      {analysisResult.populationGrowthRate && (
                        <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-violet-100 rounded-lg">
                          <div className="text-3xl font-bold text-purple-600 mb-2">
                            {analysisResult.populationGrowthRate?.toFixed(1) || '0.0'}%
                          </div>
                          <div className="text-sm text-gray-700 font-medium">Population Growth</div>
                          <div className="text-xs text-gray-600">Annual Rate</div>
                        </div>
                      )}
                    </div>

                    {/* Investment Projection */}
                    <div className="bg-gray-50 rounded-lg p-6 mb-6">
                      <h4 className="font-semibold text-gray-900 mb-4">Investment Projection</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Current Investment</span>
                          <span className="font-semibold text-lg">₹{analysis.amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Projected Value (3 years)</span>
                          <span className="font-bold text-green-600 text-lg">
                            ₹{Math.round(analysis.amount * (1 + (analysisResult.growthPrediction || 0) / 100)).toLocaleString()}
                          </span>
                        </div>
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Potential Gain</span>
                            <span className="font-bold text-green-600 text-xl">
                              +₹{Math.round(analysis.amount * ((analysisResult.growthPrediction || 0) / 100)).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Market Insights */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <h5 className="font-medium text-gray-900 mb-2">Infrastructure Score</h5>
                        <div className="flex items-center">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${Math.min(100, (analysisResult.nearbyPlaces.length / 15) * 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{Math.round((analysisResult.nearbyPlaces.length / 15) * 100)}%</span>
                        </div>
                      </div>
                      
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <h5 className="font-medium text-gray-900 mb-2">Connectivity Score</h5>
                        <div className="flex items-center">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                            <div 
                              className="bg-green-500 h-2 rounded-full" 
                              style={{ width: `${Math.min(100, 100 - (Object.values(analysisResult.distances).reduce((avg, d) => avg + d.distance.value, 0) / Object.values(analysisResult.distances).length / 5000 * 100))}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">
                            {Math.round(Math.min(100, 100 - (Object.values(analysisResult.distances).reduce((avg, d) => avg + d.distance.value, 0) / Object.values(analysisResult.distances).length / 5000 * 100)))}%
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
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2">
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
                    <Button className="bg-purple-500 hover:bg-purple-600 text-white px-8 py-2">
                      Upgrade to Pro Plan - ₹199
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
                  <p className="text-sm text-gray-600 mt-1">AI-analyzed locations within 25km with superior investment potential</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {analysisResult.topInvestmentLocations.map((location, index) => (
                      <div key={index} className="border border-indigo-200 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 overflow-hidden">
                        {/* Location Header */}
                        <div className="p-4 bg-white bg-opacity-70 border-b border-indigo-100">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                                <span className="text-sm font-bold text-indigo-600">#{index + 1}</span>
                              </div>
                              <h4 className="font-semibold text-gray-900">{location.address}</h4>
                            </div>
                            <Badge variant="outline" className="text-xs border-indigo-300 text-indigo-700">
                              {location.distance}
                            </Badge>
                          </div>
                          
                          {/* Score and Metrics */}
                          <div className="grid grid-cols-3 gap-4 mt-4">
                            <div className="text-center">
                              <div className="text-lg font-bold text-indigo-600">{location.score.toFixed(0)}%</div>
                              <div className="text-xs text-gray-600">Investment Score</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-green-600">
                                {location.score >= 90 ? 'Excellent' : location.score >= 80 ? 'Very Good' : 'Good'}
                              </div>
                              <div className="text-xs text-gray-600">Rating</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-bold text-purple-600">
                                {location.score >= 85 ? 'High' : location.score >= 70 ? 'Medium' : 'Moderate'}
                              </div>
                              <div className="text-xs text-gray-600">Growth Potential</div>
                            </div>
                          </div>
                        </div>

                        {/* Location Image */}
                        {location.imageUrl && (
                          <div className="relative">
                            <img 
                              src={location.imageUrl} 
                              alt={`${location.address} location`} 
                              className="w-full h-40 object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) (fallback as any).style.display = 'flex';
                              }}
                            />
                            <div 
                              className="w-full h-40 bg-gradient-to-br from-indigo-100 via-purple-100 to-blue-100 flex items-center justify-center"
                              style={{ display: 'none' }}
                            >
                              <div className="text-center text-gray-600">
                                <MapPin className="h-12 w-12 mx-auto mb-2" />
                                <p className="text-sm font-medium">Alternative Investment Location</p>
                                <p className="text-xs">{location.address}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Analysis Details */}
                        <div className="p-4">
                          <h5 className="font-medium text-gray-900 mb-2">Investment Analysis</h5>
                          <p className="text-sm text-gray-700 mb-4 leading-relaxed">{location.reasoning}</p>
                          
                          {/* Investment Highlights */}
                          <div className="bg-white bg-opacity-60 rounded-lg p-3 mb-4">
                            <h6 className="font-medium text-gray-800 mb-2">Key Investment Highlights</h6>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                <span>Strategic Location</span>
                              </div>
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                                <span>Growth Infrastructure</span>
                              </div>
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                                <span>Market Demand</span>
                              </div>
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                                <span>Future Potential</span>
                              </div>
                            </div>
                          </div>

                          {/* Score Visualization */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Investment Potential</span>
                            <div className="flex items-center">
                              <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                                <div 
                                  className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-300" 
                                  style={{ width: `${location.score}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-semibold text-indigo-600">{location.score.toFixed(0)}%</span>
                            </div>
                          </div>
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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Plan Info */}
            <Card>
              <CardHeader>
                <CardTitle className="capitalize">{analysis.planType} Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Analysis Date:</span>
                    <span>{new Date(analysis.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Property Type:</span>
                    <span className="capitalize">{analysis.propertyType.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Investment Amount:</span>
                    <span>₹{analysis.amount.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Street View - Paid Plans Only */}
            {isPaidPlan && analysisResult.streetViewUrl && (
              <Card>
                <CardHeader>
                  <CardTitle>Street View</CardTitle>
                </CardHeader>
                <CardContent>
                  <img 
                    src={analysisResult.streetViewUrl} 
                    alt="Street View" 
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </CardContent>
              </Card>
            )}

            {/* Upgrade CTA for Free Plan */}
            {analysis.planType === 'free' && (
              <Card className="border-[#FF5A5F] border-2">
                <CardHeader>
                  <CardTitle className="text-[#FF5A5F]">Upgrade for More Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    Get detailed growth predictions, street view, and AI-powered investment recommendations.
                  </p>
                  <Link href="/">
                    <Button className="w-full bg-[#FF5A5F] hover:bg-[#e54852]">
                      Upgrade Now
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
