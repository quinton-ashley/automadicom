# automaDICOM

```
cd /pathOf/automaDICOM
node main.js /pathTo/imagesDir/or/img.dcm usr/rules.csv /pathTo/outputDir usr/append.csv
```
### Input Directory Format
Accepts either a single image or a directory with subdirectories that contain images.  By design the program will look in all subdirectories of the specified directory for images but does not look directly in the specified directory for images.
### Rules CSV Format
```javascript
replaceValueOfThisTagWith; 'staticText'
additionalTag; 1996
thisTagToo; $dicomTagX + 'A1'
anotherTag; 'prefix' + $dicomTagY.toLowerCase() + $dicomTagZ.slice(0,1)
oneMoreTag; ( ($dicomTagZ.includes('Quinton Ashley')) ? 'author' : 'user' )
```
The tag and the replacement value must be separated by semicolons.  This program dynamically evaluates the replacement values by using the `eval()` function.  If you aren't a Javascript programmer take a look at the powerful methods you can use from the [String object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) and learn about [ternary operators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Conditional_Operator)!  To request a tag value use a single dollar sign followed by the tag name.  If the tag has been modified by a preceding rule the tag's new value will be retrieved instead of the tag's original value.  Let's take a look at an example:
```javascript
tag0; $tag1
tag1; $tag1 + $tag55
tag2; $tag1
```
`tag0` will be changed to the original value of `tag1`.  `tag1` will be changed to the original value of `tag1` followed by the original value of `tag55`.  `tag2` will be changed to the modified value of `tag1`.  
To specifically request the original value of a modified tag use two dollar signs.  Here's an example:
```javascript
tag0; $tag1
tag1; $tag1 + $tag55
tag2; $tag1 + $$tag0
```
`tag2` will get the new value of `tag1` and the original value of `tag0`.
### Output Directory Format
Accepts an existing or non-existent directory that the program is able to write to.  If no output directory is specified all modified images will be placed in the same directory as the originals.  If no append CSV is specified all modified images will be placed in the output directory.
### Append CSV Format
```javascript
'nameOfTheFirstLevelFolderToPutInTheOutputDirectory'
'secondLevelFolder'
$youCanPutTagsHereToo
$tag2.trim() + 'youCanAlsoUseJS'
'theLastLineIsTheImageName'
```
Just as in the rules file, a single dollar sign will get the modified value of the tag if the tag has been modified or the original value if it was not.  Be aware that two dollar signs will still get the original tag!
### EULA

automaDICOM ("THE SOFTWARE") IS PROVIDED AS IS.  IF YOU DO NOT AGREE TO ALL OF THE TERMS OF THIS EULA, DO NOT INSTALL, USE OR COPY THE SOFTWARE. USE THE SOFTWARE AT YOUR OWN RISK.  THE AUTHORS MAKE NO WARRANTIES AS TO PERFORMANCE OR FITNESS FOR A PARTICULAR PURPOSE, OR ANY OTHER WARRANTIES WHETHER EXPRESSED OR IMPLIED. NO ORAL OR WRITTEN COMMUNICATION FROM OR INFORMATION PROVIDED BY THE AUTHORS SHALL CREATE A WARRANTY. UNDER NO CIRCUMSTANCES SHALL THE AUTHORS BE LIABLE FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES RESULTING FROM THE USE, MISUSE, OR INABILITY TO USE THE SOFTWARE, EVEN IF THE AUTHOR HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. THESE EXCLUSIONS AND LIMITATIONS MAY NOT APPLY IN ALL JURISDICTIONS. YOU MAY HAVE ADDITIONAL RIGHTS AND SOME OF THESE LIMITATIONS MAY NOT APPLY TO YOU.

THIS SOFTWARE IS NOT INTENDED FOR PRIMARY DIAGNOSTIC, ONLY FOR SCIENTIFIC USAGE.  automaDICOM IS NOT CERTIFIED AS A MEDICAL DEVICE FOR PRIMARY DIAGNOSIS. THERE ARE NO CERTIFICATIONS. YOU CAN ONLY USE automaDICOM AS A REVIEWING AND SCIENTIFIC SOFTWARE, NOT FOR PRIMARY DIAGNOSTIC.