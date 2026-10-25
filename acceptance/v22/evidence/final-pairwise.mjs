import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(fileURLToPath(import.meta.url));
const repo = "C:/Users/sb128/.codex/worktrees/workbench-verification-report/LearningPlatform";
const manifest = readFileSync(join(root,"final-baselines.json"));
const pins = JSON.parse(manifest);
const targets = pins.baselines.filter(item => item.target !== "main");
const out = join(root,"final-pairwise.json");
assert.equal(existsSync(out),false);
const report = {startedAt:new Date().toISOString(),combination:pins.combination,baselinesSha256:createHash("sha256").update(manifest).digest("hex"),method:"Independent textual Git merge-tree checks only; not functional or combined runtime acceptance.",checks:[]};
for(let i=0;i<targets.length;i++) for(let j=i+1;j<targets.length;j++) {
 const left=targets[i],right=targets[j];
 const args=["-C",repo,"merge-tree","--write-tree","--messages",left.sha,right.sha];
 const result=spawnSync("git",args,{encoding:"utf8",windowsHide:true,maxBuffer:8*1024*1024});
 report.checks.push({left:left.target,leftSha:left.sha,right:right.target,rightSha:right.sha,command:["git",...args],exitCode:result.status,error:result.error?.message,result:result.status===0?"textually-clean":result.status===1?"conflict":"command-error",output:(result.stdout??"")+(result.stderr??"")});
}
report.finishedAt=new Date().toISOString();
report.clean=report.checks.filter(c=>c.exitCode===0).length;
report.conflicts=report.checks.filter(c=>c.exitCode===1).length;
report.errors=report.checks.filter(c=>c.exitCode!==0&&c.exitCode!==1).length;
writeFileSync(out,JSON.stringify(report,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({clean:report.clean,conflicts:report.conflicts,errors:report.errors,receipt:out,sha256:createHash("sha256").update(readFileSync(out)).digest("hex")}));
if(report.conflicts||report.errors)process.exitCode=1;
