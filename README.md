# automadicom

automadicom automatically modifies DICOM tag values based on dynamically evaluated rules!

## Using automadicom

![main view](https://raw.githubusercontent.com/quinton-ashley/automadicom-img/master/main_view.png)

This is the main view of automadicom.  Click on a study from the table of studies to view its images.  Select your anonymization options from the option menu at the bottom.  Click `Preview Edits` link below an image to see the effects of your selected options.  Click the green `Start` button and select an output folder to create anonymized copies of all the images in the input folder.

![preview edits](https://raw.githubusercontent.com/quinton-ashley/automadicom-img/master/preview_edits.png)

## User Defaults

Default file location: `~/Documents/automadicom`

## Command Line Usage

The command line programs Git Bash, Terminal, and PowerShell are able to write the path names for you if you drag and drop a file or folder onto their window.  This will save you a lot of time!  
In the example below the `cd` command means change directory.  Using `sudo` will ask you for your password.  Your permission is needed to install automadicom as a global CLI.  After installing you can now use the `automadicom` command to run the script.  
If you are on Windows open up Git Bash and use this format:

```code
/pathTo/automadicom.exe -i '/c/pathTo/imagesDir/or/img.dcm' '/c/optionalPathTo/outputDir'
```

If you are using macOS open up Terminal and use this format:

```code
/Applications/automadicom.app -i /pathTo/imagesDir/or/img.dcm -o /optionalPathTo/outputDir
```

## Sample Config File

You can edit config files in a text editor.

```JSON
{
	"rules": {
		"CurrentPatientLocation": "NA",
		"PatientAddress": "NA",
		"PatientAge": 0,
		"PatientBirthDate": "19000101",
		"PatientBirthName": "Anonymous",
		"PatientBirthTime": "0000",
		"PatientComments": "NA",
		"PatientID": "anonID",
		"PatientIdentityRemoved": "Yes",
		"PatientMotherBirthName": "Anonymous",
		"PatientName": "Anonymous",
		"PatientReligiousPreference": "NA",
		"PatientSex": "NA",
		"PatientSize": 0,
		"PatientTelephoneNumbers": "000-000-0000",
		"PatientTelecomInformation": "NA",
		"PatientWeight": 0
	}
}
```

### Config Editing with Tag Requests

To assign a tag value based on another tag value in the same DICOM file, use a single dollar sign followed by the tag name.  If the tag has been modified by a preceding rule, the tag's new value will be retrieved instead of the tag's original value.  Let's take a look at a generic example:  

```JSON
"rules": {
	"tag0": "$tag1",
	"tag1": "$tag1 + $tag6",
	"tag2": "$tag1"
}
```

The value of `tag0` will be changed to the original value of `tag1`.  The value of `tag1` will be changed to the original value of `tag1` followed by the original value of `tag6` with no spaces in between.  `tag2` will be changed to the new value of `tag1`.  
To specifically request the original value of a modified tag, use two dollar signs.  Here's another generic example:  

```JSON
"rules": {
	"tag0": "$tag1",
	"tag1": "$tag1 + $tag6",
	"tag2": "$tag1 + $$tag0"
}
```

In this example the value of `tag2` will be changed to the new value of `tag1` followed by the original value of `tag0`.  

### Advanced Dynamic Formatting Using JS

Here's a representative rules.csv file that illustrates the dynamic formatting capability of the app using Javascript:  

```JSON
"rules": {
	"replaceValueOfThisTagWith": "$file.base",
	"numberTag": 5,
	"thisTagToo": " $tagX + 'A1' ",
	"anotherTag": " 'prefix' + $tagY.toLowerCase() ",
	"oneMoreTag": " ( ($tagZ.includes('Quinton')) ? 'author' : 'user' ) ",
	"tagAgain": "((a = $PatientID.slice(0,3).match(/(10|20|30)\d/)) ? a[0] : '400')"
}
```

The program dynamically evaluates the replacement values by using the `eval()` function.  If you aren't a Javascript programmer take a look at the powerful methods you can use from the [String object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) and learn about [ternary operators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Conditional_Operator)!  The variable `$file` is the original path of the file, you can get different elements of the file that are parsed by the [node.js path module](https://nodejs.org/api/path.html#path_path_parse_path).  The variable `a` can be useful when using ternary operators.

    ┌─────────────────────┬────────────┐
    │          dir        │    base    │
    ├──────┬              ├──────┬─────┤
    │ root │              │ name │ ext │
    "  /    home/user/dir / file  .txt "
    └──────┴──────────────┴──────┴─────┘

### Organize Output Folders

 automadicom can dynamically structure new folders to append to the specified output directory.  The default `Organize_Output_Folders.csv` file is stored in the `configs` directory.  Here's an advanced example:

```javascript
'nameOfTheFirstLevelFolderToPutInTheOutputDirectory'
'secondLevelFolder'
$youCanPutTagsHereToo
$tag2.trim() + 'youCanAlsoUseJS'
'theLastLineIsTheImageName'
$file.base
```

The example file above will create a four level directory structure with the last line being used as the output file name.  A sequence number is added if you're processing multiple files that would have the same path.  Just as in the rules file, you can use tag requests to name the directories and files.  A single dollar sign will get the new value of the tag if the tag has been modified or the original value if it was not.  Be aware that using two dollar signs will still get the original tag!  
If automadicom encounters an input file with no extension that isn't a DICOM image it will throw an error and report to the user to give the file an extension.  
Here's an example with standard DICOM tags that will create a directory with the PatientID value as the first level directory name, with the Modality as the second level subdirectory name, with the SeriesDescription as the file name.

    $PatientID
    $Modality
    $SeriesDescription

## EULA

automadicom ("THE SOFTWARE") IS PROVIDED AS IS.  IF YOU DO NOT AGREE TO ALL OF THE TERMS OF THIS EULA, DO NOT INSTALL, USE OR COPY THE SOFTWARE. USE THE SOFTWARE AT YOUR OWN RISK.  THE AUTHORS MAKE NO WARRANTIES AS TO PERFORMANCE OR FITNESS FOR A PARTICULAR PURPOSE, OR ANY OTHER WARRANTIES WHETHER EXPRESSED OR IMPLIED. NO ORAL OR WRITTEN COMMUNICATION FROM OR INFORMATION PROVIDED BY THE AUTHORS SHALL CREATE A WARRANTY. UNDER NO CIRCUMSTANCES SHALL THE AUTHORS BE LIABLE FOR DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES RESULTING FROM THE USE, MISUSE, OR INABILITY TO USE THE SOFTWARE, EVEN IF THE AUTHOR HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. THESE EXCLUSIONS AND LIMITATIONS MAY NOT APPLY IN ALL JURISDICTIONS. YOU MAY HAVE ADDITIONAL RIGHTS AND SOME OF THESE LIMITATIONS MAY NOT APPLY TO YOU.

THIS SOFTWARE IS NOT INTENDED FOR PRIMARY DIAGNOSTIC, ONLY FOR SCIENTIFIC USAGE.  automadicom IS NOT CERTIFIED AS A MEDICAL DEVICE FOR PRIMARY DIAGNOSIS. THERE ARE NO CERTIFICATIONS. YOU CAN ONLY USE automadicom AS A REVIEWING AND SCIENTIFIC SOFTWARE, NOT FOR PRIMARY DIAGNOSTIC.
