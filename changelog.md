# DBAssistant v0.3.4

## Bugs

- properly notify of error when trying to create history file in inexistant Library path
- forces failure when library path doesn't exist
- fixed logging of currently addid file status to prevent false positive reports
- fixed malformed destination paths for file copies

## Improvements

- Copies files regardless of whether they are inside the library path or noth, obeying only user option

# DBAssistant v0.3.3

## Bugs

- Fixed error when adding files with missing certain metadata fields 

## Features

- Export command now extracts shortcut name from db file if it is not provided
- Command line interfaces for add,deduplicate and export commands (use manual mode)
- new templates command creates json templates to control DBAssistant

## Improvements

- addition history is only created if there were succesful additions
- DB files are created by add if nonexistant


# DBAssistant v0.3.2

## IMPROVEMENTS

- history log files moved to Library directory, in DBA_history folder

## BUGS

- ReferenceError: DBFolder is not defined

# DBAssistant v0.3.1

## FEATURES

- Extracts all fields of metadata from BEXT, iXML, ID3, exif and vorbis tags.
- New metadata extractor without external dependencies

## IMPROVEMENTS

- DBAssistant doesn't depend on config.json anymore
- .ogg, .flac, .aif and .wv formats are now recognized
- Avoid newlines on verbose logging
- More steps are logged to file
  