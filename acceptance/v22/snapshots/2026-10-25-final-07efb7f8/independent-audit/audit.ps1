$ErrorActionPreference='Stop'
Set-Location 'C:/Users/sb128/Desktop/LearningPlatform'
$auditRoot='C:/Users/sb128/.codex/visualizations/2026/10/25/01a173d6-e789-7233-92d2-b0b55d4559ed/independent-audit'
$env:GIT_OBJECT_DIRECTORY="$auditRoot/objects"
$env:GIT_ALTERNATE_OBJECT_DIRECTORIES='C:/Users/sb128/Desktop/LearningPlatform/.git/objects'
$env:GIT_AUTHOR_NAME='Independent Acceptance Audit'
$env:GIT_AUTHOR_EMAIL='acceptance@example.invalid'
$env:GIT_COMMITTER_NAME=$env:GIT_AUTHOR_NAME
$env:GIT_COMMITTER_EMAIL=$env:GIT_AUTHOR_EMAIL
$env:GIT_AUTHOR_DATE='2026-10-25T16:00:00Z'
$env:GIT_COMMITTER_DATE=$env:GIT_AUTHOR_DATE
$main='723ed6fea41138b604a9d333ebcd4a07b2202c36'
$inputs=@(
 @{pr=116; sha='94e4e534ea4d68d86ea0810067497bf07258e6d2'},
 @{pr=120; sha='435ccbc94c42a59993568e0252c777c5acb42c53'},
 @{pr=117; sha='a615b9743a0b4e08562428771e2c84f62c97888f'},
 @{pr=118; sha='1bad60ce76b4d1a11f044f1edb020f07ee3ab22f'},
 @{pr=123; sha='76ae36bbf32383d3794d54591c0bfe33013e031d'},
 @{pr=124; sha='1cd41adf53a81bab6bf0491eb0d6aee7488f19cf'},
 @{pr=113; sha='71898a8a72908577065bcc7c7fb9035d6cc29ebf'}
)
$ancestry=@()
$pairs=@()
for($i=0;$i -lt $inputs.Count;$i++) {
 $a=$inputs[$i]
 git merge-base --is-ancestor $main $a.sha
 $ancestry+=@{ancestor='main'; descendant=$a.pr; isAncestor=($LASTEXITCODE -eq 0); mergeBase=(& git merge-base $main $a.sha)}
 for($j=$i+1;$j -lt $inputs.Count;$j++) {
  $b=$inputs[$j]
  git merge-base --is-ancestor $a.sha $b.sha
  $isAncestor=$LASTEXITCODE -eq 0
  $mb=& git merge-base $a.sha $b.sha
  $ancestry+=@{ancestor=$a.pr; descendant=$b.pr; isAncestor=$isAncestor; mergeBase=$mb}
  $out=@(& git merge-tree --write-tree $a.sha $b.sha 2>&1 | ForEach-Object {"$_"})
  $code=$LASTEXITCODE
  $pairs+=@{left=$a.pr; right=$b.pr; exitCode=$code; tree=$out[0]; output=$out}
 }
}
$current=$main
$steps=@()
foreach($a in $inputs) {
 $out=@(& git merge-tree --write-tree $current $a.sha 2>&1 | ForEach-Object {"$_"})
 $code=$LASTEXITCODE
 $tree=$out[0]
 if($code -ne 0) { $steps+=@{pr=$a.pr; before=$current; exitCode=$code; output=$out}; break }
 $commit=& git commit-tree $tree -p $current -p $a.sha -m "Independent recomposition PR $($a.pr)"
 if($LASTEXITCODE -ne 0) { throw 'commit-tree failed' }
 $steps+=@{pr=$a.pr; before=$current; input=$a.sha; tree=$tree; commit=$commit; exitCode=$code; output=$out}
 $current=$commit
}
$finalTree=& git rev-parse "$current^{tree}"
$report=@{main=$main; inputs=$inputs; ancestry=$ancestry; pairs=$pairs; steps=$steps; finalCommit=$current; finalTree=$finalTree; commands=@('git merge-base --is-ancestor <left> <right>','git merge-base <left> <right>','git merge-tree --write-tree <left> <right>','git commit-tree <tree> -p <combined> -p <input> -m <audit-message>'); isolation=@{objectDirectory=$env:GIT_OBJECT_DIRECTORY; alternateObjects=$env:GIT_ALTERNATE_OBJECT_DIRECTORIES; worktreeModified=$false; refsModified=$false}}
$report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "$auditRoot/composition.json" -Encoding utf8
@{finalTree=$finalTree; finalCommit=$current; completed=$steps.Count; pairCount=$pairs.Count; pairConflicts=@($pairs | Where-Object exitCode -ne 0); steps=$steps} | ConvertTo-Json -Depth 8
