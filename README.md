# Introduction

Additional data repository for the _HMB Coins_ project, complementing its IIIF image server.
Contains IIIF Representation API manifests, the data and scripts to generate them, as well as other files accompanying its IIIF resources.

# Interview

[/iiif/interview/](./iiif/interview/) contains additional data for the interview with a private coin collector, an [IIIF story](https://www.exhibit.so/exhibits/xDncYM2Z6nUEn9csl2kV) implemented with [Exhibit.so](https://www.exhibit.so/):

- IIIF Representation API [manifests](./iiif/interview/manifests/)
- [data](./iiif/interview/data/) and the [script](./iiif/interview/scripts/generate-manifests.js) to generate the manifests
- [audio files](./iiif/interview/audio/) accompanying the images on the IIIF server, as well as the [script](./iiif/interview/scripts/compress_mp3.sh) to encode them for the web

## Use

- manifests: `npm run generate-manifests` ingests [interview.json](./iiif/interview/data/interview.json) to generate [manifests](./iiif/interview/manifests/), which are then linked to from the Exhibit.so story
- audio files: change into the directory containing the files to be compressed; execute [compress_mp3.sh](./iiif/interview/scripts/compress_mp3.sh); move the resulting files from the `_compressed/` directory to [./iiif/interview/audio/](./iiif/interview/audio/)
