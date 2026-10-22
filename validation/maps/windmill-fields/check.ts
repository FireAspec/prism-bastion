import {inspectGeometry} from './geometry';

const report=inspectGeometry();
process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
if(report.errors.length)process.exitCode=1;
