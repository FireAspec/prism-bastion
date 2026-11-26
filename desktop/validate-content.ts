import {loadContent,validateContent} from '../src/content';
const config=loadContent();
const errors=validateContent(config);
if(errors.length){for(const error of errors)console.error(error);process.exitCode=1;}
else console.log('Content validation passed.');
