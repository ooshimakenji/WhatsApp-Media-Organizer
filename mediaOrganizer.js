/**
 * WhatsApp Exported Media Organizer
 * 
 * This script processes ZIP files exported from WhatsApp and organizes media files
 * into folders based on captions or protocol numbers sent with the photos.
 * 
 * Features:
 * - Groups photos from the same sender in sequence
 * - Identifies numeric protocols as captions
 * - Organizes by date and caption/protocol
 * - Creates date_time nomenclature when no caption exists
 * 
 * Usage:
 * 1. Install dependency: npm install adm-zip
 * 2. Configure input and output folders below
 * 3. Run: node organizer.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');
const readline = require('readline');

// ==================== CONFIGURATION ====================
const INPUT_FOLDER = './to-process';
const OUTPUT_FOLDER = './organized-photos';
let HOURS = 24;
const MAX_PHOTO_INTERVAL = 5; // Minutes between photos in same group
// =======================================================

/**
 * Validates required folders exist
 */
function validateEnvironment() {
  if (!fs.existsSync(INPUT_FOLDER)) {
    console.error(`Error: Folder "${INPUT_FOLDER}" not found.`);
    console.log('Create the folder or adjust INPUT_FOLDER in the code.\n');
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_FOLDER)) {
    fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
    console.log(`Output folder created: ${OUTPUT_FOLDER}\n`);
  }
}

/**
 * Removes invalid characters from filenames
 */
function cleanName(text) {
  return text
    .replace(/[\/\\|*?"<>:]/g, '_')
    .replace(/[\u{1F600}-\u{1F6FF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100) || 'unnamed';
}

/**
 * Processes a ZIP file exported from WhatsApp
 */
function processZip(zipName) {
  console.log(`\nProcessing: ${zipName}`);
  
  const zipPath = path.join(INPUT_FOLDER, zipName);
  const tempDir = path.join(INPUT_FOLDER, 'temp_' + Date.now());
  
  try {
    new AdmZip(zipPath).extractAllTo(tempDir, true);
  } catch (error) {
    console.error(`Error extracting ZIP: ${error.message}`);
    return 0;
  }

  const allFiles = fs.readdirSync(tempDir);
  const mediaFiles = allFiles.filter(f => 
    /\.(jpg|jpeg|png|gif|webp|mp4|mov|avi)$/i.test(f)
  );

  console.log(`Media files found in ZIP: ${mediaFiles.length}`);

  const txtFiles = allFiles.filter(f => 
    f.endsWith('.txt') && !f.includes('README')
  );
  
  if (txtFiles.length === 0) {
    console.log('No conversation file found');
    fs.rmSync(tempDir, { recursive: true, force: true });
    return 0;
  }

  const txtPath = path.join(tempDir, txtFiles[0]);
  let content;
  
  try {
    content = fs.readFileSync(txtPath, 'utf8');
  } catch {
    content = fs.readFileSync(txtPath, 'latin1');
  }
  
  const lines = content.split(/\r?\n/);
  const now = Date.now();
  const timeLimit = now - (HOURS * 60 * 60 * 1000);

  console.log(`Total lines in file: ${lines.length}`);
  console.log(`Date limit: ${new Date(timeLimit).toLocaleString('en-US')}`);

  const messages = [];
  let processedLines = 0;

  // Process each line from conversation file
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (!line.trim()) continue;
    if (line.includes('end-to-end encrypted')) continue;
    if (line.includes('created group')) continue;

    // Extract message with date/time/sender
    const match = line.match(/^(\d{2}\/\d{2}\/\d{4})[,\s]+(\d{2}:\d{2})\s*-\s*([^:]+?):\s*(.*)$/);
    
    if (match) {
      const [, date, time, sender, messageContent] = match;
      
      let timestamp;
      try {
        const [day, month, year] = date.split('/');
        timestamp = new Date(`${year}-${month}-${day}T${time}:00`).getTime();
      } catch {
        continue;
      }

      if (isNaN(timestamp) || timestamp < timeLimit) continue;

      processedLines++;

      // Remove invisible Unicode characters
      const cleanContent = messageContent.replace(/[\u200E\u200F\u202A-\u202E]/g, '');

      const isMedia = cleanContent.includes('attached') && 
                      /\.(jpg|jpeg|png|gif|webp|mp4|mov)/i.test(cleanContent);

      if (isMedia) {
        const fileMatch = cleanContent.match(/([^\s]+\.(jpg|jpeg|png|gif|webp|mp4|mov))/i);
        if (fileMatch) {
          const fileName = fileMatch[1];
          const filePath = path.join(tempDir, fileName);
          
          if (fs.existsSync(filePath)) {
            messages.push({
              type: 'media',
              sender,
              timestamp,
              file: filePath,
              originalName: fileName
            });
          }
        }
      } else {
        const cleanText = messageContent.trim().replace(/[\u200E\u200F\u202A-\u202E]/g, '');
        if (cleanText.length > 0) {
          messages.push({
            type: 'text',
            sender,
            timestamp,
            text: cleanText
          });
        }
      }
    } else {
      // Line without date might be protocol
      const isolatedText = line.trim();
      if (/^\d{10}$/.test(isolatedText)) {
        messages.push({
          type: 'protocol',
          text: isolatedText
        });
      }
    }
  }

  console.log(`Lines processed in period: ${processedLines}`);
  console.log(`Media identified: ${messages.filter(m => m.type === 'media').length}`);
  console.log(`Protocols identified: ${messages.filter(m => m.type === 'protocol').length}`);

  // Group photos and identify captions
  let totalProcessed = 0;
  const groups = [];
  let currentGroup = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.type === 'media') {
      if (!currentGroup || 
          msg.sender !== currentGroup.sender ||
          (msg.timestamp - currentGroup.lastPhotoTs) / 60000 > MAX_PHOTO_INTERVAL) {
        
        if (currentGroup && currentGroup.photos.length > 0) {
          groups.push(currentGroup);
        }
        
        currentGroup = {
          sender: msg.sender,
          photos: [msg],
          lastPhotoTs: msg.timestamp,
          caption: null
        };
      } else {
        currentGroup.photos.push(msg);
        currentGroup.lastPhotoTs = msg.timestamp;
      }
    } else if ((msg.type === 'text' || msg.type === 'protocol') && currentGroup) {
      if (msg.type === 'protocol' || 
          (msg.sender === currentGroup.sender && !currentGroup.caption)) {
        currentGroup.caption = msg.text;
      }
    }
  }

  if (currentGroup && currentGroup.photos.length > 0) {
    groups.push(currentGroup);
  }

  console.log(`Groups formed: ${groups.length}`);

  // Save organized groups
  let withCaption = 0;
  let withDateTime = 0;
  
  groups.forEach(group => {
    let caption = group.caption;
    
    // Filter invalid captions
    if (caption && (caption.includes('deleted message') || 
                    caption.includes('.opus') || 
                    caption.includes('attached'))) {
      caption = null;
    }

    let folderName;
    let hasRealCaption = false;
    
    if (caption && /^2025\d+$/.test(caption)) {
      // Protocol starting with 2025
      folderName = caption;
      hasRealCaption = true;
      withCaption++;
    } else if (caption && caption.length > 3 && !/^\d+$/.test(caption)) {
      // Descriptive text
      folderName = cleanName(caption);
      hasRealCaption = true;
      withCaption++;
    } else {
      // No caption: use date_time
      const date = new Date(group.photos[0].timestamp);
      const dateFormatted = date.toISOString().slice(0, 10);
      const timeFormatted = date.toTimeString().slice(0, 5).replace(':', 'h');
      folderName = `${dateFormatted}_${timeFormatted}`;
      withDateTime++;
    }

    // Create folder structure and save files
    const photoDate = new Date(group.photos[0].timestamp);
    const dateStr = photoDate.toISOString().slice(0, 10);
    const finalFolder = path.join(OUTPUT_FOLDER, dateStr, folderName);
    fs.mkdirSync(finalFolder, { recursive: true });

    group.photos.forEach((photo, idx) => {
      const ext = path.extname(photo.originalName);
      const newName = group.photos.length > 1 
        ? `${folderName}_${idx + 1}${ext}`
        : `${folderName}${ext}`;
      
      fs.copyFileSync(photo.file, path.join(finalFolder, newName));
      totalProcessed++;
    });

    if (hasRealCaption) {
      console.log(`  ${group.sender} -> "${folderName}" (${group.photos.length} file(s))`);
    }
  });

  if (withCaption > 0) {
    console.log(`\nGroups with caption: ${withCaption}`);
  }
  if (withDateTime > 0) {
    console.log(`Groups organized by date/time: ${withDateTime}`);
  }

  // Remove temporary folder
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Warning: Could not clean temporary folder: ${error.message}`);
  }

  return totalProcessed;
}

/**
 * Main initialization function
 */
function startProcessing() {
  console.log('========================================');
  console.log('  WhatsApp Organizer - Version 1.0     ');
  console.log('========================================\n');

  validateEnvironment();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`How many hours back to process? (default ${HOURS}h): `, answer => {
    if (answer.trim() && !isNaN(answer)) {
      HOURS = parseInt(answer);
    }
    rl.close();

    console.log(`\nSearching for .zip files in: ${INPUT_FOLDER}`);
    console.log(`Processing last ${HOURS} hours\n`);
    
    const zips = fs.readdirSync(INPUT_FOLDER).filter(f => f.toLowerCase().endsWith('.zip'));
    
    if (zips.length === 0) {
      console.log('No .zip files found.');
      console.log('Place WhatsApp exports in the folder and run again.\n');
      return;
    }

    console.log(`Files found: ${zips.length}\n`);
    console.log('========================================');

    let totalFiles = 0;
    zips.forEach(zipName => {
      totalFiles += processZip(zipName);
    });

    console.log('\n========================================');
    console.log(`\nCompleted! ${totalFiles} file(s) organized.`);
    console.log(`Results in: ${path.resolve(OUTPUT_FOLDER)}\n`);

    // Open output folder (Windows)
    try {
      if (process.platform === 'win32') {
        execSync(`start "" "${path.resolve(OUTPUT_FOLDER)}"`);
      }
    } catch (error) {
      console.log('Open the folder manually to view results.');
    }
  });
}

// Execute the program
startProcessing();