const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// Get the name argument from the command line
const args = process.argv.slice(2);
let outputFileName = 'new';
let customName = 'New File';
let extractCsvFilePath = null;

// Function to display help instructions
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

// Parse arguments
args.forEach((arg, index) => {
  if (arg === '-h') {
    displayHelp();
    process.exit(0);
  }
  if (arg === '--name' && args[index + 1]) {
    customName = args[index + 1];
    outputFileName = customName.replace(/\s+/g, '_');
  }
  if (arg === '--extractcsv' && args[index + 1]) {
    extractCsvFilePath = args[index + 1];
  }
});

const inputDir = './AOFiles';
const templateFile = './template.xml';
const outputXmlDir = path.join('./output', 'xml');
const outputCsvDir = path.join('./output', 'csv');
const outputFile = path.join(outputXmlDir, `${outputFileName}.xml`);

// Utility to generate unique LumiverseId
let lumiverseIdCounter = 1;
const generateLumiverseId = () => lumiverseIdCounter++;

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
            dmxScreens.push(screen);
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

// Function to gather all DmxScreen elements from multiple files, ignoring duplicates by name
const gatherDmxScreens = async () => {
  const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.xml'));

  if (files.length === 0) {
    console.error('Error: No XML files found in the AOFiles directory.');
    process.exit(1); // Exit the script if no files are found
  }

  let allScreens = [];
  const existingScreenNames = new Set();
  for (const file of files) {
    const screens = await extractDmxScreens(path.join(inputDir, file), existingScreenNames);
    allScreens = allScreens.concat(screens);
  }
  return allScreens;
};

const generateNewXml = async (dmxScreens) => {
  // Check if output file already exists
  if (fs.existsSync(outputFile)) {
    console.error(`Error: Output file "${outputFile}" already exists. Please choose a different name.`);
    process.exit(1);
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
    console.log(`New XML generated at: ${outputFile}`);
  } catch (error) {
    console.error('Error reading the template file or writing the output file.', error);
    process.exit(1);
  }
};

// Function to extract pixel data and save as CSV
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
    const dmxScreens = await gatherDmxScreens();
    await generateNewXml(dmxScreens);
  }
};

runAOParser();