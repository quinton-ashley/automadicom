# automaDICOM
Automatic DICOM tag value editor that uses dynamically evaluated rules to modify DICOM tag values.
## Installation and Requirements
1. To install automaDICOM you can use git or go to the [GitHub page](https://github.com/quinton-ashley/automaDICOM) and download and extract the ZIP file.  I highly recommend installing both [git](https://git-scm.com/downloads) and the [GitHub Desktop app](https://desktop.github.com/).  This will make updating automaDICOM easy!  You can use all the default install settings.
2. Run the GitHub Desktop app.  You do not need to have a GitHub account or login to use this app, just skip those steps in the setup.  Click on "File" then "Clone Repository" in the toolbar, enter `quinton-ashley/automaDICOM`, and click the "Clone" button.  Look for automaDICOM in the GitHub folder of your Documents folder to verify the installation.  Anytime there is an update you can just open up the GitHub Desktop app and press the "Sync" button on macOS or press "Fetch origin" then "Pull" on Windows.  You'd have to download and extract a ZIP folder from the GitHub page every time you wanted to update if you weren't using git!
3. Node.js and npm are required to run automaDICOM.  Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine.  Node.js' package ecosystem, npm, is the largest ecosystem of open source libraries in the world!  The backbone of this project is the incredible npm package, [DWV](https://github.com/ivmartel/dwv).  Install the LTS version of [Node.js and npm](https://nodejs.org).
4. Windows users must use "Developer Mode" to run automaDICOM.  Type "developer" into the Cortana search bar (right next to the Windows icon in the bottom left in Windows 10) and click on the "For developers settings".  Once the Settings window comes up check the "Developer Mode" option and restart your computer.
5. You must have read/write permission for both the input and output directories given as arguments to automaDICOM.
  
## Input File/Directory Format
The first command line argument to automaDICOM can be either a single image or directory with images or subdirectories that contain images.  This program does not edit any contents of the input file(s) but will add the `.dcm` extension to the file name if the improperly named DICOM file(s) doesn't(don't) have it.
## Rules CSV Format
The rules CSV file tells the program what tag values to change in the DICOM images.  A template `rules.csv` file is provided and stored in the automaDICOM directory in the `usr` folder.  For the rules file, write one rule per line.  The tag and its replacement value must be separated by a semicolon.  Use the exact attribute name of the tag.  
### Simple Example with Static Replacements
Here's a simple example that anonymises the `PatientID`, `PatientName`, and `PatientBirthDate` tag values.
```javascript
PatientID; 'Anonymous'
PatientName; 'Anonymous'
PatientBirthDate; '19000101'
StudyTime; '131313'
PatientWeight;0
```
Note that for a purely numerical sequence to be interpreted as a Number you must not leave a space after the semicolon.  Make sure that the new value that you're trying to assign is consistent with the required format for that DICOM tag.  For example, Dates must be entered as a string not a number.  
At this time only top level tags and the two sub-level tags `CodeMeaning` and `FrameLaterality` can be parsed.
### Advanced Examples with Tag Requests
To assign a tag value based on another tag value in the same DICOM file, use a single dollar sign followed by the tag name.  If the tag has been modified by a preceding rule, the tag's new value will be retrieved instead of the tag's original value.  Let's take a look at a generic example:
```javascript
tag0; $tag1
tag1; $tag1 + $tag55
tag2; $tag1
```
The value of `tag0` will be changed to the original value of `tag1`.  The value of `tag1` will be changed to the original value of `tag1` followed by the original value of `tag55` with no spaces in between.  `tag2` will be changed to the new value of `tag1`.  
To specifically request the original value of a modified tag, use two dollar signs.  Here's another generic example:
```javascript
tag0; $tag1
tag1; $tag1 + $tag55
tag2; $tag1 + $$tag0
```
In this example the value of `tag2` will be changed to the new value of `tag1` followed by the original value of `tag0`.  
### Advanced Example with Dynamic Formatting Using JS
Here's a representative rules.csv file with non-standard DICOM tag attribute names that illustrates the features of this program using Javascript:  
```javascript
replaceValueOfThisTagWith; 'staticText'
numberTag;5
thisTagToo; $dicomTagX + 'A1'
anotherTag; 'prefix' + $dicomTagY.toLowerCase() + $dicomTagZ.slice(0,1)
oneMoreTag; ( ($dicomTagZ.includes('Quinton Ashley')) ? 'author' : 'user' )
```
The program dynamically evaluates the replacement values by using the `eval()` function.  If you aren't a Javascript programmer take a look at the powerful methods you can use from the [String object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) and learn about [ternary operators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Conditional_Operator)!
## Output Directory and File Name Formats
The second command line argument can be an existing or a directory you would like to create that the program has permission and is able to write to.  If no output directory is specified, all modified images will be placed in the same directory as the originals.
### Append CSV Format
`append.csv` is another configuration file like `rules.csv`.  It lets you dynamically name new paths for output directories and files.  A template `append.csv` file is provided and stored in the automaDICOM directory in the `usr` folder.  If an output directory is specified on the command line, the append CSV is used.  Here's a generic example:
```javascript
'nameOfTheFirstLevelFolderToPutInTheOutputDirectory'
'secondLevelFolder'
$youCanPutTagsHereToo
$tag2.trim() + 'youCanAlsoUseJS'
'theLastLineIsTheImageName'
```
The example file above will create a four level directory structure with the last line being used as the output file name.  A sequence number is added if you're processing multiple files that would have the same path.  Just as in the rules file, you can use tag requests to name the directories and files.  A single dollar sign will get the new value of the tag if the tag has been modified or the original value if it was not.  Be aware that using two dollar signs will still get the original tag!  
The `.dcm` extension will automatically be added to the original DICOM file if it does not have an extension.  There is no option to disable this, since not having the `.dcm`extension on a DICOM file is improper.  If automaDICOM encounters an input file with no extension that isn't a DICOM image it will throw an error and report to the user to give the file its proper extension.  
Here's an example with standard DICOM tags that will create a directory with the PatientID value as the first level directory name, with the Modality as the second level subdirectory name, with the SeriesDescription as the file name.
```
$PatientID
$Modality
$SeriesDescription
```
## Running the Script
The command line programs Git Bash, Terminal, and PowerShell are able to write the path names for you if you drag and drop a file or folder onto their window.  This will save you a lot of time!  
In the example below the `cd` command means change directory.  Using `sudo` will ask you for your password.  Your permission is needed to install automaDICOM as a global CLI.  After installing you can now use the `automaDICOM` command to run the script.  
If you are on Windows open up Git Bash and use this format:
```
cd '/c/pathOf/automaDICOM/'
sudo npm i -g
automaDICOM '/c/pathTo/imagesDir/or/img.dcm' '/c/optionalPathTo/outputDir'
```
If you are on Windows and don't have Git Bash, open up PowerShell and use this format:
```
cd "C:\pathOf\automaDICOM"
sudo npm i -g
automaDICOM "C:\pathTo\imagesDir\or\img.dcm" "C:\optionalPathTo\outputDir"
```
If you are on Mac or Linux open up Terminal and use this format:
```
cd /pathOf/automaDICOM/
sudo npm i -g
automaDICOM /pathTo/imagesDir/or/img.dcm /optionalPathTo/outputDir
```
Note that you do not have to specify the paths to the `rules.csv` or `append.csv`.  automaDICOM uses the corresponding files in the `usr` folder automatically so don't move them!  automaDICOM will only use the files with those exact names so if you want to save a rules or append file for later just name it differently, for example `rulesForKnees.csv`.
## EULA

automaDICOM ("THE SOFTWARE") IS PROVIDED AS IS.  IF YOU DO NOT AGREE TO ALL OF THE TERMS OF THIS EULA, DO NOT INSTALL, USE OR COPY THE SOFTWARE. USE THE SOFTWARE AT YOUR OWN RISK.  THE AUTHORS MAKE NO WARRANTIES AS TO PERFORMANCE OR FITNESS FOR A PARTICULAR PURPOSE, OR ANY OTHER WARRANTIES WHETHER EXPRESSED OR IMPLIED. NO ORAL OR WRITTEN COMMUNICATION FROM OR INFORMATION PROVIDED BY THE AUTHORS SHALL CREATE A WARRANTY. UNDER NO CIRCUMSTANCES SHALL THE AUTHORS BE LIABLE FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES RESULTING FROM THE USE, MISUSE, OR INABILITY TO USE THE SOFTWARE, EVEN IF THE AUTHOR HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. THESE EXCLUSIONS AND LIMITATIONS MAY NOT APPLY IN ALL JURISDICTIONS. YOU MAY HAVE ADDITIONAL RIGHTS AND SOME OF THESE LIMITATIONS MAY NOT APPLY TO YOU.

THIS SOFTWARE IS NOT INTENDED FOR PRIMARY DIAGNOSTIC, ONLY FOR SCIENTIFIC USAGE.  automaDICOM IS NOT CERTIFIED AS A MEDICAL DEVICE FOR PRIMARY DIAGNOSIS. THERE ARE NO CERTIFICATIONS. YOU CAN ONLY USE automaDICOM AS A REVIEWING AND SCIENTIFIC SOFTWARE, NOT FOR PRIMARY DIAGNOSTIC.
