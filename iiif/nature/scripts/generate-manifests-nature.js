import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import edtf from "edtf";

async function generateManifests() {
	try {
		// Define common URL patterns as variables
		const GITHUB_BASE_URL =
			"https://raw.githubusercontent.com/brogr/hmb-coins-data/refs/heads/main";
		const IIIF_BASE_URL = "https://philhist-vanuatu.philhist.unibas.ch/iiif/3";
		const MANIFEST_BASE_PATH = `${GITHUB_BASE_URL}/iiif/nature/manifests`;
		const IMAGE_BASE_PATH = `${IIIF_BASE_URL}/coins%2Fnature_on_coins%2F`;

		// Local path to the folder containing the image files
		// Adjust this path to match your local setup
		const LOCAL_IMAGE_PATH =
			"/Users/fv/Documents/Lohnarbeit/Brogramming/DSD Numismatik/Material/20250320 All data/Complete_Data/Images_final/nature_on_coins";

		// Define file paths
		const TEMPLATE_PATH = "../manifests/_template-nature.json";
		const DATA_PATH = "../../../data/coins.json";
		const OUTPUT_DIR = "../manifests";

		// Create output directory if it doesn't exist
		try {
			await fs.mkdir(OUTPUT_DIR, { recursive: true });
			console.log(`Ensuring output directory exists: ${OUTPUT_DIR}`);
		} catch (err) {
			if (err.code !== "EEXIST") {
				console.error(`Error creating output directory: ${err.message}`);
				throw err;
			}
		}

		// Function to get image dimensions from a local file
		const getImageDimensions = async (imagePath) => {
			try {
				const metadata = await sharp(imagePath).metadata();
				return {
					width: metadata.width || 1000, // fallback width
					height: metadata.height || 1000, // fallback height
				};
			} catch (error) {
				console.warn(
					`Could not read dimensions for ${imagePath}: ${error.message}`
				);
				// Return default dimensions if image can't be read
				return { width: 1000, height: 1000 };
			}
		};

		// Function to format EDTF date to human-readable German format
		const formatEdtfDateToGerman = (edtfString) => {
			if (!edtfString) return "";

			// Clean up the input string - remove square brackets if present
			let cleanEdtfString = edtfString.replace(/^\[|\]$/g, "");

			// Special handling for negative years and problematic formats
			if (
				cleanEdtfString.includes("-") &&
				!cleanEdtfString.match(/^\d{4}-\d{2}/)
			) {
				// Try custom parsing for negative years and date ranges
				return parseSpecialEdtfFormats(cleanEdtfString);
			}

			try {
				const date = edtf(cleanEdtfString);

				// Try to use the library's built-in German locale support first
				let result = "";

				if (date.type === "Interval") {
					// Handle intervals (date ranges)
					const fromFormatted = formatSingleDateToGerman(date.from);
					const toFormatted = formatSingleDateToGerman(date.to);

					if (!fromFormatted && toFormatted) {
						result = `bis ${toFormatted}`;
					} else if (fromFormatted && !toFormatted) {
						result = `ab ${fromFormatted}`;
					} else if (fromFormatted && toFormatted) {
						result = `${fromFormatted} bis ${toFormatted}`;
					}
				} else {
					// Handle single dates
					result = formatSingleDateToGerman(date);
				}

				return result || edtfString;
			} catch (error) {
				console.warn(
					`Could not parse EDTF date: ${edtfString}, trying special format parsing`,
					error
				);
				return parseSpecialEdtfFormats(cleanEdtfString) || edtfString;
			}
		};

		// Special parser for problematic EDTF formats, especially with negative years
		const parseSpecialEdtfFormats = (edtfString) => {
			// Handle date ranges with negative years like "-299/-200"
			const negativeYearRangeRegex = /^-(\d+)\/-(\d+)$/;
			const match = edtfString.match(negativeYearRangeRegex);

			if (match) {
				const startYear = parseInt(match[1]);
				const endYear = parseInt(match[2]);
				return `${startYear} v. Chr. bis ${endYear} v. Chr.`;
			}

			// Handle single negative years like "-299"
			const singleNegativeYearRegex = /^-(\d+)$/;
			const singleMatch = edtfString.match(singleNegativeYearRegex);

			if (singleMatch) {
				const year = parseInt(singleMatch[1]);
				return `${year} v. Chr.`;
			}

			// Handle mixed ranges (negative to positive) like "-50/50"
			const mixedRangeRegex = /^-(\d+)\/(\d+)$/;
			const mixedMatch = edtfString.match(mixedRangeRegex);

			if (mixedMatch) {
				const startYear = parseInt(mixedMatch[1]);
				const endYear = parseInt(mixedMatch[2]);
				return `${startYear} v. Chr. bis ${endYear} n. Chr.`;
			}

			// Handle date ranges with positive years like "1600/1660"
			const positiveYearRangeRegex = /^(\d+)\/(\d+)$/;
			const positiveMatch = edtfString.match(positiveYearRangeRegex);

			if (positiveMatch) {
				const startYear = parseInt(positiveMatch[1]);
				const endYear = parseInt(positiveMatch[2]);
				return `${startYear} n. Chr. bis ${endYear} n. Chr.`;
			}

			// Handle open start ranges like "../1660"
			if (edtfString.startsWith("../")) {
				const year = edtfString.substring(3);
				return `bis ${year} n. Chr.`;
			}

			// Handle open end ranges like "1600/.."
			if (edtfString.endsWith("/..")) {
				const year = edtfString.substring(0, edtfString.length - 3);
				return `ab ${year} n. Chr.`;
			}

			// If no special format matches, return the original string
			return edtfString;
		};

		// Helper function to format a single date to German
		const formatSingleDateToGerman = (date) => {
			if (!date) return "";

			try {
				// Try to use the library's locale support if available
				if (typeof date.toLocaleString === "function") {
					try {
						// Try German locale first
						let localized = date.toLocaleString("de-DE", {
							year: "numeric",
							month: "long",
							day: "numeric",
						});

						// Add BCE/CE notation and uncertainty markers
						if (date.year < 0) {
							localized =
								localized.replace(/\d+/, Math.abs(date.year)) + " v. Chr.";
						} else {
							localized += " n. Chr.";
						}

						// Add uncertainty/approximation markers
						if (date.uncertain) {
							localized += " (unsicher)";
						} else if (date.approximate) {
							localized += " (ungefähr)";
						}

						return localized;
					} catch (localeError) {
						// Fall back to custom formatting if locale support fails
						console.warn("Locale formatting failed, using custom formatting");
					}
				}

				// Custom German formatting as fallback
				return formatDateCustomGerman(date);
			} catch (error) {
				console.warn("Date formatting error:", error);
				return date.toString();
			}
		};

		// Custom German date formatting (fallback)
		const formatDateCustomGerman = (date) => {
			if (!date) return "";

			const monthNames = [
				"Januar",
				"Februar",
				"März",
				"April",
				"Mai",
				"Juni",
				"Juli",
				"August",
				"September",
				"Oktober",
				"November",
				"Dezember",
			];

			let result = "";

			// Handle BCE dates (negative years)
			const isNegative = date.year < 0;
			const yearAbs = Math.abs(date.year);

			// Build the date string
			if (date.day && date.month) {
				result = `${date.day}. ${monthNames[date.month - 1]} ${yearAbs}`;
			} else if (date.month) {
				result = `${monthNames[date.month - 1]} ${yearAbs}`;
			} else {
				result = `${yearAbs}`;
			}

			// Add BCE/CE notation
			result += isNegative ? " v. Chr." : " n. Chr.";

			// Add uncertainty markers
			if (date.uncertain) {
				result += " (unsicher)";
			} else if (date.approximate) {
				result += " (ungefähr)";
			}

			return result;
		};

		// Read the template and data
		console.log(`Reading template from: ${TEMPLATE_PATH}`);
		console.log(`Reading data from: ${DATA_PATH}`);
		console.log(`Looking for images in: ${LOCAL_IMAGE_PATH}`);

		const templateData = JSON.parse(await fs.readFile(TEMPLATE_PATH, "utf8"));
		const data = JSON.parse(await fs.readFile(DATA_PATH, "utf8"));

		// Process each coin in the data
		let manifestCount = 0;

		// Filter to only include coins with image_selection and nature category
		const natureCoins = data.filter(
			(coin) =>
				coin.DSD_project_info &&
				coin.DSD_project_info.exhibition_category === "nature" &&
				coin.image_selection
		);

		console.log(
			`Found ${natureCoins.length} coins with nature category and image selection`
		);

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
				manifestId = `seq_${String(coinIndex + 1).padStart(3, "0")}`;
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
				if (
					value !== null &&
					value !== undefined &&
					String(value).trim() !== ""
				) {
					// Format arrays as comma-separated strings
					let formattedValue = Array.isArray(value)
						? value.join(", ")
						: String(value);

					newMetadata.push({
						label: { de: [prefix ? `${prefix} ${label}` : label] },
						value: { de: [formattedValue] },
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

				// Add human-readable German date from EDTF using library's locale support
				if (coin.creation_range.EDTF_date) {
					const germanDate = formatEdtfDateToGerman(
						coin.creation_range.EDTF_date
					);
					addMetadata("Datierung", germanDate);
				}

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
				addMetadata(
					"Inventarnummer",
					coin.inventory_relations.inventory_number
				);

				// Handle person information if available
				if (coin.inventory_relations.person_name) {
					const personType = coin.inventory_relations.person_type;
					const personName = coin.inventory_relations.person_name;

					if (
						Array.isArray(personName) &&
						Array.isArray(personType) &&
						personName.length === personType.length
					) {
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
				addMetadata(
					"Standortgeschichte",
					coin.location_in_museum.location_history
				);
			}

			// Add documentation status
			addMetadata(
				"Dokumentation vorhanden",
				coin.documentation_available ? "Ja" : "Nein"
			);

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
				addMetadata(
					"Erwerbungsdatum",
					coin.acquisition_details.acquisition_date
				);
				addMetadata(
					"Erwerbungsvermerk",
					coin.acquisition_details.acquisition_remark
				);
				addMetadata(
					"Erwerbungspreis",
					coin.acquisition_details.acquisition_price
				);
				addMetadata("Wertschätzung", coin.acquisition_details.value_estimate);
				addMetadata(
					"Wertschätzungsbeschreibung",
					coin.acquisition_details.value_estimate_description
				);
			}

			// Add cultural-historical context
			addMetadata(
				"Kulturhistorischer Kontext",
				coin["culture-historical_context"]
			);

			// Add published object description
			addMetadata(
				"Veröffentlichte Objektbeschreibung",
				coin.published_object_description
			);

			// Replace the manifest metadata with our new metadata
			manifest.metadata = newMetadata;

			// Update items (canvases)
			if (manifest.items && manifest.items.length > 0) {
				// Get the front and back image filenames from image_selection
				const frontImage = coin.image_selection.image_front;
				const backImage = coin.image_selection.image_back;

				// Get image dimensions for both front and back images
				const frontImagePath = path.join(LOCAL_IMAGE_PATH, frontImage);
				const backImagePath = path.join(LOCAL_IMAGE_PATH, backImage);

				const frontDimensions = await getImageDimensions(frontImagePath);
				const backDimensions = await getImageDimensions(backImagePath);

				console.log(
					`Front image dimensions: ${frontDimensions.width}x${frontDimensions.height}`
				);
				console.log(
					`Back image dimensions: ${backDimensions.width}x${backDimensions.height}`
				);

				// Get the descriptions, prioritizing description_front and description_back
				// Only fall back to the description array if those are null
				const coinDesc = coin.coin_description || {};
				const descriptions = coinDesc.description || [];

				// For front description: use description_front if not null, otherwise use descriptions[0]
				let frontDescription = "";
				if (
					coinDesc.description_front !== null &&
					coinDesc.description_front !== undefined
				) {
					frontDescription = coinDesc.description_front || "";
				} else if (descriptions.length > 0) {
					frontDescription = descriptions[0] || "";
				}

				// For back description: use description_back if not null, otherwise use descriptions[1]
				let backDescription = "";
				if (
					coinDesc.description_back !== null &&
					coinDesc.description_back !== undefined
				) {
					backDescription = coinDesc.description_back || "";
				} else if (descriptions.length > 1) {
					backDescription = descriptions[1] || "";
				}

				// Canvas names to match the template
				const canvasNames = ["canvas-front", "canvas-back"];
				const images = [frontImage, backImage];
				const canvasDescriptions = [frontDescription, backDescription];
				const imageDimensions = [frontDimensions, backDimensions];
				const sideNames = ["Vorderseite", "Rückseite"];

				// For each canvas in the template, update with the corresponding image
				for (let i = 0; i < manifest.items.length && i < 2; i++) {
					const canvas = manifest.items[i];
					const canvasName = canvasNames[i];
					const imageSrc = images[i];
					const canvasDescription = canvasDescriptions[i];
					const dimensions = imageDimensions[i];
					const sideName = sideNames[i];

					// Update canvas ID and dimensions
					canvas.id = `${MANIFEST_BASE_PATH}/${manifestId}/${canvasName}`;
					canvas.width = dimensions.width;
					canvas.height = dimensions.height;

					// Use canvas-specific description if available, otherwise use default labels
					if (canvasDescription && canvasDescription.trim() !== "") {
						canvas.label = { de: [canvasDescription] };
					} else {
						// Fallback to generic labels if no specific description is available
						canvas.label = { de: [sideName] };
					}

					// Update canvas metadata to show which side of the coin it is
					if (canvas.metadata && canvas.metadata.length > 0) {
						// Update existing metadata
						canvas.metadata[0].label = { de: ["Seite"] };
						canvas.metadata[0].value = { de: [sideName] };
					} else {
						// Create metadata if it doesn't exist
						canvas.metadata = [
							{
								label: { de: ["Seite"] },
								value: { de: [sideName] },
							},
						];
					}

					// Update canvas items (annotation page and annotations)
					if (canvas.items && canvas.items.length > 0) {
						const annoPage = canvas.items[0];
						annoPage.id = `${MANIFEST_BASE_PATH}/${manifestId}/${canvasName}/annotation/page`;

						if (annoPage.items && annoPage.items.length > 0) {
							const annotation = annoPage.items[0];
							annotation.id = `${MANIFEST_BASE_PATH}/${manifestId}/${canvasName}/annotation/image`;

							// Update image body with URL encoded image source and dimensions
							if (annotation.body && imageSrc) {
								// URL encode the image source
								const encodedImageSrc = encodeURIComponent(imageSrc);

								// Construct the image URL
								annotation.body.id = `${IMAGE_BASE_PATH}${encodedImageSrc}/full/max/0/default.jpg`;

								// Update image dimensions
								annotation.body.width = dimensions.width;
								annotation.body.height = dimensions.height;

								if (
									annotation.body.service &&
									annotation.body.service.length > 0
								) {
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
			console.log(
				`  Using original_id: ${manifestId} for manifest ID and filename`
			);
			console.log(`  Added ${manifest.metadata.length} metadata entries`);

			// Log EDTF date conversion if available
			if (coin.creation_range && coin.creation_range.EDTF_date) {
				const edtfDate = coin.creation_range.EDTF_date;
				const germanDate = formatEdtfDateToGerman(edtfDate);
				console.log(`  EDTF date "${edtfDate}" converted to: "${germanDate}"`);
			}

			// Log the image URLs for verification
			if (coin.image_selection.image_front) {
				const encodedFrontImage = encodeURIComponent(
					coin.image_selection.image_front
				);
				console.log(
					`Front Image URL: ${IMAGE_BASE_PATH}${encodedFrontImage}/full/max/0/default.jpg`
				);
			}
			if (coin.image_selection.image_back) {
				const encodedBackImage = encodeURIComponent(
					coin.image_selection.image_back
				);
				console.log(
					`Back Image URL: ${IMAGE_BASE_PATH}${encodedBackImage}/full/max/0/default.jpg`
				);
			}
		}

		console.log(
			`Successfully generated ${manifestCount} manifests in the '${OUTPUT_DIR}' directory.`
		);
	} catch (error) {
		console.error("Error generating manifests:", error);
		process.exit(1);
	}
}

generateManifests();
