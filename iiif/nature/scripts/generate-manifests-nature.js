import fs from 'fs/promises';
import path from 'path';

async function generateManifests() {
  try {
    // Define common URL patterns as variables
    const GITHUB_BASE_URL = "https://raw.githubusercontent.com/brogr/hmb-coins-data/refs/heads/main";
    const IIIF_BASE_URL = "https://philhist-vanuatu.philhist.unibas.ch/iiif/3";
    const MANIFEST_BASE_PATH = `${GITHUB_BASE_URL}/iiif/nature/manifests`;
    const IMAGE_BASE_PATH = `${IIIF_BASE_URL}/coins%2Fnature_on_coins%2F`;
    
    // Define file paths
    const TEMPLATE_PATH = "../manifests/_template-nature.json";
    const DATA_PATH = "../../../data/coins.json";
    const OUTPUT_DIR = "../manifests";

    // Create output directory if it doesn't exist
    try {
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      console.log(`Ensuring output directory exists: ${OUTPUT_DIR}`);
    } catch (err) {
      if (err.code !== 'EEXIST') {
        console.error(`Error creating output directory: ${err.message}`);
        throw err;
      }
    }

    // Read the template and data
    console.log(`Reading template from: ${TEMPLATE_PATH}`);
    console.log(`Reading data from: ${DATA_PATH}`);
    
    const templateData = JSON.parse(await fs.readFile(TEMPLATE_PATH, 'utf8'));
    const data = JSON.parse(await fs.readFile(DATA_PATH, 'utf8'));

    // Process each coin in the data
    let manifestCount = 0;
    
    // Filter to only include coins with image_selection and nature category
    const natureCoins = data.filter(coin => 
      coin.DSD_project_info && 
      coin.DSD_project_info.exhibition_category === "nature" && 
      coin.image_selection
    );
    
    console.log(`Found ${natureCoins.length} coins with nature category and image selection`);
    
    // Keep track of used IDs to avoid duplicates
    const usedIds = new Set();
    
    for (const [coinIndex, coin] of natureCoins.entries()) {
      manifestCount++;
      
      // Create a new manifest based on the template
      const manifest = JSON.parse(JSON.stringify(templateData));
      
      // Get the original_id from the coin data, or use a fallback
      let manifestId;
      if (coin.identifier && coin.identifier.original_id) {
        // Use the original_id as the manifest ID
        manifestId = String(coin.identifier.original_id);
      } else {
        // Fallback to a sequential number if original_id is not available
        manifestId = `seq_${String(coinIndex + 1).padStart(3, '0')}`;
      }
      
      // Handle duplicate IDs by adding a suffix
      let uniqueId = manifestId;
      let suffix = 1;
      while (usedIds.has(uniqueId)) {
        uniqueId = `${manifestId}_${suffix}`;
        suffix++;
      }
      usedIds.add(uniqueId);
      manifestId = uniqueId;
      
      // Update manifest ID
      manifest.id = `${MANIFEST_BASE_PATH}/${manifestId}.json`;
      
      // Get the title from coin_title
      const title = coin.coin_title?.title || "Unknown";
      
      // Apply the title to manifest label
      manifest.label = { de: [title] };
      
      // Initialize metadata array if it doesn't exist
      if (!manifest.metadata) {
        manifest.metadata = [];
      }
      
      // Create a new metadata array
      const newMetadata = [];
      
      // Function to add metadata from a property if it exists and is not empty
      const addMetadata = (label, value, prefix = "") => {
        if (value !== null && value !== undefined && String(value).trim() !== '') {
          // Format arrays as comma-separated strings
          let formattedValue = Array.isArray(value) ? value.join(", ") : String(value);
          
          newMetadata.push({
            "label": { "de": [prefix ? `${prefix} ${label}` : label] },
            "value": { "de": [formattedValue] }
          });
        }
      };
      
      // Add the standard metadata entries using the addMetadata function
      addMetadata("Urheber", "Digitales Schaudepot");
      addMetadata("Sammlung", "Nature on Coins");
      addMetadata("Titel", title);
      addMetadata("Beschreibung", coin.DSD_project_info?.description || "");
      addMetadata("Alternativer Titel", coin.coin_title?.alternative_title);
      
      // Add identifier information
      if (coin.identifier) {
        addMetadata("Original ID", coin.identifier.original_id);
      }
      
      // Add keywords
      if (coin.keywords && coin.keywords.length > 0) {
        addMetadata("Schlagwörter", coin.keywords);
      }
      
      // Add creation range information
      if (coin.creation_range) {
        addMetadata("Entstehungszeit", coin.creation_range.creation_period);
        addMetadata("EDTF Datum", coin.creation_range.EDTF_date);
        addMetadata("Datierungsart", coin.creation_range.date_label);
        addMetadata("Datierungsinfo", coin.creation_range.date_info);
        addMetadata("Datierungskommentar", coin.creation_range.date_comment);
      }
      
      // Add coin measurements
      if (coin.coin_measurements) {
        const weight = coin.coin_measurements.coin_weight;
        const weightUnit = coin.coin_measurements.weight_unit;
        if (weight !== null && weight !== undefined && weightUnit) {
          addMetadata("Gewicht", `${weight} ${weightUnit}`);
        }
        
        const diameter = coin.coin_measurements.coin_diameter;
        const diameterUnit = coin.coin_measurements.diameter_unit;
        if (diameter !== null && diameter !== undefined && diameterUnit) {
          addMetadata("Durchmesser", `${diameter} ${diameterUnit}`);
        }
      }
      
      // Add provenance
      addMetadata("Provenienz", coin.provenance);
      
      // Add inventory relations
      if (coin.inventory_relations) {
        addMetadata("Inventarnummer", coin.inventory_relations.inventory_number);
        
        // Handle person information if available
        if (coin.inventory_relations.person_name) {
          const personType = coin.inventory_relations.person_type;
          const personName = coin.inventory_relations.person_name;
          
          if (Array.isArray(personName) && Array.isArray(personType) && personName.length === personType.length) {
            // If we have matching arrays of person names and types
            for (let i = 0; i < personName.length; i++) {
              addMetadata(personType[i], personName[i], "Person");
            }
          } else {
            // Otherwise just add the person name
            addMetadata("Person", personName);
          }
        }
      }
      
      // Add location in museum
      if (coin.location_in_museum) {
        addMetadata("Standort", coin.location_in_museum.location_title);
        addMetadata("Standortgeschichte", coin.location_in_museum.location_history);
      }
      
      // Add documentation status
      addMetadata("Dokumentation vorhanden", coin.documentation_available ? "Ja" : "Nein");
      
      // Add collection info
      if (coin.collection_info) {
        addMetadata("Projekt-ID", coin.collection_info.project_identifier);
        addMetadata("Projektbezeichnung", coin.collection_info.project_label);
        addMetadata("Objektstatus", coin.collection_info.object_status);
      }
      
      // Add creation details
      if (coin.creation_details) {
        addMetadata("Material", coin.creation_details.material);
        addMetadata("Technik", coin.creation_details.technique);
        addMetadata("Stempelstellung", coin.creation_details.stamp_alignment);
        addMetadata("Entstehungsort", coin.creation_details.place_of_origin);
        addMetadata("Koordinaten", coin.creation_details.coordinates_to_origin);
        addMetadata("Inschrift", coin.creation_details.inscription);
      }
      
      // Add acquisition details
      if (coin.acquisition_details) {
        addMetadata("Erwerbungsart", coin.acquisition_details.acquisition_type);
        addMetadata("Erwerbungsdatum", coin.acquisition_details.acquisition_date);
        addMetadata("Erwerbungsvermerk", coin.acquisition_details.acquisition_remark);
        addMetadata("Erwerbungspreis", coin.acquisition_details.acquisition_price);
        addMetadata("Wertschätzung", coin.acquisition_details.value_estimate);
        addMetadata("Wertschätzungsbeschreibung", coin.acquisition_details.value_estimate_description);
      }
      
      // Add cultural-historical context
      addMetadata("Kulturhistorischer Kontext", coin["culture-historical_context"]);
      
      // Add published object description
      addMetadata("Veröffentlichte Objektbeschreibung", coin.published_object_description);
      
      // Add DSD project info tags
      if (coin.DSD_project_info) {
        addMetadata("Ausstellungskategorie", coin.DSD_project_info.exhibition_category);
        addMetadata("Tier-Tag", coin.DSD_project_info.animal_tag);
        addMetadata("Mythologie-Tag", coin.DSD_project_info.mythology_tag);
        addMetadata("Natur-Tag", coin.DSD_project_info.nature_tag);
      }
      
      // Replace the manifest metadata with our new metadata
      manifest.metadata = newMetadata;
      
      // Update items (canvases)
      if (manifest.items && manifest.items.length > 0) {
        // Get the front and back image filenames from image_selection
        const frontImage = coin.image_selection.image_front;
        const backImage = coin.image_selection.image_back;
        
        // Get the descriptions, prioritizing description_front and description_back
        // Only fall back to the description array if those are null
        const coinDesc = coin.coin_description || {};
        const descriptions = coinDesc.description || [];
        
        // For front description: use description_front if not null, otherwise use descriptions[0]
        let frontDescription = "";
        if (coinDesc.description_front !== null && coinDesc.description_front !== undefined) {
          frontDescription = coinDesc.description_front || "";
        } else if (descriptions.length > 0) {
          frontDescription = descriptions[0] || "";
        }
        
        // For back description: use description_back if not null, otherwise use descriptions[1]
        let backDescription = "";
        if (coinDesc.description_back !== null && coinDesc.description_back !== undefined) {
          backDescription = coinDesc.description_back || "";
        } else if (descriptions.length > 1) {
          backDescription = descriptions[1] || "";
        }
        
        // Canvas names to match the template
        const canvasNames = ['canvas-front', 'canvas-back'];
        const images = [frontImage, backImage];
        const canvasDescriptions = [frontDescription, backDescription];
        
        // For each canvas in the template, update with the corresponding image
        for (let i = 0; i < manifest.items.length && i < 2; i++) {
          const canvas = manifest.items[i];
          const canvasName = canvasNames[i];
          const imageSrc = images[i];
          const canvasDescription = canvasDescriptions[i];
          
          // Update canvas ID
          canvas.id = `${MANIFEST_BASE_PATH}/${manifestId}/${canvasName}`;
          
          // Use canvas-specific description if available, otherwise use default labels
          if (canvasDescription && canvasDescription.trim() !== '') {
            canvas.label = { de: [canvasDescription] };
          } else {
            // Fallback to generic labels if no specific description is available
            canvas.label = { de: [i === 0 ? "Vorderseite" : "Rückseite"] };
          }
          
          // Update canvas metadata with the canvas-specific description
          if (canvas.metadata && canvas.metadata.length > 0) {
            // Update existing metadata
            canvas.metadata[0].value = { de: [canvas.label.de[0]] };
          } else {
            // Create metadata if it doesn't exist
            canvas.metadata = [
              {
                "label": { "de": ["Beschreibung"] },
                "value": { "de": [canvas.label.de[0]] }
              }
            ];
          }
          
          // Update canvas items (annotation page and annotations)
          if (canvas.items && canvas.items.length > 0) {
            const annoPage = canvas.items[0];
            annoPage.id = `${MANIFEST_BASE_PATH}/${manifestId}/${canvasName}/annotation/page`;
            
            if (annoPage.items && annoPage.items.length > 0) {
              const annotation = annoPage.items[0];
              annotation.id = `${MANIFEST_BASE_PATH}/${manifestId}/${canvasName}/annotation/image`;
              
              // Update image body with URL encoded image source
              if (annotation.body && imageSrc) {
                // URL encode the image source
                const encodedImageSrc = encodeURIComponent(imageSrc);
                
                // Construct the image URL
                annotation.body.id = `${IMAGE_BASE_PATH}${encodedImageSrc}/full/max/0/default.jpg`;
                
                if (annotation.body.service && annotation.body.service.length > 0) {
                  annotation.body.service[0].id = `${IMAGE_BASE_PATH}${encodedImageSrc}`;
                }
              }
              
              annotation.target = canvas.id;
            }
          }
        }
      }
      
      // Write manifest to file
      const manifestPath = path.join(OUTPUT_DIR, `${manifestId}.json`);
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`Created manifest: ${manifestPath} with title: "${title}"`);
      console.log(`  Using original_id: ${manifestId} for manifest ID and filename`);
      console.log(`  Added ${manifest.metadata.length} metadata entries`);
      
      // Log the image URLs for verification
      if (coin.image_selection.image_front) {
        const encodedFrontImage = encodeURIComponent(coin.image_selection.image_front);
        console.log(`Front Image URL: ${IMAGE_BASE_PATH}${encodedFrontImage}/full/max/0/default.jpg`);
      }
      if (coin.image_selection.image_back) {
        const encodedBackImage = encodeURIComponent(coin.image_selection.image_back);
        console.log(`Back Image URL: ${IMAGE_BASE_PATH}${encodedBackImage}/full/max/0/default.jpg`);
      }
    }
    
    console.log(`Successfully generated ${manifestCount} manifests in the '${OUTPUT_DIR}' directory.`);
  } catch (error) {
    console.error('Error generating manifests:', error);
    process.exit(1);
  }
}

generateManifests();