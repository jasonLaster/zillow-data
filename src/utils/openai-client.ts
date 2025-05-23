import OpenAI from 'openai'
import type { 
  PropertyGenerationRequest,
  GeneratedProperty,
  RockridgeContext,
  PropertyTypeDistribution,
  BedroomDistribution,
  RateLimitConfig
} from '../types/property.ts'
import { OpenAIPropertyResponseSchema } from '../types/property.ts'

export class RockridgePropertyGenerator {
  private client: OpenAI
  private rateLimitConfig: RateLimitConfig
  private lastRequestTime: number = 0
  private requestCount: number = 0
  private resetTime: number = Date.now() + 60000 // Reset every minute
  
  private rockridgeContext: RockridgeContext = {
    neighborhood: 'Rockridge',
    city: 'Oakland',
    state: 'CA',
    zipCodes: ['94618', '94609'],
    characteristics: [
      'Tree-lined streets with Craftsman and Tudor homes',
      'Close to Berkeley border',
      'College Avenue shopping district',
      'BART accessible (Rockridge station)',
      'Hills with bay views',
      'Family-friendly neighborhood',
      'Mix of single-family homes and condos',
      'Active community with local shops and restaurants'
    ],
    nearbyAmenities: [
      'College Avenue shops and restaurants',
      'Rockridge BART station',
      'Claremont Avenue',
      'UC Berkeley campus',
      'Tilden Regional Park',
      "Dreyer's Grand Ice Cream factory",
      'Market Hall Foods',
      'Various cafes and boutiques'
    ],
    schoolDistrict: 'Oakland Unified School District',
    typicalPriceRanges: {
      condo: [800000, 1200000],
      townhouse: [1200000, 1800000],
      single_family: [1400000, 2500000]
    }
  }

  constructor(apiKey?: string, config?: Partial<RateLimitConfig>) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    })
    
    this.rateLimitConfig = {
      maxRequestsPerMinute: 50,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    }
  }

  async generatePropertyBatch(
    requests: PropertyGenerationRequest[],
    batchSize: number = 10
  ): Promise<GeneratedProperty[]> {
    const results: GeneratedProperty[] = []
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize)
      
      try {
        await this.enforceRateLimit()
        const batchResult = await this.generatePropertyBatchInternal(batch)
        results.push(...batchResult)
        
        console.log(`Generated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(requests.length / batchSize)}`)
      } catch (error) {
        console.error(`Error generating batch ${Math.floor(i / batchSize) + 1}:`, error)
        continue
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    return results
  }

  private async generatePropertyBatchInternal(
    requests: PropertyGenerationRequest[]
  ): Promise<GeneratedProperty[]> {
    const prompt = this.createBatchPrompt(requests)
    
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt()
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 8000
    })

    try {
      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No content in OpenAI response')
      }

      // Strip markdown code fences if present
      let jsonContent = content.trim()
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }

      const parsedData = JSON.parse(jsonContent)
      const validatedData = OpenAIPropertyResponseSchema.parse(parsedData)
      
      return validatedData.properties
    } catch (error) {
      console.error('Failed to parse OpenAI response:', error)
      console.error('Response content:', response.choices[0]?.message?.content)
      return []
    }
  }

  private getSystemPrompt(): string {
    return `
You are a real estate data specialist generating realistic property listings for the Rockridge neighborhood in Oakland, CA.

NEIGHBORHOOD CONTEXT:
${JSON.stringify(this.rockridgeContext, null, 2)}

Your task is to generate realistic property data that accurately reflects:
1. Rockridge's architectural styles (primarily Craftsman, Tudor, some contemporary)
2. Actual market prices for the area
3. Realistic square footage and lot sizes for the neighborhood
4. Authentic street names and locations within Rockridge
5. Appropriate amenities and features for properties in this price range
6. Realistic agent names and brokerages that operate in the Bay Area

IMPORTANT GUIDELINES:
- Use REAL street names from Rockridge (College Ave, Claremont Ave, Keith Ave, etc.)
- Generate realistic but not real addresses
- Prices should reflect current Rockridge market (very expensive)
- Include Bay Area-specific features (earthquake retrofitting, etc.)
- Use authentic local brokerage names (Compass, Coldwell Banker, etc.)
- Property descriptions should mention neighborhood-specific amenities
- All data should be internally consistent

OUTPUT FORMAT: Return valid JSON only, no additional text.
`
  }

  private createBatchPrompt(requests: PropertyGenerationRequest[]): string {
    const propertiesSpecs = requests.map((req, i) => ({
      property_id: i + 1,
      property_type: req.propertyType,
      price_range: req.priceRange,
      bedrooms: req.bedrooms,
      bathrooms: req.bathrooms,
      sqft_range: req.sqftRange,
      year_built_range: req.yearBuiltRange
    }))

    return `
Generate ${requests.length} realistic property listings for Rockridge, Oakland, CA based on these specifications:

${JSON.stringify(propertiesSpecs, null, 2)}

For each property, generate this COMPLETE data structure. Keep descriptions concise but compelling:

{
  "properties": [
    {
      "zpid": "string (8-digit unique ID)",
      "address": "string (realistic Rockridge street address)",
      "zipCode": "string (94618 or 94609)",
      "latitude": number,
      "longitude": number,
      "bedrooms": number,
      "bathrooms": number,
      "sqft": number,
      "lotSizeSqft": number,
      "yearBuilt": number,
      "propertyType": "string",
      "stories": number,
      "garageSpaces": number,
      "parkingSpaces": number,
      "price": number,
      "pricePerSqft": number,
      "hoaFee": number,
      "propertyTax": number,
      "status": "For Sale",
      "listingType": "string",
      "listing": {
        "listDate": "2024-05-22T10:00:00Z",
        "daysOnMarket": number,
        "description": "string (compelling 150-200 word property description)",
        "keyFeatures": ["list of 4-6 key selling points"],
        "agentName": "string",
        "agentPhone": "string",
        "agentEmail": "string",
        "brokerage": "string",
        "openHouseDates": ["2024-05-25T14:00:00Z", "2024-05-26T14:00:00Z"],
        "tourAvailable": true,
        "originalPrice": number,
        "priceChanges": []
      },
      "features": {
        "flooringTypes": ["array of 2-3 flooring types"],
        "kitchenFeatures": ["array of 2-3 kitchen features"],
        "bathroomFeatures": ["array of 2-3 bathroom features"],
        "fireplace": boolean,
        "fireplaceCount": number,
        "laundryFeatures": "string",
        "cooling": "string",
        "heating": "string",
        "yardFeatures": ["array of 2-3 yard features if applicable"],
        "pool": boolean,
        "spa": boolean,
        "garageType": "string",
        "securityFeatures": ["array if any, max 2"],
        "greenFeatures": ["array if any, max 2"],
        "schoolDistrict": "Oakland Unified School District",
        "walkabilityScore": number (70-95 for Rockridge),
        "transitScore": number (80-95 for Rockridge),
        "bikeScore": number (60-85 for Rockridge)
      },
      "photos": [
        {
          "caption": "string (concise description of room/area)",
          "roomType": "string",
          "isPrimary": boolean,
          "sortOrder": number
        }
      ]
    }
  ]
}

IMPORTANT: Return COMPLETE, valid JSON only. Ensure all brackets and braces are properly closed.
`
  }

  createPropertyRequests(totalProperties: number = 1000): PropertyGenerationRequest[] {
    const requests: PropertyGenerationRequest[] = []

    // Property type distribution for Rockridge
    const propertyTypes: PropertyTypeDistribution[] = [
      { type: 'single_family', weight: 0.7 }, // 70% single family
      { type: 'condo', weight: 0.2 },         // 20% condos
      { type: 'townhouse', weight: 0.1 }      // 10% townhouses
    ]

    // Bedroom distribution
    const bedroomDist: BedroomDistribution[] = [
      { bedrooms: 2, weight: 0.2 }, // 20% 2-bedroom
      { bedrooms: 3, weight: 0.4 }, // 40% 3-bedroom
      { bedrooms: 4, weight: 0.3 }, // 30% 4-bedroom
      { bedrooms: 5, weight: 0.1 }  // 10% 5-bedroom
    ]

    for (let i = 0; i < totalProperties; i++) {
      // Select property type using weighted random
      const propType = this.weightedRandom(propertyTypes).type
      
      // Select bedrooms using weighted random
      const bedrooms = this.weightedRandom(bedroomDist).bedrooms
      
      // Calculate bathrooms (typically 0.75-1.25 per bedroom)
      const bathrooms = Math.round((bedrooms * (0.75 + Math.random() * 0.5)) * 2) / 2
      
      // Set ranges based on property type
      let priceRange: [number, number]
      let sqftRange: [number, number]
      
      switch (propType) {
        case 'single_family':
          priceRange = [1400000, 2500000]
          sqftRange = [1800, 3500]
          break
        case 'condo':
          priceRange = [800000, 1200000]
          sqftRange = [900, 1800]
          break
        case 'townhouse':
          priceRange = [1200000, 1800000]
          sqftRange = [1400, 2400]
          break
        default:
          priceRange = [1000000, 2000000]
          sqftRange = [1200, 2800]
      }

      const yearBuiltRange: [number, number] = [1920, 2020] // Rockridge has mix of old and new

      requests.push({
        propertyType: propType,
        priceRange,
        bedrooms,
        bathrooms,
        sqftRange,
        yearBuiltRange
      })
    }

    return requests
  }

  private weightedRandom<T extends { weight: number }>(items: T[]): T {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
    let random = Math.random() * totalWeight
    
    for (const item of items) {
      random -= item.weight
      if (random <= 0) return item
    }
    
    return items[items.length - 1] // Fallback
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now()
    
    // Reset counter every minute
    if (now >= this.resetTime) {
      this.requestCount = 0
      this.resetTime = now + 60000
    }
    
    // Check if we've hit the rate limit
    if (this.requestCount >= this.rateLimitConfig.maxRequestsPerMinute) {
      const waitTime = this.resetTime - now
      console.log(`Rate limit reached. Waiting ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      
      // Reset after waiting
      this.requestCount = 0
      this.resetTime = Date.now() + 60000
    }
    
    // Ensure minimum delay between requests
    const timeSinceLastRequest = now - this.lastRequestTime
    const minDelay = 60000 / this.rateLimitConfig.maxRequestsPerMinute
    
    if (timeSinceLastRequest < minDelay) {
      await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastRequest))
    }
    
    this.requestCount++
    this.lastRequestTime = Date.now()
  }
} 