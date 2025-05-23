#!/usr/bin/env bun

import { RockridgePropertyGenerator } from '../src/utils/openai-client.ts'
import { PropertyDataInserter } from '../src/utils/data-inserter.ts'

async function testSmallBatch() {
  console.log('Testing small batch generation...')

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY environment variable is required')
    console.log('Set it with: export OPENAI_API_KEY=your_key_here')
    return
  }

  // Create generator and inserter
  const generator = new RockridgePropertyGenerator(undefined, { maxRequestsPerMinute: 10 })
  const inserter = new PropertyDataInserter()

  try {
    // Generate requests for just 3 properties
    const requests = generator.createPropertyRequests(3)

    console.log(`Generated ${requests.length} property requests`)
    requests.forEach((req, i) => {
      console.log(`  ${i + 1}. ${req.propertyType}, ${req.bedrooms}bd/${req.bathrooms}ba, $${req.priceRange[0].toLocaleString()}-$${req.priceRange[1].toLocaleString()}`)
    })

    // Generate properties
    console.log('Calling OpenAI API...')
    const propertiesData = await generator.generatePropertyBatch(requests, 3)

    console.log(`Generated ${propertiesData.length} properties`)

    if (propertiesData.length > 0) {
      // Show first property details
      const firstProp = propertiesData[0]
      console.log('Sample generated property:')
      console.log(`  ZPID: ${firstProp.zpid}`)
      console.log(`  Address: ${firstProp.address}`)
      console.log(`  Price: $${firstProp.price.toLocaleString()}`)
      console.log(`  Bedrooms: ${firstProp.bedrooms}`)
      console.log(`  Bathrooms: ${firstProp.bathrooms}`)
      console.log(`  Sqft: ${firstProp.sqft.toLocaleString()}`)

      // Try to insert into database
      console.log('Inserting into database...')
      const insertedCount = await inserter.insertProperties(propertiesData)
      console.log(`Successfully inserted ${insertedCount} properties`)

      // Show database stats
      const totalCount = await inserter.getPropertyCount()
      console.log(`Total properties in database: ${totalCount}`)
    } else {
      console.warn('No properties were generated')
    }

  } catch (error) {
    console.error('Error during test:', error)
    throw error
  } finally {
    await inserter.disconnect()
  }
}

testSmallBatch().catch(console.error) 