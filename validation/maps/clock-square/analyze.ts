import {analyzeMap} from './geometry';
const report=analyzeMap();
console.log(JSON.stringify(report,null,2));
if(!report.valid)process.exitCode=1;
