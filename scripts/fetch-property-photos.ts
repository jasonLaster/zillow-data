#!/usr/bin/env bun

import { program } from 'commander'
import { PrismaClient } from '@prisma/client'

interface UnsplashPhoto {
  id: string
  urls: {
    raw: string
    full: string
    regular: string
    small: string
    thumb: string
  }
  alt_description: string | null
  description: string | null
  user: {
    name: string
    username: string
  }
  links: {
    download_location: string
  }
}

interface UnsplashResponse {
  results: UnsplashPhoto[]
  total: number
  total_pages: number
}

class PropertyPhotoFetcher {
  private prisma: PrismaClient
  private unsplashAccessKey: string
  private baseUrl = 'https://api.unsplash.com'
  
  // Room type to search term mapping for better photo results
  private roomSearchTerms: Record<string, string[]> = {
    'Living Room': ['modern living room', 'cozy living room', 'living room interior', 'family room'],
    'Kitchen': ['modern kitchen', 'gourmet kitchen', 'kitchen interior', 'luxury kitchen'],
    'Master Bedroom': ['master bedroom', 'luxury bedroom', 'bedroom interior', 'modern bedroom'],
    'Bedroom': ['bedroom interior', 'cozy bedroom', 'modern bedroom', 'guest bedroom'],
    'Bathroom': ['modern bathroom', 'luxury bathroom', 'spa bathroom', 'master bathroom'],
    'Dining Room': ['dining room', 'formal dining room', 'modern dining room', 'elegant dining room'],
    'Family Room': ['family room', 'cozy family room', 'living space', 'home interior'],
    'Office': ['home office', 'modern office', 'study room', 'workspace'],
    'Backyard': ['backyard', 'garden', 'outdoor space', 'patio'],
    'Yard': ['backyard garden', 'landscaping', 'outdoor patio', 'garden design'],
    'Exterior': ['house exterior', 'home exterior', 'modern house', 'craftsman house'],
    'Balcony': ['balcony', 'apartment balcony', 'outdoor balcony', 'city balcony'],
    'Patio': ['patio', 'outdoor patio', 'backyard patio', 'garden patio']
  }

  constructor(requireApiKey: boolean = true) {
    this.prisma = new PrismaClient()
    this.unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY || ''
    
    if (requireApiKey && !this.unsplashAccessKey) {
      throw new Error('UNSPLASH_ACCESS_KEY environment variable is required')
    }
  }

  async fetchPhotosForRoom(roomType: string, count: number = 5): Promise<UnsplashPhoto[]> {
    const searchTerms = this.roomSearchTerms[roomType] || [roomType.toLowerCase()]
    const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)]
    
    console.log(`🔍 Searching for "${randomTerm}" photos...`)
    
    try {
      const response = await fetch(
        `${this.baseUrl}/search/photos?query=${encodeURIComponent(randomTerm)}&per_page=${count}&orientation=landscape&order_by=relevant`,
        {
          headers: {
            'Authorization': `Client-ID ${this.unsplashAccessKey}`,
            'Accept-Version': 'v1'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Unsplash API error: ${response.status} ${response.statusText}`)
      }

      const data: UnsplashResponse = await response.json()
      return data.results
    } catch (error) {
      console.error(`❌ Failed to fetch photos for ${roomType}:`, error)
      return []
    }
  }

  async updatePropertyPhotos(dryRun: boolean = false): Promise<void> {
    console.log('🏠 Starting property photo update...')
    
    try {
      // Get all photos that need image URLs
      const photos = await this.prisma.propertyPhoto.findMany({
        where: {
          imageUrl: null // Only update photos without existing URLs
        },
        include: {
          property: {
            select: {
              zpid: true,
              address: true
            }
          }
        },
        orderBy: [
          { propertyId: 'asc' },
          { sortOrder: 'asc' }
        ]
      })

      console.log(`📸 Found ${photos.length} photos needing image URLs`)

      if (photos.length === 0) {
        console.log('✅ All photos already have image URLs!')
        return
      }

      // Group photos by room type for efficient fetching
      const photosByRoomType: Record<string, typeof photos> = {}
      for (const photo of photos) {
        const roomType = photo.roomType || 'Unknown'
        if (!photosByRoomType[roomType]) {
          photosByRoomType[roomType] = []
        }
        photosByRoomType[roomType].push(photo)
      }

      let totalUpdated = 0
      
      // Process each room type
      for (const [roomType, roomPhotos] of Object.entries(photosByRoomType)) {
        console.log(`\n🏡 Processing ${roomPhotos.length} ${roomType} photos...`)
        
        // Fetch enough photos for this room type
        const unsplashPhotos = await this.fetchPhotosForRoom(roomType, Math.min(roomPhotos.length * 2, 30))
        
        if (unsplashPhotos.length === 0) {
          console.warn(`⚠️  No photos found for ${roomType}`)
          continue
        }

        // Update photos with Unsplash URLs
        for (let i = 0; i < roomPhotos.length; i++) {
          const photo = roomPhotos[i]
          const unsplashPhoto = unsplashPhotos[i % unsplashPhotos.length] // Cycle through available photos
          
          const imageUrl = unsplashPhoto.urls.regular
          const imageAlt = unsplashPhoto.alt_description || photo.caption
          const photographerName = unsplashPhoto.user.name
          const photographerUsername = unsplashPhoto.user.username
          
          console.log(`  📷 ${photo.property.address} - ${roomType}: ${imageUrl}`)
          
          if (!dryRun) {
            await this.prisma.propertyPhoto.update({
              where: { id: photo.id },
              data: {
                imageUrl,
                imageAlt,
                photographerName,
                photographerUsername
              }
            })
            totalUpdated++
          }
          
          // Add small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      if (dryRun) {
        console.log(`\n✅ Dry run completed. Would update ${photos.length} photos.`)
      } else {
        console.log(`\n✅ Successfully updated ${totalUpdated} photos with image URLs!`)
      }

    } catch (error) {
      console.error('❌ Photo update failed:', error)
      throw error
    } finally {
      await this.prisma.$disconnect()
    }
  }

  async addMissingPhotos(photosPerProperty: number = 3): Promise<void> {
    console.log(`🏠 Adding missing photos (${photosPerProperty} per property)...`)
    
    try {
      // Get properties with fewer than desired photos
      const properties = await this.prisma.property.findMany({
        include: {
          photos: true
        }
      })

      const propertiesNeedingPhotos = properties.filter(p => p.photos.length < photosPerProperty)
      
      console.log(`📊 Found ${propertiesNeedingPhotos.length} properties needing more photos`)

      for (const property of propertiesNeedingPhotos) {
        const photosNeeded = photosPerProperty - property.photos.length
        console.log(`\n🏡 ${property.address} needs ${photosNeeded} more photos`)
        
        // Common room types for additional photos
        const additionalRoomTypes = ['Living Room', 'Kitchen', 'Bedroom', 'Bathroom', 'Exterior']
        
        for (let i = 0; i < photosNeeded; i++) {
          const roomType = additionalRoomTypes[i % additionalRoomTypes.length]
          const photos = await this.fetchPhotosForRoom(roomType, 1)
          
          if (photos.length > 0) {
            const unsplashPhoto = photos[0]
            const sortOrder = property.photos.length + i + 1
            
            await this.prisma.propertyPhoto.create({
              data: {
                propertyId: property.id,
                caption: `Beautiful ${roomType.toLowerCase()} with modern finishes`,
                roomType,
                isPrimary: false,
                sortOrder,
                imageUrl: unsplashPhoto.urls.regular,
                imageAlt: unsplashPhoto.alt_description || `${roomType} in ${property.address}`,
                photographerName: unsplashPhoto.user.name,
                photographerUsername: unsplashPhoto.user.username
              }
            })
            
            console.log(`  📷 Added ${roomType} photo`)
          }
          
          // Delay between requests
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }

      console.log('✅ Successfully added missing photos!')

    } catch (error) {
      console.error('❌ Failed to add missing photos:', error)
      throw error
    } finally {
      await this.prisma.$disconnect()
    }
  }

  async generatePhotoReport(): Promise<void> {
    console.log('📊 Generating photo report...')
    
    try {
      const stats = await this.prisma.propertyPhoto.groupBy({
        by: ['roomType'],
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        }
      })

      const withUrls = await this.prisma.propertyPhoto.count({
        where: {
          imageUrl: { not: null }
        }
      })

      const withoutUrls = await this.prisma.propertyPhoto.count({
        where: {
          imageUrl: null
        }
      })

      const total = await this.prisma.propertyPhoto.count()

      console.log('\n📈 Photo Statistics:')
      console.log(`   📸 Total photos: ${total}`)
      console.log(`   ✅ With image URLs: ${withUrls}`)
      console.log(`   ❌ Without image URLs: ${withoutUrls}`)
      console.log(`   📊 Completion rate: ${((withUrls / total) * 100).toFixed(1)}%`)

      console.log('\n🏠 Photos by room type:')
      for (const stat of stats) {
        console.log(`   ${stat.roomType}: ${stat._count.id}`)
      }

    } catch (error) {
      console.error('❌ Failed to generate report:', error)
      throw error
    } finally {
      await this.prisma.$disconnect()
    }
  }
}

// CLI setup
program
  .name('fetch-property-photos')
  .description('Fetch real property photos from Unsplash and update database')
  .option('--dry-run', 'Show what would be updated without making changes')
  .option('--add-missing <number>', 'Add missing photos to properties (specify photos per property)')
  .option('--report', 'Generate photo statistics report only')

program.parse()

const options = program.opts()

async function main() {
  try {
    // For reports, we don't need the API key
    const isReportOnly = options.report
    
    if (!isReportOnly && !process.env.UNSPLASH_ACCESS_KEY) {
      console.error('❌ Please set UNSPLASH_ACCESS_KEY environment variable')
      console.log('📝 Get your free API key at: https://unsplash.com/developers')
      process.exit(1)
    }

    const fetcher = new PropertyPhotoFetcher(!isReportOnly)
    
    if (options.report) {
      await fetcher.generatePhotoReport()
    } else if (options.addMissing) {
      const photosPerProperty = parseInt(options.addMissing)
      await fetcher.addMissingPhotos(photosPerProperty)
    } else {
      await fetcher.updatePropertyPhotos(options.dryRun)
    }

  } catch (error) {
    console.error('💥 Error:', error)
    process.exit(1)
  }
}

main() 