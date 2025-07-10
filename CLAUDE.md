# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AOParser is a Node.js command-line tool for processing Resolume Arena's Advanced Output XML files. It performs two main functions:
1. Consolidates multiple XML files from `./AOFiles` into a single merged XML output using a template
2. Extracts LED pixel mapping data from XML files into CSV format

## Key Commands

Run the application:
```bash
node AOParser.js
```

Install dependencies:
```bash
npm install
```

Generate consolidated XML from AOFiles directory:
```bash
node AOParser.js --name "Custom Name"
```

Extract pixel data to CSV files:
```bash
node AOParser.js --extractcsv "path/to/file.xml"
```

## Architecture

- **Main Entry Point**: `AOParser.js` - Single-file CLI application
- **Input Directory**: `./AOFiles/` - Contains source XML files to be merged
- **Template**: `template.xml` - Base XML structure with `[NAME]` and `[SCREENS]` placeholders
- **Output Directories**: 
  - `./output/xml/` - Generated consolidated XML files
  - `./output/csv/` - Extracted pixel mapping CSV files

## Core Processing Logic

The tool uses xml2js for XML parsing/building and implements:
- Duplicate screen detection by name across multiple input files
- Sequential LumiverseId generation for unique screen identification
- Pixel coordinate extraction from DmxSlice InputRect corner data (averaged to center points)
- Template-based XML generation with placeholder replacement

## Dependencies

- `xml2js`: XML parsing and building functionality

## LED Pixel and Lumiverse Specification

### XML Structure Overview
- **Root**: `XmlState` with name attribute
- **Version Info**: Contains Resolume Arena version details
- **ScreenSetup**: Main container for all screen configurations
  - **screens**: Collection of DmxScreen elements (lumiverses)

### Lumiverse (DmxScreen) Structure
Each `DmxScreen` represents a single LED artwork/lumiverse with:
- **name**: Screen identifier (e.g., "kolmio2", "kolmio6")
- **uniqueId**: Unique numerical identifier
- **LumiverseId**: Sequential ID for the lumiverse (e.g., "8", "13")
- **layers**: Collection of DmxSlice elements (individual pixels/fixtures)

### LED Pixel (DmxSlice) Structure
Each `DmxSlice` represents a single LED pixel with:
- **Name**: Descriptive name (e.g., "1 - 3 Ledi", "4 - 6 Ledi")
- **Start Channel**: DMX channel number where this pixel begins
  - Value ranges from 1 to 131072
  - Each pixel uses 3 channels (RGB)
- **InputRect**: Physical position coordinates with 4 vertices (v elements)
  - Contains x,y coordinates defining pixel's physical location
  - Has orientation attribute (rotation in radians)
- **FixtureInstance**: Contains fixture configuration
  - **Width/Height**: Always 1x1 for single pixels
  - **Color Format**: "grb" or "rgb"
  - **Gamma**: Color correction value (default 2.5)

### DMX Channel Allocation
- Each pixel consumes 3 DMX channels (one per color)
- Start channels in example: 1, 4, 7, 10, 13, 16, 19, 22, 25...
- Pattern: Sequential allocation with 3-channel increments

### Key Requirements for Channel Management
When chaining multiple lumiverses:
1. **First Lumiverse**: Can start at channel 1
2. **Subsequent Lumiverses**: Must start at next available channel after previous lumiverse ends
3. **Channel Calculation**: 
   - Last pixel's start channel + 3 = Next available channel
   - Example: If last pixel starts at channel 97, next lumiverse should start at 100

### Modification Requirements
The program should:
1. Parse all lumiverses and their pixels
2. Calculate total channels used per lumiverse
3. Prompt user for each lumiverse's starting channel
4. Validate no channel overlaps occur
5. Update all pixel start channels within each lumiverse based on new base channel
6. Maintain 3-channel increments between pixels