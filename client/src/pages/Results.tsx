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
  Crown
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
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-[#FF5A5F]">₹{analysis.amount.toLocaleString()}</div>
                <Badge variant="outline" className="mt-1 capitalize">
                  {analysis.propertyType.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </CardHeader>
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
            
            {/* Location Score - Free */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-blue-500" />
                  Location Score
                  <Badge variant="secondary" className="ml-2 bg-green-100 text-green-600">
                    Free
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  {renderStars(analysisResult.locationScore)}
                </div>
                <p className="text-gray-600 mb-4">
                  Excellent connectivity with key amenities within reasonable distance.
                </p>
                
                <div className="space-y-3">
                  {Object.entries(analysisResult.distances).slice(0, 3).map(([name, data]) => (
                    <div key={name} className="flex justify-between items-center">
                      <div className="flex items-center">
                        {getPlaceIcon(analysisResult.nearbyPlaces.find(p => p.name === name)?.types || [])}
                        <span className="ml-2 text-gray-700">{name}</span>
                      </div>
                      <span className="font-medium text-gray-900">{data.distance.text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Nearby Places - Free */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Home className="h-5 w-5 mr-2 text-gray-500" />
                  Nearby Places
                  <Badge variant="secondary" className="ml-2 bg-green-100 text-green-600">
                    Free
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysisResult.nearbyPlaces.slice(0, 5).map((place, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        {getPlaceIcon(place.types)}
                        <div className="ml-3">
                          <div className="font-medium text-gray-900">{place.name}</div>
                          <div className="text-sm text-gray-600">{place.vicinity}</div>
                        </div>
                      </div>
                      {place.rating && (
                        <div className="flex items-center">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                          <span className="text-sm font-medium">{place.rating}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {!isPaidPlan && analysisResult.nearbyPlaces.length > 5 && (
                  <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-700 text-center">
                      +{analysisResult.nearbyPlaces.length - 5} more places available with Paid Plan
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PAID CONTENT SECTION */}
            
            {/* Growth Potential */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
                    Growth Potential
                  </div>
                  {!isPaidPlan && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-600">
                      <Zap className="h-3 w-3 mr-1" />
                      Paid Feature
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isPaidPlan ? (
                  <>
                    <div className="text-center mb-4">
                      <span className="text-4xl font-bold text-green-600">+{analysisResult.growthPrediction}%</span>
                      <p className="text-gray-600">Expected appreciation in 3 years</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600">Current Value</span>
                        <span className="font-semibold">₹{analysis.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Projected Value</span>
                        <span className="font-semibold text-green-600">
                          ₹{Math.round(analysis.amount * (1 + analysisResult.growthPrediction / 100)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">Based on nearby developments and market trends</p>
                  </>
                ) : (
                  <div className="relative">
                    <div className="blur-sm pointer-events-none">
                      <div className="text-center mb-4">
                        <span className="text-4xl font-bold text-green-600">+██%</span>
                        <p className="text-gray-600">Expected appreciation in 3 years</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600">Current Value</span>
                          <span className="font-semibold">₹████████</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Projected Value</span>
                          <span className="font-semibold text-green-600">₹████████</span>
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-lg">
                      <div className="text-center">
                        <Lock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="font-semibold text-gray-900 mb-2">Unlock Growth Analysis</p>
                        <p className="text-sm text-gray-600 mb-4">Get detailed market predictions and investment returns</p>
                        <Button className="bg-orange-500 hover:bg-orange-600">
                          Upgrade to Paid - ₹99
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Brain className="h-5 w-5 mr-2 text-purple-500" />
                    AI Recommendations
                  </div>
                  {!isProPlan && (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-600">
                      <Crown className="h-3 w-3 mr-1" />
                      Pro Feature
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isProPlan && analysisResult.aiRecommendations ? (
                  <div className="space-y-4">
                    {analysisResult.aiRecommendations.map((recommendation, index) => (
                      <div key={index} className="bg-purple-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700">{recommendation}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="blur-sm pointer-events-none">
                      <div className="space-y-4">
                        <div className="bg-purple-50 rounded-lg p-4">
                          <p className="text-sm text-gray-700">████████ ██████ ████ ███████ ████████ ███ ██████ ██████ ████ ███ ████████.</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4">
                          <p className="text-sm text-gray-700">██████ ████████ ███ ████ ██████ ███████ ████ ██████ ████████ ███████.</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4">
                          <p className="text-sm text-gray-700">████████ ██████ ███ ████████ ██████ ████ ███████ ████ ██████.</p>
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-lg">
                      <div className="text-center">
                        <Crown className="h-12 w-12 text-purple-400 mx-auto mb-3" />
                        <p className="font-semibold text-gray-900 mb-2">Unlock AI Insights</p>
                        <p className="text-sm text-gray-600 mb-4">Get personalized investment recommendations powered by AI</p>
                        <Button className="bg-purple-500 hover:bg-purple-600">
                          Upgrade to Pro - ₹199
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
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
