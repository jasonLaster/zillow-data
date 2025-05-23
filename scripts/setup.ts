#!/usr/bin/env bun

import { spawn } from 'bun'
import { existsSync, mkdirSync } from 'fs'

async function runCommand(command: string, args: string[] = []): Promise<boolean> {
  try {
    const proc = spawn([command, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    
    const result = await proc.exited
    return result === 0
  } catch (error) {
    console.error(`Error running ${command}:`, error)
    return false
  }
}

function checkBunVersion(): boolean {
  try {
    const version = Bun.version
    console.log(`✓ Bun version: ${version}`)
    return true
  } catch {
    console.error('✗ Bun not found')
    return false
  }
}

function installDependencies(): Promise<boolean> {
  console.log('Installing dependencies...')
  return runCommand('bun', ['install'])
}

function createDirectories(): boolean {
  console.log('Creating directories...')
  const directories = [
    'data',
    'data/raw_generated',
    'data/analysis'
  ]
  
  try {
    directories.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
        console.log(`✓ Created ${dir}/`)
      } else {
        console.log(`✓ ${dir}/ already exists`)
      }
    })
    return true
  } catch (error) {
    console.error('✗ Error creating directories:', error)
    return false
  }
}

function checkOpenAIKey(): boolean {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.log('⚠ Warning: OPENAI_API_KEY environment variable not set')
    console.log('Set it with: export OPENAI_API_KEY=your_key_here')
    console.log('Or create a .env file with OPENAI_API_KEY=your_key_here')
    return false
  } else {
    console.log('✓ OpenAI API key found')
    return true
  }
}

async function initializeDatabase(): Promise<boolean> {
  console.log('Initializing database...')
  const generateResult = await runCommand('bunx', ['prisma', 'generate'])
  if (!generateResult) {
    console.error('✗ Error generating Prisma client')
    return false
  }
  
  const pushResult = await runCommand('bunx', ['prisma', 'db', 'push'])
  if (!pushResult) {
    console.error('✗ Error initializing database')
    return false
  }
  
  console.log('✓ Database initialized successfully')
  return true
}

async function runTest(): Promise<boolean> {
  console.log('Running test generation (requires OpenAI API key)...')
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠ Skipping test - no API key found')
    return true
  }
  
  const testResult = await runCommand('bun', ['run', 'scripts/test-small-batch.ts'])
  if (!testResult) {
    console.error('✗ Test failed')
    return false
  }
  
  console.log('✓ Test completed successfully')
  return true
}

function printUsageInstructions(): void {
  console.log('\n' + '='.repeat(60))
  console.log('SETUP COMPLETE!')
  console.log('='.repeat(60))
  console.log('\nNext steps:')
  console.log('1. Set your OpenAI API key:')
  console.log('   export OPENAI_API_KEY=your_key_here')
  console.log('\n2. Test with a small batch:')
  console.log('   bun run test')
  console.log('\n3. Generate full dataset (1000 properties):')
  console.log('   bun run generate --properties 1000')
  console.log('\n4. Analyze generated data:')
  console.log('   bun run analyze')
  console.log('\nOther useful commands:')
  console.log('   # Generate fewer properties for testing')
  console.log('   bun run generate --properties 50')
  console.log('\n   # Validate existing data')
  console.log('   bun run generate --validate-only')
  console.log('\n   # Open Prisma Studio to browse data')
  console.log('   bun run studio')
  console.log('\nFiles and directories:')
  console.log('   data/zillow_rockridge.db - Main database')
  console.log('   data/raw_generated/ - Raw API responses')
  console.log('   data/analysis/ - Analysis results')
}

async function main(): Promise<void> {
  console.log('Zillow Rockridge Data Generator Setup (TypeScript + Bun)')
  console.log('='.repeat(65))
  
  // Check Bun version
  if (!checkBunVersion()) {
    console.error('Please install Bun: https://bun.sh')
    process.exit(1)
  }
  
  // Install dependencies
  if (!await installDependencies()) {
    console.error('Failed to install dependencies')
    process.exit(1)
  }
  console.log('✓ Dependencies installed')
  
  // Create directories
  if (!createDirectories()) {
    process.exit(1)
  }
  
  // Initialize database
  if (!await initializeDatabase()) {
    process.exit(1)
  }
  
  // Check API key
  const apiKeyAvailable = checkOpenAIKey()
  
  // Run test if API key is available
  if (apiKeyAvailable) {
    const response = prompt('\nRun test generation? (y/n): ')
    if (response?.toLowerCase() === 'y') {
      await runTest()
    }
  }
  
  // Print usage instructions
  printUsageInstructions()
}

main().catch(error => {
  console.error('Setup failed:', error)
  process.exit(1)
}) 