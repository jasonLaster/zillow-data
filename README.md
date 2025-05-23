# Zillow Data Generator for Rockridge, CA (TypeScript + Bun)

## Overview

This project uses OpenAI 4o to generate realistic synthetic property listings for the Rockridge neighborhood in Oakland, CA. Built with **TypeScript** and **Bun** for blazing-fast performance, it creates a comprehensive Zillow-like database schema and populates it with thousands of realistic property listings.

## 🎯 Project Goals

- Generate 1000+ realistic property listings for Rockridge, CA
- Create a comprehensive database schema matching Zillow's data structure
- Use OpenAI 4o for generating realistic property descriptions, features, and market data
- Implement efficient batch processing for large-scale data generation
- Ensure data quality with validation and geographic accuracy
- Leverage TypeScript for type safety and Bun for performance

## 🚀 Technology Stack

- **Runtime**: Bun (fast JavaScript runtime)
- **Language**: TypeScript (type-safe JavaScript)
- **Database**: SQLite with Prisma ORM
- **AI Generation**: OpenAI 4o API
- **Validation**: Zod for runtime type checking
- **CLI**: Commander.js for command-line interface

## 🏗️ Architecture

### Database Schema (Prisma)

- **Properties**: Core property information (address, price, bedrooms, bathrooms, sqft, etc.)
- **Listings**: Market-specific data (listing date, status, agent info, descriptions)
- **Property Features**: Detailed amenities and characteristics
- **Property Photos**: AI-generated photo descriptions and metadata
- **Neighborhoods**: Geographic and demographic information

### AI Generation Pipeline

- **Batch Processing**: 5 properties per API call for efficiency
- **Rate Limiting**: Built-in throttling (50 RPM default)
- **Type Safety**: Zod schemas for API response validation
- **Error Handling**: Graceful failure with detailed logging

## 💰 Cost Estimates

### OpenAI API Costs (GPT-4o)

- **Input tokens**: ~2,000 per batch of 5 properties
- **Output tokens**: ~3,000 per batch of 5 properties
- **Cost per 1M tokens**: $2.50 (input) + $10.00 (output)
- **Estimated cost for 1000 properties**: $15-25

### Processing Time

- **1000 properties**: 2-4 hours with rate limiting
- **API calls required**: ~200 calls (5 properties per call)
- **Database size**: ~50MB with full dataset

## 🛠️ Prerequisites

1. **Bun** (v1.0+): [Install Bun](https://bun.sh)
2. **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com)

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the project
git clone <your-repo-url>
cd zillow-data

# Run setup (installs deps, creates database, etc.)
bun run setup
```

### 2. Set OpenAI API Key

```bash
export OPENAI_API_KEY=your_openai_api_key_here
```

Or create a `.env` file:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Test Generation

```bash
# Test with 3 properties
bun run test
```

### 4. Generate Full Dataset

```bash
# Generate 1000 properties (recommended)
bun run generate --properties 1000

# Or start smaller for testing
bun run generate --properties 100
```

### 5. Analyze Results

```bash
bun run analyze
```

## 📋 Detailed Usage

### Available Scripts

```bash
# Setup project (one-time)
bun run setup

# Initialize/reset database
bun run init-db

# Generate properties
bun run generate [options]

# Test with small batch
bun run test

# Analyze generated data
bun run analyze

# Open Prisma Studio (database browser)
bun run studio

# Reset database
bun run reset-db
```

### Generation Options

```bash
# Basic generation
bun run generate --properties 500

# Adjust batch size (properties per API call)
bun run generate --properties 1000 --batch-size 3

# Validate existing data only
bun run generate --validate-only
```

## 🗄️ Database Schema Details

### Properties Table

```typescript
model Property {
  zpid         String   @unique
  address      String
  city         String   @default("Oakland")
  state        String   @default("CA")
  zipCode      String
  latitude     Float
  longitude    Float
  bedrooms     Int
  bathrooms    Float
  sqft         Int
  price        Int
  propertyType String
  // ... additional fields
}
```

### Type Safety with Zod

```typescript
export const GeneratedPropertySchema = z.object({
  zpid: z.string(),
  address: z.string(),
  zipCode: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  bedrooms: z.number().int(),
  bathrooms: z.number(),
  sqft: z.number().int(),
  price: z.number().int(),
  // ... fully typed schema
});
```

## 🎨 Generated Data Quality

### Rockridge-Specific Features

- **Authentic street names**: College Ave, Claremont Ave, Keith Ave, etc.
- **Realistic pricing**: $800K-$2.5M based on actual market data
- **Architectural styles**: Craftsman, Tudor, contemporary
- **Local amenities**: BART station, College Avenue shops, etc.
- **Proper geography**: Accurate lat/lng coordinates

### Property Distribution

- **70% Single Family Homes**: $1.4M-$2.5M, 1800-3500 sqft
- **20% Condos**: $800K-$1.2M, 900-1800 sqft
- **10% Townhouses**: $1.2M-$1.8M, 1400-2400 sqft

## 📊 Sample Output

```typescript
{
  "zpid": "12345678",
  "address": "1234 College Avenue, Oakland, CA 94618",
  "price": 1850000,
  "bedrooms": 4,
  "bathrooms": 3,
  "sqft": 2400,
  "propertyType": "single_family",
  "listing": {
    "description": "Stunning Craftsman home in the heart of Rockridge...",
    "agentName": "Sarah Chen",
    "brokerage": "Compass Real Estate",
    "keyFeatures": [
      "Hardwood floors throughout",
      "Updated gourmet kitchen",
      "Private garden patio"
    ]
  }
}
```

## 🛠️ Project Structure

```
zillow-data/
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── prisma/
│   └── schema.prisma         # Database schema
├── src/
│   ├── types/
│   │   └── property.ts       # TypeScript types & schemas
│   └── utils/
│       ├── openai-client.ts  # AI generation client
│       └── data-inserter.ts  # Database insertion utilities
├── scripts/
│   ├── setup.ts             # Project setup
│   ├── generate-listings.ts # Main generation script
│   ├── test-small-batch.ts  # Test script
│   └── analyze-data.ts      # Data analysis
└── data/
    ├── zillow_rockridge.db   # SQLite database
    ├── raw_generated/        # Raw API responses
    └── analysis/             # Analysis outputs
```

## 🔧 Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=your_key_here

# Optional (defaults shown)
DATABASE_URL="file:./data/zillow_rockridge.db"
```

### TypeScript Configuration

The project uses strict TypeScript settings with:

- ES2022 target
- Bun types included
- Strict type checking
- Path mapping for clean imports

### Customization

- **Property distributions**: Modify `RockridgePropertyGenerator.createPropertyRequests()`
- **Database schema**: Update `prisma/schema.prisma`
- **Type definitions**: Extend types in `src/types/property.ts`
- **Neighborhood context**: Customize `rockridgeContext` in OpenAI client

## 📈 Performance & Monitoring

### Bun Performance Benefits

- **~3x faster** startup than Node.js
- **Built-in TypeScript** support (no compilation step)
- **Native SQLite** performance
- **Efficient memory usage** for large datasets

### Monitoring

- **Real-time progress**: Batch completion tracking
- **Error recovery**: Continues on individual batch failures
- **Raw data persistence**: All API responses saved for debugging
- **Comprehensive logging**: Detailed generation and validation logs

## 🎯 Expected API Usage

For 1000 properties:

- **Total API calls**: ~200 calls (5 properties per call)
- **Rate limiting**: 50 calls per minute (conservative)
- **Processing time**: 2-4 hours
- **Total cost**: $15-25 (OpenAI GPT-4o pricing)

## 🚨 Important Notes

1. **Synthetic Data**: All generated data is fictional for development/testing
2. **Rate Limits**: Built-in throttling respects OpenAI API limits
3. **Type Safety**: Full TypeScript coverage prevents runtime errors
4. **Error Recovery**: Graceful handling of API failures
5. **Geographic Accuracy**: Uses real Rockridge boundaries and street names

## 🔍 Example Commands

```bash
# Quick test
bun run test

# Generate medium dataset
bun run generate --properties 250 --batch-size 5

# Generate large dataset with smaller batches (more reliable)
bun run generate --properties 1000 --batch-size 3

# Analyze and export data
bun run analyze

# Browse data in web interface
bun run studio

# Validate existing data without generating new
bun run generate --validate-only
```

## 📊 Data Analysis Features

The analysis script provides:

- **Property type distribution**
- **Price statistics and ranges**
- **Geographic distribution by zip code**
- **Property age analysis**
- **Transportation scores**
- **Sample listings with descriptions**
- **JSON export** for further analysis

## 🤝 Contributing

To extend this project:

1. **Add new neighborhoods**: Create similar generator classes
2. **Enhance validation**: Add property-specific validation rules
3. **Add visualizations**: Create charts/maps of generated data
4. **Web interface**: Build React/Next.js frontend for browsing
5. **Photo generation**: Integrate DALL-E for property images

## 📄 License

MIT License - see LICENSE file for details

---

**Ready to generate your Rockridge property dataset with TypeScript + Bun!** 🏠⚡
