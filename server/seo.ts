
// SEO utilities and structured data generation
export interface SEOData {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl: string;
  structuredData?: any;
}

export const generateSEOTags = (data: SEOData): string => {
  const keywords = data.keywords.join(', ');
  
  return `
    <title>${data.title}</title>
    <meta name="description" content="${data.description}" />
    <meta name="keywords" content="${keywords}" />
    <link rel="canonical" href="${data.canonicalUrl}" />
    <meta property="og:title" content="${data.title}" />
    <meta property="og:description" content="${data.description}" />
    <meta property="og:url" content="${data.canonicalUrl}" />
    <meta name="twitter:title" content="${data.title}" />
    <meta name="twitter:description" content="${data.description}" />
  `;
};

export const generatePropertyAnalysisStructuredData = (analysis: any) => {
  return {
    "@context": "https://schema.org",
    "@type": "Report",
    "name": "Real Estate Investment Analysis Report",
    "description": `AI-powered property analysis for ${analysis.location?.address || 'property location'}`,
    "author": {
      "@type": "Organization",
      "name": "ValueNest AI"
    },
    "dateCreated": new Date().toISOString(),
    "about": {
      "@type": "RealEstateAgent",
      "name": "Property Investment Analysis",
      "description": "Comprehensive AI analysis including location intelligence, market trends, and investment recommendations"
    },
    "mainEntity": {
      "@type": "Place",
      "name": analysis.location?.address || "Property Location",
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": analysis.location?.lat,
        "longitude": analysis.location?.lng
      }
    }
  };
};

export const SEO_KEYWORDS = {
  primary: [
    "real estate AI",
    "property investment analysis", 
    "AI real estate tools",
    "location intelligence",
    "property valuation AI",
    "real estate analytics",
    "smart property investment",
    "real estate market analysis"
  ],
  secondary: [
    "property growth prediction",
    "real estate technology",
    "investment grade properties",
    "property analysis software",
    "real estate data analytics",
    "crime rate analysis",
    "property market insights",
    "AI investment recommendations",
    "real estate intelligence platform",
    "property investment intelligence"
  ],
  longTail: [
    "AI powered real estate investment analysis",
    "best real estate AI analysis tool",
    "property investment decision software",
    "real estate location intelligence platform",
    "AI real estate market predictions",
    "smart property investment analysis",
    "real estate investment risk assessment",
    "property value prediction AI",
    "real estate investment grade analysis",
    "AI property market intelligence"
  ]
};

export const PAGE_SEO_DATA = {
  home: {
    title: "ValueNest AI - #1 Real Estate Location Intelligence & Property Investment Analysis Tool",
    description: "Revolutionary AI-powered real estate location intelligence platform. Get instant property investment analysis, crime rate assessment, growth predictions, and market insights. Make smarter real estate decisions with our advanced AI technology.",
    keywords: [...SEO_KEYWORDS.primary, ...SEO_KEYWORDS.secondary.slice(0, 5)],
    canonicalUrl: "https://valuenest-ai.replit.app/"
  },
  analysis: {
    title: "AI Property Analysis - Real Estate Investment Intelligence | ValueNest AI",
    description: "Get comprehensive AI-powered property analysis with location intelligence, market trends, crime rates, and investment recommendations. Advanced real estate analytics for smart investment decisions.",
    keywords: ["property analysis AI", "real estate investment analysis", "location intelligence", "property valuation", "market analysis"],
    canonicalUrl: "https://valuenest-ai.replit.app/analysis"
  },
  results: {
    title: "Property Investment Analysis Results - AI Real Estate Intelligence | ValueNest AI", 
    description: "View your comprehensive AI-generated property investment analysis including location scores, growth predictions, market insights, and personalized investment recommendations.",
    keywords: ["investment analysis results", "property analysis report", "real estate AI insights", "investment recommendations", "property market report"],
    canonicalUrl: "https://valuenest-ai.replit.app/results"
  }
};
