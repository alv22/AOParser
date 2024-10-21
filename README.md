# AOParser
---

```
▄▄▄       ▒█████   ██▓███   ▄▄▄       ██▀███    ██████ ▓█████  ██▀███  
▒████▄    ▒██▒  ██▒▓██░  ██▒▒████▄    ▓██ ▒ ██▒▒██    ▒ ▓█   ▀ ▓██ ▒ ██▒
▒██  ▀█▄  ▒██░  ██▒▓██░ ██▓▒▒██  ▀█▄  ▓██ ░▄█ ▒░ ▓██▄   ▒███   ▓██ ░▄█ ▒
░██▄▄▄▄██ ▒██   ██░▒██▄█▓▒ ▒░██▄▄▄▄██ ▒██▀▀█▄    ▒   ██▒▒▓█  ▄ ▒██▀▀█▄  
 ▓█   ▓██▒░ ████▓▒░▒██▒ ░  ░ ▓█   ▓██▒░██▓ ▒██▒▒██████▒▒░▒████▒░██▓ ▒██▒
 ▒▒   ▓▒█░░ ▒░▒░▒░ ▒▓▒░ ░  ░ ▒▒   ▓▒█░░ ▒▓ ░▒▓░▒ ▒▓▒ ▒ ░░░ ▒░ ░░ ▒▓ ░▒▓░
  ▒   ▒▒ ░  ░ ▒ ▒░ ░▒ ░       ▒   ▒▒ ░  ░▒ ░ ▒░░ ░▒  ░ ░ ░ ░  ░  ░▒ ░ ▒░
  ░   ▒   ░ ░ ░ ▒  ░░         ░   ▒     ░░   ░ ░  ░  ░     ░     ░░   ░ 
      ░  ░    ░ ░                 ░  ░   ░           ░     ░  ░   ░     
``` 

**AOParser** is a Node.js program designed to parse Resolume Arena's Advanced Output `.xml` save files. It consolidates multiple files into a single output XML file and extracts LED mapping data into `.csv` files for each screen's pixel data.

## Usage
### 0. Install dependencies

```bash
npm install
```

### 1. Generate a consolidated XML file
To merge all .xml files in the ./AOFiles directory into a single output file, run the following command:

`node AOParser.js --name "Your Custom Name"`

This will create a consolidated XML file in ./output/xml/Your_Custom_Name.xml.

### 2. Extract LED maps to CSV files
To extract pixel data from an Advanced Output .xml file into .csv files, run:

`node AOParser.js --extractcsv "./path/to/yourfile.xml"`

This will generate CSV files for each DMX Lumiverse in yourfile.xml and save them in the ./output/csv/ directory.

### 3. Help Screen
To display the help screen with instructions, run:

`node AOParser.js`

### ### License
MIT License