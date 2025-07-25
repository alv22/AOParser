const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const readlineSync = require('readline-sync');

const args = process.argv.slice(2);
let outputFileName = 'new';
let customName = 'New File';
let extractCsvFilePath = null;

const displayHelp = () => {
  console.log(`
 ▄▄▄       ▒█████   ██▓███   ▄▄▄       ██▀███    ██████ ▓█████  ██▀███  
▒████▄    ▒██▒  ██▒▓██░  ██▒▒████▄    ▓██ ▒ ██▒▒██    ▒ ▓█   ▀ ▓██ ▒ ██▒
▒██  ▀█▄  ▒██░  ██▒▓██░ ██▓▒▒██  ▀█▄  ▓██ ░▄█ ▒░ ▓██▄   ▒███   ▓██ ░▄█ ▒
░██▄▄▄▄██ ▒██   ██░▒██▄█▓▒ ▒░██▄▄▄▄██ ▒██▀▀█▄    ▒   ██▒▒▓█  ▄ ▒██▀▀█▄  
 ▓█   ▓██▒░ ████▓▒░▒██▒ ░  ░ ▓█   ▓██▒░██▓ ▒██▒▒██████▒▒░▒████▒░██▓ ▒██▒
 ▒▒   ▓▒█░░ ▒░▒░▒░ ▒▓▒░ ░  ░ ▒▒   ▓▒█░░ ▒▓ ░▒▓░▒ ▒▓▒ ▒ ░░░ ▒░ ░░ ▒▓ ░▒▓░
  ▒   ▒▒ ░  ░ ▒ ▒░ ░▒ ░       ▒   ▒▒ ░  ░▒ ░ ▒░░ ░▒  ░ ░ ░ ░  ░  ░▒ ░ ▒░
  ░   ▒   ░ ░ ░ ▒  ░░         ░   ▒     ░░   ░ ░  ░  ░     ░     ░░   ░ 
      ░  ░    ░ ░                 ░  ░   ░           ░     ░  ░   ░     
                                                                        
Options:
  --name <filename>        Create a new XML file based on the template, and use <filename> for output and in the [NAME] placeholder.
  --extractcsv <filename>  Extract pixel data from the XML file and create CSV files for each DmxScreen.
  -h                       Show this help screen.

Examples:
  node AOParser.js --name "Kosmos Spacetime 2024"
  node AOParser.js --extractcsv "sample.xml"
`);
};

if (args.length === 0) {
  displayHelp();
  process.exit(0);
}

args.forEach((arg, index) => {
  if (arg === '-h') {
    displayHelp();
    process.exit(0);
  }
  if (arg === '--name' && args[index + 1]) {
    customName = args[index + 1];
    outputFileName = customName.replace(/\s+/g, '_');
  } else if (arg === '--extractcsv' && args[index + 1]) {
    extractCsvFilePath = args[index + 1];
  }
});

const inputDir = './AOFiles';
const templateFile = './template.xml';
const outputXmlDir = path.join('./output', 'xml');
const outputCsvDir = path.join('./output', 'csv');
const outputFile = path.join(outputXmlDir, `${outputFileName}.xml`);

// Generate a new unique, sequential LumiverseId for each lumiverse
let lumiverseIdCounter = 1;
const generateLumiverseId = () => lumiverseIdCounter++;

// Get fixture channel count based on width, height, and color format
const getFixtureChannelCount = (slice) => {
  let width = 1;
  let height = 1;
  let channelsPerPixel = 3; // Default for RGB/GRB
  
  if (slice.FixtureInstance && slice.FixtureInstance[0].Fixture) {
    const fixture = slice.FixtureInstance[0].Fixture[0];
    if (fixture.Params) {
      fixture.Params.forEach(params => {
        if (params.ParamFixturePixels) {
          params.ParamFixturePixels.forEach(pixelParams => {
            // Get width
            if (pixelParams.ParamRange) {
              pixelParams.ParamRange.forEach(param => {
                if (param.$ && param.$.name === 'Width' && param.$.value) {
                  width = parseInt(param.$.value);
                } else if (param.$ && param.$.name === 'Height' && param.$.value) {
                  height = parseInt(param.$.value);
                }
              });
            }
            // Get color format
            if (pixelParams.ParamChoice) {
              pixelParams.ParamChoice.forEach(param => {
                if (param.$ && param.$.name === 'Color Format' && param.$.value) {
                  const format = param.$.value.toLowerCase();
                  if (format === 'rgbw') {
                    channelsPerPixel = 4;
                  } else if (format === 'rgb' || format === 'grb' || format === 'bgr') {
                    channelsPerPixel = 3;
                  }
                }
              });
            }
          });
        }
      });
    }
  }
  
  return width * height * channelsPerPixel;
};

// Calculate total DMX channels used by a lumiverse
const calculateLumiverseChannels = (dmxScreen) => {
  let highestChannel = 0;
  let lastFixtureChannels = 0;
  
  if (dmxScreen.layers && dmxScreen.layers[0].DmxSlice) {
    dmxScreen.layers[0].DmxSlice.forEach(slice => {
      let startChannel = 0;
      if (slice.Params) {
        slice.Params.forEach(params => {
          if (params.$ && params.$.name === 'Input' && params.ParamRange) {
            params.ParamRange.forEach(param => {
              if (param.$ && param.$.name === 'Start Channel' && param.$.value) {
                startChannel = parseInt(param.$.value);
                if (startChannel > highestChannel) {
                  highestChannel = startChannel;
                  lastFixtureChannels = getFixtureChannelCount(slice);
                }
              }
            });
          }
        });
      }
    });
  }
  
  // Total = highest start channel + channels for the last fixture - 1
  return highestChannel > 0 ? highestChannel + lastFixtureChannels - 1 : 0;
};

// Update all pixel channels in a lumiverse based on new starting channel
const updatePixelChannels = (dmxScreen, newStartChannel) => {
  let currentChannel = newStartChannel;
  
  if (dmxScreen.layers && dmxScreen.layers[0].DmxSlice) {
    dmxScreen.layers[0].DmxSlice.forEach(slice => {
      if (slice.Params) {
        slice.Params.forEach(params => {
          if (params.$ && params.$.name === 'Input' && params.ParamRange) {
            params.ParamRange.forEach(param => {
              if (param.$ && param.$.name === 'Start Channel') {
                param.$.value = currentChannel.toString();
              }
            });
          }
        });
      }
      // Move to next fixture based on its actual channel count
      currentChannel += getFixtureChannelCount(slice);
    });
  }
  
  return currentChannel - 1; // Return the last channel used
};


// Interactive channel reassignment for selected screens
const reassignChannels = (selectedScreens) => {
  console.log('\n=== DMX Channel Assignment ===');
  console.log('Enter starting DMX channel for each lumiverse (or press Enter to accept default):\n');
  
  let suggestedStart = 1;
  
  selectedScreens.forEach((screen, index) => {
    // Calculate total channels by summing all fixture channel counts
    let totalChannels = 0;
    let fixtureDetails = [];
    
    if (screen.layers && screen.layers[0].DmxSlice) {
      screen.layers[0].DmxSlice.forEach(slice => {
        const channelCount = getFixtureChannelCount(slice);
        totalChannels += channelCount;
        
        // Get fixture dimensions for display
        let width = 1, height = 1;
        if (slice.FixtureInstance && slice.FixtureInstance[0].Fixture) {
          const fixture = slice.FixtureInstance[0].Fixture[0];
          if (fixture.Params) {
            fixture.Params.forEach(params => {
              if (params.ParamFixturePixels) {
                params.ParamFixturePixels.forEach(pixelParams => {
                  if (pixelParams.ParamRange) {
                    pixelParams.ParamRange.forEach(param => {
                      if (param.$ && param.$.name === 'Width' && param.$.value) {
                        width = parseInt(param.$.value);
                      } else if (param.$ && param.$.name === 'Height' && param.$.value) {
                        height = parseInt(param.$.value);
                      }
                    });
                  }
                });
              }
            });
          }
        }
        
        // Add to fixture details if not 1x1
        if (width > 1 || height > 1) {
          fixtureDetails.push(`${width}x${height}`);
        }
      });
    }
    
    const fixtureCount = screen.layers && screen.layers[0].DmxSlice ? screen.layers[0].DmxSlice.length : 0;
    const currentStartChannel = getFirstPixelStartChannel(screen);
    
    console.log(`${index + 1}. ${screen.$.name}`);
    console.log(`   Fixtures: ${fixtureCount} (${totalChannels} channels total)`);
    if (fixtureDetails.length > 0) {
      const uniqueSizes = [...new Set(fixtureDetails)];
      console.log(`   Fixture sizes: ${uniqueSizes.join(', ')}`);
    }
    console.log(`   Current starting channel: ${currentStartChannel}`);
    
    let validInput = false;
    let newStart;
    
    while (!validInput) {
      const input = readlineSync.question(`   New starting channel [${suggestedStart}]: `).trim();
      
      if (input === '') {
        // User pressed Enter, use suggested value
        newStart = suggestedStart;
        validInput = true;
      } else {
        newStart = parseInt(input);
        if (!isNaN(newStart) && newStart > 0 && newStart <= 131072) {
          validInput = true;
        } else {
          console.log('   Invalid input. Please enter a number between 1 and 131072.');
        }
      }
    }
    
    // Update all pixel channels in this lumiverse
    updatePixelChannels(screen, newStart);
    console.log(`   ✓ Updated to channels ${newStart}-${newStart + totalChannels - 1}\n`);
    
    // Calculate next suggested start for the next lumiverse
    suggestedStart = newStart + totalChannels;
  });
  
  console.log('Channel assignment complete.\n');
  return selectedScreens;
};

// Helper function to get the first pixel's start channel
const getFirstPixelStartChannel = (dmxScreen) => {
  let firstChannel = 0;
  
  if (dmxScreen.layers && dmxScreen.layers[0].DmxSlice && dmxScreen.layers[0].DmxSlice.length > 0) {
    const firstSlice = dmxScreen.layers[0].DmxSlice[0];
    if (firstSlice.Params) {
      firstSlice.Params.forEach(params => {
        if (params.$ && params.$.name === 'Input' && params.ParamRange) {
          params.ParamRange.forEach(param => {
            if (param.$ && param.$.name === 'Start Channel' && param.$.value) {
              firstChannel = parseInt(param.$.value);
            }
          });
        }
      });
    }
  }
  
  return firstChannel;
};

// Function to extract DmxScreen elements and check for duplicates
const extractDmxScreens = async (filePath, existingScreenNames) => {
  try {
    const xmlData = fs.readFileSync(filePath, 'utf-8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlData);

    // Find <DmxScreen> elements in the parsed object
    const dmxScreens = [];
    if (result.XmlState && result.XmlState.ScreenSetup && result.XmlState.ScreenSetup[0].screens) {
      const screens = result.XmlState.ScreenSetup[0].screens[0];
      if (screens.DmxScreen) {
        screens.DmxScreen.forEach(screen => {
          const screenName = screen.$.name;
          if (!existingScreenNames.has(screenName)) {
            screen.$.LumiverseId = generateLumiverseId().toString();
            dmxScreens.push({
              screen: screen,
              name: screenName,
              sourceFile: path.basename(filePath)
            });
            // Track the screen name to avoid duplicates
            existingScreenNames.add(screenName);
          }
        });
      }
    }
    return dmxScreens;
  } catch (error) {
    console.error(`Error reading or processing file: ${filePath}`, error);
    process.exit(1);
  }
};

// Gather all DmxScreen elements from multiple files, ignoring duplicates by name
const gatherDmxScreens = async () => {
  const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.xml'));

  if (files.length === 0) {
    console.error('Error: No XML files found in the AOFiles directory.');
    process.exit(1);
  }

  let allScreens = [];
  const existingScreenNames = new Set();
  for (const file of files) {
    const screens = await extractDmxScreens(path.join(inputDir, file), existingScreenNames);
    allScreens = allScreens.concat(screens);
  }
  return allScreens;
};

// Interactive CLI function to select fixtures
const selectFixtures = (allScreens) => {
  console.log('\n=== LED Fixture Selection ===');
  console.log(`Found ${allScreens.length} unique fixtures:\n`);
  
  // Display all available fixtures with numbers
  allScreens.forEach((screenData, index) => {
    console.log(`${index + 1}. ${screenData.name} (from ${screenData.sourceFile})`);
  });
  
  console.log('\nSelection options:');
  console.log('- Enter numbers separated by commas (e.g., 1,3,5)');
  console.log('- Enter ranges with dashes (e.g., 1-4,7,9-11)');
  console.log('- Enter "all" to select all fixtures');
  console.log('- Enter "none" to select no fixtures');
  
  const input = readlineSync.question('\nSelect fixtures: ').trim();
  
  if (input.toLowerCase() === 'all') {
    return allScreens.map(screenData => screenData.screen);
  }
  
  if (input.toLowerCase() === 'none') {
    return [];
  }
  
  // Parse selection input
  const selectedIndices = new Set();
  const parts = input.split(',').map(part => part.trim());
  
  for (const part of parts) {
    if (part.includes('-')) {
      // Handle ranges like "1-4"
      const [start, end] = part.split('-').map(num => parseInt(num.trim()) - 1);
      if (!isNaN(start) && !isNaN(end) && start >= 0 && end < allScreens.length && start <= end) {
        for (let i = start; i <= end; i++) {
          selectedIndices.add(i);
        }
      } else {
        console.log(`Invalid range: ${part}`);
      }
    } else {
      // Handle single numbers
      const index = parseInt(part) - 1;
      if (!isNaN(index) && index >= 0 && index < allScreens.length) {
        selectedIndices.add(index);
      } else {
        console.log(`Invalid selection: ${part}`);
      }
    }
  }
  
  const selectedScreens = Array.from(selectedIndices).map(index => allScreens[index].screen);
  
  console.log(`\nSelected ${selectedScreens.length} fixtures for output.`);
  if (selectedScreens.length > 0) {
    console.log('Selected fixtures:');
    Array.from(selectedIndices).forEach(index => {
      console.log(`- ${allScreens[index].name}`);
    });
  }
  
  return selectedScreens;
};

const generateNewXml = async (dmxScreens) => {
  if (fs.existsSync(outputFile)) {
    console.error(`Error: Output file "${outputFile}" already exists. Please choose a different name.`);
    process.exit(1);
  }

  if (dmxScreens.length === 0) {
    console.log('No fixtures selected. Skipping XML generation.');
    return;
  }

  try {
    // Read template.xml
    let templateContent = fs.readFileSync(templateFile, 'utf-8');

    // Convert DmxScreen objects back to XML format
    const builder = new xml2js.Builder();
    const screensXml = dmxScreens.map(screen => builder.buildObject({
      DmxScreen: screen
    })).join('\n');

    // Replace placeholders in the template
    let newXmlContent = templateContent.replace('[SCREENS]', screensXml);
    newXmlContent = newXmlContent.replace('[NAME]', customName);

    // Write the new XML content to output/<customName>.xml
    if (!fs.existsSync(outputXmlDir)) {
      fs.mkdirSync(outputXmlDir, {
        recursive: true
      });
    }
    fs.writeFileSync(outputFile, newXmlContent, 'utf-8');
    console.log(`\nNew XML generated at: ${outputFile}`);
  } catch (error) {
    console.error('Error reading the template file or writing the output file.', error);
    process.exit(1);
  }
};

// Extract pixel data and save as CSV
const extractPixelsToCsv = async (filePath) => {
  try {
    const xmlData = fs.readFileSync(filePath, 'utf-8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlData);

    // Ensure output directory for CSV files exists
    if (!fs.existsSync(outputCsvDir)) {
      fs.mkdirSync(outputCsvDir, {
        recursive: true
      });
    }

    // Process DmxScreen elements
    if (result.XmlState && result.XmlState.ScreenSetup && result.XmlState.ScreenSetup[0].screens) {
      const screens = result.XmlState.ScreenSetup[0].screens[0].DmxScreen;

      screens.forEach(screen => {
        const screenName = screen.$.name;
        const csvFilePath = path.join(outputCsvDir, `${screenName}.csv`);
        const csvStream = fs.createWriteStream(csvFilePath);
        // CSV header
        csvStream.write('x, y\n');

        if (screen.layers && screen.layers[0].DmxSlice) {
          screen.layers[0].DmxSlice.forEach(slice => {
            if (slice.InputRect && slice.InputRect[0].v) {
              const corners = slice.InputRect[0].v;
              if (corners.length === 4) {
                // Get the four corner coordinates
                const xCoords = corners.map(corner => parseFloat(corner.$.x));
                const yCoords = corners.map(corner => parseFloat(corner.$.y));

                // Calculate the center by averaging the coordinates
                const centerX = Math.round((xCoords.reduce((a, b) => a + b, 0)) / 4);
                const centerY = Math.round((yCoords.reduce((a, b) => a + b, 0)) / 4);

                csvStream.write(`${centerX}, ${centerY}\n`);
              }
            }
          });
        }
        csvStream.end();
        console.log(`CSV generated for DmxScreen "${screenName}" at: ${csvFilePath}`);
      });
    } else {
      console.error(`Error: No valid <DmxScreen> elements found in ${filePath}.`);
    }
  } catch (error) {
    console.error(`Error reading or processing file: ${filePath}`, error);
    process.exit(1);
  }
};

const runAOParser = async () => {
  if (extractCsvFilePath) {
    await extractPixelsToCsv(extractCsvFilePath);
  } else {
    const allScreens = await gatherDmxScreens();
    let selectedScreens = selectFixtures(allScreens);
    
    // Always reassign channels if fixtures were selected
    if (selectedScreens.length > 0) {
      selectedScreens = reassignChannels(selectedScreens);
    }
    
    await generateNewXml(selectedScreens);
  }
};

runAOParser();