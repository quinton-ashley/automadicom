# automaDICOM
Automatic DICOM tag value editor that uses dynamically evaluated rules to modify DICOM tag values.
### Installation
1. Click here to go to this app's [GitHub page](https://github.com/quinton-ashley/automaDICOM) (if you're not already reading this there).
2. On the GitHub page, click the green "Clone or Download" button and then click "Download as Zip" or copy the link and use git install if you prefer.
3. You can extract the files to any folder.  If you are on a company computer you do not have to extract to `Program Files` or any other folders you don't have permission to write to.  Note the path name
4. Node.js and npm are required to run automaDICOM.  Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine. Node.js uses an event-driven, non-blocking I/O model that makes it lightweight and efficient. Node.js' package ecosystem, npm, is the largest ecosystem of open source libraries in the world.  The backbone of this project is the incredible npm package, [DWV](https://github.com/ivmartel/dwv).  Install the LTS version of [Node.js and npm](https://nodejs.org).
5. If you are using Windows you must use "Developer Mode" to run automaDICOM.  Type "developer" into the Cortana search bar and click on the "For developers settings".  Once the Settings window comes up check the "Developer Mode" option and restart your computer.
  
### Input File/Directory Format
Accepts either a single image or directory with subdirectories that contain images.  By design the program will not look for images directly in the specified directory.  This program does not edit any contents of the input file(s) but will add the `.dcm` extension if the improperly named DICOM file(s) doesn't(don't) have it.
### Rules CSV Format
```javascript
replaceValueOfThisTagWith; 'staticText'
numberTag;5
thisTagToo; $dicomTagX + 'A1'
anotherTag; 'prefix' + $dicomTagY.toLowerCase() + $dicomTagZ.slice(0,1)
oneMoreTag; ( ($dicomTagZ.includes('Quinton Ashley')) ? 'author' : 'user' )
```
For the rules file, write one rule per line.  The tag and it's replacement value must be separated by a semicolon.  At this time only top level tags and the two sub-level tags `CodeMeaning` and `FrameLaterality` can be parsed.  This program dynamically evaluates the replacement values by using the `eval()` function.  If you aren't a Javascript programmer take a look at the powerful methods you can use from the [String object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) and learn about [ternary operators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Conditional_Operator)!  
Note that for a purely numerical sequence to be interpreted as a Number you must not leave a space after the semicolon.  To request a tag value use a single dollar sign followed by the tag name.  If the tag has been modified by a preceding rule the tag's new value will be retrieved instead of the tag's original value.  Let's take a look at an example:
```javascript
tag0; $tag1
tag1; $tag1 + $tag55
tag2; $tag1
```
The value of `tag0` will be changed to the original value of `tag1`.  The value of tag `tag1` will be changed to the original value of `tag1` followed by the original value of `tag55`.  `tag2` will be changed to the new value of `tag1`.  
To specifically request the original value of a modified tag use two dollar signs.  Here's an example:
```javascript
tag0; $tag1
tag1; $tag1 + $tag55
tag2; $tag1 + $$tag0
```
In this example the value of `tag2` will be changed to the new value of `tag1` followed by the original value of `tag0`.
### Output Directory Format
Accepts an existing or non-existent directory that the program has permission and is able to write to.  If no output directory is specified all modified images will be placed in the same directory as the originals.
### Append CSV Format
```javascript
'nameOfTheFirstLevelFolderToPutInTheOutputDirectory'
'secondLevelFolder'
$youCanPutTagsHereToo
$tag2.trim() + 'youCanAlsoUseJS'
'theLastLineIsTheImageName'
```
If an output directory is specified the append CSV is used.  Just as in the rules file, a single dollar sign will get the new value of the tag if the tag has been modified or the original value if it was not.  Be aware that using two dollar signs will still get the original tag!  The `.dcm` extension will automatically be added to the image name.  There is no option to disable this, not having the `.dcm`extension on a DICOM file is improper.
### Running the Script
Both Powershell and Terminal are able to write the path names for you if you drag and drop a file or folder onto their window.  This will save you a lot of time!  `cd` means change directory.  `node` runs the main script, `main.js`.  
If you are on Windows open up PowerShell and use this format:
```javascript
cd "C:\pathOf\automaDICOM"
node "main.js" "C:\pathTo\imagesDir\or\img.dcm" "C:\optionalPathTo\outputDir"
```
If you are on Mac or Linux open up Terminal and use this format:
```javascript
cd '/pathOf/automaDICOM/'
node 'main.js' '/pathTo/imagesDir/or/img.dcm' '/optionalPathTo/outputDir'
```
Note that you do not have to specify the paths to the `rules.csv` or `append.csv`.  automaDICOM uses the corresponding files in the `usr` folder automatically so don't move them!  automaDICOM will only use the files with those exact names so if you want to save a rules or append file for later just name it differently, for example `rulesForKnees.csv`.
### EULA

automaDICOM ("THE SOFTWARE") IS PROVIDED AS IS.  IF YOU DO NOT AGREE TO ALL OF THE TERMS OF THIS EULA, DO NOT INSTALL, USE OR COPY THE SOFTWARE. USE THE SOFTWARE AT YOUR OWN RISK.  THE AUTHORS MAKE NO WARRANTIES AS TO PERFORMANCE OR FITNESS FOR A PARTICULAR PURPOSE, OR ANY OTHER WARRANTIES WHETHER EXPRESSED OR IMPLIED. NO ORAL OR WRITTEN COMMUNICATION FROM OR INFORMATION PROVIDED BY THE AUTHORS SHALL CREATE A WARRANTY. UNDER NO CIRCUMSTANCES SHALL THE AUTHORS BE LIABLE FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES RESULTING FROM THE USE, MISUSE, OR INABILITY TO USE THE SOFTWARE, EVEN IF THE AUTHOR HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. THESE EXCLUSIONS AND LIMITATIONS MAY NOT APPLY IN ALL JURISDICTIONS. YOU MAY HAVE ADDITIONAL RIGHTS AND SOME OF THESE LIMITATIONS MAY NOT APPLY TO YOU.

THIS SOFTWARE IS NOT INTENDED FOR PRIMARY DIAGNOSTIC, ONLY FOR SCIENTIFIC USAGE.  automaDICOM IS NOT CERTIFIED AS A MEDICAL DEVICE FOR PRIMARY DIAGNOSIS. THERE ARE NO CERTIFICATIONS. YOU CAN ONLY USE automaDICOM AS A REVIEWING AND SCIENTIFIC SOFTWARE, NOT FOR PRIMARY DIAGNOSTIC.