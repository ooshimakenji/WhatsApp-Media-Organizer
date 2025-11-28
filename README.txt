# WhatsApp Media Organizer

Automated tool to organize media files exported from WhatsApp into folders based on captions or protocol numbers.

## Features

- Groups photos from the same sender sent in sequence
- Identifies numeric protocols as captions
- Organizes by date and caption/protocol
- Creates date_time nomenclature when no caption exists
- Processes only specified time range

## Installation
```bash
npm install adm-zip
```

## Configuration

Edit these constants in `organizer.js`:

- `INPUT_FOLDER`: Location of exported .zip files
- `OUTPUT_FOLDER`: Destination for organized media
- `HOURS`: Time period in hours to process
- `MAX_PHOTO_INTERVAL`: Maximum minutes between photos in same group

## Usage
```bash
node organizer.js
```

The program will ask how many hours back to process.

## How It Works

1. Reads WhatsApp exported .zip files
2. Identifies photo groups from same sender
3. Associates numeric protocols or text as captions
4. Organizes into folders by date and caption
5. When no caption exists, uses date_time as folder name

## Output Structure
```
organized-photos/
  2025-11-27/
    2025167453/
      2025167453_1.jpg
      2025167453_2.jpg
    2025-11-27_18h30/
      2025-11-27_18h30.jpg
```

## Requirements

- Node.js 14 or higher
- adm-zip library

## License

MIT