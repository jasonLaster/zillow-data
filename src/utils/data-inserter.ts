import { PrismaClient } from '@prisma/client'
import type { GeneratedProperty, ValidationResults } from '../types/property.ts'

export class PropertyDataInserter {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  async insertProperties(propertiesData: GeneratedProperty[]): Promise<number> {
    let insertedCount = 0

    for (const propData of propertiesData) {
      try {
        if (await this.insertSingleProperty(propData)) {
          insertedCount++
        }
      } catch (error) {
        console.error(`Error inserting property ${propData.zpid}:`, error)
        continue
      }
    }

    console.log(`Successfully inserted ${insertedCount} properties`)
    return insertedCount
  }

  private async insertSingleProperty(propData: GeneratedProperty): Promise<boolean> {
    try {
      // Validate required fields
      if (!this.validatePropertyData(propData)) {
        console.warn(`Skipping invalid property: ${propData.zpid}`)
        return false
      }

      // Check if property already exists
      const existing = await this.prisma.property.findUnique({
        where: { zpid: propData.zpid }
      })

      if (existing) {
        console.warn(`Property ${propData.zpid} already exists, skipping`)
        return false
      }

      // Create property with all related data in a transaction
      await this.prisma.$transaction(async (tx) => {
        // Create main property record
        const property = await tx.property.create({
          data: {
            zpid: propData.zpid,
            address: propData.address,
            city: 'Oakland',
            state: 'CA',
            zipCode: propData.zipCode,
            latitude: propData.latitude,
            longitude: propData.longitude,
            bedrooms: propData.bedrooms,
            bathrooms: propData.bathrooms,
            sqft: propData.sqft,
            lotSizeSqft: propData.lotSizeSqft,
            yearBuilt: propData.yearBuilt,
            propertyType: propData.propertyType,
            stories: propData.stories,
            garageSpaces: propData.garageSpaces,
            parkingSpaces: propData.parkingSpaces,
            price: propData.price,
            pricePerSqft: propData.pricePerSqft,
            hoaFee: propData.hoaFee,
            propertyTax: propData.propertyTax,
            status: propData.status || 'For Sale',
            listingType: propData.listingType || 'Resale'
          }
        })

        // Create listing record if data exists
        if (propData.listing) {
          await tx.listing.create({
            data: {
              propertyId: property.id,
              listDate: new Date(propData.listing.listDate),
              daysOnMarket: propData.listing.daysOnMarket || 0,
              description: propData.listing.description,
              keyFeatures: JSON.stringify(propData.listing.keyFeatures || []),
              agentName: propData.listing.agentName,
              agentPhone: propData.listing.agentPhone,
              agentEmail: propData.listing.agentEmail,
              brokerage: propData.listing.brokerage,
              openHouseDates: JSON.stringify(propData.listing.openHouseDates || []),
              tourAvailable: propData.listing.tourAvailable ?? true,
              virtualTourUrl: propData.listing.virtualTourUrl,
              originalPrice: propData.listing.originalPrice || propData.price,
              priceChanges: JSON.stringify(propData.listing.priceChanges || [])
            }
          })
        }

        // Create property features record if data exists
        if (propData.features) {
          await tx.propertyFeatures.create({
            data: {
              propertyId: property.id,
              flooringTypes: JSON.stringify(propData.features.flooringTypes || []),
              kitchenFeatures: JSON.stringify(propData.features.kitchenFeatures || []),
              bathroomFeatures: JSON.stringify(propData.features.bathroomFeatures || []),
              fireplace: propData.features.fireplace || false,
              fireplaceCount: propData.features.fireplaceCount || 0,
              laundryFeatures: propData.features.laundryFeatures,
              cooling: propData.features.cooling,
              heating: propData.features.heating,
              yardFeatures: JSON.stringify(propData.features.yardFeatures || []),
              pool: propData.features.pool || false,
              spa: propData.features.spa || false,
              garageType: propData.features.garageType,
              securityFeatures: JSON.stringify(propData.features.securityFeatures || []),
              accessibilityFeatures: JSON.stringify(propData.features.accessibilityFeatures || []),
              greenFeatures: JSON.stringify(propData.features.greenFeatures || []),
              schoolDistrict: propData.features.schoolDistrict || 'Oakland Unified School District',
              walkabilityScore: propData.features.walkabilityScore || 80,
              transitScore: propData.features.transitScore || 85,
              bikeScore: propData.features.bikeScore || 70
            }
          })
        }

        // Create property photo records if data exists
        if (propData.photos && propData.photos.length > 0) {
          for (let i = 0; i < propData.photos.length; i++) {
            const photo = propData.photos[i]
            await tx.propertyPhoto.create({
              data: {
                propertyId: property.id,
                photoUrl: `https://placeholder.com/property_${propData.zpid}_photo_${i + 1}.jpg`,
                caption: photo.caption,
                roomType: photo.roomType,
                isPrimary: photo.isPrimary ?? i === 0,
                sortOrder: photo.sortOrder ?? i
              }
            })
          }
        }
      })

      return true

    } catch (error) {
      console.error(`Error inserting property ${propData.zpid}:`, error)
      return false
    }
  }

  private validatePropertyData(propData: GeneratedProperty): boolean {
    // Check required fields
    const requiredFields = [
      'zpid', 'address', 'zipCode', 'latitude', 'longitude',
      'bedrooms', 'bathrooms', 'sqft', 'yearBuilt', 'propertyType', 'price'
    ]

    for (const field of requiredFields) {
      if (propData[field as keyof GeneratedProperty] == null) {
        console.warn(`Missing required field: ${field}`)
        return false
      }
    }

    // Validate data types and ranges
    try {
      if (propData.bedrooms <= 0 || !Number.isInteger(propData.bedrooms)) return false
      if (propData.bathrooms <= 0) return false
      if (propData.sqft <= 0 || !Number.isInteger(propData.sqft)) return false
      if (propData.price <= 0 || !Number.isInteger(propData.price)) return false
      if (propData.yearBuilt < 1800 || propData.yearBuilt > 2024) return false
      if (propData.latitude < 37.8 || propData.latitude > 37.9) return false
      if (propData.longitude < -122.3 || propData.longitude > -122.2) return false
    } catch {
      console.warn(`Invalid data values for property ${propData.zpid}`)
      return false
    }

    return true
  }

  async getPropertyCount(): Promise<number> {
    return await this.prisma.property.count()
  }

  async getSampleProperties(limit: number = 5): Promise<Array<{
    zpid: string
    address: string
    price: number
    bedrooms: number
    bathrooms: number
    sqft: number
    propertyType: string
  }>> {
    const properties = await this.prisma.property.findMany({
      take: limit,
      select: {
        zpid: true,
        address: true,
        price: true,
        bedrooms: true,
        bathrooms: true,
        sqft: true,
        propertyType: true
      }
    })

    return properties
  }

  async validateGeneration(): Promise<ValidationResults> {
    const totalProperties = await this.getPropertyCount()

    if (totalProperties === 0) {
      return {
        totalProperties: 0,
        sampleSize: 0,
        priceRange: [0, 0],
        propertyTypes: [],
        bedroomRange: [0, 0],
        isValid: false,
        errors: ['No properties found in database']
      }
    }

    // Get sample for validation
    const sampleProperties = await this.getSampleProperties(20)

    const prices = sampleProperties.map(p => p.price)
    const bedrooms = sampleProperties.map(p => p.bedrooms)
    const propertyTypes = [...new Set(sampleProperties.map(p => p.propertyType))]

    return {
      totalProperties,
      sampleSize: sampleProperties.length,
      priceRange: [Math.min(...prices), Math.max(...prices)],
      propertyTypes,
      bedroomRange: [Math.min(...bedrooms), Math.max(...bedrooms)],
      isValid: true,
      errors: []
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect()
  }
} 