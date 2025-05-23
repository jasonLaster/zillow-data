#!/usr/bin/env bun

import { PrismaClient } from '@prisma/client'

async function analyzeGeneratedData() {
  console.log('='.repeat(60))
  console.log('ZILLOW ROCKRIDGE DATA ANALYSIS')
  console.log('='.repeat(60))

  const prisma = new PrismaClient()

  try {
    // Get total count
    const totalProperties = await prisma.property.count()

    if (totalProperties === 0) {
      console.log('No properties found in database')
      console.log('Run "bun run generate" to generate data')
      return
    }

    console.log(`\nBASIC STATISTICS:`)
    console.log(`Total Properties: ${totalProperties.toLocaleString()}`)

    // Property types
    const propertyTypes = await prisma.property.groupBy({
      by: ['propertyType'],
      _count: { propertyType: true }
    })

    console.log(`\nPROPERTY TYPES:`)
    propertyTypes.forEach(type => {
      const percentage = (type._count.propertyType / totalProperties * 100).toFixed(1)
      console.log(`  ${type.propertyType}: ${type._count.propertyType.toLocaleString()} (${percentage}%)`)
    })

    // Price analysis
    const priceStats = await prisma.property.aggregate({
      _avg: { price: true, pricePerSqft: true },
      _min: { price: true },
      _max: { price: true }
    })

    console.log(`\nPRICE ANALYSIS:`)
    console.log(`  Average Price: $${Math.round(priceStats._avg.price || 0).toLocaleString()}`)
    console.log(`  Price Range: $${(priceStats._min.price || 0).toLocaleString()} - $${(priceStats._max.price || 0).toLocaleString()}`)
    console.log(`  Average Price/sqft: $${Math.round(priceStats._avg.pricePerSqft || 0)}`)

    // Property size analysis
    const sizeStats = await prisma.property.aggregate({
      _avg: { sqft: true },
      _min: { sqft: true },
      _max: { sqft: true }
    })

    console.log(`\nPROPERTY SIZE:`)
    console.log(`  Average Sqft: ${Math.round(sizeStats._avg.sqft || 0).toLocaleString()}`)
    console.log(`  Sqft Range: ${(sizeStats._min.sqft || 0).toLocaleString()} - ${(sizeStats._max.sqft || 0).toLocaleString()}`)

    // Bedroom distribution
    const bedroomDist = await prisma.property.groupBy({
      by: ['bedrooms'],
      _count: { bedrooms: true },
      orderBy: { bedrooms: 'asc' }
    })

    console.log(`\nBEDROOM DISTRIBUTION:`)
    bedroomDist.forEach(bedroom => {
      const percentage = (bedroom._count.bedrooms / totalProperties * 100).toFixed(1)
      console.log(`  ${bedroom.bedrooms} bedrooms: ${bedroom._count.bedrooms.toLocaleString()} (${percentage}%)`)
    })

    // Zip code distribution
    const zipDist = await prisma.property.groupBy({
      by: ['zipCode'],
      _count: { zipCode: true }
    })

    console.log(`\nZIP CODE DISTRIBUTION:`)
    zipDist.forEach(zip => {
      const percentage = (zip._count.zipCode / totalProperties * 100).toFixed(1)
      console.log(`  ${zip.zipCode}: ${zip._count.zipCode.toLocaleString()} (${percentage}%)`)
    })

    // Year built analysis
    const yearStats = await prisma.property.aggregate({
      _avg: { yearBuilt: true },
      _min: { yearBuilt: true },
      _max: { yearBuilt: true }
    })

    const currentYear = 2024
    const avgAge = currentYear - Math.round(yearStats._avg.yearBuilt || 0)
    const oldestAge = currentYear - (yearStats._min.yearBuilt || 0)
    const newestAge = currentYear - (yearStats._max.yearBuilt || 0)

    console.log(`\nAGE ANALYSIS:`)
    console.log(`  Average Age: ${avgAge} years`)
    console.log(`  Oldest Property: ${yearStats._min.yearBuilt} (${oldestAge} years old)`)
    console.log(`  Newest Property: ${yearStats._max.yearBuilt} (${newestAge} years old)`)

    // Transit scores (if available)
    const transitStats = await prisma.propertyFeatures.aggregate({
      _avg: { walkabilityScore: true, transitScore: true, bikeScore: true }
    })

    if (transitStats._avg.walkabilityScore) {
      console.log(`\nTRANSPORTATION SCORES:`)
      console.log(`  Average Walkability: ${Math.round(transitStats._avg.walkabilityScore || 0)}/100`)
      console.log(`  Average Transit Score: ${Math.round(transitStats._avg.transitScore || 0)}/100`)
      console.log(`  Average Bike Score: ${Math.round(transitStats._avg.bikeScore || 0)}/100`)
    }

    // Sample listings
    console.log(`\nSAMPLE LISTINGS:`)
    const sampleProps = await prisma.property.findMany({
      take: 5,
      include: { listing: true },
      orderBy: { createdAt: 'desc' }
    })

    sampleProps.forEach(prop => {
      console.log(`  ${prop.zpid}: ${prop.address}`)
      console.log(`    $${prop.price.toLocaleString()} • ${prop.bedrooms}bd/${prop.bathrooms}ba • ${prop.sqft.toLocaleString()} sqft • ${prop.propertyType}`)
      if (prop.listing?.description) {
        const description = prop.listing.description.length > 100 
          ? prop.listing.description.substring(0, 100) + '...'
          : prop.listing.description
        console.log(`    ${description}`)
      }
      console.log()
    })

    // Export summary
    const summary = {
      totalProperties,
      propertyTypes: propertyTypes.reduce((acc, type) => {
        acc[type.propertyType] = type._count.propertyType
        return acc
      }, {} as Record<string, number>),
      priceStats: {
        mean: Math.round(priceStats._avg.price || 0),
        min: priceStats._min.price || 0,
        max: priceStats._max.price || 0
      },
      bedroomDistribution: bedroomDist.reduce((acc, bedroom) => {
        acc[bedroom.bedrooms] = bedroom._count.bedrooms
        return acc
      }, {} as Record<number, number>),
      zipCodeDistribution: zipDist.reduce((acc, zip) => {
        acc[zip.zipCode] = zip._count.zipCode
        return acc
      }, {} as Record<string, number>),
      averageSqft: Math.round(sizeStats._avg.sqft || 0),
      averageAge: avgAge
    }

    // Save summary using Bun
    await Bun.write('data/analysis/summary.json', JSON.stringify(summary, null, 2))
    console.log('Analysis saved to data/analysis/summary.json')

  } catch (error) {
    console.error('Error analyzing data:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

analyzeGeneratedData().catch(console.error) 