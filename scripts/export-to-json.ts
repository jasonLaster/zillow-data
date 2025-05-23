#!/usr/bin/env bun

import { program } from 'commander'
import { PrismaClient } from '@prisma/client'
import { dirname } from 'node:path'

interface ExportedProperty {
  // Basic property info
  zpid: string
  address: string
  zipCode: string
  latitude: number
  longitude: number
  bedrooms: number
  bathrooms: number
  sqft: number
  lotSizeSqft: number | null
  yearBuilt: number
  propertyType: string
  stories: number | null
  garageSpaces: number | null
  parkingSpaces: number | null
  price: number
  pricePerSqft: number
  hoaFee: number | null
  propertyTax: number | null
  status: string
  listingType: string
  
  // Related data
  listing: any
  features: any
  photos: any[]
}

class SQLiteToJSONExporter {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  async exportAllData(outputPath: string): Promise<void> {
    console.log('🔄 Starting data export from SQLite to JSON...')
    
    try {
      // Get total count
      const totalCount = await this.prisma.property.count()
      console.log(`📊 Found ${totalCount} properties to export`)

      if (totalCount === 0) {
        console.log('❌ No properties found in database')
        return
      }

      // Fetch all properties with related data
      console.log('📥 Fetching property data...')
      const properties = await this.prisma.property.findMany({
        include: {
          listing: true,
          features: true,
          photos: {
            orderBy: {
              sortOrder: 'asc'
            }
          }
        }
      })

      // Transform to export format
      console.log('🔄 Transforming data...')
      const exportData: ExportedProperty[] = properties.map(property => ({
        // Basic property info
        zpid: property.zpid,
        address: property.address,
        zipCode: property.zipCode,
        latitude: property.latitude,
        longitude: property.longitude,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        sqft: property.sqft,
        lotSizeSqft: property.lotSizeSqft,
        yearBuilt: property.yearBuilt,
        propertyType: property.propertyType,
        stories: property.stories,
        garageSpaces: property.garageSpaces,
        parkingSpaces: property.parkingSpaces,
        price: property.price,
        pricePerSqft: property.pricePerSqft,
        hoaFee: property.hoaFee,
        propertyTax: property.propertyTax,
        status: property.status,
        listingType: property.listingType,
        
        // Related data
        listing: property.listing ? {
          listDate: property.listing.listDate,
          daysOnMarket: property.listing.daysOnMarket,
          description: property.listing.description,
          keyFeatures: property.listing.keyFeatures,
          agentName: property.listing.agentName,
          agentPhone: property.listing.agentPhone,
          agentEmail: property.listing.agentEmail,
          brokerage: property.listing.brokerage,
          openHouseDates: property.listing.openHouseDates,
          tourAvailable: property.listing.tourAvailable,
          originalPrice: property.listing.originalPrice,
          priceChanges: property.listing.priceChanges
        } : null,
        
        features: property.features ? {
          flooringTypes: property.features.flooringTypes,
          kitchenFeatures: property.features.kitchenFeatures,
          bathroomFeatures: property.features.bathroomFeatures,
          fireplace: property.features.fireplace,
          fireplaceCount: property.features.fireplaceCount,
          laundryFeatures: property.features.laundryFeatures,
          cooling: property.features.cooling,
          heating: property.features.heating,
          yardFeatures: property.features.yardFeatures,
          pool: property.features.pool,
          spa: property.features.spa,
          garageType: property.features.garageType,
          securityFeatures: property.features.securityFeatures,
          greenFeatures: property.features.greenFeatures,
          schoolDistrict: property.features.schoolDistrict,
          walkabilityScore: property.features.walkabilityScore,
          transitScore: property.features.transitScore,
          bikeScore: property.features.bikeScore
        } : null,
        
        photos: property.photos.map(photo => ({
          caption: photo.caption,
          roomType: photo.roomType,
          isPrimary: photo.isPrimary,
          sortOrder: photo.sortOrder
        }))
      }))

      // Create export metadata
      const exportMetadata = {
        exportDate: new Date().toISOString(),
        totalProperties: exportData.length,
        priceRange: {
          min: Math.min(...exportData.map(p => p.price)),
          max: Math.max(...exportData.map(p => p.price))
        },
        propertyTypes: [...new Set(exportData.map(p => p.propertyType))],
        bedroomRange: {
          min: Math.min(...exportData.map(p => p.bedrooms)),
          max: Math.max(...exportData.map(p => p.bedrooms))
        },
        avgPricePerSqft: Math.round(exportData.reduce((sum, p) => sum + p.pricePerSqft, 0) / exportData.length),
        zipCodes: [...new Set(exportData.map(p => p.zipCode))]
      }

      // Create final export object
      const finalExport = {
        metadata: exportMetadata,
        properties: exportData
      }

      // Write to file
      console.log(`💾 Writing data to ${outputPath}...`)
      await Bun.write(outputPath, JSON.stringify(finalExport, null, 2))

      // Success summary
      console.log('✅ Export completed successfully!')
      console.log('📈 Export Summary:')
      console.log(`   📁 File: ${outputPath}`)
      console.log(`   🏠 Properties: ${exportMetadata.totalProperties}`)
      console.log(`   💰 Price range: $${exportMetadata.priceRange.min.toLocaleString()} - $${exportMetadata.priceRange.max.toLocaleString()}`)
      console.log(`   🏘️  Property types: ${exportMetadata.propertyTypes.join(', ')}`)
      console.log(`   🛏️  Bedrooms: ${exportMetadata.bedroomRange.min} - ${exportMetadata.bedroomRange.max}`)
      console.log(`   📍 ZIP codes: ${exportMetadata.zipCodes.join(', ')}`)

      // File size
      const fileStats = await Bun.file(outputPath).size
      const fileSizeMB = (fileStats / (1024 * 1024)).toFixed(2)
      console.log(`   📊 File size: ${fileSizeMB} MB`)

    } catch (error) {
      console.error('❌ Export failed:', error)
      throw error
    } finally {
      await this.prisma.$disconnect()
    }
  }

  async exportSample(outputPath: string, sampleSize: number = 10): Promise<void> {
    console.log(`🔄 Exporting sample of ${sampleSize} properties...`)
    
    try {
      const properties = await this.prisma.property.findMany({
        take: sampleSize,
        include: {
          listing: true,
          features: true,
          photos: {
            orderBy: {
              sortOrder: 'asc'
            }
          }
        }
      })

      const exportData = properties.map(property => ({
        zpid: property.zpid,
        address: property.address,
        price: property.price,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        sqft: property.sqft,
        propertyType: property.propertyType,
        listing: property.listing,
        features: property.features,
        photos: property.photos
      }))

      await Bun.write(outputPath, JSON.stringify(exportData, null, 2))
      console.log(`✅ Sample export completed: ${outputPath}`)

    } catch (error) {
      console.error('❌ Sample export failed:', error)
      throw error
    } finally {
      await this.prisma.$disconnect()
    }
  }

  async validateDatabase(): Promise<void> {
    console.log('🔍 Validating database structure...')

    try {
      const counts = {
        properties: await this.prisma.property.count(),
        listings: await this.prisma.listing.count(),
        features: await this.prisma.propertyFeatures.count(),
        photos: await this.prisma.propertyPhoto.count()
      }

      console.log('📊 Database Statistics:')
      console.log(`   🏠 Properties: ${counts.properties}`)
      console.log(`   📋 Listings: ${counts.listings}`)
      console.log(`   🏗️ Features: ${counts.features}`)
      console.log(`   📸 Photos: ${counts.photos}`)

      // Check for orphaned records
      const propertiesWithoutListings = await this.prisma.property.count({
        where: { listing: null }
      })

      const propertiesWithoutFeatures = await this.prisma.property.count({
        where: { features: null }
      })

      if (propertiesWithoutListings > 0) {
        console.warn(`⚠️  ${propertiesWithoutListings} properties missing listings`)
      }

      if (propertiesWithoutFeatures > 0) {
        console.warn(`⚠️  ${propertiesWithoutFeatures} properties missing features`)
      }

      if (propertiesWithoutListings === 0 && propertiesWithoutFeatures === 0) {
        console.log('✅ Database structure looks good!')
      }

    } catch (error) {
      console.error('❌ Database validation failed:', error)
      throw error
    } finally {
      await this.prisma.$disconnect()
    }
  }
}

// CLI setup
program
  .name('export-to-json')
  .description('Export property data from SQLite to JSON')
  .option('-o, --output <path>', 'Output JSON file path', 'data/export/properties.json')
  .option('-s, --sample <number>', 'Export only a sample of N properties')
  .option('--validate', 'Validate database structure only')

program.parse()

const options = program.opts()

async function main() {
  try {
    const exporter = new SQLiteToJSONExporter()
    
    if (options.validate) {
      await exporter.validateDatabase()
      return
    }

    // Ensure output directory exists
    const outputDir = dirname(options.output)
    if (!await Bun.file(outputDir).exists()) {
      console.log(`📁 Creating output directory: ${outputDir}`)
      await Bun.spawn(['mkdir', '-p', outputDir]).exited
    }

    if (options.sample) {
      const sampleSize = parseInt(options.sample)
      await exporter.exportSample(options.output, sampleSize)
    } else {
      await exporter.exportAllData(options.output)
    }

  } catch (error) {
    console.error('💥 Error:', error)
    process.exit(1)
  }
}

main() 