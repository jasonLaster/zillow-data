#!/usr/bin/env bun

import { program } from 'commander'
import { RockridgePropertyGenerator } from '../src/utils/openai-client.ts'
import { PropertyDataInserter } from '../src/utils/data-inserter.ts'
import type { GenerationProgress } from '../src/types/property.ts'

class DataGenerationOrchestrator {
  private totalProperties: number
  private batchSize: number
  private generator: RockridgePropertyGenerator
  private inserter: PropertyDataInserter
  private progress: GenerationProgress

  constructor(totalProperties: number = 1000, batchSize: number = 10) {
    this.totalProperties = totalProperties
    this.batchSize = batchSize
    this.generator = new RockridgePropertyGenerator()
    this.inserter = new PropertyDataInserter()
    
    // Ensure OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }

    this.progress = {
      totalRequested: totalProperties,
      totalGenerated: 0,
      totalInserted: 0,
      currentChunk: 0,
      totalChunks: 0,
      failedBatches: [],
      startTime: new Date(),
      elapsedTime: 0
    }
  }

  async generateAllData(): Promise<void> {
    console.log(`Starting generation of ${this.totalProperties} properties`)
    console.log(`Batch size: ${this.batchSize}`)

    // Check current database state
    const currentCount = await this.inserter.getPropertyCount()
    console.log(`Current properties in database: ${currentCount}`)

    if (currentCount > 0) {
      const response = prompt(`Database already contains ${currentCount} properties. Continue? (y/n): `)
      if (response?.toLowerCase() !== 'y') {
        console.log('Aborted by user')
        return
      }
    }

    // Create property generation requests
    console.log('Creating property generation requests...')
    const requests = this.generator.createPropertyRequests(this.totalProperties)

    // Process in chunks to manage memory and provide progress updates
    const chunkSize = 50 // Process 50 properties at a time
    this.progress.totalChunks = Math.ceil(requests.length / chunkSize)

    for (let chunkIdx = 0; chunkIdx < this.progress.totalChunks; chunkIdx++) {
      const startIdx = chunkIdx * chunkSize
      const endIdx = Math.min(startIdx + chunkSize, requests.length)
      const chunkRequests = requests.slice(startIdx, endIdx)

      this.progress.currentChunk = chunkIdx + 1
      console.log(`Processing chunk ${this.progress.currentChunk}/${this.progress.totalChunks} (${chunkRequests.length} properties)`)

      try {
        // Generate properties for this chunk
        const propertiesData = await this.generator.generatePropertyBatch(
          chunkRequests,
          this.batchSize
        )

        if (propertiesData.length === 0) {
          console.warn(`No data generated for chunk ${this.progress.currentChunk}`)
          continue
        }

        this.progress.totalGenerated += propertiesData.length

        // Save raw data for debugging
        await this.saveRawData(propertiesData, chunkIdx)

        // Insert into database
        const insertedCount = await this.inserter.insertProperties(propertiesData)
        this.progress.totalInserted += insertedCount

        console.log(`Chunk ${this.progress.currentChunk}: Inserted ${insertedCount}/${chunkRequests.length} properties`)
        console.log(`Total progress: ${this.progress.totalInserted}/${this.totalProperties} properties`)

        // Small delay between chunks
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error) {
        console.error(`Error processing chunk ${this.progress.currentChunk}:`, error)
        this.progress.failedBatches.push(this.progress.currentChunk)
        continue
      }
    }

    // Calculate final timing
    this.progress.elapsedTime = Date.now() - this.progress.startTime.getTime()

    // Final summary
    this.printFinalSummary()

    // Show sample of generated data
    await this.showSampleData()

    // Cleanup
    await this.inserter.disconnect()
  }

  private async saveRawData(propertiesData: any[], chunkIdx: number): Promise<void> {
    try {
      // Create output directory using Bun APIs
      await Bun.write(`data/raw_generated/chunk_${chunkIdx.toString().padStart(3, '0')}.json`, 
        JSON.stringify(propertiesData, null, 2))
    } catch (error) {
      console.warn('Failed to save raw data:', error)
    }
  }

  private printFinalSummary(): void {
    console.log('='.repeat(60))
    console.log('GENERATION COMPLETE')
    console.log('='.repeat(60))
    console.log(`Total properties requested: ${this.progress.totalRequested}`)
    console.log(`Total properties generated: ${this.progress.totalGenerated}`)
    console.log(`Total properties inserted: ${this.progress.totalInserted}`)
    console.log(`Success rate: ${((this.progress.totalInserted / this.progress.totalRequested) * 100).toFixed(1)}%`)
    console.log(`Elapsed time: ${(this.progress.elapsedTime / 1000 / 60).toFixed(1)} minutes`)

    if (this.progress.failedBatches.length > 0) {
      console.warn(`Failed chunks: ${this.progress.failedBatches.join(', ')}`)
    }
  }

  private async showSampleData(): Promise<void> {
    const sampleProperties = await this.inserter.getSampleProperties(5)
    console.log('Sample properties:')
    for (const prop of sampleProperties) {
      console.log(`  ${prop.zpid}: ${prop.address} - $${prop.price.toLocaleString()} (${prop.bedrooms}bd/${prop.bathrooms}ba)`)
    }
  }

  async validateGeneration(): Promise<void> {
    console.log('Validating generated data...')

    const validation = await this.inserter.validateGeneration()
    
    console.log(`Total properties in database: ${validation.totalProperties}`)

    if (!validation.isValid) {
      console.warn('Validation failed:')
      validation.errors.forEach(error => console.warn(`  - ${error}`))
      return
    }

    console.log('Validation results:')
    console.log(`  Total properties: ${validation.totalProperties}`)
    console.log(`  Sample size: ${validation.sampleSize}`)
    console.log(`  Price range: $${validation.priceRange[0].toLocaleString()} - $${validation.priceRange[1].toLocaleString()}`)
    console.log(`  Property types: ${validation.propertyTypes.join(', ')}`)
    console.log(`  Bedroom range: ${validation.bedroomRange[0]} - ${validation.bedroomRange[1]}`)

    await this.inserter.disconnect()
  }
}

// CLI setup
program
  .name('generate-listings')
  .description('Generate Zillow property data for Rockridge, CA')
  .option('-p, --properties <number>', 'Number of properties to generate', '100')
  .option('-b, --batch-size <number>', 'Properties per API call', '10')
  .option('--validate-only', 'Only validate existing data')

program.parse()

const options = program.opts()

async function main() {
  try {
    const orchestrator = new DataGenerationOrchestrator(
      parseInt(options.properties),
      parseInt(options.batchSize)
    )

    if (options.validateOnly) {
      await orchestrator.validateGeneration()
    } else {
      await orchestrator.generateAllData()
      await orchestrator.validateGeneration()
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main() 