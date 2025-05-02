import fs from "fs/promises";
import path from "path";

async function generateManifests() {
	try {
		// Define common URL patterns as variables
		const GITHUB_BASE_URL =
			"https://raw.githubusercontent.com/brogr/hmb-coins-data/refs/heads/main";
		const IIIF_BASE_URL = "https://philhist-vanuatu.philhist.unibas.ch/iiif/3";
		const MANIFEST_BASE_PATH = `${GITHUB_BASE_URL}/iiif/interview/manifests`;

		// Fix the audio URL to use media.githubusercontent.com instead of raw.githubusercontent.com
		const AUDIO_BASE_URL =
			"https://media.githubusercontent.com/media/brogr/hmb-coins-data/refs/heads/main/iiif/interview/audio";

		const IMAGE_BASE_PATH = `${IIIF_BASE_URL}/coins%2Finterview%2F`;

		// Define the interview prefix
		const INTERVIEW_PREFIX = "Interview mit Münzsammlerin M. Bieri: ";

		// Define file paths
		const TEMPLATE_PATH = "../manifests/_template.json";
		const INTERVIEW_DATA_PATH = "../interview-data.json";
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

		// Read the template and interview data
		console.log(`Reading template from: ${TEMPLATE_PATH}`);
		console.log(`Reading interview data from: ${INTERVIEW_DATA_PATH}`);

		const templateData = JSON.parse(await fs.readFile(TEMPLATE_PATH, "utf8"));
		const interviewData = JSON.parse(
			await fs.readFile(INTERVIEW_DATA_PATH, "utf8")
		);

		// Process each snippet
		let manifestCount = 0;
		for (const [snippetIndex, snippet] of interviewData.snippets.entries()) {
			console.log(`Processing snippet: ${snippet.title}`);

			// Process each image in the snippet
			for (const [imageIndex, image] of snippet.images.entries()) {
				manifestCount++;

				// Create a new manifest based on the template
				const manifest = JSON.parse(JSON.stringify(templateData));

				// Update manifest ID
				const manifestId = `${String(snippetIndex + 1).padStart(
					2,
					"0"
				)}_${String(imageIndex + 1).padStart(2, "0")}`;
				manifest.id = `${MANIFEST_BASE_PATH}/${manifestId}.json`;

				// Create a consistent label, checking if title and description are identical
				let combinedLabel;

				// Check if image has a description and it's not empty
				if (image.description && image.description.trim() !== "") {
					// Check if snippet title and image description are identical
					if (snippet.title === image.description) {
						// If they're identical, just use one of them
						combinedLabel = snippet.title;
					} else {
						// If they're different, format as "Snippet Title – Image Description"
						combinedLabel = `${snippet.title} – ${image.description}`;
					}
				} else {
					// If no image description, just use the snippet title
					combinedLabel = snippet.title;
				}

				// Add prefix to the combined label
				const prefixedLabel = combinedLabel.startsWith(INTERVIEW_PREFIX)
					? combinedLabel
					: INTERVIEW_PREFIX + combinedLabel;

				// Apply the SAME prefixed label to both manifest label and metadata description
				manifest.label = { de: [prefixedLabel] };

				// Update metadata with the SAME prefixed label
				if (manifest.metadata && manifest.metadata.length >= 2) {
					manifest.metadata[1].value = { de: [prefixedLabel] };
				}

				// Get description without prefix for deeper elements
				const description = image.description || snippet.title;

				// Ensure duration is a float
				const durationFloat = parseFloat(image.duration);

				// Update canvas
				if (manifest.items && manifest.items.length > 0) {
					const canvas = manifest.items[0];
					canvas.id = `${MANIFEST_BASE_PATH}/${manifestId}/canvas`;

					// Set duration as float
					canvas.duration = durationFloat;

					// Update accompanying canvas if it exists
					if (canvas.accompanyingCanvas) {
						canvas.accompanyingCanvas.id = `${MANIFEST_BASE_PATH}/${manifestId}/canvas/accompanying`;

						// Use description WITHOUT prefix for deeper elements
						canvas.accompanyingCanvas.label = { de: [description] };

						// Update description in accompanying canvas metadata
						if (
							canvas.accompanyingCanvas.metadata &&
							canvas.accompanyingCanvas.metadata.length > 0
						) {
							canvas.accompanyingCanvas.metadata[0].value = {
								de: [description],
							};
						}

						// Update annotation
						if (
							canvas.accompanyingCanvas.items &&
							canvas.accompanyingCanvas.items.length > 0
						) {
							const annoPage = canvas.accompanyingCanvas.items[0];
							annoPage.id = `${MANIFEST_BASE_PATH}/${manifestId}/canvas/accompanying/annotation/page`;

							if (annoPage.items && annoPage.items.length > 0) {
								const annotation = annoPage.items[0];
								annotation.id = `${MANIFEST_BASE_PATH}/${manifestId}/canvas/accompanying/annotation/image`;

								// Use description WITHOUT prefix
								annotation.label = { de: [description] };

								// Update description in annotation metadata
								if (annotation.metadata && annotation.metadata.length > 0) {
									annotation.metadata[0].value = { de: [description] };
								}

								// Update image body
								if (annotation.body) {
									annotation.body.id = `${IMAGE_BASE_PATH}${image.src}/full/max/0/default.jpg`;

									if (
										annotation.body.service &&
										annotation.body.service.length > 0
									) {
										annotation.body.service[0].id = `${IMAGE_BASE_PATH}${image.src}`;
									}
								}

								annotation.target = canvas.accompanyingCanvas.id;
							}
						}
					}

					// Update canvas items
					if (canvas.items && canvas.items.length > 0) {
						const annoPage = canvas.items[0];
						annoPage.id = `${MANIFEST_BASE_PATH}/${manifestId}/canvas/annopage`;

						if (annoPage.items && annoPage.items.length > 0) {
							const annotation = annoPage.items[0];
							annotation.id = `${MANIFEST_BASE_PATH}/${manifestId}/canvas/annopage/annotation`;

							// Use description WITHOUT prefix
							annotation.label = { de: [description] };

							// Update audio body
							if (annotation.body) {
								// Fix the MP3 URL to use the correct format
								annotation.body.id = `${AUDIO_BASE_URL}/${image.fileName}`;

								// Set duration as float
								annotation.body.duration = durationFloat;
							}

							annotation.target = canvas.id;
						}
					}
				}

				// Write manifest to file
				const manifestPath = path.join(OUTPUT_DIR, `${manifestId}.json`);
				await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
				console.log(
					`Created manifest: ${manifestPath} with label: "${prefixedLabel}"`
				);

				// Log the audio URL for verification
				if (image.fileName) {
					console.log(`Audio URL: ${AUDIO_BASE_URL}/${image.fileName}`);
				}
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
