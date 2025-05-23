import { z } from 'zod'

// Property generation request schema
export const PropertyGenerationRequestSchema = z.object({
  propertyType: z.enum(['single_family', 'condo', 'townhouse']),
  priceRange: z.tuple([z.number(), z.number()]),
  bedrooms: z.number().int().positive(),
  bathrooms: z.number().positive(),
  sqftRange: z.tuple([z.number(), z.number()]),
  yearBuiltRange: z.tuple([z.number(), z.number()]),
})

export type PropertyGenerationRequest = z.infer<typeof PropertyGenerationRequestSchema>

// Generated property data schema
export const GeneratedPropertySchema = z.object({
  zpid: z.string(),
  address: z.string(),
  zipCode: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  bedrooms: z.number().int(),
  bathrooms: z.number(),
  sqft: z.number().int(),
  lotSizeSqft: z.number().int().optional(),
  yearBuilt: z.number().int(),
  propertyType: z.string(),
  stories: z.number().int().optional(),
  garageSpaces: z.number().int().optional(),
  parkingSpaces: z.number().int().optional(),
  price: z.number().int(),
  pricePerSqft: z.number().optional(),
  hoaFee: z.number().int().optional(),
  propertyTax: z.number().int().optional(),
  status: z.string().default('For Sale'),
  listingType: z.string().optional(),
  listing: z.object({
    listDate: z.string(),
    daysOnMarket: z.number().int().optional(),
    description: z.string().optional(),
    keyFeatures: z.array(z.string()).optional(),
    agentName: z.string().optional(),
    agentPhone: z.string().optional(),
    agentEmail: z.string().optional(),
    brokerage: z.string().optional(),
    openHouseDates: z.array(z.string()).optional(),
    tourAvailable: z.boolean().optional(),
    virtualTourUrl: z.string().optional(),
    originalPrice: z.number().int().optional(),
    priceChanges: z.array(z.any()).optional(),
  }).optional(),
  features: z.object({
    flooringTypes: z.array(z.string()).optional(),
    kitchenFeatures: z.array(z.string()).optional(),
    bathroomFeatures: z.array(z.string()).optional(),
    fireplace: z.boolean().optional(),
    fireplaceCount: z.number().int().optional(),
    laundryFeatures: z.string().optional(),
    cooling: z.string().optional(),
    heating: z.string().optional(),
    yardFeatures: z.array(z.string()).optional(),
    pool: z.boolean().optional(),
    spa: z.boolean().optional(),
    garageType: z.string().optional(),
    securityFeatures: z.array(z.string()).optional(),
    accessibilityFeatures: z.array(z.string()).optional(),
    greenFeatures: z.array(z.string()).optional(),
    schoolDistrict: z.string().optional(),
    walkabilityScore: z.number().int().optional(),
    transitScore: z.number().int().optional(),
    bikeScore: z.number().int().optional(),
  }).optional(),
  photos: z.array(z.object({
    caption: z.string().optional(),
    roomType: z.string().optional(),
    isPrimary: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })).optional(),
})

export type GeneratedProperty = z.infer<typeof GeneratedPropertySchema>

// OpenAI API response schema
export const OpenAIPropertyResponseSchema = z.object({
  properties: z.array(GeneratedPropertySchema),
})

export type OpenAIPropertyResponse = z.infer<typeof OpenAIPropertyResponseSchema>

// Rockridge neighborhood context
export interface RockridgeContext {
  neighborhood: string
  city: string
  state: string
  zipCodes: string[]
  characteristics: string[]
  nearbyAmenities: string[]
  schoolDistrict: string
  typicalPriceRanges: {
    condo: [number, number]
    townhouse: [number, number]
    single_family: [number, number]
  }
}

// Property distribution for random generation
export interface PropertyTypeDistribution {
  type: 'single_family' | 'condo' | 'townhouse'
  weight: number
}

export interface BedroomDistribution {
  bedrooms: number
  weight: number
}

// Rate limiting configuration
export interface RateLimitConfig {
  maxRequestsPerMinute: number
  retryAttempts: number
  retryDelay: number
}

// Generation progress tracking
export interface GenerationProgress {
  totalRequested: number
  totalGenerated: number
  totalInserted: number
  currentChunk: number
  totalChunks: number
  failedBatches: number[]
  startTime: Date
  elapsedTime: number
}

// Database validation results
export interface ValidationResults {
  totalProperties: number
  sampleSize: number
  priceRange: [number, number]
  propertyTypes: string[]
  bedroomRange: [number, number]
  isValid: boolean
  errors: string[]
} 